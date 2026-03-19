"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIMusicAPINode = void 0;
/**
 * AI Music API Node - Generates music using AI Music API
 */
class AIMusicAPINode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'ai_music_api_ai';
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
                name: 'audio',
                description: 'Generated audio file',
            },
        ];
    }
    validateParameters() {
        const errors = [];
        if (!this.params.prompt || this.params.prompt.trim() === '') {
            errors.push({
                text: 'AI Music API node requires a prompt',
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
                description: 'Music generation prompt',
                type: 'string',
            },
            {
                name: 'model',
                required: false,
                description: 'AI model to use',
                type: 'string',
            },
        ];
    }
}
exports.AIMusicAPINode = AIMusicAPINode;
//# sourceMappingURL=index.js.map