import { CompiledExpression } from './expression-parser';

export type Asset = {
  name: string; // e.g. "clip1"
  path: string; // e.g. "./assets/clip1.mp4"
  author?: string; // e.g. "John Doe"
  type: 'video' | 'image' | 'audio';
  duration: number; // in ms
  width: number;
  height: number;
  rotation: number; // rotation in degrees (0, 90, 180, 270)
  hasVideo: boolean; // whether the asset has a video stream
  hasAudio: boolean; // whether the asset has an audio stream
};

export type Fragment = {
  id: string;
  enabled: boolean;
  assetName: string;
  duration: number | CompiledExpression; // calculated, in milliseconds
  trimLeft: number | CompiledExpression; // in milliseconds
  overlayLeft: number | CompiledExpression; // milliseconds to overlay with previous fragment
  overlayZIndex: number;
  transitionIn: string; // how to transition into the fragment
  transitionInDuration: number; // how long the transition in lasts (milliseconds)
  transitionOut: string; // how to transition out of the fragment
  transitionOutDuration: number; // how long the transition out lasts (milliseconds)
  objectFit: 'cover' | 'contain' | 'ken-burns';
  objectFitContain: 'ambient' | 'pillarbox';
  objectFitContainAmbientBlurStrength: number;
  objectFitContainAmbientBrightness: number;
  objectFitContainAmbientSaturation: number;
  objectFitContainPillarboxColor: string;
  objectFitKenBurns:
    | 'zoom-in'
    | 'zoom-out'
    | 'pan-left'
    | 'pan-right'
    | 'pan-top'
    | 'pan-bottom';
  objectFitKenBurnsZoom: number; // zoom percentage
  objectFitKenBurnsEffectDuration: number; // duration in milliseconds
  objectFitKenBurnsEasing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  objectFitKenBurnsFocalX: number; // focal point X in percent (0-100)
  objectFitKenBurnsFocalY: number; // focal point Y in percent (0-100)
  objectFitKenBurnsPanStartX: number; // pan start position X in percent
  objectFitKenBurnsPanStartY: number; // pan start position Y in percent
  objectFitKenBurnsPanEndX: number; // pan end position X in percent
  objectFitKenBurnsPanEndY: number; // pan end position Y in percent
  chromakey: boolean;
  chromakeyBlend: number;
  chromakeySimilarity: number;
  chromakeyColor: string;
  visualFilter?: string; // Optional visual filter (e.g., 'instagram-nashville')
  sound: 'on' | 'off'; // Whether to use asset audio or silence
  timecodeLabel?: string; // Optional label for timecode
};

export type SequenceDefinition = {
  fragments: Fragment[];
};

export type FragmentDebugInfo = {
  id: string;
  assetName: string;
  startTime: number; // absolute start time in milliseconds
  endTime: number; // absolute end time in milliseconds
  duration: number; // fragment duration in milliseconds
  trimLeft: number; // trim from asset start in milliseconds
  overlayLeft: number; // overlay with previous fragment in milliseconds
  enabled: boolean;
};

export type Output = {
  name: string; // e.g. "youtube"
  path: string; // e.g. "./output/video.mp4"
  resolution: {
    width: number;
    height: number;
  };
  fps: number; // e.g. 30
};
