import { AIGenerationStrategy, AIAssetConfig } from '../ai-generation-strategy';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import https from 'https';
import http from 'http';

interface MusicAPICredentials {
  apiKey: string;
}

interface MusicAPICreateResponse {
  task_id: string;
  state: string;
  message?: string;
}

interface MusicAPITaskResponse {
  task_id: string;
  state: string; // 'pending', 'processing', 'succeeded', 'failed'
  audio_url?: string;
  error_message?: string;
}

/**
 * MusicAPI.AI generation strategy
 * Generates music using MusicAPI.AI's API
 */
export class MusicAPIGenerationStrategy implements AIGenerationStrategy {
  private readonly API_BASE_URL = 'https://api.aimusicapi.ai/api/v1';
  private readonly POLL_INTERVAL_MS = 20000; // 20 seconds
  private readonly MAX_POLL_ATTEMPTS = 60; // 20 minutes max
  private readonly DEFAULT_MODEL = 'sonic-v4-5'; // Default model if none specified
  private readonly DEFAULT_DURATION = 30; // Default duration in seconds if none specified

  getTag(): string {
    return 'music-api-ai';
  }

  validate(): void {
    // Validation happens during generation when we load credentials
  }

  async generate(config: AIAssetConfig, projectPath: string): Promise<void> {
    const credentials = this.loadCredentials(config.integrationName, projectPath);
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

    const audioUrl = await this.pollForCompletion(credentials.apiKey, taskId);

    console.log(`  Downloading audio file...`);
    await this.downloadAudio(audioUrl, config.assetPath);

    console.log(`  Audio saved to: ${config.assetPath}`);
  }

  /**
   * Loads credentials from .auth/<integrationName>.json
   */
  private loadCredentials(
    integrationName: string,
    projectPath: string,
  ): MusicAPICredentials {
    const authFilePath = resolve(projectPath, '.auth', `${integrationName}.json`);

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

    const response = await this.makeRequest<MusicAPICreateResponse>(
      endpoint,
      apiKey,
      'POST',
      requestBody,
    );

    if (!response.task_id) {
      throw new Error(
        `Failed to create music generation task: ${response.message || 'Unknown error'}`,
      );
    }

    return response.task_id;
  }

  /**
   * Polls for task completion
   * Returns the audio URL when ready
   */
  private async pollForCompletion(
    apiKey: string,
    taskId: string,
  ): Promise<string> {
    const endpoint = `${this.API_BASE_URL}/sonic/task/${taskId}`;

    for (let attempt = 0; attempt < this.MAX_POLL_ATTEMPTS; attempt++) {
      const response = await this.makeRequest<MusicAPITaskResponse>(
        endpoint,
        apiKey,
        'GET',
      );

      if (response.state === 'succeeded') {
        if (!response.audio_url) {
          throw new Error('Task succeeded but no audio URL returned');
        }
        return response.audio_url;
      }

      if (response.state === 'failed') {
        throw new Error(
          `Music generation failed: ${response.error_message || 'Unknown error'}`,
        );
      }

      // Still processing, wait before next poll
      if (attempt < this.MAX_POLL_ATTEMPTS - 1) {
        console.log(
          `  Status: ${response.state}... (attempt ${attempt + 1}/${this.MAX_POLL_ATTEMPTS})`,
        );
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
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Failed to download audio: HTTP ${response.statusCode}`,
              ),
            );
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              writeFileSync(outputPath, buffer);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        })
        .on('error', reject);
    });
  }

  /**
   * Makes an HTTP request to the MusicAPI.AI API
   */
  private async makeRequest<T>(
    url: string,
    apiKey: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const responseText = Buffer.concat(chunks).toString('utf-8');
            const data = JSON.parse(responseText) as T;

            if (res.statusCode && res.statusCode >= 400) {
              reject(
                new Error(
                  `API request failed with status ${res.statusCode}: ${responseText}`,
                ),
              );
              return;
            }

            resolve(data);
          } catch (error) {
            reject(
              new Error(
                `Failed to parse API response: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`API request failed: ${error.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
