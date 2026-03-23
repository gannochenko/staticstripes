"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAINode = void 0;
const openai_1 = __importDefault(require("openai"));
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const credentials_1 = require("../../lib/credentials");
/**
 * Generates a cache key from OpenAI node parameters
 */
function generateOpenAICacheKey(params) {
    const hash = (0, crypto_1.createHash)('sha256');
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
class OpenAINode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'openai';
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [];
    }
    getOutputs() {
        return [
            {
                name: 'text',
                description: 'Generated text',
            },
        ];
    }
    validateParameters() {
        const errors = [];
        if (!this.params.prompt || this.params.prompt.trim() === '') {
            errors.push({
                text: 'OpenAI node requires a prompt',
                field: 'prompt',
            });
        }
        return errors;
    }
    getParameterSchema() {
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
    async execute(context) {
        console.log(`\n🤖 Executing OpenAI node "${this.params.name || 'unnamed'}"`);
        console.log(`   Prompt: ${this.params.prompt.substring(0, 100)}${this.params.prompt.length > 100 ? '...' : ''}`);
        const nodeName = this.params.name || 'unnamed_openai';
        // Create cache directory organized by node name
        const cacheDir = (0, path_1.resolve)(context.projectDir, 'cache', nodeName);
        if (!(0, fs_1.existsSync)(cacheDir)) {
            await (0, promises_1.mkdir)(cacheDir, { recursive: true });
        }
        // Generate cache key from parameters
        const cacheKey = generateOpenAICacheKey(this.params);
        const cacheFilePath = (0, path_1.resolve)(cacheDir, `${cacheKey}.txt`);
        // Check if cached result exists
        if ((0, fs_1.existsSync)(cacheFilePath)) {
            console.log(`   📦 Using cached result (hash: ${cacheKey})`);
            const cachedText = await (0, promises_1.readFile)(cacheFilePath, 'utf-8');
            console.log(`   Preview: ${cachedText.substring(0, 200)}${cachedText.length > 200 ? '...' : ''}`);
            return {
                text: cachedText,
            };
        }
        // Move any existing cache files to prev-cache before generating new content
        const prevCacheDir = (0, path_1.resolve)(cacheDir, 'prev-cache');
        const existingCacheFiles = (0, fs_1.existsSync)(cacheDir)
            ? (0, fs_1.readdirSync)(cacheDir).filter(f => f.endsWith('.txt'))
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
        const credManager = new credentials_1.CredentialsManager(context.projectDir, 'openai');
        const credentials = credManager.load(['apiKey']);
        // Initialize OpenAI client
        const openai = new openai_1.default({
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
            await (0, promises_1.writeFile)(cacheFilePath, generatedText, 'utf-8');
            console.log(`   💾 Saved to cache (hash: ${cacheKey})`);
            return {
                text: generatedText,
            };
        }
        catch (error) {
            throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.OpenAINode = OpenAINode;
//# sourceMappingURL=index.js.map