import { type DefaultTreeAdapterMap } from 'parse5';

export type ASTNode = DefaultTreeAdapterMap['node'];
export type Document = DefaultTreeAdapterMap['document'];
export type Element = DefaultTreeAdapterMap['element'];

export type CSSProperties = {
  [key: string]: string;
};

export type ParsedHtml = {
  ast: Document;
  css: Map<Element, CSSProperties>;
  // cssRules: csstree.CssNode;
};

export type Asset = {
  name: string; // e.g. "clip1"
  path: string; // e.g. "./assets/clip1.mp4"
  author?: string; // e.g. "John Doe"
  type: 'video' | 'image' | 'audio';
  duration: number; // in ms
  width: number;
  height: number;
  rotation: number; // rotation in degrees (0, 90, 180, 270)
};

export type Fragment = {
  enabled: boolean;
  assetName: string;
  duration: number; // calculated, in seconds (can come from CSS or from the asset's duration)
  trimStart: number; // in seconds
  overlayLeft: number; // amount of seconds to overlay with the previous fragment (normalized from margin-left + prev margin-right)
  transitionIn: string; // how to transition into the fragment
  transitionInDuration: number; // how long the transition in lasts
  transitionOut: string; // how to transition out of the fragment
  transitionOutDuration: number; // how long the transition out lasts
  objectFit: 'cover' | 'contain';
  objectFitContain: 'ambient' | 'pillarbox';

  // probably don't need it:
  zIndex: number; // order of layering
  blendModeLeft: string; // how to blend with the previous fragment (normalized from -blend-mode-left + prev -blend-mode-right)
};

export type SequenceDefinition = {
  fragments: Fragment[];
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

export type ProjectStructure = {
  sequences: SequenceDefinition[];
  assets: Map<string, Asset>;
  assetIndexMap: Map<string, number>; // assetName -> ffmpeg input index
  output: Output;
};
