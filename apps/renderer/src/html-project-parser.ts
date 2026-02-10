import {
  ParsedHtml,
  Asset,
  Output,
  Element,
  ASTNode,
  SequenceDefinition,
  Fragment,
  Container,
  FFmpegOption,
  Upload,
} from './type';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { Project } from './project';
import { parseValueLazy, CompiledExpression } from './expression-parser';

const execFileAsync = promisify(execFile);

/**
 * Helper to get attributes as a Map from htmlparser2 element
 */
function getAttrs(element: Element): Map<string, string> {
  const map = new Map<string, string>();
  if (element.attribs) {
    for (const [name, value] of Object.entries(element.attribs)) {
      map.set(name, value);
    }
  }
  return map;
}

export class HTMLProjectParser {
  private projectDir: string;

  constructor(
    private html: ParsedHtml,
    private projectPath: string,
  ) {
    this.projectDir = dirname(projectPath);
  }

  public async parse(): Promise<Project> {
    const assets = await this.processAssets();

    // Preflight check: verify all assets exist
    this.validateAssetFiles(assets);

    const outputs = this.processOutputs();
    const ffmpegOptions = this.processFfmpegOptions();
    const title = this.processTitle();
    const globalTags = this.processGlobalTags();
    const uploads = this.processUploads(title, globalTags);
    const sequences = this.processSequences(assets);
    const cssText = this.html.cssText;

    return new Project(
      sequences,
      assets,
      outputs,
      ffmpegOptions,
      uploads,
      title,
      cssText,
      this.projectPath,
    );
  }

  /**
   * Validates that all asset files exist on the filesystem
   * Throws an error with a list of missing files if any are not found
   */
  private validateAssetFiles(assets: Asset[]): void {
    const missingFiles: string[] = [];

    for (const asset of assets) {
      if (!existsSync(asset.path)) {
        missingFiles.push(asset.path);
      }
    }

    if (missingFiles.length > 0) {
      const fileList = missingFiles.map(f => `  - ${f}`).join('\n');
      throw new Error(
        `Asset file(s) not found:\n${fileList}\n\nPlease check that all asset paths in project.html are correct.`
      );
    }
  }

  /**
   * Processes asset elements from the parsed HTML and builds an assets map
   */
  private async processAssets(): Promise<Asset[]> {
    const result: Asset[] = [];

    // Find all elements with class "asset" or data-asset attribute
    const assetElements = this.findAssetElements();

    for (const element of assetElements) {
      const asset = await this.extractAssetFromElement(element);
      if (asset) {
        result.push(asset);
      }
    }

    return result;
  }

  /**
   * Finds all asset elements in the HTML
   */
  private findAssetElements(): Element[] {
    const results: Element[] = [];

    const traverse = (node: ASTNode) => {
      if (node.type === 'tag') {
        const element = node as Element;

        // Check if element is an <asset> tag
        if (element.name === 'asset') {
          results.push(element);
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.html.ast);
    return results;
  }

  /**
   * Extracts asset information from an element
   */
  private async extractAssetFromElement(
    element: Element,
  ): Promise<Asset | null> {
    const attrs = getAttrs(element);

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
    const absolutePath = resolve(this.projectDir, relativePath);

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
      type = this.inferAssetType(element.name, relativePath);
    }

    // Get duration using ffprobe (in ms) - only for audio/video
    const duration = await this.getAssetDuration(absolutePath, type);

    // Get dimensions using ffprobe - for video and image
    const { width, height } = await this.getAssetDimensions(absolutePath, type);

    // Get rotation using ffprobe - for video and image
    const rotation = await this.getAssetRotation(absolutePath, type);

    // Check if asset has video stream
    const hasVideo = await this.getHasVideo(absolutePath, type);

    // Check if asset has audio stream
    const hasAudio = await this.getHasAudio(absolutePath, type);

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
      hasVideo,
      hasAudio,
      ...(author && { author }),
    };
  }

  /**
   * Infers asset type from tag name or file path
   */
  private inferAssetType(
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
  private async getAssetDuration(
    path: string,
    type: 'video' | 'image' | 'audio',
  ): Promise<number> {
    // Images don't have duration, skip ffprobe
    if (type === 'image') {
      return 0;
    }

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
      throw new Error(`Could not parse duration for asset: ${path}`);
    }

    return Math.round(durationSeconds * 1000);
  }

  /**
   * Gets the rotation of an asset file using ffprobe
   * @param path - Path to the asset file
   * @param type - Asset type (video, audio, or image)
   * @returns Rotation in degrees (0, 90, 180, 270)
   */
  private async getAssetRotation(
    path: string,
    type: 'video' | 'image' | 'audio',
  ): Promise<number> {
    // Audio files don't have rotation
    if (type === 'audio') {
      return 0;
    }

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
  }

  /**
   * Gets the dimensions of an asset file using ffprobe
   * @param path - Path to the asset file
   * @param type - Asset type (video, audio, or image)
   * @returns Object with width and height in pixels
   */
  private async getAssetDimensions(
    path: string,
    type: 'video' | 'image' | 'audio',
  ): Promise<{ width: number; height: number }> {
    // Audio files don't have dimensions
    if (type === 'audio') {
      return { width: 0, height: 0 };
    }

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
      throw new Error(`Could not parse dimensions for: ${path}`);
    }

    return { width, height };
  }

  /**
   * Checks if an asset file has a video stream using ffprobe
   * @param _path - Path to the asset file (unused for now, type-based check)
   * @param type - Asset type (video, audio, or image)
   * @returns True if the asset has a video stream
   */
  private async getHasVideo(
    _path: string,
    type: 'video' | 'image' | 'audio',
  ): Promise<boolean> {
    // Audio files don't have video
    if (type === 'audio') {
      return false;
    }

    // Video and image files always have video
    if (type === 'video' || type === 'image') {
      return true;
    }

    return false;
  }

  /**
   * Checks if an asset file has an audio stream using ffprobe
   * @param path - Path to the asset file
   * @param type - Asset type (video, audio, or image)
   * @returns True if the asset has an audio stream
   */
  private async getHasAudio(
    path: string,
    type: 'video' | 'image' | 'audio',
  ): Promise<boolean> {
    // Images don't have audio
    if (type === 'image') {
      return false;
    }

    // Audio files always have audio
    if (type === 'audio') {
      return true;
    }

    // For video, probe for audio stream
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]);

    // If we get output, an audio stream exists
    return stdout.trim() === 'audio';
  }

  /**
   * Processes all output configurations from the parsed HTML
   * Returns a map of output name => Output definition
   */
  private processOutputs(): Map<string, Output> {
    const outputElements = this.findOutputElements();
    const outputs = new Map<string, Output>();

    // If no outputs found, create default
    if (outputElements.length === 0) {
      console.warn('No output elements found, using defaults');
      const defaultOutput: Output = {
        name: 'output',
        path: resolve(this.projectDir, './output/video.mp4'),
        resolution: { width: 1920, height: 1080 },
        fps: 30,
      };
      outputs.set(defaultOutput.name, defaultOutput);
      return outputs;
    }

    // Process each output element
    for (const element of outputElements) {
      const attrs = getAttrs(element);

      // Extract name
      const name = attrs.get('name') || 'output';

      // Extract and resolve path
      const relativePath = attrs.get('path') || `./output/${name}.mp4`;
      const path = resolve(this.projectDir, relativePath);

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

      const output: Output = {
        name,
        path,
        resolution,
        fps,
      };

      outputs.set(name, output);
    }

    return outputs;
  }

  /**
   * Finds all output elements in the HTML
   */
  private findOutputElements(): Element[] {
    const results: Element[] = [];

    const traverse = (node: ASTNode) => {
      if (node.type === 'tag') {
        const element = node as Element;

        // Check if element is an <output> tag
        if (element.name === 'output') {
          results.push(element);
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.html.ast);
    return results;
  }

  /**
   * Processes ffmpeg options from the parsed HTML
   */
  private processFfmpegOptions(): Map<string, FFmpegOption> {
    const ffmpegElements = this.findFfmpegElements();
    const options = new Map<string, FFmpegOption>();

    // Process each <ffmpeg> element (should typically be only one)
    for (const ffmpegElement of ffmpegElements) {
      // Find all <option> child elements
      if ('children' in ffmpegElement && ffmpegElement.children) {
        for (const child of ffmpegElement.children) {
          if (child.type === 'tag') {
            const childElement = child as Element;
            if (childElement.name === 'option') {
              const attrs = getAttrs(childElement);

              const name = attrs.get('name');
              if (!name) {
                continue; // Skip options without name
              }

              // Get the text content (the FFmpeg arguments)
              let args = '';
              if ('children' in childElement && childElement.children) {
                for (const textNode of childElement.children) {
                  if (textNode.type === 'text' && 'data' in textNode) {
                    args += textNode.data;
                  }
                }
              }

              // Trim whitespace
              args = args.trim();

              const option: FFmpegOption = {
                name,
                args,
              };

              options.set(name, option);
            }
          }
        }
      }
    }

    return options;
  }

  /**
   * Finds all ffmpeg elements in the HTML
   */
  private findFfmpegElements(): Element[] {
    const results: Element[] = [];

    const traverse = (node: ASTNode) => {
      if (node.type === 'tag') {
        const element = node as Element;

        // Check if element is an <ffmpeg> tag
        if (element.name === 'ffmpeg') {
          results.push(element);
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.html.ast);
    return results;
  }

  /**
   * Processes all uploads (YouTube, S3, etc.) from the parsed HTML
   */
  private processUploads(
    projectTitle: string,
    globalTags: string[],
  ): Map<string, Upload> {
    const uploadsElements = this.findUploadsElements();
    const uploads = new Map<string, Upload>();

    for (const uploadsElement of uploadsElements) {
      if ('children' in uploadsElement && uploadsElement.children) {
        for (const child of uploadsElement.children) {
          if (child.type === 'tag') {
            const childElement = child as Element;
            let upload: Upload | null = null;

            if (childElement.name === 'youtube') {
              upload = this.parseYouTubeElement(
                childElement,
                projectTitle,
                globalTags,
              );
            } else if (childElement.name === 's3') {
              upload = this.parseS3Element(childElement);
            } else if (childElement.name === 'instagram') {
              upload = this.parseInstagramElement(
                childElement,
                projectTitle,
                globalTags,
              );
            }

            if (upload) {
              uploads.set(upload.name, upload);
            }
          }
        }
      }
    }

    return uploads;
  }

  /**
   * Parses a single <youtube> element
   */
  private parseYouTubeElement(
    element: Element,
    projectTitle: string,
    globalTags: string[],
  ): Upload | null {
    const attrs = getAttrs(element);

    const name = attrs.get('name');
    const outputName = attrs.get('data-output-name');

    if (!name || !outputName) {
      console.warn('YouTube upload missing name or data-output-name attribute');
      return null;
    }

    const videoId = attrs.get('id') || undefined;

    // Parse child elements
    let uploadTitle: string | undefined;
    let privacy: 'public' | 'unlisted' | 'private' = 'private';
    let madeForKids = false;
    const localTags: string[] = [];
    let category = 'entertainment';
    let language = 'en';
    let description = '';
    let thumbnailTimecode: number | undefined;

    if ('children' in element && element.children) {
      for (const child of element.children) {
        if (child.type === 'tag') {
          const childElement = child as Element;

          switch (childElement.name) {
            case 'title': {
              // Get text content
              if ('children' in childElement && childElement.children) {
                for (const textNode of childElement.children) {
                  if (textNode.type === 'text' && 'data' in textNode) {
                    uploadTitle = (uploadTitle || '') + textNode.data;
                  }
                }
              }
              uploadTitle = uploadTitle?.trim();
              break;
            }
            case 'public':
              privacy = 'public';
              break;
            case 'unlisted':
              privacy = 'unlisted';
              break;
            case 'private':
              privacy = 'private';
              break;
            case 'made-for-kids':
              madeForKids = true;
              break;
            case 'tag': {
              const tagAttrs = getAttrs(childElement);
              const tagName = tagAttrs.get('name');
              if (tagName) {
                localTags.push(tagName);
              }
              break;
            }
            case 'category': {
              const catAttrs = getAttrs(childElement);
              const catName = catAttrs.get('name');
              if (catName) {
                category = catName;
              }
              break;
            }
            case 'language': {
              const langAttrs = getAttrs(childElement);
              const langName = langAttrs.get('name');
              if (langName) {
                language = langName;
              }
              break;
            }
            case 'pre': {
              // Get text content
              if ('children' in childElement && childElement.children) {
                for (const textNode of childElement.children) {
                  if (textNode.type === 'text' && 'data' in textNode) {
                    description += textNode.data;
                  }
                }
              }
              break;
            }
            case 'thumbnail': {
              const thumbAttrs = getAttrs(childElement);
              const timecode = thumbAttrs.get('data-timecode');
              if (timecode) {
                // Parse timecode (e.g., "1000ms" or "1s")
                const match = timecode.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
                if (match) {
                  const value = parseFloat(match[1]);
                  const unit = match[2];
                  thumbnailTimecode = unit === 's' ? value * 1000 : value;
                }
              }
              break;
            }
          }
        }
      }
    }

    // Merge global tags + local tags (global first)
    const allTags = [...globalTags, ...localTags];

    // Use project title if upload doesn't have its own
    const finalTitle = uploadTitle || projectTitle;

    return {
      name,
      tag: element.name, // e.g., "youtube", "s3", etc.
      outputName,
      title: finalTitle,
      videoId,
      privacy,
      madeForKids,
      tags: allTags,
      category,
      language,
      description: description.trim(),
      thumbnailTimecode,
    };
  }

  /**
   * Parses a single <s3> element
   */
  private parseS3Element(element: Element): Upload | null {
    const attrs = getAttrs(element);

    const name = attrs.get('name');
    const outputName = attrs.get('data-output-name');

    if (!name || !outputName) {
      console.warn('S3 upload missing name or data-output-name attribute');
      return null;
    }

    // Parse S3-specific child elements
    let endpoint: string | undefined;
    let region = '';
    let bucket = '';
    let path = '';
    let acl: string | undefined;

    if ('children' in element && element.children) {
      for (const child of element.children) {
        if (child.type === 'tag') {
          const childElement = child as Element;
          const childAttrs = getAttrs(childElement);

          switch (childElement.name) {
            case 'endpoint': {
              endpoint = childAttrs.get('name');
              break;
            }
            case 'region': {
              region = childAttrs.get('name') || '';
              break;
            }
            case 'bucket': {
              bucket = childAttrs.get('name') || '';
              break;
            }
            case 'path': {
              path = childAttrs.get('name') || '';
              break;
            }
            case 'acl': {
              acl = childAttrs.get('name');
              break;
            }
          }
        }
      }
    }

    // Validate required fields
    if (!region || !bucket || !path) {
      console.warn(`S3 upload "${name}" missing required fields (region, bucket, or path)`);
      return null;
    }

    return {
      name,
      tag: element.name, // "s3"
      outputName,
      privacy: 'private', // Default values for S3 (not used but required by Upload type)
      madeForKids: false,
      tags: [],
      category: '',
      language: '',
      description: '',
      s3: {
        endpoint,
        region,
        bucket,
        path,
        acl,
      },
    };
  }

  /**
   * Parses a single <instagram> element
   */
  private parseInstagramElement(
    element: Element,
    projectTitle: string,
    globalTags: string[],
  ): Upload | null {
    const attrs = getAttrs(element);

    const name = attrs.get('name');
    const outputName = attrs.get('data-output-name');

    if (!name || !outputName) {
      console.warn('Instagram upload missing name or data-output-name attribute');
      return null;
    }

    // Parse Instagram-specific child elements
    let caption = '';
    let shareToFeed = false;
    let thumbOffset: number | undefined;
    let coverUrl: string | undefined;
    let videoUrl: string | undefined;
    const localTags: string[] = [];

    if ('children' in element && element.children) {
      for (const child of element.children) {
        if (child.type === 'tag') {
          const childElement = child as Element;
          const childAttrs = getAttrs(childElement);

          switch (childElement.name) {
            case 'pre': {
              // Get text content (unified with YouTube description)
              if ('children' in childElement && childElement.children) {
                for (const textNode of childElement.children) {
                  if (textNode.type === 'text' && 'data' in textNode) {
                    caption += textNode.data;
                  }
                }
              }
              break;
            }
            case 'caption': {
              // Legacy syntax (deprecated, but still supported)
              if ('children' in childElement && childElement.children) {
                for (const textNode of childElement.children) {
                  if (textNode.type === 'text' && 'data' in textNode) {
                    caption += textNode.data;
                  }
                }
              }
              caption = caption.trim();
              break;
            }
            case 'share-to-feed': {
              shareToFeed = true;
              break;
            }
            case 'thumbnail': {
              // Unified syntax like YouTube: <thumbnail data-timecode="1000ms" />
              const timecode = childAttrs.get('data-timecode');
              if (timecode) {
                // Parse timecode (e.g., "1000ms" or "1s")
                const match = timecode.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
                if (match) {
                  const value = parseFloat(match[1]);
                  const unit = match[2];
                  thumbOffset = unit === 's' ? value * 1000 : value;
                }
              }
              break;
            }
            case 'thumb-offset': {
              // Legacy syntax (deprecated, but still supported)
              const offset = childAttrs.get('value');
              if (offset) {
                thumbOffset = parseInt(offset, 10);
              }
              break;
            }
            case 'cover-url': {
              coverUrl = childAttrs.get('value');
              break;
            }
            case 'video-url': {
              videoUrl = childAttrs.get('value');
              break;
            }
            case 'tag': {
              const tagName = childAttrs.get('name');
              if (tagName) {
                localTags.push(tagName);
              }
              break;
            }
          }
        }
      }
    }

    // Merge global tags + local tags
    const allTags = [...globalTags, ...localTags];

    return {
      name,
      tag: element.name, // "instagram"
      outputName,
      title: projectTitle,
      privacy: 'private', // Default values (not used but required by Upload type)
      madeForKids: false,
      tags: allTags,
      category: '',
      language: '',
      description: '',
      instagram: {
        caption, // Raw caption with ${variables}, will be rendered by upload strategy
        shareToFeed,
        thumbOffset,
        coverUrl,
        videoUrl,
      },
    };
  }

  /**
   * Processes global tags from the top of the HTML file (before <project>)
   */
  private processGlobalTags(): string[] {
    const tags: string[] = [];

    const traverse = (node: ASTNode, insideProject: boolean = false) => {
      if (node.type === 'tag') {
        const element = node as Element;

        // Stop when we hit <project>, <uploads>, or <outputs>
        if (
          element.name === 'project' ||
          element.name === 'uploads' ||
          element.name === 'outputs'
        ) {
          insideProject = true;
        }

        // Only parse <tag> elements outside of project/uploads/outputs
        if (!insideProject && element.name === 'tag') {
          const attrs = getAttrs(element);
          const tagName = attrs.get('name');
          if (tagName) {
            tags.push(tagName);
          }
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child, insideProject);
        }
      }
    };

    traverse(this.html.ast);
    return tags;
  }

  /**
   * Processes the title from the parsed HTML
   */
  private processTitle(): string {
    const titleElements = this.findTitleElements();

    if (titleElements.length === 0) {
      return 'Untitled Project';
    }

    // Get text content from first title element
    const titleElement = titleElements[0];
    let title = '';

    if ('children' in titleElement && titleElement.children) {
      for (const textNode of titleElement.children) {
        if (textNode.type === 'text' && 'data' in textNode) {
          title += textNode.data;
        }
      }
    }

    return title.trim() || 'Untitled Project';
  }

  /**
   * Finds all title elements in the HTML (top-level only, not inside uploads)
   */
  private findTitleElements(): Element[] {
    const results: Element[] = [];

    const traverse = (node: ASTNode, insideUploads: boolean = false) => {
      if (node.type === 'tag') {
        const element = node as Element;

        // Find top-level <title> tags (not inside <youtube> elements in <uploads>)
        if (element.name === 'title' && !insideUploads) {
          results.push(element);
        }

        // Mark that we're inside an uploads section
        const isUploadsSection = element.name === 'uploads';

        if ('children' in node && node.children) {
          for (const child of node.children) {
            traverse(child, insideUploads || isUploadsSection);
          }
        }
      } else if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child, insideUploads);
        }
      }
    };

    traverse(this.html.ast);
    return results;
  }

  /**
   * Finds all uploads elements in the HTML
   */
  private findUploadsElements(): Element[] {
    const results: Element[] = [];

    const traverse = (node: ASTNode) => {
      if (node.type === 'tag') {
        const element = node as Element;

        if (element.name === 'uploads') {
          results.push(element);
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.html.ast);
    return results;
  }

  /**
   * Processes sequences and fragments from the parsed HTML
   */
  private processSequences(assets: Asset[]): SequenceDefinition[] {
    const sequenceElements = this.findSequenceElements();
    const sequences: SequenceDefinition[] = [];

    const assetMap: Map<string, Asset> = new Map();
    assets.forEach((ass) => assetMap.set(ass.name, ass));

    for (const sequenceElement of sequenceElements) {
      const fragmentElements = this.findFragmentChildren(sequenceElement);
      const rawFragments: Array<
        Fragment & {
          overlayRight: number | CompiledExpression;
          overlayZIndexRight: number;
        }
      > = [];

      for (const fragmentElement of fragmentElements) {
        const fragment = this.processFragment(fragmentElement, assetMap);
        if (fragment) {
          rawFragments.push(fragment);
        }
      }

      // Normalize overlays: combine prev's overlayRight with current's overlayLeft
      const fragments: Fragment[] = rawFragments.map((frag, idx) => {
        const { overlayRight, overlayZIndexRight, ...rest } = frag;

        if (idx === 0) {
          // First fragment: keep overlayLeft as-is
          return rest;
        }

        const prevOverlayRight = rawFragments[idx - 1].overlayRight;
        const prevOverlayZIndexRight = rawFragments[idx - 1].overlayZIndexRight;

        // Sum up overlayLeft with previous overlayRight
        let normalizedOverlayLeft: number | CompiledExpression;
        if (
          typeof frag.overlayLeft === 'number' &&
          typeof prevOverlayRight === 'number'
        ) {
          normalizedOverlayLeft = frag.overlayLeft + prevOverlayRight;
        } else {
          // If either is an expression, create a new calc() expression
          const leftVal =
            typeof frag.overlayLeft === 'number'
              ? frag.overlayLeft.toString()
              : frag.overlayLeft.original;
          const rightVal =
            typeof prevOverlayRight === 'number'
              ? prevOverlayRight.toString()
              : prevOverlayRight.original;
          normalizedOverlayLeft = parseValueLazy(
            `calc(${leftVal} + ${rightVal})`,
          ) as CompiledExpression;
        }

        // OverlayZIndexLeft from previous fragment's overlayZIndexRight (negated), if not already set
        // Note: overlayZIndexRight is negated as per spec (e.g. 100 becomes -100)
        const normalizedOverlayZIndex =
          frag.overlayZIndex !== 0
            ? frag.overlayZIndex
            : prevOverlayZIndexRight !== 0
              ? -prevOverlayZIndexRight
              : 0;

        return {
          ...rest,
          overlayLeft: normalizedOverlayLeft,
          overlayZIndex: normalizedOverlayZIndex,
        };
      });

      sequences.push({ fragments });
    }

    return sequences;
  }

  /**
   * Finds all sequence elements that are direct children of <project>
   */
  private findSequenceElements(): Element[] {
    // First find the <project> element
    const projectElement = this.findProjectElement();
    if (!projectElement) {
      console.warn('No <project> element found');
      return [];
    }

    // Get direct sequence children only
    const sequences: Element[] = [];
    if ('children' in projectElement && projectElement.children) {
      for (const child of projectElement.children) {
        if (child.type === 'tag') {
          const element = child as Element;
          if (element.name === 'sequence') {
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
  private findProjectElement(): Element | null {
    const traverse = (node: ASTNode): Element | null => {
      if (node.type === 'tag') {
        const element = node as Element;
        if (element.name === 'project') {
          return element;
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          const result = traverse(child);
          if (result) return result;
        }
      }

      return null;
    };

    return traverse(this.html.ast);
  }

  /**
   * Finds all fragment descendants of a sequence element (not just direct children)
   * Parse5 treats self-closing custom tags as opening tags, nesting subsequent elements
   */
  private findFragmentChildren(sequenceElement: Element): Element[] {
    const fragments: Element[] = [];

    const traverse = (node: ASTNode) => {
      if (node.type === 'tag') {
        const element = node as Element;
        if (element.name === 'fragment') {
          fragments.push(element);
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    // Start traversing from the sequence element's children
    if ('children' in sequenceElement && sequenceElement.children) {
      for (const child of sequenceElement.children) {
        traverse(child);
      }
    }

    return fragments;
  }

  /**
   * Processes a single fragment element according to Parser.md specification
   * Returns fragment with temporary overlayRight and overlayZIndexRight for normalization
   */
  private processFragment(
    element: Element,
    assets: Map<string, Asset>,
  ):
    | (Fragment & {
        overlayRight: number | CompiledExpression;
        overlayZIndexRight: number;
      })
    | null {
    const attrs = getAttrs(element);
    const styles = this.html.css.get(element) || {};

    // 1. Extract fragment ID from id attribute or generate one
    const id =
      attrs.get('id') ||
      `fragment_${Math.random().toString(36).substring(2, 11)}`;

    // 2. Extract assetName from attribute or CSS -asset property
    const assetName = attrs.get('data-asset') || styles['-asset'] || '';

    // 3. Check enabled flag from display property
    const enabled = this.parseEnabled(styles['display']);

    // 4. Extract container if present (first one only)
    const container = this.extractFragmentContainer(element);

    // 5. Parse trimLeft from -trim-start property
    const trimLeft = this.parseTrimStart(styles['-trim-start']);

    // 6. Parse duration from -duration property
    const duration = this.parseDurationProperty(
      styles['-duration'],
      assetName,
      assets,
      trimLeft,
    );

    // 7. Parse -offset-start for overlayLeft (can be number or expression)
    const overlayLeft = this.parseOffsetStart(styles['-offset-start']);

    // 8. Parse -offset-end for overlayRight (temporary, will be normalized)
    const overlayRight = this.parseOffsetEnd(styles['-offset-end']);

    // 9. Parse -overlay-start-z-index for overlayZIndex
    const overlayZIndex = this.parseZIndex(styles['-overlay-start-z-index']);

    // 10. Parse -overlay-end-z-index for overlayZIndexRight (temporary)
    const overlayZIndexRight = this.parseZIndex(styles['-overlay-end-z-index']);

    // 11. Parse -transition-start
    const transitionIn = this.parseTransitionProperty(
      styles['-transition-start'],
    );

    // 12. Parse -transition-end
    const transitionOut = this.parseTransitionProperty(
      styles['-transition-end'],
    );

    // 13. Parse -object-fit
    const objectFitData = this.parseObjectFitProperty(styles['-object-fit']);

    // 14. Parse -chromakey
    const chromakeyData = this.parseChromakeyProperty(styles['-chromakey']);

    // 15. Parse filter (for visual filters)
    const visualFilter = this.parseVisualFilterProperty(styles['filter']);

    // 16. Extract timecode label from data-timecode attribute
    const timecodeLabel = attrs.get('data-timecode') || undefined;

    return {
      id,
      enabled,
      assetName,
      duration,
      trimLeft,
      overlayLeft,
      overlayZIndex,
      overlayRight, // Temporary, will be normalized
      overlayZIndexRight, // Temporary, will be normalized
      transitionIn: transitionIn.name,
      transitionInDuration: transitionIn.duration,
      transitionOut: transitionOut.name,
      transitionOutDuration: transitionOut.duration,
      objectFit: objectFitData.objectFit,
      objectFitContain: objectFitData.objectFitContain,
      objectFitContainAmbientBlurStrength:
        objectFitData.objectFitContainAmbientBlurStrength,
      objectFitContainAmbientBrightness:
        objectFitData.objectFitContainAmbientBrightness,
      objectFitContainAmbientSaturation:
        objectFitData.objectFitContainAmbientSaturation,
      objectFitContainPillarboxColor:
        objectFitData.objectFitContainPillarboxColor,
      chromakey: chromakeyData.chromakey,
      chromakeyBlend: chromakeyData.chromakeyBlend,
      chromakeySimilarity: chromakeyData.chromakeySimilarity,
      chromakeyColor: chromakeyData.chromakeyColor,
      ...(visualFilter && { visualFilter }), // Add visualFilter if present
      ...(container && { container }), // Add container if present
      ...(timecodeLabel && { timecodeLabel }), // Add timecode label if present
    };
  }

  /**
   * Parses filter property (for visual filters)
   * Format: "<filter-name>"
   * Example: "instagram-nashville", "instagram-moon"
   */
  private parseVisualFilterProperty(
    visualFilter: string | undefined,
  ): string | undefined {
    if (!visualFilter) {
      return undefined;
    }

    const trimmed = visualFilter.trim();

    // Return the filter name as-is
    // Validation will happen in the Stream.filter() method
    return trimmed || undefined;
  }

  /**
   * Extracts the first <container> child from a fragment element
   */
  private extractFragmentContainer(element: Element): Container | undefined {
    // Find first container child
    if (!('children' in element) || !element.children) {
      return undefined;
    }

    for (const child of element.children) {
      if (child.type === 'tag' && child.name === 'container') {
        const containerElement = child as Element;

        // Get id attribute
        const id =
          containerElement.attribs?.id ||
          `container_${Math.random().toString(36).substring(2, 11)}`;

        // Get innerHTML (serialize all children)
        const htmlContent = this.serializeElement(containerElement);

        return {
          id,
          htmlContent,
        };
      }
    }

    return undefined;
  }

  /**
   * Serializes an element's children to HTML string
   */
  private serializeElement(element: Element): string {
    let html = '';

    const traverse = (node: ASTNode) => {
      if (node.type === 'text') {
        // Text node
        if ('data' in node && typeof node.data === 'string') {
          html += node.data;
        }
      } else if (node.type === 'tag') {
        // Element node
        const el = node as Element;
        html += `<${el.name}`;

        // Add attributes
        if (el.attribs) {
          for (const [name, value] of Object.entries(el.attribs)) {
            html += ` ${name}="${value}"`;
          }
        }

        html += '>';

        // Process children
        if ('children' in el && el.children) {
          for (const child of el.children) {
            traverse(child);
          }
        }

        html += `</${el.name}>`;
      }
    };

    // Serialize all children
    if ('children' in element && element.children) {
      for (const child of element.children) {
        traverse(child);
      }
    }

    return html;
  }

  /**
   * Splits a string by whitespace, handling CSS-tree's various number formatting quirks:
   * - Recombines standalone minus signs: "- 0.1" → "-0.1"
   * - Splits concatenated numbers: "25-0.1" → ["25", "-0.1"]
   */
  private splitCssValue(value: string): string[] {
    const rawParts = value.split(/\s+/);
    const parts: string[] = [];

    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i];

      // Handle standalone minus sign followed by number
      if (part === '-' && i + 1 < rawParts.length) {
        parts.push('-' + rawParts[i + 1]);
        i++; // skip next part
        continue;
      }

      // Handle concatenated numbers like "25-0.1" → ["25", "-0.1"]
      // Match: <number><minus><number>
      const match = part.match(/^(\d+(?:\.\d+)?)(-.+)$/);
      if (match) {
        parts.push(match[1]); // first number
        parts.push(match[2]); // negative number
        continue;
      }

      parts.push(part);
    }

    return parts;
  }

  /**
   * Parses the 'display' CSS property for the enabled flag
   * display: none -> false, anything else -> true
   */
  private parseEnabled(display: string | undefined): boolean {
    return display !== 'none';
  }

  /**
   * Parses -trim-start property into trimLeft
   * Cannot be negative
   */
  private parseTrimStart(trimStart: string | undefined): number {
    if (!trimStart) {
      return 0;
    }

    const value = this.parseMilliseconds(trimStart);
    // Ensure non-negative as per spec
    return Math.max(0, value);
  }

  /**
   * Parses the -duration CSS property
   * Can be: "auto", percentage (e.g. "100%", "50%"), or time value (e.g. "5000ms", "5s")
   */
  private parseDurationProperty(
    duration: string | undefined,
    assetName: string,
    assets: Map<string, Asset>,
    trimLeft: number,
  ): number {
    if (!duration || duration.trim() === 'auto') {
      // Auto: use asset duration minus trim-start
      const asset = assets.get(assetName);
      if (!asset) {
        return 0;
      }
      return Math.max(0, asset.duration - trimLeft);
    }

    // Handle percentage (e.g., "100%", "50%")
    if (duration.endsWith('%')) {
      const percentage = parseFloat(duration);
      if (isNaN(percentage)) {
        return 0;
      }

      const asset = assets.get(assetName);
      if (!asset) {
        return 0;
      }

      // Calculate percentage of asset duration (don't include trim)
      return Math.round((asset.duration * percentage) / 100);
    }

    // Handle time value (e.g., "5000ms", "5s")
    return this.parseMilliseconds(duration);
  }

  /**
   * Parses time value into milliseconds
   * Supports: "5s", "5000ms", "1.5s", etc.
   */
  private parseMilliseconds(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const trimmed = value.trim();

    // Handle milliseconds (e.g., "5000ms")
    if (trimmed.endsWith('ms')) {
      const ms = parseFloat(trimmed);
      if (!isNaN(ms)) {
        return Math.round(ms);
      }
    }

    // Handle seconds (e.g., "5s", "1.5s")
    if (trimmed.endsWith('s')) {
      const seconds = parseFloat(trimmed);
      if (!isNaN(seconds)) {
        return Math.round(seconds * 1000);
      }
    }

    return 0;
  }

  /**
   * Parses -offset-start into overlayLeft
   * Can be a time value or a calc() expression
   */
  private parseOffsetStart(
    offsetStart: string | undefined,
  ): number | CompiledExpression {
    if (!offsetStart) {
      return 0;
    }

    const trimmed = offsetStart.trim();

    // Check if it's a calc() expression
    if (trimmed.startsWith('calc(')) {
      return parseValueLazy(trimmed) as CompiledExpression;
    }

    // Otherwise parse as time value
    return this.parseMilliseconds(trimmed);
  }

  /**
   * Parses -offset-end into overlayRight (for next fragment)
   * Can be a time value or a calc() expression
   */
  private parseOffsetEnd(
    offsetEnd: string | undefined,
  ): number | CompiledExpression {
    if (!offsetEnd) {
      return 0;
    }

    const trimmed = offsetEnd.trim();

    // Check if it's a calc() expression
    if (trimmed.startsWith('calc(')) {
      return parseValueLazy(trimmed) as CompiledExpression;
    }

    // Otherwise parse as time value
    return this.parseMilliseconds(trimmed);
  }

  /**
   * Parses z-index values (-overlay-start-z-index, -overlay-end-z-index)
   */
  private parseZIndex(zIndex: string | undefined): number {
    if (!zIndex) {
      return 0;
    }

    const parsed = parseInt(zIndex.trim(), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parses -transition-start or -transition-end
   * Format: "<transition-name> <duration>"
   * Example: "fade-in 5s", "fade-out 500ms"
   */
  private parseTransitionProperty(transition: string | undefined): {
    name: string;
    duration: number;
  } {
    if (!transition) {
      return { name: '', duration: 0 };
    }

    const trimmed = transition.trim();
    const parts = this.splitCssValue(trimmed);

    if (parts.length === 0) {
      return { name: '', duration: 0 };
    }

    // First part is transition name
    const name = parts[0];

    // Second part is duration (if present)
    const duration = parts.length > 1 ? this.parseMilliseconds(parts[1]) : 0;

    return { name, duration };
  }

  /**
   * Parses -object-fit property
   * Format: "<type> <settings>"
   * Examples:
   *   - "contain ambient 25 -0.1 0.7"
   *   - "contain pillarbox #000000"
   *   - "cover"
   */
  private parseObjectFitProperty(objectFit: string | undefined): {
    objectFit: 'cover' | 'contain';
    objectFitContain: 'ambient' | 'pillarbox';
    objectFitContainAmbientBlurStrength: number;
    objectFitContainAmbientBrightness: number;
    objectFitContainAmbientSaturation: number;
    objectFitContainPillarboxColor: string;
  } {
    // Defaults
    const defaults = {
      objectFit: 'cover' as 'cover' | 'contain',
      objectFitContain: 'ambient' as 'ambient' | 'pillarbox',
      objectFitContainAmbientBlurStrength: 20,
      objectFitContainAmbientBrightness: -0.3,
      objectFitContainAmbientSaturation: 0.8,
      objectFitContainPillarboxColor: '#000000',
    };

    if (!objectFit) {
      return defaults;
    }

    const trimmed = objectFit.trim();
    const parts = this.splitCssValue(trimmed);

    if (parts.length === 0) {
      return defaults;
    }

    const type = parts[0];

    // Handle "cover"
    if (type === 'cover') {
      return { ...defaults, objectFit: 'cover' };
    }

    // Handle "contain" with sub-options
    if (type === 'contain') {
      const subType = parts[1];

      // "contain ambient <blur> <brightness> <saturation>"
      if (subType === 'ambient') {
        const blur = parts[2]
          ? parseFloat(parts[2])
          : defaults.objectFitContainAmbientBlurStrength;
        const brightness = parts[3]
          ? parseFloat(parts[3])
          : defaults.objectFitContainAmbientBrightness;
        const saturation = parts[4]
          ? parseFloat(parts[4])
          : defaults.objectFitContainAmbientSaturation;

        return {
          ...defaults,
          objectFit: 'contain',
          objectFitContain: 'ambient',
          objectFitContainAmbientBlurStrength: isNaN(blur)
            ? defaults.objectFitContainAmbientBlurStrength
            : blur,
          objectFitContainAmbientBrightness: isNaN(brightness)
            ? defaults.objectFitContainAmbientBrightness
            : brightness,
          objectFitContainAmbientSaturation: isNaN(saturation)
            ? defaults.objectFitContainAmbientSaturation
            : saturation,
        };
      }

      // "contain pillarbox <color>"
      if (subType === 'pillarbox') {
        const color = parts[2] || defaults.objectFitContainPillarboxColor;

        return {
          ...defaults,
          objectFit: 'contain',
          objectFitContain: 'pillarbox',
          objectFitContainPillarboxColor: color,
        };
      }
    }

    // Default
    return defaults;
  }

  /**
   * Parses -chromakey property
   * Format: "<blend> <similarity> <color>"
   * Example: "0.1 0.3 #00FF00", "hard good #00FF00", "soft loose #123abc45"
   * Blend: hard=0.0, smooth=0.1, soft=0.2
   * Similarity: strict=0.1, good=0.3, forgiving=0.5, loose=0.7
   */
  private parseChromakeyProperty(chromakey: string | undefined): {
    chromakey: boolean;
    chromakeyBlend: number;
    chromakeySimilarity: number;
    chromakeyColor: string;
  } {
    // Defaults
    const defaults = {
      chromakey: false,
      chromakeyBlend: 0,
      chromakeySimilarity: 0,
      chromakeyColor: '#00FF00',
    };

    if (!chromakey) {
      return defaults;
    }

    const trimmed = chromakey.trim();
    const parts = this.splitCssValue(trimmed);

    if (parts.length < 3) {
      // Need at least 3 parts
      return defaults;
    }

    // Parse blend (can be number or canned constant)
    let blend = parseFloat(parts[0]);
    if (isNaN(blend)) {
      // Try canned constant
      const blendStr = parts[0].toLowerCase();
      if (blendStr === 'hard') blend = 0.0;
      else if (blendStr === 'smooth') blend = 0.1;
      else if (blendStr === 'soft') blend = 0.2;
      else blend = 0.0;
    }

    // Parse similarity (can be number or canned constant)
    let similarity = parseFloat(parts[1]);
    if (isNaN(similarity)) {
      // Try canned constant
      const similarityStr = parts[1].toLowerCase();
      if (similarityStr === 'strict') similarity = 0.1;
      else if (similarityStr === 'good') similarity = 0.3;
      else if (similarityStr === 'forgiving') similarity = 0.5;
      else if (similarityStr === 'loose') similarity = 0.7;
      else similarity = 0.3;
    }

    // Parse color
    const color = parts[2] || defaults.chromakeyColor;

    return {
      chromakey: true, // If -chromakey is defined, it's enabled
      chromakeyBlend: blend,
      chromakeySimilarity: similarity,
      chromakeyColor: color,
    };
  }
}
