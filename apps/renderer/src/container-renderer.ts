import puppeteer from 'puppeteer';
import { writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { Container } from './type';

export interface RenderContainerOptions {
  container: Container;
  cssText: string;
  width: number;
  height: number;
  projectDir: string;
  outputName: string;
}

export interface ContainerRenderResult {
  container: Container;
  screenshotPath: string;
}

/**
 * Generates a hash from container content, CSS, and output name
 */
function generateCacheKey(
  containerHtml: string,
  cssText: string,
  outputName: string,
): string {
  const hash = createHash('sha256');
  hash.update(containerHtml);
  hash.update(cssText);
  hash.update(outputName);
  return hash.digest('hex').substring(0, 16);
}

/**
 * Renders a container to a PNG screenshot using Puppeteer
 */
export async function renderContainer(
  options: RenderContainerOptions,
): Promise<ContainerRenderResult> {
  const { container, cssText, width, height, projectDir, outputName } = options;

  // Create cache directory
  const cacheDir = resolve(projectDir, 'cache', 'containers');
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }

  // Generate cache key from content hash
  const cacheKey = generateCacheKey(container.htmlContent, cssText, outputName);
  const screenshotPath = resolve(cacheDir, `${cacheKey}.png`);

  // Check if cached version exists
  if (existsSync(screenshotPath)) {
    console.log(
      `Using cached container "${container.id}" (hash: ${cacheKey}) from ${screenshotPath}`,
    );
    return {
      container,
      screenshotPath,
    };
  }

  // Build complete HTML document
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: transparent;
      font-size: 16px;
    }
    ${cssText}
  </style>
</head>
<body>
  ${container.htmlContent}
</body>
</html>
  `.trim();

  // Launch browser and render
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Take screenshot with transparent background
    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: {
        x: 0,
        y: 0,
        width,
        height,
      },
    });

    // Save to file
    await writeFile(screenshotPath, screenshot);

    console.log(
      `Rendered container "${container.id}" (hash: ${cacheKey}) to ${screenshotPath}`,
    );

    return {
      container,
      screenshotPath,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Cleans up stale cache entries that are not in the active set
 */
async function cleanupStaleCache(
  cacheDir: string,
  activeCacheKeys: Set<string>,
): Promise<void> {
  if (!existsSync(cacheDir)) {
    return;
  }

  const files = await readdir(cacheDir);
  const pngFiles = files.filter((file) => file.endsWith('.png'));

  let removedCount = 0;
  for (const file of pngFiles) {
    const cacheKey = file.replace('.png', '');
    if (!activeCacheKeys.has(cacheKey)) {
      const filePath = resolve(cacheDir, file);
      await unlink(filePath);
      console.log(`Removed stale cache entry: ${file}`);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} stale cache entries`);
  }
}

/**
 * Renders multiple containers in sequence
 */
export async function renderContainers(
  containers: Container[],
  cssText: string,
  width: number,
  height: number,
  projectDir: string,
  outputName: string,
): Promise<ContainerRenderResult[]> {
  const results: ContainerRenderResult[] = [];
  const activeCacheKeys = new Set<string>();

  // Render all containers and collect active cache keys
  for (const container of containers) {
    const cacheKey = generateCacheKey(
      container.htmlContent,
      cssText,
      outputName,
    );
    activeCacheKeys.add(cacheKey);

    const result = await renderContainer({
      container,
      cssText,
      width,
      height,
      projectDir,
      outputName,
    });
    results.push(result);
  }

  // Clean up stale cache entries
  const cacheDir = resolve(projectDir, 'cache', 'containers');
  await cleanupStaleCache(cacheDir, activeCacheKeys);

  return results;
}
