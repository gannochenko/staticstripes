"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElevenLabsNode = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const credentials_1 = require("../../lib/credentials");
/**
 * Generates a cache key from ElevenLabs node parameters
 */
function generateElevenLabsCacheKey(params, text) {
    const hash = (0, crypto_1.createHash)('sha256');
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
function convertToWordTiming(alignment) {
    const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
    const words = [];
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
        }
        else {
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
class ElevenLabsNode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'elevenlabs';
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [
            {
                name: 'text',
                description: 'Text to convert to speech',
            },
        ];
    }
    getOutputs() {
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
    validateParameters() {
        const errors = [];
        if (!this.params.textRef) {
            errors.push({
                text: 'ElevenLabs node requires a text reference',
                field: 'textRef',
            });
        }
        return errors;
    }
    getParameterSchema() {
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
    async execute(context) {
        console.log(`\n🎙️ Executing ElevenLabs node "${this.params.name || 'unnamed'}"`);
        // Get the text from the upstream node
        const textSource = this.params.textRef.replace('$', '').split('.');
        const nodeName = textSource[0];
        const outputName = textSource[1] || 'text';
        const text = context.getOutput(nodeName, outputName);
        if (!text || typeof text !== 'string') {
            throw new Error(`ElevenLabs node requires text input, got: ${typeof text}`);
        }
        console.log(`   Text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        const nodeNameStr = this.params.name || 'unnamed_elevenlabs';
        // Create cache directory organized by node name
        const cacheDir = (0, path_1.resolve)(context.projectDir, 'cache', nodeNameStr);
        if (!(0, fs_1.existsSync)(cacheDir)) {
            await (0, promises_1.mkdir)(cacheDir, { recursive: true });
        }
        // Generate cache key from parameters
        const cacheKey = generateElevenLabsCacheKey(this.params, text);
        const audioExtension = (this.params.outputFormat || 'mp3_44100_128').split('_')[0];
        const audioCacheFile = (0, path_1.resolve)(cacheDir, `${cacheKey}.${audioExtension}`);
        const alignmentCacheFile = (0, path_1.resolve)(cacheDir, `${cacheKey}.json`);
        // Check if cached result exists
        if ((0, fs_1.existsSync)(audioCacheFile) && (0, fs_1.existsSync)(alignmentCacheFile)) {
            console.log(`   📦 Using cached result (hash: ${cacheKey})`);
            const cachedAlignment = JSON.parse(await (0, promises_1.readFile)(alignmentCacheFile, 'utf-8'));
            console.log(`   Audio: ${audioCacheFile}`);
            console.log(`   Words: ${cachedAlignment.length} words`);
            return {
                audio: audioCacheFile,
                wordTiming: cachedAlignment,
            };
        }
        // Move any existing cache files to prev-cache before generating new content
        const prevCacheDir = (0, path_1.resolve)(cacheDir, 'prev-cache');
        const existingCacheFiles = (0, fs_1.existsSync)(cacheDir)
            ? (0, fs_1.readdirSync)(cacheDir).filter(f => f.endsWith(`.${audioExtension}`) || f.endsWith('.json'))
            : [];
        if (existingCacheFiles.length > 0) {
            if (!(0, fs_1.existsSync)(prevCacheDir)) {
                await (0, promises_1.mkdir)(prevCacheDir, { recursive: true });
            }
            for (const file of existingCacheFiles) {
                const oldPath = (0, path_1.resolve)(cacheDir, file);
                const timestamp = Date.now();
                const newPath = (0, path_1.resolve)(prevCacheDir, `${timestamp}_${file}`);
                console.log(`   📦 Moving old cache to prev-cache: ${file}`);
                await (0, promises_1.rename)(oldPath, newPath);
            }
        }
        // Load credentials
        const credManager = new credentials_1.CredentialsManager(context.projectDir, 'elevenlabs');
        const credentials = credManager.load(['apiKey']);
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
                throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
            }
            const result = await response.json();
            // Decode and save audio
            const audioBuffer = Buffer.from(result.audio_base64, 'base64');
            await (0, promises_1.writeFile)(audioCacheFile, audioBuffer);
            console.log(`   ✅ Generated audio: ${audioBuffer.length} bytes`);
            // Convert character-level alignment to word-level timing
            const wordTiming = convertToWordTiming(result.alignment);
            await (0, promises_1.writeFile)(alignmentCacheFile, JSON.stringify(wordTiming, null, 2), 'utf-8');
            console.log(`   ✅ Generated word timing: ${wordTiming.length} words`);
            // Save to cache
            console.log(`   💾 Saved to cache (hash: ${cacheKey})`);
            return {
                audio: audioCacheFile,
                wordTiming,
            };
        }
        catch (error) {
            throw new Error(`ElevenLabs API error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.ElevenLabsNode = ElevenLabsNode;
//# sourceMappingURL=index.js.map