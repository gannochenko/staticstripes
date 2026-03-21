"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppNode = void 0;
const app_builder_1 = require("./app-builder");
const app_renderer_1 = require("./app-renderer");
const puppeteer_1 = __importDefault(require("puppeteer"));
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
        // Render app
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