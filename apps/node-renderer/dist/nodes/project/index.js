"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectNode = void 0;
const rendering_1 = require("./rendering");
const path_1 = require("path");
const fs_1 = require("fs");
const css_processor_1 = require("./rendering/css-processor");
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
    async prepareAssets(context) {
        const renderAssets = [];
        for (const asset of this.params.assets) {
            // Resolve assets that reference node outputs (e.g., app outputs)
            if (asset.input) {
                // Parse input reference: $nodeName.output.outputName
                const match = asset.input.match(/^\$([^.]+)\.output\.([^.]+)$/);
                if (!match) {
                    console.warn(`⚠️  Asset "${asset.name}" has invalid input format: ${asset.input}`);
                    continue;
                }
                const [, nodeName, outputName] = match;
                const outputPath = context.getOutput(nodeName, outputName);
                if (!outputPath) {
                    console.warn(`⚠️  Asset "${asset.name}" references missing output: ${asset.input}`);
                    continue;
                }
                console.log(`✅ Resolved app asset "${asset.name}" from ${nodeName}.${outputName}`);
                // Determine type from file extension
                const ext = outputPath.split(".").pop()?.toLowerCase() || "";
                let assetType = "image";
                if (ext === "apng" || ext === "mp4") {
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
                    hasAudio: false, // Apps don't have audio
                };
                renderAssets.push(renderAsset);
                continue;
            }
            if (!asset.path) {
                console.warn(`⚠️  Asset "${asset.name}" has no path, skipping`);
                continue;
            }
            // Resolve asset path relative to project directory
            const assetPath = (0, path_1.resolve)(context.projectDir, asset.path);
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
                hasAudio: assetType === "video" || assetType === "audio",
            };
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