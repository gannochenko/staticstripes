import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
  NodeExecutionContext,
} from "../../lib/node-interface";
import type { Output, Sequence, Asset, FFmpegOption } from "../../lib/type";
import {
  AssetManager,
  ExpressionContext,
  FilterBuffer,
  Sequence as RenderSequence,
  makeFFmpegCommand,
  runFFMpeg,
  getAssetDuration,
} from "./rendering";
import { resolve, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import type {
  Asset as RenderAsset,
  Output as RenderOutput,
} from "./rendering/types";
import { CSSProcessor } from "./rendering/css-processor";
import { DAGValidator } from "../../lib/dag-validator";

export interface ProjectNodeParams {
  name?: string;
  title?: string;
  tags: string[];
  outputs: Output[];
  sequences: Sequence[];
  assets: Asset[];
  ffmpegOptions: FFmpegOption[];
  css?: Map<any, Record<string, string>>; // CSS map for processing
}

/**
 * Project Node - Main node that runs ffmpeg to render video
 */
export class ProjectNode implements INode {
  constructor(private params: ProjectNodeParams) {}

  public getType(): string {
    return "project";
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [];
  }

  public getOutputs(): NodeOutput[] {
    return this.params.outputs.map((output) => ({
      name: output.name,
      description: `Video output: ${output.resolution} @ ${output.fps}fps`,
    }));
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

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

  public getParameterSchema(): NodeParameter[] {
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

  public async execute(
    context: NodeExecutionContext,
  ): Promise<Record<string, any>> {
    console.log("🎬 Executing project node...");

    // Convert assets to render format (resolve paths, probe durations)
    const renderAssets = await this.prepareAssets(context);

    // Create asset manager
    const assetManager = new AssetManager(renderAssets);

    // Build expression context for fragment references
    const expressionContext: ExpressionContext = {
      fragments: new Map(),
    };

    // Result map: output name -> rendered file path
    const results: Record<string, string> = {};

    // Render each output
    for (const output of this.params.outputs) {
      console.log(
        `\n📹 Rendering output: ${output.name} (${output.resolution}@${output.fps}fps)`,
      );

      //  Generate output path
      const outputPath = resolve(
        context.projectDir,
        "output",
        `${output.name}.mp4`,
      );

      const renderOutput: RenderOutput = {
        name: output.name,
        path: outputPath,
        resolution: {
          width: parseInt(output.resolution.split("x")[0]),
          height: parseInt(output.resolution.split("x")[1]),
        },
        fps: output.fps,
      };

      // Ensure output directory exists
      const outputDir = dirname(renderOutput.path);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Build filter graph
      const filterBuffer = await this.buildFilterGraph(
        renderOutput,
        assetManager,
        expressionContext,
      );

      const filterComplex = filterBuffer.render();
      console.log(
        `\n🔍 Filter complex length: ${filterComplex.length} characters`,
      );
      if (filterComplex.length < 500) {
        console.log(`   Filter: ${filterComplex.substring(0, 200)}...`);
      }

      // Get FFmpeg args from options
      const ffmpegArgs = this.params.ffmpegOptions[0]?.args || "";

      // Generate FFmpeg command
      const ffmpegCommand = makeFFmpegCommand(
        assetManager.getAssetIndexMap(),
        new Map(renderAssets.map((a) => [a.name, a])),
        renderOutput,
        filterComplex,
        ffmpegArgs,
      );

      console.log(`\n🔧 FFmpeg command:\n${ffmpegCommand}\n`);

      // Run FFmpeg
      await runFFMpeg(ffmpegCommand);

      console.log(
        `✅ Output "${output.name}" rendered to: ${renderOutput.path}`,
      );
      results[output.name] = renderOutput.path;
    }

    return results;
  }

  private async prepareAssets(
    context: NodeExecutionContext,
  ): Promise<RenderAsset[]> {
    const renderAssets: RenderAsset[] = [];

    for (const asset of this.params.assets) {
      // Resolve assets that reference node outputs (e.g., app outputs)
      if (asset.input) {
        // Parse input reference: supports both $nodeName.output.outputName and $nodeName.outputName
        const ref = DAGValidator.parseNodeReference(asset.input);
        if (!ref) {
          console.warn(
            `⚠️  Asset "${asset.name}" has invalid input format: ${asset.input}`,
          );
          continue;
        }

        const { nodeName, outputName } = ref;
        const outputPath = context.getOutput(nodeName, outputName);

        if (!outputPath) {
          console.warn(
            `⚠️  Asset "${asset.name}" references missing output: ${asset.input}`,
          );
          continue;
        }

        console.log(
          `✅ Resolved app asset "${asset.name}" from ${nodeName}.${outputName}`,
        );

        // Determine type from file extension
        const ext = outputPath.split(".").pop()?.toLowerCase() || "";
        let assetType: "video" | "image" | "audio" = "image";
        let isApng = false;
        if (ext === "apng") {
          assetType = "video";
          isApng = true; // APNG files never have audio
        } else if (ext === "mp4") {
          assetType = "video";
        } else if (["mp3", "wav", "aac"].includes(ext)) {
          assetType = "audio";
        }

        // Probe duration for video/audio assets (including APNG)
        let duration = 0;
        if (assetType === "video" || assetType === "audio") {
          duration = await getAssetDuration(outputPath);
        }

        const renderAsset: RenderAsset = {
          name: asset.name,
          path: outputPath,
          author: asset.author,
          type: assetType,
          duration: duration,
          width: 1920,
          height: 1080,
          rotation: 0,
          hasVideo: assetType === "video" || assetType === "image",
          hasAudio: (assetType === "video" && !isApng) || assetType === "audio",
        };

        renderAssets.push(renderAsset);
        continue;
      }

      if (!asset.path) {
        console.warn(`⚠️  Asset "${asset.name}" has no path, skipping`);
        continue;
      }

      // Resolve asset path relative to project directory
      const assetPath = resolve(context.projectDir, asset.path);

      // Determine asset type from file extension
      const ext = asset.path.split(".").pop()?.toLowerCase() || "";
      let assetType: "video" | "image" | "audio" = "video";
      if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
        assetType = "image";
      } else if (["mp3", "wav", "aac", "m4a"].includes(ext)) {
        assetType = "audio";
      }

      // Probe duration for videos and audio
      let duration = 0;
      if (assetType === "video" || assetType === "audio") {
        duration = await getAssetDuration(assetPath);
      }

      const renderAsset: RenderAsset = {
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

      console.log(`   Asset "${asset.name}": type=${assetType}, hasVideo=${renderAsset.hasVideo}, hasAudio=${renderAsset.hasAudio}`);

      renderAssets.push(renderAsset);
    }

    return renderAssets;
  }

  private async buildFilterGraph(
    output: RenderOutput,
    assetManager: AssetManager,
    expressionContext: ExpressionContext,
  ): Promise<FilterBuffer> {
    const buf = new FilterBuffer();
    let mainSequence: RenderSequence | null = null;

    // Process sequences with CSS
    const cssMap = this.params.css || new Map();
    const renderSequences = CSSProcessor.processSequences(
      this.params.sequences,
      cssMap,
    );

    console.log(`   Processed ${renderSequences.length} sequence(s)`);

    // Build each sequence
    for (const renderSequenceDef of renderSequences) {
      console.log(
        `   Building sequence with ${renderSequenceDef.fragments.length} fragment(s)`,
      );

      const seq = new RenderSequence(
        buf,
        renderSequenceDef,
        output,
        assetManager,
        expressionContext,
      );

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
      } else {
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
