import { CompiledExpression } from './expression-parser';
export type Asset = {
    name: string;
    path: string;
    author?: string;
    type: 'video' | 'image' | 'audio';
    duration: number;
    width: number;
    height: number;
    rotation: number;
    hasVideo: boolean;
    hasAudio: boolean;
};
export type Fragment = {
    id: string;
    enabled: boolean;
    assetName: string;
    duration: number | CompiledExpression;
    trimLeft: number;
    overlayLeft: number | CompiledExpression;
    overlayZIndex: number;
    transitionIn: string;
    transitionInDuration: number;
    transitionOut: string;
    transitionOutDuration: number;
    objectFit: 'cover' | 'contain' | 'ken-burns';
    objectFitContain: 'ambient' | 'pillarbox';
    objectFitContainAmbientBlurStrength: number;
    objectFitContainAmbientBrightness: number;
    objectFitContainAmbientSaturation: number;
    objectFitContainPillarboxColor: string;
    objectFitKenBurns: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-top' | 'pan-bottom';
    objectFitKenBurnsZoom: number;
    objectFitKenBurnsEffectDuration: number;
    objectFitKenBurnsEasing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    objectFitKenBurnsFocalX: number;
    objectFitKenBurnsFocalY: number;
    objectFitKenBurnsPanStartX: number;
    objectFitKenBurnsPanStartY: number;
    objectFitKenBurnsPanEndX: number;
    objectFitKenBurnsPanEndY: number;
    chromakey: boolean;
    chromakeyBlend: number;
    chromakeySimilarity: number;
    chromakeyColor: string;
    visualFilter?: string;
    sound: 'on' | 'off';
    timecodeLabel?: string;
};
export type SequenceDefinition = {
    fragments: Fragment[];
};
export type FragmentDebugInfo = {
    id: string;
    assetName: string;
    startTime: number;
    endTime: number;
    duration: number;
    trimLeft: number;
    overlayLeft: number;
    enabled: boolean;
};
export type Output = {
    name: string;
    path: string;
    resolution: {
        width: number;
        height: number;
    };
    fps: number;
};
//# sourceMappingURL=types.d.ts.map