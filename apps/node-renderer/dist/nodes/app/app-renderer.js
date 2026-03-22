"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderApp = renderApp;
const puppeteer_1 = __importDefault(require("puppeteer"));
const promises_1 = require("fs/promises");
const path_1 = require("path");
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const RENDER_TIMEOUT_MS = 30000; // Increased for animated apps
function generateAppCacheKey(src, parameters, title, date, tags, outputName, fps, duration) {
    const hash = (0, crypto_1.createHash)("sha256");
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
async function mergeFramesToVideo(capturedFrames, outputPath, fps, width, height, duration) {
    const tempDir = (0, path_1.resolve)((0, path_1.dirname)(outputPath), `temp_frames_${Date.now()}`);
    await (0, promises_1.mkdir)(tempDir, { recursive: true });
    try {
        // Calculate how many output frames we need for the full duration
        const totalFrames = Math.ceil((duration / 1000) * fps);
        console.log(`\nDuplicating ${capturedFrames.length} captured frames to ${totalFrames} output frames`);
        console.log(`  Captured frame numbers: ${capturedFrames.map((f) => f.number).join(", ")}`);
        // Sort captured frames by frame number (just in case they arrived out of order)
        capturedFrames.sort((a, b) => a.number - b.number);
        // Build output frame sequence by filling gaps between captured frames
        const outputFrames = [];
        let captureIndex = 0;
        for (let i = 0; i < totalFrames; i++) {
            // Find the most recent captured frame at or before frame i
            while (captureIndex < capturedFrames.length - 1 &&
                capturedFrames[captureIndex + 1].number <= i) {
                captureIndex++;
            }
            outputFrames.push(capturedFrames[captureIndex].buffer);
        }
        console.log(`  Frame duplication map:`);
        let currentCaptureIndex = 0;
        let rangeStart = 0;
        for (let i = 0; i <= totalFrames; i++) {
            if (i === totalFrames ||
                (currentCaptureIndex < capturedFrames.length - 1 &&
                    capturedFrames[currentCaptureIndex + 1].number <= i)) {
                const rangeEnd = i - 1;
                if (rangeStart <= rangeEnd) {
                    console.log(`    Frames ${rangeStart}-${rangeEnd}: use capture #${capturedFrames[currentCaptureIndex].number}`);
                }
                rangeStart = i;
                if (currentCaptureIndex < capturedFrames.length - 1 &&
                    capturedFrames[currentCaptureIndex + 1].number <= i) {
                    currentCaptureIndex++;
                }
            }
        }
        // Write duplicated frames to temp directory
        const padding = totalFrames.toString().length;
        for (let i = 0; i < outputFrames.length; i++) {
            const frameNum = i.toString().padStart(padding, "0");
            await (0, promises_1.writeFile)((0, path_1.resolve)(tempDir, `frame_${frameNum}.png`), outputFrames[i]);
        }
        // Merge with FFmpeg
        // Using APNG (Animated PNG) codec which natively supports alpha transparency
        const ffmpegCmd = [
            "ffmpeg",
            "-framerate",
            fps.toString(),
            "-i",
            (0, path_1.resolve)(tempDir, `frame_%0${padding}d.png`),
            "-c:v",
            "apng", // APNG codec with native RGBA support
            "-plays",
            "0", // Loop indefinitely
            "-vf",
            `scale=${width}:${height}`, // Scale only - APNG preserves alpha automatically
            "-y",
            outputPath,
        ].join(" ");
        console.log(`\nMerging ${outputFrames.length} frames to video: ${ffmpegCmd}`);
        (0, child_process_1.execSync)(ffmpegCmd, { stdio: "inherit" });
    }
    finally {
        // Cleanup temp frames
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
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
async function renderApp(options) {
    const { app, width, height, projectDir, outputName, title, date, tags, fps, duration, browser: sharedBrowser, } = options;
    // Create cache directory organized by app ID
    const cacheDir = (0, path_1.resolve)(projectDir, "cache", app.id);
    if (!(0, fs_1.existsSync)(cacheDir)) {
        await (0, promises_1.mkdir)(cacheDir, { recursive: true });
    }
    // Generate cache key from all inputs that affect output
    const cacheKey = generateAppCacheKey(app.src, app.parameters, title, date, tags, outputName, fps, duration);
    // Check cache for APNG (used for both static and animated to preserve alpha)
    const cachedApng = (0, path_1.resolve)(cacheDir, `${cacheKey}.apng`);
    if ((0, fs_1.existsSync)(cachedApng)) {
        console.log(`Using cached app "${app.id}" (hash: ${cacheKey}) from ${cachedApng}`);
        // TODO: Extract metadata from video (frameCount, duration, fps)
        return {
            app,
            mode: "animated",
            path: cachedApng,
        };
    }
    // Resolve index.html
    const appDir = (0, path_1.isAbsolute)(app.src) ? app.src : (0, path_1.resolve)(projectDir, app.src);
    const indexPath = (0, path_1.resolve)(appDir, "index.html");
    if (!(0, fs_1.existsSync)(indexPath)) {
        throw new Error(`App "${app.id}": index.html not found at ${indexPath}`);
    }
    // Build URL with query parameters including fps and duration
    const searchParams = new URLSearchParams({ rendering: "" });
    searchParams.set("fps", fps.toString());
    searchParams.set("duration", duration.toString());
    searchParams.set("title", title);
    if (date)
        searchParams.set("date", date);
    if (tags.length > 0)
        searchParams.set("tags", tags.join(","));
    for (const [key, value] of Object.entries(app.parameters)) {
        searchParams.set(key, value);
    }
    const url = `file://${indexPath}?${searchParams.toString()}`;
    console.log(`\nRendering app "${app.id}" from ${url}`);
    console.log(`  FPS: ${fps}, Duration: ${duration}ms`);
    const ownBrowser = sharedBrowser
        ? null
        : await puppeteer_1.default.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            protocolTimeout: 120000, // 2 minutes for screenshot operations
        });
    const browser = sharedBrowser ?? ownBrowser;
    const page = await browser.newPage();
    try {
        await page.setViewport({ width, height });
        // Inject CSS before page load to ensure transparent background and consistent rem sizing
        await page.evaluateOnNewDocument(() => {
            // @ts-expect-error - This runs in browser context
            const style = document.createElement("style");
            style.textContent = `
        html { font-size: 16px !important; }
        * { background: transparent !important; }
        html, body { background: transparent !important; }
      `;
            // @ts-expect-error - This runs in browser context
            document.head?.appendChild(style) || document.documentElement.appendChild(style);
        });
        page.on("console", (msg) => console.log(`[app:${app.id}] console.${msg.type()}: ${msg.text()}`));
        page.on("pageerror", (err) => console.error(`[app:${app.id}] page error: ${String(err)}`));
        page.on("requestfailed", (req) => console.error(`[app:${app.id}] request failed: ${req.url()} — ${req.failure()?.errorText}`));
        const frames = [];
        // Expose frame capture function that apps can call with explicit frame numbers
        // This returns a promise that resolves when screenshot is complete (ACK)
        await page.exposeFunction("__stsCaptureFrame", async (frameNumber) => {
            const screenshot = await page.screenshot({
                type: "png",
                omitBackground: true,
                clip: { x: 0, y: 0, width, height },
            });
            frames.push({
                number: frameNumber,
                buffer: Buffer.from(screenshot),
            });
            console.log(`[app:${app.id}] Captured frame ${frameNumber} (${frames.length} total)`);
            // Promise resolution is the ACK!
            return true;
        });
        // Create a promise that will be resolved when rendering completes
        let renderingCompleteResolve;
        const renderingPromise = new Promise((resolve) => {
            renderingCompleteResolve = resolve;
        });
        // Expose a function that the page can call when rendering is complete
        await page.exposeFunction("__stsNotifyRenderComplete", () => {
            renderingCompleteResolve();
        });
        // Set up event listener and backward compatibility BEFORE navigation
        await page.evaluateOnNewDocument(() => {
            // Set up listener for 'sts-done-rendering' event
            // @ts-expect-error - This runs in browser context
            document.addEventListener("sts-done-rendering", () => {
                // @ts-expect-error - This is the exposed function
                window.__stsNotifyRenderComplete();
            });
            // For backward compatibility with old apps using window.__stsRenderComplete
            // @ts-expect-error - This runs in browser context
            Object.defineProperty(window, "__stsRenderComplete", {
                set: (value) => {
                    if (value === true) {
                        // @ts-expect-error - This runs in browser context
                        document.dispatchEvent(new CustomEvent("sts-done-rendering"));
                    }
                },
                get: () => false,
            });
        });
        await page.goto(url, { waitUntil: "networkidle0" });
        await Promise.race([
            renderingPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`App "${app.id}" did not signal completion within ${RENDER_TIMEOUT_MS}ms`)), RENDER_TIMEOUT_MS)),
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
            const tempPng = (0, path_1.resolve)(cacheDir, `temp_${cacheKey}.png`);
            await (0, promises_1.writeFile)(tempPng, screenshot);
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
                (0, child_process_1.execSync)(ffmpegCmd, { stdio: "inherit" });
            }
            finally {
                // Cleanup temp file
                await (0, promises_1.rm)(tempPng, { force: true });
            }
            console.log(`Rendered static app "${app.id}" (hash: ${cacheKey}) to ${cachedApng}`);
            return {
                app,
                mode: "static",
                path: cachedApng,
            };
        }
        else {
            // Animated mode - merge frames to video
            console.log(`App "${app.id}" is animated (${frames.length} frames captured)`);
            const firstFrame = frames[0].number;
            const lastFrame = frames[frames.length - 1].number;
            console.log(`  Frame range: ${firstFrame} to ${lastFrame}`);
            await mergeFramesToVideo(frames, cachedApng, fps, width, height, duration);
            console.log(`Rendered animated app "${app.id}" (hash: ${cacheKey}) to ${cachedApng}`);
            return {
                app,
                mode: "animated",
                path: cachedApng,
                frameCount: frames.length,
                duration,
                fps,
            };
        }
    }
    finally {
        await page.close();
        if (ownBrowser)
            await ownBrowser.close();
    }
}
//# sourceMappingURL=app-renderer.js.map