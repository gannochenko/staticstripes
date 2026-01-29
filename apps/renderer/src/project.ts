import { Asset, Output, SequenceDefinition } from './type';
import { Label } from './ffmpeg';
import { AssetManager } from './asset-manager';
import { Sequence } from './sequence';

export class Project {
  private assetManager: AssetManager;

  constructor(
    private sequences: SequenceDefinition[],
    assets: Asset[],
    private output: Output,
  ) {
    this.assetManager = new AssetManager(assets);
  }

  public build() {
    let mainSequence: Sequence;

    this.sequences.forEach((sequence) => {});
  }

  public printStats() {
    this.assetManager.getAssetIndexMap().forEach((key, value) => {
      const asset = this.assetManager.getAssetByName(value)!;

      console.log(
        `Asset "${asset.name}" (${asset.type}) dimensions: w=${asset.width}, h=${asset.height}, rotation: ${asset.rotation}°, duration: ${asset.duration}, hasVideo: ${asset.hasVideo}, hasAudio: ${asset.hasAudio}`,
      );
    });
  }

  public getAssetManager(): AssetManager {
    return this.assetManager;
  }

  public getSequences(): SequenceDefinition[] {
    return this.sequences;
  }

  public getOutput(): Output {
    return this.output;
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
}
