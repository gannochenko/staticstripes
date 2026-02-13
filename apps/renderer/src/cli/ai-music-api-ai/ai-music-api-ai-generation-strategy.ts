import { AIGenerationStrategy, AIAssetConfig } from '../ai-generation-strategy';
import { resolve, dirname, basename, extname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { makeRequest, downloadFile } from '../../lib/net';
import { writeFile } from '../../lib/file';

interface MusicAPICredentials {
  apiKey: string;
}

interface MusicAPICreateResponse {
  code: number;
  message: string;
  task_id: string;
  data?: {
    state?: string;
  };
}

/**
 * AIMusicAPI.ai generation strategy
 * Generates music using AIMusicAPI.ai's API (https://aimusicapi.ai)
 */
export class AIMusicAPIGenerationStrategy implements AIGenerationStrategy {
  private readonly API_BASE_URL = 'https://api.aimusicapi.ai/api/v1';
  private readonly POLL_INTERVAL_MS = 20000; // 20 seconds
  private readonly MAX_POLL_ATTEMPTS = 60; // 20 minutes max
  private readonly DEFAULT_MODEL = 'sonic-v4-5'; // Default model if none specified
  private readonly DEFAULT_DURATION = 30; // Default duration in seconds if none specified

  getTag(): string {
    return 'ai-music-api-ai';
  }

  validate(): void {
    // Validation happens during generation when we load credentials
  }

  async generate(config: AIAssetConfig, projectPath: string): Promise<void> {
    const credentials = this.loadCredentials(
      config.integrationName,
      projectPath,
    );
    const model = config.model || this.DEFAULT_MODEL;
    const duration = config.duration || this.DEFAULT_DURATION;

    console.log(
      `  Submitting music generation request (model: ${model}, duration: ${duration}s)...`,
    );
    console.log(
      `  Using API key: ${credentials.apiKey.substring(0, 10)}... (length: ${credentials.apiKey.length})`,
    );
    const taskId = await this.createMusicGenerationTask(
      credentials.apiKey,
      config.prompt,
      model,
      duration,
    );

    console.log(`  Task ID: ${taskId}`);
    console.log(`  Waiting for generation to complete...`);

    const audioUrls = await this.pollForCompletion(credentials.apiKey, taskId);

    console.log(`  Downloading ${audioUrls.length} audio file(s)...`);

    // Download the first file to the main asset path
    await this.downloadAudio(audioUrls[0], config.assetPath);
    console.log(`  Primary audio saved to: ${config.assetPath}`);

    // Download remaining files to alternative paths in the same directory
    if (audioUrls.length > 1) {
      const assetDir = dirname(config.assetPath);
      const assetExt = extname(config.assetPath);
      const assetBase = basename(config.assetPath, assetExt);

      for (let i = 1; i < audioUrls.length; i++) {
        const altNumber = String(i).padStart(2, '0');
        const altPath = resolve(
          assetDir,
          `${assetBase}_alt_${altNumber}${assetExt}`,
        );
        await this.downloadAudio(audioUrls[i], altPath);
        console.log(`  Alternative ${i} saved to: ${altPath}`);
      }
    }
  }

  /**
   * Loads credentials from .auth/<integrationName>.json
   */
  private loadCredentials(
    integrationName: string,
    projectPath: string,
  ): MusicAPICredentials {
    const authFilePath = resolve(
      projectPath,
      '.auth',
      `${integrationName}.json`,
    );

    if (!existsSync(authFilePath)) {
      throw new Error(
        `Credentials file not found: ${authFilePath}\n` +
          `Please create the file with the following format:\n` +
          `{\n  "apiKey": "your-api-key-here"\n}`,
      );
    }

    try {
      const fileContent = readFileSync(authFilePath, 'utf-8');
      const credentials = JSON.parse(fileContent) as MusicAPICredentials;

      if (!credentials.apiKey) {
        throw new Error(
          `Invalid credentials file: ${authFilePath}\n` +
            `Missing "apiKey" field`,
        );
      }

      // Trim whitespace from API key
      return {
        apiKey: credentials.apiKey.trim(),
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          `Invalid JSON in credentials file: ${authFilePath}\n` +
            `${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Creates a music generation task
   * Returns the task ID
   */
  // @ts-expect-error fuck
  private async createMusicGenerationTask(
    apiKey: string,
    prompt: string,
    model: string,
    duration: number,
  ): Promise<string> {
    const endpoint = `${this.API_BASE_URL}/sonic/create`;

    const requestBody = {
      task_type: 'create_music',
      custom_mode: false,
      gpt_description_prompt: prompt,
      mv: model,
      duration,
    };

    const response = await makeRequest<MusicAPICreateResponse>({
      url: endpoint,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: requestBody,
    });

    if (!response.task_id) {
      throw new Error(
        `Failed to create music generation task: ${response.message || 'Unknown error'}`,
      );
    }

    return response.task_id;
  }

  /**
   * Polls for task completion
   * Returns all audio URLs when ready
   */
  private async pollForCompletion(
    apiKey: string,
    taskId: string,
  ): Promise<string[]> {
    const endpoint = `${this.API_BASE_URL}/sonic/task/${taskId}`;

    for (let attempt = 0; attempt < this.MAX_POLL_ATTEMPTS; attempt++) {
      const response = await makeRequest<any>({
        url: endpoint,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      // API returns an array of clips in the data field
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error(
          `Unexpected API response format: ${JSON.stringify(response)}`,
        );
      }

      if (response.data.length === 0) {
        throw new Error('No clips returned in response');
      }

      // Check the first clip to determine overall status
      const firstClip = response.data[0];
      const state = firstClip.state;
      const errorMessage = firstClip.error_message;

      console.log(
        `  Status: ${state}... (${response.data.length} clip(s), attempt ${attempt + 1}/${this.MAX_POLL_ATTEMPTS})`,
      );

      if (
        state === 'succeeded' ||
        state === 'completed' ||
        state === 'success'
      ) {
        // Collect all audio URLs from successful clips
        const audioUrls: string[] = [];
        for (const clip of response.data) {
          if (clip.audio_url) {
            audioUrls.push(clip.audio_url);
          }
        }

        if (audioUrls.length === 0) {
          throw new Error('Task succeeded but no audio URLs returned');
        }

        console.log(`  Found ${audioUrls.length} generated clip(s)`);
        return audioUrls;
      }

      if (state === 'failed' || state === 'error') {
        throw new Error(
          `Music generation failed: ${errorMessage || 'Unknown error'}`,
        );
      }

      // Still processing, wait before next poll
      if (attempt < this.MAX_POLL_ATTEMPTS - 1) {
        await this.sleep(this.POLL_INTERVAL_MS);
      }
    }

    throw new Error(
      `Music generation timed out after ${this.MAX_POLL_ATTEMPTS} attempts`,
    );
  }

  /**
   * Downloads audio from URL to file
   */
  private async downloadAudio(url: string, outputPath: string): Promise<void> {
    const buffer = await downloadFile(url);

    writeFile(outputPath, buffer);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
