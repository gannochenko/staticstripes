import { Asset, Output, SequenceDefinition } from './type';
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

  public getCssText(): string {
    return this.cssText;
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
  public async renderContainers(outputName: string): Promise<void> {
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
