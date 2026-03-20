"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetManager = void 0;
class AssetManager {
    assets;
    assetIndexMap = new Map();
    constructor(assets) {
        this.assets = assets;
        let index = 0;
        for (const asset of assets) {
            this.assetIndexMap.set(asset.name, index++);
        }
    }
    getAssetIndexMap() {
        return this.assetIndexMap;
    }
    getAssetByName(name) {
        return this.assets.find((assetItem) => assetItem.name === name);
    }
    getAssets() {
        return this.assets;
    }
    getVideoInputLabelByAssetName(name) {
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
    getAudioInputLabelByAssetName(name) {
        const assetIndex = this.assetIndexMap.get(name);
        return {
            tag: `${assetIndex}:a`,
            isAudio: true,
        };
    }
    /**
     * Adds a virtual asset (e.g., rendered container screenshot)
     */
    addVirtualAsset(asset) {
        // Add to assets array
        this.assets.push(asset);
        // Assign next available index
        const nextIndex = this.assetIndexMap.size;
        this.assetIndexMap.set(asset.name, nextIndex);
    }
}
exports.AssetManager = AssetManager;
//# sourceMappingURL=asset-manager.js.map