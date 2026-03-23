import { createHash } from 'crypto';
import { existsSync, readdirSync } from 'fs';
import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { resolve } from 'path';
import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
  NodeExecutionContext,
} from '../../lib/node-interface';
import { CredentialsManager, ElevenLabsCredentials } from '../../lib/credentials';

export interface ElevenLabsNodeParams {
  name?: string;
  textRef: string; // Reference to text source
  voice?: string;
  model?: string;
  outputFormat?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  salt?: string; // Optional salt to force cache invalidation
}

/**
 * Word-level timing information
 */
export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * Alignment response from ElevenLabs API
 */
interface AlignmentResponse {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/**
 * API response from ElevenLabs
 */
interface ElevenLabsResponse {
  audio_base64: string;
  alignment: AlignmentResponse;
  normalized_alignment?: AlignmentResponse;
}

/**
 * Generates a cache key from ElevenLabs node parameters
 */
function generateElevenLabsCacheKey(params: ElevenLabsNodeParams, text: string): string {
  const hash = createHash('sha256');
  hash.update(text);
  hash.update(params.voice || 'default');
  hash.update(params.model || 'eleven_multilingual_v2');
  hash.update(params.outputFormat || 'mp3_44100_128');
  hash.update(String(params.stability ?? 0.5));
  hash.update(String(params.similarityBoost ?? 0.75));
  hash.update(String(params.style ?? 0));
  hash.update(String(params.useSpeakerBoost ?? true));
  if (params.salt) {
    hash.update(params.salt);
  }
  return hash.digest('hex').substring(0, 16);
}

/**
 * Converts character-level alignment to word-level timing
 */
function convertToWordTiming(alignment: AlignmentResponse): WordTiming[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;

  const words: WordTiming[] = [];
  let currentWord = '';
  let wordStartTime = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const startTime = character_start_times_seconds[i];
    const endTime = character_end_times_seconds[i];

    // Check if this is whitespace or punctuation that ends a word
    if (char.match(/[\s,.!?;:'"]/)) {
      // Save the current word if it exists
      if (currentWord.trim().length > 0) {
        words.push({
          word: currentWord.trim(),
          start: wordStartTime,
          end: character_end_times_seconds[i - 1],
        });
      }
      currentWord = '';
    } else {
      // Start a new word
      if (currentWord.length === 0) {
        wordStartTime = startTime;
      }
      currentWord += char;
    }
  }

  // Add the last word if exists
  if (currentWord.trim().length > 0) {
    words.push({
      word: currentWord.trim(),
      start: wordStartTime,
      end: character_end_times_seconds[characters.length - 1],
    });
  }

  return words;
}

/**
 * ElevenLabs Node - Text-to-speech using ElevenLabs API
 *
 * Credentials are loaded from:
 * - Local: <project>/.auth/elevenlabs.json
 * - Global: ~/.staticstripes/auth/elevenlabs.json
 *
 * Credentials file format:
 * {
 *   "apiKey": "your-api-key"
 * }
 */
export class ElevenLabsNode implements INode {
  constructor(private params: ElevenLabsNodeParams) {}

  public getType(): string {
    return 'elevenlabs';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [
      {
        name: 'text',
        description: 'Text to convert to speech',
      },
    ];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'audio',
        description: 'Generated speech audio file',
      },
      {
        name: 'wordTiming',
        description: 'Word-level timing information',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.textRef) {
      errors.push({
        text: 'ElevenLabs node requires a text reference',
        field: 'textRef',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'textRef',
        required: true,
        description: 'Text source reference',
        type: 'reference',
      },
      {
        name: 'voice',
        required: false,
        description: 'Voice ID to use (default: 21m00Tcm4TlvDq8ikWAM - Rachel)',
        type: 'string',
      },
      {
        name: 'model',
        required: false,
        description: 'ElevenLabs model to use (default: eleven_multilingual_v2)',
        type: 'string',
      },
      {
        name: 'outputFormat',
        required: false,
        description: 'Audio format (default: mp3_44100_128)',
        type: 'string',
      },
      {
        name: 'stability',
        required: false,
        description: 'Voice stability 0-1 (default: 0.5)',
        type: 'number',
      },
      {
        name: 'similarityBoost',
        required: false,
        description: 'Similarity boost 0-1 (default: 0.75)',
        type: 'number',
      },
      {
        name: 'style',
        required: false,
        description: 'Style exaggeration 0-1 (default: 0)',
        type: 'number',
      },
      {
        name: 'useSpeakerBoost',
        required: false,
        description: 'Use speaker boost (default: true)',
        type: 'boolean',
      },
      {
        name: 'salt',
        required: false,
        description: 'Optional salt to force regeneration without modifying text',
        type: 'string',
      },
    ];
  }

  public async execute(context: NodeExecutionContext): Promise<Record<string, any>> {
    console.log(`\n🎙️ Executing ElevenLabs node "${this.params.name || 'unnamed'}"`);

    // Get the text from the upstream node
    const textSource = this.params.textRef.replace('$', '').split('.');
    const nodeName = textSource[0];
    const outputName = textSource[1] || 'text';
    const text = context.getOutput(nodeName, outputName) as string;

    if (!text || typeof text !== 'string') {
      throw new Error(`ElevenLabs node requires text input, got: ${typeof text}`);
    }

    console.log(`   Text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    const nodeNameStr = this.params.name || 'unnamed_elevenlabs';

    // Create cache directory organized by node name
    const cacheDir = resolve(context.projectDir, 'cache', nodeNameStr);
    if (!existsSync(cacheDir)) {
      await mkdir(cacheDir, { recursive: true });
    }

    // Generate cache key from parameters
    const cacheKey = generateElevenLabsCacheKey(this.params, text);
    const audioExtension = (this.params.outputFormat || 'mp3_44100_128').split('_')[0];
    const audioCacheFile = resolve(cacheDir, `${cacheKey}.${audioExtension}`);
    const alignmentCacheFile = resolve(cacheDir, `${cacheKey}.json`);

    // Check if cached result exists
    if (existsSync(audioCacheFile) && existsSync(alignmentCacheFile)) {
      console.log(`   📦 Using cached result (hash: ${cacheKey})`);
      const cachedAlignment = JSON.parse(await readFile(alignmentCacheFile, 'utf-8')) as WordTiming[];
      console.log(`   Audio: ${audioCacheFile}`);
      console.log(`   Words: ${cachedAlignment.length} words`);

      return {
        audio: audioCacheFile,
        wordTiming: cachedAlignment,
      };
    }

    // Move any existing cache files to prev-cache before generating new content
    const prevCacheDir = resolve(cacheDir, 'prev-cache');
    const existingCacheFiles = existsSync(cacheDir)
      ? readdirSync(cacheDir).filter(f =>
          f.endsWith(`.${audioExtension}`) || f.endsWith('.json')
        )
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
    const credManager = new CredentialsManager(context.projectDir, 'elevenlabs');
    const credentials = credManager.load<ElevenLabsCredentials>(['apiKey']);

    const voiceId = this.params.voice || '21m00Tcm4TlvDq8ikWAM'; // Rachel
    const model = this.params.model || 'eleven_multilingual_v2';
    const outputFormat = this.params.outputFormat || 'mp3_44100_128';
    const stability = this.params.stability ?? 0.5;
    const similarityBoost = this.params.similarityBoost ?? 0.75;
    const style = this.params.style ?? 0;
    const useSpeakerBoost = this.params.useSpeakerBoost ?? true;

    console.log(`   Voice: ${voiceId}, Model: ${model}, Format: ${outputFormat}`);
    console.log(`   Settings: stability=${stability}, similarityBoost=${similarityBoost}, style=${style}`);

    // Prepare request body
    const requestBody = {
      text,
      model_id: model,
      output_format: outputFormat,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: useSpeakerBoost,
      },
    };

    // Make API request
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': credentials.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ElevenLabs API error (${response.status}): ${errorText}`,
        );
      }

      const result = await response.json() as ElevenLabsResponse;

      // Decode and save audio
      const audioBuffer = Buffer.from(result.audio_base64, 'base64');
      await writeFile(audioCacheFile, audioBuffer);
      console.log(`   ✅ Generated audio: ${audioBuffer.length} bytes`);

      // Convert character-level alignment to word-level timing
      const wordTiming = convertToWordTiming(result.alignment);
      await writeFile(alignmentCacheFile, JSON.stringify(wordTiming, null, 2), 'utf-8');
      console.log(`   ✅ Generated word timing: ${wordTiming.length} words`);

      // Save to cache
      console.log(`   💾 Saved to cache (hash: ${cacheKey})`);

      return {
        audio: audioCacheFile,
        wordTiming,
      };
    } catch (error) {
      throw new Error(
        `ElevenLabs API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
