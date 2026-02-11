import type { AnyNode, Document, Element } from 'domhandler';
import { CompiledExpression } from './expression-parser';

export type ASTNode = AnyNode;
export type { Document, Element };

export type CSSProperties = {
  [key: string]: string;
};

export type Container = {
  id: string;
  htmlContent: string;
};

export type ParsedHtml = {
  ast: Document;
  css: Map<Element, CSSProperties>;
  cssText: string; // Full CSS text from <style> tags
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
  hasVideo: boolean; // whether the asset has a video stream
  hasAudio: boolean; // whether the asset has an audio stream
  ai?: {
    integrationName: string; // References AI integration name from <ai> section
    prompt: string; // Generation prompt
    duration?: number; // Optional duration in seconds for generation
  };
};

export type Fragment = {
  id: string;
  enabled: boolean;
  assetName: string;
  duration: number; // calculated, in seconds (can come from CSS or from the asset's duration)
  trimLeft: number; // in seconds
  overlayLeft: number | CompiledExpression; // amount of seconds to overlay with the previous fragment (normalized from margin-left + prev margin-right)
  overlayZIndex: number;
  transitionIn: string; // how to transition into the fragment
  transitionInDuration: number; // how long the transition in lasts
  transitionOut: string; // how to transition out of the fragment
  transitionOutDuration: number; // how long the transition out lasts
  objectFit: 'cover' | 'contain';
  objectFitContain: 'ambient' | 'pillarbox';
  objectFitContainAmbientBlurStrength: number;
  objectFitContainAmbientBrightness: number;
  objectFitContainAmbientSaturation: number;
  objectFitContainPillarboxColor: string;
  chromakey: boolean;
  chromakeyBlend: number;
  chromakeySimilarity: number;
  chromakeyColor: string;
  visualFilter?: string; // Optional visual filter (e.g., 'instagram-nashville')
  container?: Container; // Optional container attached to this fragment
  timecodeLabel?: string; // Optional label for timecode (from data-timecode attribute)
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

export type FFmpegOption = {
  name: string; // e.g. "preview", "production"
  args: string; // e.g. "-c:v h264_nvenc -preset fast"
};

export type Upload = {
  name: string; // e.g. "yt_primary", "s3_backup"
  tag: string; // e.g. "youtube", "s3" - used to identify upload provider
  outputName: string; // e.g. "youtube" - references Output name
  title?: string; // Upload-specific title (optional, falls back to global title)
  videoId?: string; // Video ID after upload (YouTube, etc.)
  privacy: 'public' | 'unlisted' | 'private';
  madeForKids: boolean;
  tags: string[];
  category: string; // e.g. "entertainment"
  language: string; // e.g. "en"
  description: string; // Pre-processed description (can contain EJS)
  thumbnailTimecode?: number; // Milliseconds, if thumbnail should be extracted from video
  // S3-specific configuration
  s3?: {
    endpoint?: string; // e.g. "digitaloceanspaces.com"
    region: string; // e.g. "ams3", "us-east-1"
    bucket: string; // e.g. "my-bucket"
    path: string; // e.g. "videos/${slug}/${output}.mp4"
    acl?: string; // e.g. "public-read", "private"
  };
  // Instagram-specific configuration
  instagram?: {
    caption: string; // Caption/description for the Reel
    shareToFeed: boolean; // Whether to share to Feed in addition to Reels tab
    thumbOffset?: number; // Thumbnail frame location in milliseconds
    coverUrl?: string; // Optional cover image URL
    videoUrl?: string; // Public URL to video (if not auto-generated from S3)
  };
};

// Legacy alias for backward compatibility
export type YouTubeUpload = Upload;

export type AIProvider = {
  name: string; // e.g. "music-api" - used to reference this provider in assets
  tag: string; // e.g. "music-api-ai" - used to identify provider type
  model?: string; // e.g. "sonic-v3-5" - optional model name
};

export type ProjectStructure = {
  sequences: SequenceDefinition[];
  assets: Map<string, Asset>;
  assetIndexMap: Map<string, number>; // assetName -> ffmpeg input index
  output: Output;
};
