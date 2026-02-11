import { Label } from './ffmpeg';
import { Asset } from './type';

export class AssetManager {
  private assetIndexMap: Map<string, number> = new Map();

  constructor(private assets: Asset[]) {
    let index = 0;
    for (const asset of assets) {
      this.assetIndexMap.set(asset.name, index++);
    }
  }

  public getAssetIndexMap(): Map<string, number> {
    return this.assetIndexMap;
  }

  public getAssetByName(name: string): Asset | undefined {
    return this.assets.find((assetItem) => assetItem.name === name);
  }

  public getAssets(): Asset[] {
    return this.assets;
  }

  public getVideoInputLabelByAssetName(name: string): Label {
    const assetIndex = this.assetIndexMap.get(name);
    const asset = this.getAssetByName(name);
    if (asset && asset.type === 'audio') {
      throw new Error('trying to get video stream from an audio only asset');
    }

    return {
      tag: `${assetIndex}:v`,
      isAudio: false,
    };
  }

  public getAudioInputLabelByAssetName(name: string): Label {
    const assetIndex = this.assetIndexMap.get(name);

    return {
      tag: `${assetIndex}:a`,
      isAudio: true,
    };
  }

  /**
   * Adds a virtual asset (e.g., rendered container screenshot)
   */
  public addVirtualAsset(asset: Asset): void {
    // Add to assets array
    this.assets.push(asset);

    // Assign next available index
    const nextIndex = this.assetIndexMap.size;
    this.assetIndexMap.set(asset.name, nextIndex);
  }
}
