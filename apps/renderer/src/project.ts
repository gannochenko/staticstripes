import {
  Asset,
  Output,
  SequenceDefinition,
  FFmpegOption,
  Upload,
  AIProvider,
} from './type';
import { Label } from './ffmpeg';
import { AssetManager } from './asset-manager';
import { Sequence } from './sequence';
import { FilterBuffer } from './stream';
import { ExpressionContext, FragmentData } from './expression-parser';
import { renderContainers } from './container-renderer';
import { dirname } from 'path';

export class Project {
  private assetManager: AssetManager;
  private expressionContext: ExpressionContext;

  constructor(
    private sequencesDefinitions: SequenceDefinition[],
    assets: Asset[],
    private outputs: Map<string, Output>,
    private ffmpegOptions: Map<string, FFmpegOption>,
    private uploads: Map<string, Upload>,
    private aiProviders: Map<string, AIProvider>,
    private title: string,
    private date: string | undefined,
    private cssText: string,
    private projectPath: string,
  ) {
    this.assetManager = new AssetManager(assets);
    this.expressionContext = {
      fragments: new Map<string, FragmentData>(),
    };
  }

  public async build(outputName: string): Promise<FilterBuffer> {
    const output = this.getOutput(outputName);
    if (!output) {
      throw new Error(`Output "${outputName}" not found`);
    }

    let buf = new FilterBuffer();
    let mainSequence: Sequence | null = null;

    this.sequencesDefinitions.forEach((sequenceDefinition) => {
      const seq = new Sequence(
        buf,
        sequenceDefinition,
        output,
        this.getAssetManager(),
        this.expressionContext,
      );
      if (seq.isEmpty()) {
        return;
      }

      seq.build();

      if (!mainSequence) {
        mainSequence = seq;
      } else {
        mainSequence.overlayWith(seq);
      }
    });

    if (mainSequence) {
      const sequence: Sequence = mainSequence;
      sequence.getVideoStream().endTo({
        tag: 'outv',
        isAudio: false,
      });
      sequence.getAudioStream().endTo({
        tag: 'outa',
        isAudio: true,
      });
    }

    return buf;
  }

  public printStats() {
    console.log('\n=== Project stats ===\n');
    console.log('== Assets ==\n');
    this.assetManager.getAssetIndexMap().forEach((_index, assetName) => {
      const asset = this.assetManager.getAssetByName(assetName)!;

      console.log(
        `Asset "${asset.name}" (${asset.type}) dimensions: w=${asset.width}, h=${asset.height}, rotation: ${asset.rotation}°, duration: ${asset.duration}, hasVideo: ${asset.hasVideo}, hasAudio: ${asset.hasAudio}`,
      );
    });
  }

  public getAssetManager(): AssetManager {
    return this.assetManager;
  }

  public getOutput(outputName: string): Output | undefined {
    return this.outputs.get(outputName);
  }

  public getOutputs(): Map<string, Output> {
    return this.outputs;
  }

  public getFfmpegOptions(): Map<string, FFmpegOption> {
    return this.ffmpegOptions;
  }

  public getFfmpegOption(name: string): FFmpegOption | undefined {
    return this.ffmpegOptions.get(name);
  }

  public getUploads(): Map<string, Upload> {
    return this.uploads;
  }

  public getUpload(name: string): Upload | undefined {
    return this.uploads.get(name);
  }

  // Legacy aliases for backward compatibility
  public getYouTubeUploads(): Map<string, Upload> {
    return this.getUploads();
  }

  public getYouTubeUpload(name: string): Upload | undefined {
    return this.getUpload(name);
  }

  public getAIProviders(): Map<string, AIProvider> {
    return this.aiProviders;
  }

  public getAIProvider(name: string): AIProvider | undefined {
    return this.aiProviders.get(name);
  }

  public getTitle(): string {
    return this.title;
  }

  public getDate(): string | undefined {
    return this.date;
  }

  public getCssText(): string {
    return this.cssText;
  }

  /**
   * Collects timecodes from fragments with timecodeLabel
   * Returns formatted timecodes in YouTube format (MM:SS or HH:MM:SS Label)
   * Note: This must be called after build() to have accurate times in expressionContext
   */
  public getTimecodes(): string[] {
    const timecodes: Array<{ time: number; label: string }> = [];

    // Collect all fragments with timecode labels
    for (const seqDef of this.sequencesDefinitions) {
      for (const fragment of seqDef.fragments) {
        if (fragment.timecodeLabel && this.expressionContext.fragments.has(fragment.id)) {
          const fragmentData = this.expressionContext.fragments.get(fragment.id)!;
          timecodes.push({
            time: fragmentData.time.start / 1000, // Convert ms to seconds
            label: fragment.timecodeLabel,
          });
        }
      }
    }

    // Sort by time
    timecodes.sort((a, b) => a.time - b.time);

    // Format as YouTube timecodes (MM:SS or HH:MM:SS)
    return timecodes.map(({ time, label }) => {
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);

      let timeStr: string;
      if (hours > 0) {
        timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }

      return `${timeStr} ${label}`;
    });
  }

  public getSequenceDefinitions(): SequenceDefinition[] {
    return this.sequencesDefinitions;
  }

  // Delegation methods for convenience
  public getAssetIndexMap(): Map<string, number> {
    return this.assetManager.getAssetIndexMap();
  }

  public getAssetByName(name: string): Asset | undefined {
    return this.assetManager.getAssetByName(name);
  }

  public getVideoInputLabelByAssetName(name: string): Label {
    return this.assetManager.getVideoInputLabelByAssetName(name);
  }

  public getAudioInputLabelByAssetName(name: string): Label {
    return this.assetManager.getAudioInputLabelByAssetName(name);
  }

  /**
   * Renders all containers and creates virtual assets for them
   */
  public async renderContainers(
    outputName: string,
    activeCacheKeys?: Set<string>,
  ): Promise<void> {
    const output = this.getOutput(outputName);
    if (!output) {
      throw new Error(`Output "${outputName}" not found`);
    }

    // Collect all fragments with containers
    const fragmentsWithContainers = this.sequencesDefinitions.flatMap((seq) =>
      seq.fragments.filter((frag) => frag.container),
    );

    if (fragmentsWithContainers.length === 0) {
      return;
    }

    console.log('\n=== Rendering Containers ===\n');

    const containers = fragmentsWithContainers.map((frag) => frag.container!);
    const projectDir = dirname(this.projectPath);

    const results = await renderContainers(
      containers,
      this.cssText,
      output.resolution.width,
      output.resolution.height,
      projectDir,
      outputName,
      activeCacheKeys,
    );

    // Create virtual assets and update fragment assetNames
    for (const result of results) {
      const virtualAssetName = result.container.id;

      // Create virtual asset
      const virtualAsset: Asset = {
        name: virtualAssetName,
        path: result.screenshotPath,
        type: 'image',
        duration: 0,
        width: output.resolution.width,
        height: output.resolution.height,
        rotation: 0,
        hasVideo: true,
        hasAudio: false,
      };

      this.assetManager.addVirtualAsset(virtualAsset);

      // Update fragment assetName
      const fragment = fragmentsWithContainers.find(
        (frag) => frag.container?.id === result.container.id,
      );
      if (fragment) {
        fragment.assetName = virtualAssetName;
      }
    }
  }
}
