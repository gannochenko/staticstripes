import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
  NodeExecutionContext,
} from "../../lib/node-interface";
import type { Output, Sequence, Asset, BasePath, FFmpegOption } from "../../lib/type";
import { resolveAssetPath } from "../../lib/path-resolver";
import {
  AssetManager,
  ExpressionContext,
  FilterBuffer,
  Sequence as RenderSequence,
  makeFFmpegCommand,
  runFFMpeg,
  getAssetDuration,
  hasAudioStream,
} from "./rendering";
import { resolve, dirname, isAbsolute } from "path";
import { existsSync, mkdirSync } from "fs";
import puppeteer from "puppeteer";
import { buildAppIfNeeded } from "../app/app-builder";
import { renderApp } from "../app/app-renderer";
import type {
  Asset as RenderAsset,
  Output as RenderOutput,
} from "./rendering/types";
import { CSSProcessor } from "./rendering/css-processor";
import { DAGValidator } from "../../lib/dag-validator";

export interface ProjectNodeParams {
  name?: string;
  title?: string;
  date?: string;
  tags: string[];
  basePaths: BasePath[];
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
    return [
      ...this.params.outputs.map((output) => ({
        name: output.name,
        description: `Video output: ${output.resolution} @ ${output.fps}fps`,
      })),
      { name: 'title', description: 'Project title' },
      { name: 'date', description: 'Project date (ISO 8601)' },
      { name: 'tags', description: 'Project tags' },
    ];
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

    // Render inline app overlays (fragments with <app> children) before filter graph
    if (this.params.sequences.some((s) => s.fragments.some((f) => f.app))) {
      const firstOutput = this.params.outputs[0];
      if (firstOutput) {
        const appRenderOutput: RenderOutput = {
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

    // Result map: output name -> value
    const results: Record<string, any> = {};

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

      // If output already exists and --force not set, skip rendering
      if (existsSync(outputPath) && !context.force) {
        console.log(`⏭️  Output "${output.name}" already exists, skipping render: ${outputPath}`);
        results[output.name] = outputPath;
        continue;
      }

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
        context.showTime,
        context.timeFormat,
      );

      const filterComplex = filterBuffer.render();
      console.log(
        `\n🔍 Filter complex length: ${filterComplex.length} characters`,
      );
      if (filterComplex.length < 500) {
        console.log(`   Filter: ${filterComplex.substring(0, 200)}...`);
      }

      // Get FFmpeg args from options — use named profile if specified, else first option
      const profile = context.ffmpegProfile;
      const selectedOption = profile
        ? this.params.ffmpegOptions.find((o) => o.name === profile) ?? this.params.ffmpegOptions[0]
        : this.params.ffmpegOptions[0];
      if (profile && !this.params.ffmpegOptions.find((o) => o.name === profile)) {
        console.warn(`⚠️  FFmpeg profile "${profile}" not found, using first option`);
      }
      const ffmpegArgs = selectedOption?.args || "";

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

    results['title'] = this.params.title ?? null;
    results['date'] = this.params.date ?? null;
    results['tags'] = this.params.tags;

    return results;
  }

  private parseTimeMs(timeStr: string): number {
    const t = timeStr.trim();
    if (t.endsWith("ms")) return parseFloat(t);
    if (t.endsWith("s")) return parseFloat(t) * 1000;
    return parseFloat(t) || 0;
  }

  private async renderFragmentApps(
    context: NodeExecutionContext,
    assetManager: AssetManager,
    output: RenderOutput,
  ): Promise<void> {
    console.log("🎨 Rendering inline app overlays...");

    const browser = await puppeteer.launch({
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
          if (!fragment.app) continue;

          const syntheticName = `__app_overlay_${appIndex++}`;

          // Resolve duration from CSS
          const styles = this.params.css?.get(fragment.element) || {};
          const duration = this.parseTimeMs(styles["-duration"] || "0ms");
          if (duration <= 0) {
            throw new Error(
              `Fragment with inline <app src="${fragment.app.src}"> has no -duration in its CSS. ` +
              `Add a -duration property to the fragment's CSS class.`,
            );
          }

          // Resolve app src path
          const resolvedSrc = resolveAssetPath(fragment.app.src, context.basePaths);
          const appSrc = isAbsolute(resolvedSrc)
            ? resolvedSrc
            : resolve(context.projectDir, resolvedSrc);

          // Build app if needed
          await buildAppIfNeeded({
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

          const result = await renderApp({
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

          console.log(
            `✅ App overlay "${syntheticName}" rendered (${result.mode}) → ${result.path}`,
          );

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
    } finally {
      await browser.close();
    }
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

        const synthesizedVideoHasAudio = (assetType === "video" && !isApng) ? await hasAudioStream(outputPath) : false;

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
      const resolvedPath = resolveAssetPath(asset.path, this.params.basePaths);
      const assetPath = resolve(context.projectDir, resolvedPath);

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

      const videoHasAudio = assetType === "video" ? await hasAudioStream(assetPath) : false;

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
        hasAudio: videoHasAudio || assetType === "audio",
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
    showTime: boolean = false,
    timeFormat: 'ms' | 'hms' = 'hms',
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
        showTime,
        timeFormat,
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
      if (showTime) {
        const timeExpr = timeFormat === 'ms' ? '%{eif\\:t*1000\\:d}ms' : '%{pts\\:hms}';
        mainSequence.getVideoStream().drawTimecode(timeExpr, {
          y: 'h-36',
          fontsize: 22,
          fontcolor: 'cyan',
        });
      }

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
