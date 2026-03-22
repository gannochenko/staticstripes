import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
  NodeExecutionContext,
} from '../../lib/node-interface';
import { buildAppIfNeeded } from './app-builder';
import { renderApp } from './app-renderer';
import puppeteer from 'puppeteer';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

export interface AppNodeParams {
  name?: string;
  src: string; // Path to app's dst/dist directory
  parameters: Record<string, string>; // All other attributes as parameters
}

/**
 * Generate cache key for an app based on all inputs that affect rendering
 */
function generateAppCacheKey(
  src: string,
  parameters: Record<string, string>,
  title: string,
  date: string | undefined,
  tags: string[],
  outputName: string,
  fps: number,
  duration: number,
): string {
  const hash = createHash('sha256');
  hash.update(src);
  hash.update(JSON.stringify(parameters));
  hash.update(title);
  hash.update(date ?? '');
  hash.update(tags.join(','));
  hash.update(outputName);
  hash.update(fps.toString());
  hash.update(duration.toString());
  return hash.digest('hex').substring(0, 16);
}

/**
 * Application Node - Renders React/SPA apps using Puppeteer
 * Apps can be static (single frame) or animated (multiple frames)
 *
 * Apps must:
 * - Call window.__stsCaptureFrame(frameNumber) to capture animated frames
 * - Emit 'sts-done-rendering' event when complete
 * - Receive parameters via URL query string (fps, duration, title, date, tags, + custom params)
 */
export class AppNode implements INode {
  constructor(private params: AppNodeParams) {}

  public getType(): string {
    return 'app';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'video',
        description: 'Rendered app output (PNG for static, APNG for animated)',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.src) {
      errors.push({
        text: 'App node must have a "src" attribute pointing to the app directory',
        field: 'src',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'src',
        required: true,
        description: 'Path to app directory (usually ends with /dst or /dist)',
        type: 'string',
      },
    ];
  }

  /**
   * Calculate the duration for the app based on its parameters
   * For karaoke text apps, parse word timings to determine actual duration
   * Falls back to 5000ms default for apps without timing data
   */
  private calculateDuration(parameters: Record<string, string>): number {
    const DEFAULT_DURATION = 5000; // 5 seconds fallback
    const DURATION_BUFFER = 500; // Add 500ms buffer for fade-out

    // Check if this is a karaoke text app with word timings
    if (parameters.words) {
      try {
        const words = JSON.parse(parameters.words);
        if (Array.isArray(words) && words.length > 0) {
          // Find the maximum end time from all words
          const maxEndTime = Math.max(...words.map((w: any) => w.end || 0));
          if (maxEndTime > 0) {
            // Convert from seconds to milliseconds and add buffer
            const calculatedDuration = Math.ceil(maxEndTime * 1000) + DURATION_BUFFER;
            console.log(`📊 Calculated duration from word timings: ${calculatedDuration}ms (max word end: ${maxEndTime}s)`);
            return calculatedDuration;
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse word timings for duration calculation:`, error);
      }
    }

    // Check if duration is explicitly provided as a parameter
    if (parameters.duration) {
      const explicitDuration = parseInt(parameters.duration, 10);
      if (!isNaN(explicitDuration) && explicitDuration > 0) {
        console.log(`📊 Using explicit duration parameter: ${explicitDuration}ms`);
        return explicitDuration;
      }
    }

    console.log(`📊 Using default duration: ${DEFAULT_DURATION}ms`);
    return DEFAULT_DURATION;
  }

  public async execute(context: NodeExecutionContext): Promise<Record<string, any>> {
    console.log(`🎨 Executing app node "${this.params.name || 'unnamed'}"...`);

    // Build app if needed
    await buildAppIfNeeded({
      appSrc: this.params.src,
      projectDir: context.projectDir,
      force: false,
    });

    // Get fps and resolution from context (set by project node)
    const fps = context.outputFps;
    const width = context.outputResolution.width;
    const height = context.outputResolution.height;

    // Calculate duration based on app parameters
    const duration = this.calculateDuration(this.params.parameters);

    // Create app object
    const app = {
      id: this.params.name || `app_${Date.now()}`,
      src: this.params.src,
      parameters: this.params.parameters,
    };

    // Check if cached result exists before launching browser
    const cacheKey = generateAppCacheKey(
      app.src,
      app.parameters,
      '', // title
      undefined, // date
      [], // tags
      'default', // outputName
      fps,
      duration,
    );

    const cacheDir = resolve(context.projectDir, 'cache', app.id);
    const cachedApng = resolve(cacheDir, `${cacheKey}.apng`);

    if (existsSync(cachedApng)) {
      console.log(
        `Using cached app "${app.id}" (hash: ${cacheKey}) from ${cachedApng}`,
      );
      return {
        video: cachedApng,
      };
    }

    // No cache - need to render, so launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--allow-file-access-from-files',
      ],
      protocolTimeout: 120000, // 2 minutes for screenshot operations
    });

    try {
      const result = await renderApp({
        app,
        width,
        height,
        projectDir: context.projectDir,
        outputName: 'default',
        title: '', // TODO: Get from project
        date: undefined,
        tags: [],
        fps,
        duration,
        browser,
      });

      console.log(
        `✅ App "${app.id}" rendered as ${result.mode} (${result.path})`,
      );

      return {
        video: result.path,
      };
    } finally {
      await browser.close();
    }
  }
}
