import type { AnyNode, Document, Element } from 'domhandler';

export type ASTNode = AnyNode;
export type { Document, Element };

export type CSSProperties = {
  [key: string]: string;
};

/**
 * Asset definition
 * Can reference either a file path OR a node output via `input` attribute
 */
export interface Asset {
  /** Asset name (e.g., "clip_01") */
  name: string;

  /** File path (e.g., "./input/video.mp4") OR undefined if using `input` */
  path?: string;

  /** Node output reference (e.g., "ai_music_api_ai.intro_song.audio") */
  input?: string;

  /** Author attribution */
  author?: string;
}

/**
 * Output configuration
 */
export interface Output {
  /** Output name (e.g., "youtube", "youtube_shorts") */
  name: string;

  /** Resolution string (e.g., "1920x1080") */
  resolution: string;

  /** Frame rate (e.g., 30) */
  fps: number;
}

/**
 * Fragment definition
 */
export interface Fragment {
  /** Fragment class attribute */
  class?: string;

  /** Fragment id attribute */
  id?: string;

  /** Timecode label */
  timecode?: string;

  /** Raw element for accessing children */
  element: Element;
}

/**
 * Sequence definition
 */
export interface Sequence {
  /** Fragments in this sequence */
  fragments: Fragment[];
}

/**
 * FFmpeg encoding option
 */
export interface FFmpegOption {
  /** Option name (e.g., "preview", "meh") */
  name: string;

  /** FFmpeg arguments string */
  args: string;
}

/**
 * Parsed project node content
 */
export interface ProjectContent {
  /** Project title */
  title?: string;

  /** Project tags */
  tags: string[];

  /** CSS text from <style> tags */
  cssText: string;

  /** Parsed CSS rules mapped to elements */
  css: Map<Element, CSSProperties>;

  /** Asset definitions */
  assets: Asset[];

  /** Output configurations */
  outputs: Output[];

  /** Sequences with fragments */
  sequences: Sequence[];

  /** FFmpeg encoding options */
  ffmpegOptions: FFmpegOption[];
}

/**
 * Represents a parsed node from the HTML
 */
export interface ParsedNode {
  /** Node type (e.g., "project", "filesystem", "youtube", "s3", etc.) */
  type: string;

  /** Node name from the name attribute (optional for project node) */
  name?: string;

  /** Raw element for accessing children and attributes */
  element: Element;

  /** Parsed attributes as a Map */
  attributes: Map<string, string>;

  /** Child elements */
  children: Element[];

  /** Parsed project content (only for project nodes) */
  projectContent?: ProjectContent;
}

/**
 * Represents the complete parsed project
 */
export interface ParsedProject {
  /** The AST of the parsed HTML document */
  ast: Document;

  /** All nodes found in the document */
  nodes: ParsedNode[];

  /** Project node (should be exactly one) */
  projectNode: ParsedNode | null;
}
