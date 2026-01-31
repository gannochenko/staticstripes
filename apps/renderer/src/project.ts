import { Asset, Output, SequenceDefinition } from './type';
import { Filter, Label } from './ffmpeg';
import { AssetManager } from './asset-manager';
import { Sequence } from './sequence';
import { FilterBuffer } from './stream';
import { ExpressionContext, FragmentData } from './expression-parser';

export class Project {
  private assetManager: AssetManager;
  private expressionContext: ExpressionContext;

  constructor(
    private sequencesDefinitions: SequenceDefinition[],
    assets: Asset[],
    private output: Output,
  ) {
    this.assetManager = new AssetManager(assets);
    this.expressionContext = {
      fragments: new Map<string, FragmentData>(),
    };
  }

  public build(): FilterBuffer {
    let buf = new FilterBuffer();
    let mainSequence: Sequence | null = null;

    this.sequencesDefinitions.forEach((sequenceDefinition) => {
      const seq = new Sequence(
        buf,
        sequenceDefinition,
        this.getOutput(),
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
