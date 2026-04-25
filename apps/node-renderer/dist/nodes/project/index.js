"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectNode = void 0;
const path_resolver_1 = require("../../lib/path-resolver");
const rendering_1 = require("./rendering");
const path_1 = require("path");
const fs_1 = require("fs");
const puppeteer_1 = __importDefault(require("puppeteer"));
const app_builder_1 = require("../app/app-builder");
const app_renderer_1 = require("../app/app-renderer");
const css_processor_1 = require("./rendering/css-processor");
const dag_validator_1 = require("../../lib/dag-validator");
/**
 * Project Node - Main node that runs ffmpeg to render video
 */
class ProjectNode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return "project";
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [];
    }
    getOutputs() {
        return this.params.outputs.map((output) => ({
            name: output.name,
            description: `Video output: ${output.resolution} @ ${output.fps}fps`,
        }));
    }
    validateParameters() {
        const errors = [];
        if (this.params.outputs.length === 0) {
            errors.push({
                text: "Project node must have at least one output defined",
                field: "outputs",
            });
        }
        if (this.params.sequences.length === 0) {
            errors.push({
                text: "Project node must have at least one sequence defined",
                field: "sequences",
            });
        }
        if (this.params.assets.length === 0) {
            errors.push({
                text: "Project node should have at least one asset defined",
                field: "assets",
            });
        }
        return errors;
    }
    getParameterSchema() {
        return [
            {
                name: "title",
                required: false,
                description: "Project title",
                type: "string",
            },
            {
                name: "tags",
                required: false,
                description: "Project tags",
                type: "string",
            },
            {
                name: "sequences",
                required: true,
                description: "Video sequences with fragments",
            },
            {
                name: "assets",
                required: true,
                description: "Media assets (video, audio, images)",
            },
            {
                name: "outputs",
                required: true,
                description: "Output configurations (resolution, fps)",
            },
            {
                name: "ffmpeg",
                required: false,
                description: "FFmpeg encoding options",
            },
        ];
    }
    async execute(context) {
        console.log("🎬 Executing project node...");
        // Convert assets to render format (resolve paths, probe durations)
        const renderAssets = await this.prepareAssets(context);
        // Create asset manager
        const assetManager = new rendering_1.AssetManager(renderAssets);
        // Build expression context for fragment references
        const expressionContext = {
            fragments: new Map(),
        };
        // Render inline app overlays (fragments with <app> children) before filter graph
        if (this.params.sequences.some((s) => s.fragments.some((f) => f.app))) {
            const firstOutput = this.params.outputs[0];
            if (firstOutput) {
                const appRenderOutput = {
                    name: firstOutput.name,
                    path: "",
                    resolution: {
                        width: parseInt(firstOutput.resolution.split("x")[0]),
                        height: parseInt(firstOutput.resolution.split("x")[1]),
                    },
                    fps: firstOutput.fps,
                };
                await this.renderFragmentApps(context, assetManager, appRenderOutput);
            }
        }
        // Result map: output name -> rendered file path
        const results = {};
        // Render each output
        for (const output of this.params.outputs) {
            console.log(`\n📹 Rendering output: ${output.name} (${output.resolution}@${output.fps}fps)`);
            //  Generate output path
            const outputPath = (0, path_1.resolve)(context.projectDir, "output", `${output.name}.mp4`);
            const renderOutput = {
                name: output.name,
                path: outputPath,
                resolution: {
                    width: parseInt(output.resolution.split("x")[0]),
                    height: parseInt(output.resolution.split("x")[1]),
                },
                fps: output.fps,
            };
            // If output already exists, skip rendering and use it as-is
            if ((0, fs_1.existsSync)(outputPath)) {
                console.log(`⏭️  Output "${output.name}" already exists, skipping render: ${outputPath}`);
                results[output.name] = outputPath;
                continue;
            }
            // Ensure output directory exists
            const outputDir = (0, path_1.dirname)(renderOutput.path);
            if (!(0, fs_1.existsSync)(outputDir)) {
                (0, fs_1.mkdirSync)(outputDir, { recursive: true });
            }
            // Build filter graph
            const filterBuffer = await this.buildFilterGraph(renderOutput, assetManager, expressionContext);
            const filterComplex = filterBuffer.render();
            console.log(`\n🔍 Filter complex length: ${filterComplex.length} characters`);
            if (filterComplex.length < 500) {
                console.log(`   Filter: ${filterComplex.substring(0, 200)}...`);
            }
            // Get FFmpeg args from options
            const ffmpegArgs = this.params.ffmpegOptions[0]?.args || "";
            // Generate FFmpeg command
            const ffmpegCommand = (0, rendering_1.makeFFmpegCommand)(assetManager.getAssetIndexMap(), new Map(renderAssets.map((a) => [a.name, a])), renderOutput, filterComplex, ffmpegArgs);
            console.log(`\n🔧 FFmpeg command:\n${ffmpegCommand}\n`);
            // Run FFmpeg
            await (0, rendering_1.runFFMpeg)(ffmpegCommand);
            console.log(`✅ Output "${output.name}" rendered to: ${renderOutput.path}`);
            results[output.name] = renderOutput.path;
        }
        return results;
    }
    parseTimeMs(timeStr) {
        const t = timeStr.trim();
        if (t.endsWith("ms"))
            return parseFloat(t);
        if (t.endsWith("s"))
            return parseFloat(t) * 1000;
        return parseFloat(t) || 0;
    }
    async renderFragmentApps(context, assetManager, output) {
        console.log("🎨 Rendering inline app overlays...");
        const browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--allow-file-access-from-files",
            ],
            protocolTimeout: 120000,
        });
        try {
            let appIndex = 0;
            for (const sequence of this.params.sequences) {
                for (const fragment of sequence.fragments) {
                    if (!fragment.app)
                        continue;
                    const syntheticName = `__app_overlay_${appIndex++}`;
                    // Resolve duration from CSS
                    const styles = this.params.css?.get(fragment.element) || {};
                    const duration = this.parseTimeMs(styles["-duration"] || "0ms");
                    if (duration <= 0) {
                        throw new Error(`Fragment with inline <app src="${fragment.app.src}"> has no -duration in its CSS. ` +
                            `Add a -duration property to the fragment's CSS class.`);
                    }
                    // Resolve app src path
                    const resolvedSrc = (0, path_resolver_1.resolveAssetPath)(fragment.app.src, context.basePaths);
                    const appSrc = (0, path_1.isAbsolute)(resolvedSrc)
                        ? resolvedSrc
                        : (0, path_1.resolve)(context.projectDir, resolvedSrc);
                    // Build app if needed
                    await (0, app_builder_1.buildAppIfNeeded)({
                        appSrc,
                        projectDir: context.projectDir,
                        basePaths: context.basePaths,
                        force: false,
                    });
                    const app = {
                        id: syntheticName,
                        src: appSrc,
                        parameters: fragment.app.parameters,
                    };
                    const result = await (0, app_renderer_1.renderApp)({
                        app,
                        width: output.resolution.width,
                        height: output.resolution.height,
                        projectDir: context.projectDir,
                        outputName: output.name,
                        title: this.params.title || "",
                        date: undefined,
                        tags: this.params.tags || [],
                        fps: output.fps,
                        duration,
                        browser,
                    });
                    console.log(`✅ App overlay "${syntheticName}" rendered (${result.mode}) → ${result.path}`);
                    // Register as virtual asset (APNG with transparency)
                    assetManager.addVirtualAsset({
                        name: syntheticName,
                        path: result.path,
                        type: "video",
                        duration,
                        width: output.resolution.width,
                        height: output.resolution.height,
                        rotation: 0,
                        hasVideo: true,
                        hasAudio: false,
                    });
                    // Inject data-asset so CSSProcessor picks it up normally
                    fragment.element.attribs["data-asset"] = syntheticName;
                }
            }
        }
        finally {
            await browser.close();
        }
    }
    async prepareAssets(context) {
        const renderAssets = [];
        for (const asset of this.params.assets) {
            // Resolve assets that reference node outputs (e.g., app outputs)
            if (asset.input) {
                // Parse input reference: supports both $nodeName.output.outputName and $nodeName.outputName
                const ref = dag_validator_1.DAGValidator.parseNodeReference(asset.input);
                if (!ref) {
                    console.warn(`⚠️  Asset "${asset.name}" has invalid input format: ${asset.input}`);
                    continue;
                }
                const { nodeName, outputName } = ref;
                const outputPath = context.getOutput(nodeName, outputName);
                if (!outputPath) {
                    console.warn(`⚠️  Asset "${asset.name}" references missing output: ${asset.input}`);
                    continue;
                }
                console.log(`✅ Resolved app asset "${asset.name}" from ${nodeName}.${outputName}`);
                // Determine type from file extension
                const ext = outputPath.split(".").pop()?.toLowerCase() || "";
                let assetType = "image";
                let isApng = false;
                if (ext === "apng") {
                    assetType = "video";
                    isApng = true; // APNG files never have audio
                }
                else if (ext === "mp4") {
                    assetType = "video";
                }
                else if (["mp3", "wav", "aac"].includes(ext)) {
                    assetType = "audio";
                }
                // Probe duration for video/audio assets (including APNG)
                let duration = 0;
                if (assetType === "video" || assetType === "audio") {
                    duration = await (0, rendering_1.getAssetDuration)(outputPath);
                }
                const synthesizedVideoHasAudio = (assetType === "video" && !isApng) ? await (0, rendering_1.hasAudioStream)(outputPath) : false;
                const renderAsset = {
                    name: asset.name,
                    path: outputPath,
                    author: asset.author,
                    type: assetType,
                    duration: duration,
                    width: 1920,
                    height: 1080,
                    rotation: 0,
                    hasVideo: assetType === "video" || assetType === "image",
                    hasAudio: synthesizedVideoHasAudio || assetType === "audio",
                };
                renderAssets.push(renderAsset);
                continue;
            }
            if (!asset.path) {
                console.warn(`⚠️  Asset "${asset.name}" has no path, skipping`);
                continue;
            }
            // Resolve asset path using base paths, then relative to project directory
            const resolvedPath = (0, path_resolver_1.resolveAssetPath)(asset.path, this.params.basePaths);
            const assetPath = (0, path_1.resolve)(context.projectDir, resolvedPath);
            // Determine asset type from file extension
            const ext = asset.path.split(".").pop()?.toLowerCase() || "";
            let assetType = "video";
            if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
                assetType = "image";
            }
            else if (["mp3", "wav", "aac", "m4a"].includes(ext)) {
                assetType = "audio";
            }
            // Probe duration for videos and audio
            let duration = 0;
            if (assetType === "video" || assetType === "audio") {
                duration = await (0, rendering_1.getAssetDuration)(assetPath);
            }
            const videoHasAudio = assetType === "video" ? await (0, rendering_1.hasAudioStream)(assetPath) : false;
            const renderAsset = {
                name: asset.name,
                path: assetPath,
                author: asset.author,
                type: assetType,
                duration,
                width: 1920,
                height: 1080,
                rotation: 0,
                hasVideo: assetType === "video" || assetType === "image",
                hasAudio: videoHasAudio || assetType === "audio",
            };
            console.log(`   Asset "${asset.name}": type=${assetType}, hasVideo=${renderAsset.hasVideo}, hasAudio=${renderAsset.hasAudio}`);
            renderAssets.push(renderAsset);
        }
        return renderAssets;
    }
    async buildFilterGraph(output, assetManager, expressionContext) {
        const buf = new rendering_1.FilterBuffer();
        let mainSequence = null;
        // Process sequences with CSS
        const cssMap = this.params.css || new Map();
        const renderSequences = css_processor_1.CSSProcessor.processSequences(this.params.sequences, cssMap);
        console.log(`   Processed ${renderSequences.length} sequence(s)`);
        // Build each sequence
        for (const renderSequenceDef of renderSequences) {
            console.log(`   Building sequence with ${renderSequenceDef.fragments.length} fragment(s)`);
            const seq = new rendering_1.Sequence(buf, renderSequenceDef, output, assetManager, expressionContext);
            if (seq.isEmpty()) {
                console.log(`   Sequence is empty, skipping`);
                continue;
            }
            seq.build();
            // Output fragment timing summary in verbose mode
            if (process.env.DEBUG) {
                const debugInfo = seq.getDebugInfo();
                console.error(`\n📊 Fragment timing summary (${debugInfo.length} fragments):`);
                console.error('╔════════════════════════════════════════════════════════════════════════════╗');
                console.error('║ ID                    │ Asset           │ Start   │ Duration │ End     ║');
                console.error('╠════════════════════════════════════════════════════════════════════════════╣');
                for (const fragment of debugInfo) {
                    const id = fragment.id.padEnd(20).substring(0, 20);
                    const asset = fragment.assetName.padEnd(14).substring(0, 14);
                    const start = `${fragment.startTime}ms`.padEnd(7);
                    const duration = `${fragment.duration}ms`.padEnd(9);
                    const end = `${fragment.endTime}ms`;
                    console.error(`║ ${id} │ ${asset} │ ${start} │ ${duration} │ ${end} ║`);
                }
                console.error('╚════════════════════════════════════════════════════════════════════════════╝');
                console.error(`   Total duration: ${seq.getTotalDuration()}ms\n`);
            }
            if (!mainSequence) {
                mainSequence = seq;
            }
            else {
                mainSequence.overlayWith(seq);
            }
        }
        // End streams with final output labels
        if (mainSequence) {
            mainSequence.getVideoStream().endTo({
                tag: "outv",
                isAudio: false,
            });
            mainSequence.getAudioStream().endTo({
                tag: "outa",
                isAudio: true,
            });
        }
        return buf;
    }
}
exports.ProjectNode = ProjectNode;
//# sourceMappingURL=index.js.map