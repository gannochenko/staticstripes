"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppNode = void 0;
const app_builder_1 = require("./app-builder");
const app_renderer_1 = require("./app-renderer");
const puppeteer_1 = __importDefault(require("puppeteer"));
const path_1 = require("path");
const fs_1 = require("fs");
const crypto_1 = require("crypto");
/**
 * Generate cache key for an app based on all inputs that affect rendering
 */
function generateAppCacheKey(src, parameters, title, date, tags, outputName, fps, duration) {
    const hash = (0, crypto_1.createHash)('sha256');
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
class AppNode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'app';
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
                name: 'video',
                description: 'Rendered app output (PNG for static, APNG for animated)',
            },
        ];
    }
    validateParameters() {
        const errors = [];
        if (!this.params.src) {
            errors.push({
                text: 'App node must have a "src" attribute pointing to the app directory',
                field: 'src',
            });
        }
        return errors;
    }
    getParameterSchema() {
        return [
            {
                name: 'src',
                required: true,
                description: 'Path to app directory (usually ends with /dst or /dist)',
                type: 'string',
            },
        ];
    }
    async execute(context) {
        console.log(`🎨 Executing app node "${this.params.name || 'unnamed'}"...`);
        // Build app if needed
        await (0, app_builder_1.buildAppIfNeeded)({
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
        // Check if cached result exists before launching browser
        const cacheKey = generateAppCacheKey(app.src, app.parameters, '', // title
        undefined, // date
        [], // tags
        'default', // outputName
        fps, duration);
        const cacheDir = (0, path_1.resolve)(context.projectDir, 'cache', app.id);
        const cachedApng = (0, path_1.resolve)(cacheDir, `${cacheKey}.apng`);
        if ((0, fs_1.existsSync)(cachedApng)) {
            console.log(`Using cached app "${app.id}" (hash: ${cacheKey}) from ${cachedApng}`);
            return {
                video: cachedApng,
            };
        }
        // No cache - need to render, so launch browser
        const browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--allow-file-access-from-files',
            ],
        });
        try {
            const result = await (0, app_renderer_1.renderApp)({
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
            console.log(`✅ App "${app.id}" rendered as ${result.mode} (${result.path})`);
            return {
                video: result.path,
            };
        }
        finally {
            await browser.close();
        }
    }
}
exports.AppNode = AppNode;
//# sourceMappingURL=index.js.map