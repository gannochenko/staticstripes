import {
  ParsedHtml,
  ProjectStructure,
  Asset,
  Output,
  Element,
  ASTNode,
  Sequence,
  Fragment,
} from './type';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { Label } from './ffmpeg';

const execFileAsync = promisify(execFile);

export class Project {
  private assetIndexMap: Map<string, number> = new Map();

  constructor(
    private sequences: Sequence[],
    private assets: Asset[],
    private output: Output,
  ) {
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

  public getSequences(): Sequence[] {
    return this.sequences;
  }

  public getOutput(): Output {
    return this.output;
  }

  public getInputLabelByAssetName(name: string): Label {
    const assetIndex = this.assetIndexMap.get(name);
    const asset = this.getAssetByName(name);
    const isAudio = !!(asset?.type === 'audio');

    return {
      tag: `${assetIndex}:${isAudio ? 'a' : 'v'}`,
      isAudio,
    };
  }
}

export async function prepareProject(
  html: ParsedHtml,
  projectPath: string,
): Promise<Project> {
  const projectDir = dirname(projectPath);
  const assets = await processAssets(html, projectDir);
  const output = processOutput(html, projectDir);
  const sequences = processSequences(html, assets);

  return new Project(sequences, assets, output);
}

/**
 * Processes asset elements from the parsed HTML and builds an assets map
 */
async function processAssets(
  html: ParsedHtml,
  projectDir: string,
): Promise<Asset[]> {
  const result: Asset[] = [];

  // Find all elements with class "asset" or data-asset attribute
  const assetElements = findAssetElements(html);

  for (const element of assetElements) {
    const asset = await extractAssetFromElement(element, projectDir);
    if (asset) {
      result.push(asset);
    }
  }

  return result;
}

/**
 * Finds all asset elements in the HTML
 */
function findAssetElements(html: ParsedHtml): Element[] {
  const results: Element[] = [];

  function traverse(node: ASTNode) {
    if ('tagName' in node) {
      const element = node as Element;

      // Check if element is an <asset> tag
      if (element.tagName === 'asset') {
        results.push(element);
      }
    }

    if ('childNodes' in node && node.childNodes) {
      for (const child of node.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(html.ast);
  return results;
}

/**
 * Extracts asset information from an element
 */
async function extractAssetFromElement(
  element: Element,
  projectDir: string,
): Promise<Asset | null> {
  const attrs = new Map(element.attrs.map((attr) => [attr.name, attr.value]));

  // Extract name (required)
  const name = attrs.get('data-name') || attrs.get('id');
  if (!name) {
    console.warn('Asset element missing data-name or id attribute');
    return null;
  }

  // Extract path (required)
  const relativePath = attrs.get('data-path') || attrs.get('src');
  if (!relativePath) {
    console.warn(`Asset "${name}" missing data-path or src attribute`);
    return null;
  }

  // Resolve to absolute path
  const absolutePath = resolve(projectDir, relativePath);

  // Extract type (required)
  let type: 'video' | 'image' | 'audio';
  const explicitType = attrs.get('data-type');
  if (
    explicitType === 'video' ||
    explicitType === 'image' ||
    explicitType === 'audio'
  ) {
    type = explicitType;
  } else {
    // Infer from tag name or file extension
    type = inferAssetType(element.tagName, relativePath);
  }

  // Get duration using ffprobe (in ms) - only for audio/video
  const duration = await getAssetDuration(absolutePath, type);

  // Get dimensions using ffprobe - for video and image
  const { width, height } = await getAssetDimensions(absolutePath, type);

  // Get rotation using ffprobe - for video and image
  const rotation = await getAssetRotation(absolutePath, type);

  console.log(
    `Asset "${name}" dimensions: w=${width}, h=${height}, rotation: ${rotation}°`,
  );

  // Extract author (optional)
  const author = attrs.get('data-author');

  return {
    name,
    path: absolutePath,
    type,
    duration,
    width,
    height,
    rotation,
    ...(author && { author }),
  };
}

/**
 * Infers asset type from tag name or file path
 */
function inferAssetType(
  tagName: string,
  path: string,
): 'video' | 'image' | 'audio' {
  // Check tag name first
  if (tagName === 'video') return 'video';
  if (tagName === 'img') return 'image';
  if (tagName === 'audio') return 'audio';

  // Check file extension
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return 'image';
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return 'audio';

  // Default to video
  return 'video';
}

/**
 * Gets the duration of an asset file using ffprobe
 * @param path - Path to the asset file
 * @param type - Asset type (video, audio, or image)
 * @returns Duration in milliseconds
 */
async function getAssetDuration(
  path: string,
  type: 'video' | 'image' | 'audio',
): Promise<number> {
  // Images don't have duration, skip ffprobe
  if (type === 'image') {
    return 0;
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]);

    const durationSeconds = parseFloat(stdout.trim());
    if (isNaN(durationSeconds)) {
      console.warn(`Could not parse duration for asset: ${path}`);
      return 0;
    }

    return Math.round(durationSeconds * 1000);
  } catch (error) {
    console.error(`Failed to get duration for asset: ${path}`, error);
    return 0;
  }
}

/**
 * Gets the rotation of an asset file using ffprobe
 * @param path - Path to the asset file
 * @param type - Asset type (video, audio, or image)
 * @returns Rotation in degrees (0, 90, 180, 270)
 */
async function getAssetRotation(
  path: string,
  type: 'video' | 'image' | 'audio',
): Promise<number> {
  // Audio files don't have rotation
  if (type === 'audio') {
    return 0;
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream_side_data=rotation',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]);

    const rotation = parseInt(stdout.trim(), 10);

    if (isNaN(rotation)) {
      // No rotation metadata found
      return 0;
    }

    // Normalize to 0, 90, 180, 270
    const normalized = Math.abs(rotation) % 360;
    return normalized;
  } catch (error) {
    // No rotation metadata or error - default to 0
    return 0;
  }
}

/**
 * Gets the dimensions of an asset file using ffprobe
 * @param path - Path to the asset file
 * @param type - Asset type (video, audio, or image)
 * @returns Object with width and height in pixels
 */
async function getAssetDimensions(
  path: string,
  type: 'video' | 'image' | 'audio',
): Promise<{ width: number; height: number }> {
  // Audio files don't have dimensions
  if (type === 'audio') {
    return { width: 0, height: 0 };
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=s=x:p=0',
      path,
    ]);

    const dimensions = stdout.trim();
    const [widthStr, heightStr] = dimensions.split('x');
    const width = parseInt(widthStr, 10);
    const height = parseInt(heightStr, 10);

    if (isNaN(width) || isNaN(height)) {
      console.warn(`Could not parse dimensions for asset: ${path}`);
      return { width: 0, height: 0 };
    }

    return { width, height };
  } catch (error) {
    console.error(`Failed to get dimensions for asset: ${path}`, error);
    return { width: 0, height: 0 };
  }
}

/**
 * Processes output configuration from the parsed HTML
 */
function processOutput(html: ParsedHtml, projectDir: string): Output {
  const outputElements = findOutputElements(html);

  // Use first output element, or return defaults if none found
  if (outputElements.length === 0) {
    console.warn('No output elements found, using defaults');
    return {
      name: 'output',
      path: resolve(projectDir, './output/video.mp4'),
      resolution: { width: 1920, height: 1080 },
      fps: 30,
    };
  }

  const element = outputElements[0];
  const attrs = new Map(element.attrs.map((attr) => [attr.name, attr.value]));

  // Extract name
  const name = attrs.get('name') || 'output';

  // Extract and resolve path
  const relativePath = attrs.get('path') || './output/video.mp4';
  const path = resolve(projectDir, relativePath);

  // Extract and parse resolution (format: "1920x1080")
  const resolutionStr = attrs.get('resolution') || '1920x1080';
  const [widthStr, heightStr] = resolutionStr.split('x');
  const resolution = {
    width: parseInt(widthStr, 10) || 1920,
    height: parseInt(heightStr, 10) || 1080,
  };

  // Extract fps
  const fpsStr = attrs.get('fps');
  const fps = fpsStr ? parseInt(fpsStr, 10) : 30;

  return {
    name,
    path,
    resolution,
    fps,
  };
}

/**
 * Finds all output elements in the HTML
 */
function findOutputElements(html: ParsedHtml): Element[] {
  const results: Element[] = [];

  function traverse(node: ASTNode) {
    if ('tagName' in node) {
      const element = node as Element;

      // Check if element is an <output> tag
      if (element.tagName === 'output') {
        results.push(element);
      }
    }

    if ('childNodes' in node && node.childNodes) {
      for (const child of node.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(html.ast);
  return results;
}

/**
 * Processes sequences and fragments from the parsed HTML
 */
function processSequences(html: ParsedHtml, assets: Asset[]): Sequence[] {
  const sequenceElements = findSequenceElements(html);
  const sequences: Sequence[] = [];

  const assetMap: Map<string, Asset> = new Map();
  assets.forEach((ass) => assetMap.set(ass.name, ass));

  for (const sequenceElement of sequenceElements) {
    const fragmentElements = findFragmentChildren(sequenceElement);
    const rawFragments: Array<
      Fragment & { overlayRight: number; blendModeRight: string }
    > = [];

    for (const fragmentElement of fragmentElements) {
      const fragment = processFragment(fragmentElement, html, assetMap);
      if (fragment) {
        rawFragments.push(fragment);
      }
    }

    // Normalize overlays and blend modes: combine prev's overlayRight/blendModeRight with current's overlayLeft/blendModeLeft
    const fragments: Fragment[] = rawFragments.map((frag, idx) => {
      if (idx === 0) {
        // First fragment: keep overlayLeft/blendModeLeft as-is, remove overlayRight/blendModeRight
        const { overlayRight, blendModeRight, ...rest } = frag;
        return rest;
      }

      const prevOverlayRight = rawFragments[idx - 1].overlayRight;
      const prevBlendModeRight = rawFragments[idx - 1].blendModeRight;
      const { overlayRight, blendModeRight, blendModeLeft, ...rest } = frag;

      // Blend mode priority: current blendModeLeft > prev blendModeRight
      const normalizedBlendModeLeft = blendModeLeft || prevBlendModeRight;

      return {
        ...rest,
        overlayLeft: frag.overlayLeft + prevOverlayRight,
        blendModeLeft: normalizedBlendModeLeft,
      };
    });

    sequences.push({ fragments });
  }

  return sequences;
}

/**
 * Finds all sequence elements that are direct children of <project>
 */
function findSequenceElements(html: ParsedHtml): Element[] {
  // First find the <project> element
  const projectElement = findProjectElement(html);
  if (!projectElement) {
    console.warn('No <project> element found');
    return [];
  }

  // Get direct sequence children only
  const sequences: Element[] = [];
  if ('childNodes' in projectElement && projectElement.childNodes) {
    for (const child of projectElement.childNodes) {
      if ('tagName' in child) {
        const element = child as Element;
        if (element.tagName === 'sequence') {
          sequences.push(element);
        }
      }
    }
  }

  return sequences;
}

/**
 * Finds the <project> root element
 */
function findProjectElement(html: ParsedHtml): Element | null {
  function traverse(node: ASTNode): Element | null {
    if ('tagName' in node) {
      const element = node as Element;
      if (element.tagName === 'project') {
        return element;
      }
    }

    if ('childNodes' in node && node.childNodes) {
      for (const child of node.childNodes) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    return null;
  }

  return traverse(html.ast);
}

/**
 * Finds all fragment descendants of a sequence element (not just direct children)
 * Parse5 treats self-closing custom tags as opening tags, nesting subsequent elements
 */
function findFragmentChildren(sequenceElement: Element): Element[] {
  const fragments: Element[] = [];

  function traverse(node: ASTNode) {
    if ('tagName' in node) {
      const element = node as Element;
      if (element.tagName === 'fragment') {
        fragments.push(element);
      }
    }

    if ('childNodes' in node && node.childNodes) {
      for (const child of node.childNodes) {
        traverse(child);
      }
    }
  }

  // Start traversing from the sequence element's children
  if ('childNodes' in sequenceElement && sequenceElement.childNodes) {
    for (const child of sequenceElement.childNodes) {
      traverse(child);
    }
  }

  return fragments;
}

/**
 * Processes a single fragment element
 * Returns fragment with temporary overlayRight and blendModeLeft/Right for normalization
 */
function processFragment(
  element: Element,
  html: ParsedHtml,
  assets: Map<string, Asset>,
): (Fragment & { overlayRight: number; blendModeRight: string }) | null {
  const attrs = new Map(element.attrs.map((attr) => [attr.name, attr.value]));
  const styles = html.css.get(element) || {};

  // Extract assetName from data-asset attribute or CSS -asset property
  // If no asset is specified, use empty string (asset will be created on demand)
  const assetName = attrs.get('data-asset') || styles['-asset'] || '';

  // Extract zIndex from CSS z-index property (default to 0)
  const zIndexStr = styles['z-index'];
  const zIndex = zIndexStr ? parseInt(zIndexStr, 10) : 0;

  // Extract duration from CSS width property
  const duration = parseDuration(styles['width'], assetName, assets);

  // Extract overlayLeft from CSS margin-left property (in ms, can be negative)
  const overlayLeft = parseTimeValue(styles['margin-left']);

  // Extract overlayRight from CSS margin-right property (in ms, can be negative)
  // This is temporary and will be normalized in processSequences
  const overlayRight = parseTimeValue(styles['margin-right']);

  // Extract blend modes from CSS -blend-mode-left and -blend-mode-right
  const blendModeLeft = parseBlendMode(styles['-blend-mode-left']);
  const blendModeRight = parseBlendMode(styles['-blend-mode-right']);

  // Extract transitions from CSS -transition-in and -transition-out
  const transitionIn = parseTransition(styles['-transition-in']);
  const transitionOut = parseTransition(styles['-transition-out']);

  // Extract objectFit from CSS object-fit property (default: "cover")
  const objectFit = parseObjectFit(styles['object-fit']);

  // Extract objectFitContain from CSS -object-fit-contain property (default: "ambient")
  const objectFitContain: 'ambient' | 'pillarbox' =
    styles['-object-fit-contain'] === 'pillarbox' ? 'pillarbox' : 'ambient';

  return {
    assetName,
    duration,
    overlayLeft,
    overlayRight, // Temporary, will be normalized
    blendModeLeft, // Will be normalized with prev blendModeRight
    blendModeRight, // Temporary, will be normalized
    transitionIn: transitionIn.name,
    transitionInDuration: transitionIn.duration,
    transitionOut: transitionOut.name,
    transitionOutDuration: transitionOut.duration,
    zIndex,
    objectFit,
    objectFitContain,
  };
}

/**
 * Parses duration from CSS width value
 * @param width - CSS width value (e.g., "5s", "100%", "50%", undefined)
 * @param assetName - Name of the asset this fragment uses
 * @param assets - Map of all assets
 * @returns Duration in milliseconds
 */
function parseDuration(
  width: string | undefined,
  assetName: string,
  assets: Map<string, Asset>,
): number {
  if (!width) {
    return 0;
  }

  // Handle percentage (e.g., 100%, 50%, 70%)
  if (width.endsWith('%')) {
    let percentage = parseFloat(width);
    if (isNaN(percentage)) {
      return 0;
    }

    // Cap percentages above 100% at 100%
    if (percentage > 100) {
      percentage = 100;
    }

    const asset = assets.get(assetName);
    if (!asset) {
      // No asset, return 0
      return 0;
    }

    // Images don't have duration, so any percentage is 0
    if (asset.type === 'image') {
      return 0;
    }

    // Calculate percentage of asset duration
    return Math.round((asset.duration * percentage) / 100);
  }

  // Handle seconds (e.g., "5s")
  return parseTimeValue(width);
}

/**
 * Parses a time value from CSS (e.g., "0.5s", "-0.5s")
 * @param value - CSS time value in seconds
 * @returns Time in milliseconds (can be negative)
 */
function parseTimeValue(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  // Handle seconds (e.g., "0.5s", "-0.5s")
  if (value.endsWith('s')) {
    const seconds = parseFloat(value);
    if (!isNaN(seconds)) {
      return Math.round(seconds * 1000);
    }
  }

  return 0;
}

/**
 * Parses a blend mode value from CSS
 * @param value - CSS blend mode value
 * @returns Blend mode string (e.g., "screen", "overlay", "multiply") or empty string if invalid
 */
function parseBlendMode(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  // Allow common blend modes
  const validBlendModes = [
    'screen',
    'multiply',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
  ];

  if (validBlendModes.includes(trimmed)) {
    return trimmed;
  }

  // Default to empty string for invalid blend modes
  return '';
}

/**
 * Parses a transition value from CSS (format: "[transition_name] [transition_duration]")
 * @param value - CSS transition value (e.g., "fade-to-black 1s", "fade-out 0.5s")
 * @returns Object with transition name and duration in milliseconds
 */
function parseTransition(value: string | undefined): {
  name: string;
  duration: number;
} {
  if (!value) {
    return { name: '', duration: 0 };
  }

  const trimmed = value.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 0) {
    return { name: '', duration: 0 };
  }

  // First part is the transition name
  const name = parts[0];

  // Second part is the duration (if present)
  const duration = parts.length > 1 ? parseTimeValue(parts[1]) : 0;

  return { name, duration };
}

/**
 * Parses objectFit value from CSS
 * @param value - CSS object-fit value
 * @returns "cover" or "contain" (defaults to "cover")
 */
function parseObjectFit(value: string | undefined): 'cover' | 'contain' {
  if (!value) {
    return 'cover';
  }

  const trimmed = value.trim();

  if (trimmed === 'contain') {
    return 'contain';
  }

  // Default to cover for any other value
  return 'cover';
}
