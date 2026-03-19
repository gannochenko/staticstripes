"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAINode = void 0;
/**
 * OpenAI Node - Text generation using OpenAI API
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
                description: 'OpenAI model to use (e.g., gpt-4, gpt-3.5-turbo)',
                type: 'string',
            },
        ];
    }
}
exports.OpenAINode = OpenAINode;
//# sourceMappingURL=index.js.map