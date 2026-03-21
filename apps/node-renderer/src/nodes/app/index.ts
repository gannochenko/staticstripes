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

export interface AppNodeParams {
  name?: string;
  src: string; // Path to app's dst/dist directory
  parameters: Record<string, string>; // All other attributes as parameters
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

  public async execute(context: NodeExecutionContext): Promise<Record<string, any>> {
    console.log(`🎨 Executing app node "${this.params.name || 'unnamed'}"...`);

    // Build app if needed
    await buildAppIfNeeded({
      appSrc: this.params.src,
      projectDir: context.projectDir,
      force: false,
    });

    // For now, use default values for fps, duration, resolution
    // TODO: These should come from the project node configuration
    const fps = 30;
    const duration = 5000; // 5 seconds default
    const width = 1920;
    const height = 1080;

    // Create app object
    const app = {
      id: this.params.name || `app_${Date.now()}`,
      src: this.params.src,
      parameters: this.params.parameters,
    };

    // Render app
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--allow-file-access-from-files',
      ],
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
