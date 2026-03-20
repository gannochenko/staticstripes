import { Label } from './ffmpeg';
import { Asset } from './types';
export declare class AssetManager {
    private assets;
    private assetIndexMap;
    constructor(assets: Asset[]);
    getAssetIndexMap(): Map<string, number>;
    getAssetByName(name: string): Asset | undefined;
    getAssets(): Asset[];
    getVideoInputLabelByAssetName(name: string): Label;
    getAudioInputLabelByAssetName(name: string): Label;
    /**
     * Adds a virtual asset (e.g., rendered container screenshot)
     */
    addVirtualAsset(asset: Asset): void;
}
//# sourceMappingURL=asset-manager.d.ts.map