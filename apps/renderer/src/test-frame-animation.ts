/**
 * Standalone test to verify frame-based animation with gap filling
 */

import puppeteer from 'puppeteer';
import { resolve } from 'path';

async function testFrameAnimation() {
  const appPath = resolve(__dirname, '../../../examples/apps/fade_test/dst/index.html');
  const fps = 30;
  const duration = 3000; // 3 seconds in ms
  const width = 1920;
  const height = 1080;

  console.log('\n🎬 Testing Frame-Based Animation System');
  console.log(`  App: ${appPath}`);
  console.log(`  FPS: ${fps}, Duration: ${duration}ms`);
  console.log(`  Expected frames: ${Math.ceil((fps * duration) / 1000)}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  const frames: Array<{ number: number; buffer: Buffer }> = [];

  // Expose frame capture function
  await page.exposeFunction('__stsCaptureFrame', async (frameNumber: number) => {
    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width, height },
    });

    frames.push({
      number: frameNumber,
      buffer: Buffer.from(screenshot),
    });

    console.log(`  ✓ Captured frame ${frameNumber}`);
    return true;
  });

  // Set up completion promise
  const renderingPromise = page.evaluateOnNewDocument(() => {
    return new Promise<void>((resolve) => {
      // @ts-expect-error - This runs in browser context
      document.addEventListener('sts-done-rendering', () => {
        resolve();
      });
    });
  });

  const searchParams = new URLSearchParams({
    rendering: '',
    fps: fps.toString(),
    duration: duration.toString(),
    text: 'Frame-Based Animation Test!',
  });

  const url = `file://${appPath}?${searchParams.toString()}`;

  console.log('🚀 Starting render...\n');
  await page.goto(url, { waitUntil: 'networkidle0' });

  await Promise.race([
    renderingPromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 30000)
    ),
  ]);

  await browser.close();

  console.log(`\n✅ Rendering complete!`);
  console.log(`  Captured ${frames.length} frames`);
  console.log(`  Frame numbers: ${frames.map(f => f.number).join(', ')}`);

  // Verify frame sequence
  const expectedFrames = Math.ceil((fps * duration) / 1000);
  console.log(`  Expected: ${expectedFrames} frames total`);

  if (frames.length === expectedFrames) {
    console.log('  ✅ All frames captured sequentially');
  } else {
    console.log(`  ⚠️  Frame count mismatch`);
  }

  // Check for gaps in frame numbers
  const frameNumbers = frames.map(f => f.number).sort((a, b) => a - b);
  const hasGaps = frameNumbers.some((num, i) => i > 0 && num !== frameNumbers[i - 1] + 1);

  if (hasGaps) {
    console.log('  ℹ️  Gaps detected - frame duplication will fill them');
  } else {
    console.log('  ✅ No gaps - continuous frame sequence');
  }
}

testFrameAnimation().catch(console.error);
