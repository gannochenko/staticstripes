import puppeteer, { Browser } from "puppeteer";
import { writeFile, mkdir, rm } from "fs/promises";
import { resolve, isAbsolute, dirname } from "path";
import { existsSync } from "fs";
import { createHash } from "crypto";
import { execSync } from "child_process";

export type App = {
  id: string;
  src: string; // path to the app's dst directory (relative to project)
  parameters: Record<string, string>; // extra params from data-parameters
};

export type AppRenderResult = {
  app: App;
  mode: "static" | "animated";
  path: string; // either .png (static) or .apng (animated with alpha)

  // Animated mode only:
  frameCount?: number;
  duration?: number; // ms - actual captured duration
  fps?: number; // calculated from frame timing
};

const RENDER_TIMEOUT_MS = 300000; // 5 minutes for animated apps with many frames

export interface RenderAppOptions {
  app: App;
  width: number;
  height: number;
  projectDir: string;
  outputName: string;
  title: string;
  date?: string;
  tags: string[];
  fps: number; // From Output definition
  duration: number; // From Fragment duration (in milliseconds)
  browser?: Browser; // optional shared browser instance
}

function generateAppCacheKey(
  src: string,
  parameters: Record<string, string>,
  title: string,
  date: string | undefined,
  tags: string[],
  outputName: string,
  fps: number,
  duration: number,
): string {
  const hash = createHash("sha256");
  hash.update(src);
  hash.update(JSON.stringify(parameters));
  hash.update(title);
  hash.update(date ?? "");
  hash.update(tags.join(","));
  hash.update(outputName);
  hash.update(fps.toString());
  hash.update(duration.toString());
  return hash.digest("hex").substring(0, 16);
}

/**
 * Merges a sequence of PNG frames into an MP4 video using FFmpeg
 */
async function mergeFramesToVideo(
  capturedFrames: Array<{ number: number; buffer: Buffer }>,
  outputPath: string,
  fps: number,
  width: number,
  height: number,
  duration: number,
): Promise<void> {
  const tempDir = resolve(dirname(outputPath), `temp_frames_${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    // Calculate how many output frames we need for the full duration
    const totalFrames = Math.ceil((duration / 1000) * fps);

    console.log(
      `\nDuplicating ${capturedFrames.length} captured frames to ${totalFrames} output frames`,
    );
    console.log(
      `  Captured frame numbers: ${capturedFrames.map((f) => f.number).join(", ")}`,
    );

    // Sort captured frames by frame number (just in case they arrived out of order)
    capturedFrames.sort((a, b) => a.number - b.number);

    // Build output frame sequence by filling gaps between captured frames
    const outputFrames: Buffer[] = [];
    let captureIndex = 0;

    for (let i = 0; i < totalFrames; i++) {
      // Find the most recent captured frame at or before frame i
      while (
        captureIndex < capturedFrames.length - 1 &&
        capturedFrames[captureIndex + 1].number <= i
      ) {
        captureIndex++;
      }

      outputFrames.push(capturedFrames[captureIndex].buffer);
    }

    console.log(`  Frame duplication map:`);
    let currentCaptureIndex = 0;
    let rangeStart = 0;
    for (let i = 0; i <= totalFrames; i++) {
      if (
        i === totalFrames ||
        (currentCaptureIndex < capturedFrames.length - 1 &&
          capturedFrames[currentCaptureIndex + 1].number <= i)
      ) {
        const rangeEnd = i - 1;
        if (rangeStart <= rangeEnd) {
          console.log(
            `    Frames ${rangeStart}-${rangeEnd}: use capture #${capturedFrames[currentCaptureIndex].number}`,
          );
        }
        rangeStart = i;
        if (
          currentCaptureIndex < capturedFrames.length - 1 &&
          capturedFrames[currentCaptureIndex + 1].number <= i
        ) {
          currentCaptureIndex++;
        }
      }
    }

    // Write duplicated frames to temp directory
    const padding = totalFrames.toString().length;
    for (let i = 0; i < outputFrames.length; i++) {
      const frameNum = i.toString().padStart(padding, "0");
      await writeFile(
        resolve(tempDir, `frame_${frameNum}.png`),
        outputFrames[i],
      );
    }

    // Merge with FFmpeg
    // Using APNG (Animated PNG) codec which natively supports alpha transparency
    const ffmpegCmd = [
      "ffmpeg",
      "-framerate",
      fps.toString(),
      "-i",
      resolve(tempDir, `frame_%0${padding}d.png`),
      "-c:v",
      "apng", // APNG codec with native RGBA support
      "-plays",
      "0", // Loop indefinitely
      "-vf",
      `scale=${width}:${height}`, // Scale only - APNG preserves alpha automatically
      "-y",
      outputPath,
    ].join(" ");

    console.log(
      `\nMerging ${outputFrames.length} frames to video: ${ffmpegCmd}`,
    );
    execSync(ffmpegCmd, { stdio: "inherit" });
  } finally {
    // Cleanup temp frames
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Renders a React (or any SPA) app using an event-driven approach.
 *
 * The app can emit:
 * - 'sts-capture-frame' events: Request frame capture (for animated apps)
 * - 'sts-done-rendering' event: Signal rendering complete
 *
 * If no frames are captured, produces a static PNG.
 * If frames are captured, merges them into an MP4 video.
 */
export async function renderApp(
  options: RenderAppOptions,
): Promise<AppRenderResult> {
  const {
    app,
    width,
    height,
    projectDir,
    outputName,
    title,
    date,
    tags,
    fps,
    duration,
    browser: sharedBrowser,
  } = options;

  // Create cache directory organized by app ID
  const cacheDir = resolve(projectDir, "cache", app.id);
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }

  // Generate cache key from all inputs that affect output
  const cacheKey = generateAppCacheKey(
    app.src,
    app.parameters,
    title,
    date,
    tags,
    outputName,
    fps,
    duration,
  );

  // Check cache for APNG (used for both static and animated to preserve alpha)
  const cachedApng = resolve(cacheDir, `${cacheKey}.apng`);

  if (existsSync(cachedApng)) {
    console.log(
      `Using cached app "${app.id}" (hash: ${cacheKey}) from ${cachedApng}`,
    );
    // TODO: Extract metadata from video (frameCount, duration, fps)
    return {
      app,
      mode: "animated",
      path: cachedApng,
    };
  }

  // Resolve index.html
  const appDir = isAbsolute(app.src) ? app.src : resolve(projectDir, app.src);
  const indexPath = resolve(appDir, "index.html");

  if (!existsSync(indexPath)) {
    throw new Error(`App "${app.id}": index.html not found at ${indexPath}`);
  }

  // Build URL with query parameters including fps and duration
  const searchParams = new URLSearchParams({ rendering: "" });
  searchParams.set("fps", fps.toString());
  searchParams.set("duration", duration.toString());
  searchParams.set("title", title);
  if (date) searchParams.set("date", date);
  if (tags.length > 0) searchParams.set("tags", tags.join(","));
  for (const [key, value] of Object.entries(app.parameters)) {
    searchParams.set(key, value);
  }

  const url = `file://${indexPath}?${searchParams.toString()}`;

  console.log(`\nRendering app "${app.id}" from ${url}`);
  console.log(`  FPS: ${fps}, Duration: ${duration}ms`);
  console.log(`  Parameters:`, app.parameters);

  const ownBrowser = sharedBrowser
    ? null
    : await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        protocolTimeout: 120000, // 2 minutes for screenshot operations
      });
  const browser = sharedBrowser ?? ownBrowser!;

  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height });

    // Inject CSS before page load to ensure transparent background and consistent rem sizing
    await page.evaluateOnNewDocument(() => {
      // Wait for DOM to be ready
      const injectStyles = () => {
        // @ts-expect-error - document exists in browser context
        if (!document.documentElement) {
          // DOM not ready yet, try again on next tick
          setTimeout(injectStyles, 0);
          return;
        }

        // @ts-expect-error - This runs in browser context
        const style = document.createElement("style");
        style.textContent = `
          html { font-size: 16px !important; }
          * { background: transparent !important; }
          html, body { background: transparent !important; }
        `;
        // @ts-expect-error - This runs in browser context
        const target = document.head || document.documentElement;
        target.appendChild(style);
      };

      // @ts-expect-error - This runs in browser context
      if (document.readyState === 'loading') {
        // @ts-expect-error - This runs in browser context
        document.addEventListener('DOMContentLoaded', injectStyles);
      } else {
        injectStyles();
      }
    });

    page.on("console", (msg) =>
      console.log(`[app:${app.id}] console.${msg.type()}: ${msg.text()}`),
    );
    page.on("pageerror", (err) =>
      console.error(`[app:${app.id}] page error: ${String(err)}`),
    );
    page.on("requestfailed", (req) =>
      console.error(
        `[app:${app.id}] request failed: ${req.url()} — ${req.failure()?.errorText}`,
      ),
    );

    const frames: Array<{ number: number; buffer: Buffer }> = [];

    // Expose frame capture function that apps can call with explicit frame numbers
    // This returns a promise that resolves when screenshot is complete (ACK)
    await page.exposeFunction(
      "__stsCaptureFrame",
      async (frameNumber: number) => {
        console.log(`[app:${app.id}] 🎬 Starting capture frame ${frameNumber}...`);
        const screenshot = await page.screenshot({
          type: "png",
          omitBackground: true,
          clip: { x: 0, y: 0, width, height },
        });

        frames.push({
          number: frameNumber,
          buffer: Buffer.from(screenshot),
        });
        console.log(
          `[app:${app.id}] ✅ Captured frame ${frameNumber} (${frames.length} total)`,
        );

        // Promise resolution is the ACK!
        return true;
      },
    );

    // Create a promise that will be resolved when rendering completes
    let renderingCompleteResolve: () => void;
    const renderingPromise = new Promise<void>((resolve) => {
      renderingCompleteResolve = resolve;
    });

    // Expose a function that the page can call when rendering is complete
    await page.exposeFunction("__stsNotifyRenderComplete", () => {
      renderingCompleteResolve();
    });

    // Set up event listener and backward compatibility BEFORE navigation
    await page.evaluateOnNewDocument(() => {
      const setupEventListeners = () => {
        // @ts-expect-error - document exists in browser context
        if (!document) {
          setTimeout(setupEventListeners, 0);
          return;
        }

        // Set up listener for 'sts-done-rendering' event
        // @ts-expect-error - This runs in browser context
        document.addEventListener("sts-done-rendering", () => {
          // @ts-expect-error - This is the exposed function
          window.__stsNotifyRenderComplete();
        });

        // For backward compatibility with old apps using window.__stsRenderComplete
        // @ts-expect-error - This runs in browser context
        Object.defineProperty(window, "__stsRenderComplete", {
          set: (value: boolean) => {
            if (value === true) {
              // @ts-expect-error - This runs in browser context
              document.dispatchEvent(new CustomEvent("sts-done-rendering"));
            }
          },
          get: () => false,
        });
      };

      // @ts-expect-error - This runs in browser context
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        // @ts-expect-error - This runs in browser context
        document.addEventListener('DOMContentLoaded', setupEventListeners);
      } else {
        setupEventListeners();
      }
    });

    await page.goto(url, { waitUntil: "networkidle0" });

    await Promise.race([
      renderingPromise,
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `App "${app.id}" did not signal completion within ${RENDER_TIMEOUT_MS}ms`,
              ),
            ),
          RENDER_TIMEOUT_MS,
        ),
      ),
    ]);

    // Determine mode and save
    if (frames.length === 0) {
      // Static mode - take a single screenshot and convert to APNG for proper alpha handling
      console.log(`App "${app.id}" is static (no frames captured)`);

      const screenshot = await page.screenshot({
        type: "png",
        omitBackground: true,
        clip: { x: 0, y: 0, width, height },
      });

      // Convert single PNG frame to APNG for FFmpeg compatibility with alpha
      const tempPng = resolve(cacheDir, `temp_${cacheKey}.png`);
      await writeFile(tempPng, screenshot);

      try {
        // Create 1-frame APNG using FFmpeg
        const ffmpegCmd = [
          "ffmpeg",
          "-i",
          tempPng,
          "-c:v",
          "apng", // APNG codec with native RGBA support
          "-plays",
          "0", // Loop indefinitely
          "-y",
          cachedApng,
        ].join(" ");

        console.log(`Converting static screenshot to APNG: ${ffmpegCmd}`);
        execSync(ffmpegCmd, { stdio: "inherit" });
      } finally {
        // Cleanup temp file
        await rm(tempPng, { force: true });
      }

      console.log(
        `Rendered static app "${app.id}" (hash: ${cacheKey}) to ${cachedApng}`,
      );

      return {
        app,
        mode: "static",
        path: cachedApng,
      };
    } else {
      // Animated mode - merge frames to video
      console.log(
        `App "${app.id}" is animated (${frames.length} frames captured)`,
      );

      const firstFrame = frames[0].number;
      const lastFrame = frames[frames.length - 1].number;
      console.log(`  Frame range: ${firstFrame} to ${lastFrame}`);

      await mergeFramesToVideo(
        frames,
        cachedApng,
        fps,
        width,
        height,
        duration,
      );

      console.log(
        `Rendered animated app "${app.id}" (hash: ${cacheKey}) to ${cachedApng}`,
      );

      return {
        app,
        mode: "animated",
        path: cachedApng,
        frameCount: frames.length,
        duration,
        fps,
      };
    }
  } finally {
    await page.close();
    if (ownBrowser) await ownBrowser.close();
  }
}
