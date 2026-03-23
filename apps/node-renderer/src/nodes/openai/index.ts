import OpenAI from 'openai';
import { createHash } from 'crypto';
import { existsSync, readdirSync } from 'fs';
import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { resolve, dirname } from 'path';
import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
  NodeExecutionContext,
} from '../../lib/node-interface';
import { CredentialsManager, OpenAICredentials } from '../../lib/credentials';

export interface OpenAINodeParams {
  name?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  salt?: string; // Optional salt to force cache invalidation without changing prompt
}

/**
 * Generates a cache key from OpenAI node parameters
 */
function generateOpenAICacheKey(params: OpenAINodeParams): string {
  const hash = createHash('sha256');
  hash.update(params.prompt);
  hash.update(params.model || 'gpt-4o-mini');
  hash.update(String(params.maxTokens || 1000));
  hash.update(String(params.temperature ?? 0.7));
  if (params.salt) {
    hash.update(params.salt);
  }
  return hash.digest('hex').substring(0, 16);
}

/**
 * OpenAI Node - Text generation using OpenAI API
 *
 * Credentials are loaded from:
 * - Local: <project>/.auth/openai.json
 * - Global: ~/.staticstripes/auth/openai.json
 *
 * Credentials file format:
 * {
 *   "apiKey": "sk-...",
 *   "organization": "org-..." (optional)
 * }
 */
export class OpenAINode implements INode {
  constructor(private params: OpenAINodeParams) {}

  public getType(): string {
    return 'openai';
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
        name: 'text',
        description: 'Generated text',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.prompt || this.params.prompt.trim() === '') {
      errors.push({
        text: 'OpenAI node requires a prompt',
        field: 'prompt',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'prompt',
        required: true,
        description: 'Text generation prompt',
        type: 'string',
      },
      {
        name: 'model',
        required: false,
        description: 'OpenAI model to use (default: gpt-4o-mini)',
        type: 'string',
      },
      {
        name: 'maxTokens',
        required: false,
        description: 'Maximum tokens to generate (default: 1000)',
        type: 'number',
      },
      {
        name: 'temperature',
        required: false,
        description: 'Sampling temperature 0-2 (default: 0.7)',
        type: 'number',
      },
      {
        name: 'salt',
        required: false,
        description: 'Optional salt to force regeneration without modifying prompt',
        type: 'string',
      },
    ];
  }

  public async execute(context: NodeExecutionContext): Promise<Record<string, any>> {
    console.log(`\n🤖 Executing OpenAI node "${this.params.name || 'unnamed'}"`);
    console.log(`   Prompt: ${this.params.prompt.substring(0, 100)}${this.params.prompt.length > 100 ? '...' : ''}`);

    const nodeName = this.params.name || 'unnamed_openai';

    // Create cache directory organized by node name
    const cacheDir = resolve(context.projectDir, 'cache', nodeName);
    if (!existsSync(cacheDir)) {
      await mkdir(cacheDir, { recursive: true });
    }

    // Generate cache key from parameters
    const cacheKey = generateOpenAICacheKey(this.params);
    const cacheFilePath = resolve(cacheDir, `${cacheKey}.txt`);

    // Check if cached result exists
    if (existsSync(cacheFilePath)) {
      console.log(`   📦 Using cached result (hash: ${cacheKey})`);
      const cachedText = await readFile(cacheFilePath, 'utf-8');
      console.log(`   Preview: ${cachedText.substring(0, 200)}${cachedText.length > 200 ? '...' : ''}`);

      return {
        text: cachedText,
      };
    }

    // Move any existing cache files to prev-cache before generating new content
    const prevCacheDir = resolve(cacheDir, 'prev-cache');
    const existingCacheFiles = existsSync(cacheDir)
      ? readdirSync(cacheDir).filter(f => f.endsWith('.txt'))
      : [];

    if (existingCacheFiles.length > 0) {
      if (!existsSync(prevCacheDir)) {
        await mkdir(prevCacheDir, { recursive: true });
      }

      for (const file of existingCacheFiles) {
        const oldPath = resolve(cacheDir, file);
        const timestamp = Date.now();
        const newPath = resolve(prevCacheDir, `${timestamp}_${file}`);
        console.log(`   📦 Moving old cache to prev-cache: ${file}`);
        await rename(oldPath, newPath);
      }
    }

    // Load credentials
    const credManager = new CredentialsManager(context.projectDir, 'openai');
    const credentials = credManager.load<OpenAICredentials>(['apiKey']);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: credentials.apiKey,
      organization: credentials.organization,
    });

    const model = this.params.model || 'gpt-4o-mini';
    const maxTokens = this.params.maxTokens || 1000;
    const temperature = this.params.temperature ?? 0.7;

    console.log(`   Model: ${model}, Max tokens: ${maxTokens}, Temperature: ${temperature}`);

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: this.params.prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      });

      const generatedText = completion.choices[0]?.message?.content || '';

      console.log(`   ✅ Generated ${generatedText.length} characters`);
      console.log(`   Preview: ${generatedText.substring(0, 200)}${generatedText.length > 200 ? '...' : ''}`);

      // Save to cache
      await writeFile(cacheFilePath, generatedText, 'utf-8');
      console.log(`   💾 Saved to cache (hash: ${cacheKey})`);

      return {
        text: generatedText,
      };
    } catch (error) {
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
