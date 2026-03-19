"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElevenLabsNode = void 0;
/**
 * ElevenLabs Node - Text-to-speech using ElevenLabs API
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
                description: 'Generated speech audio',
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
                description: 'Voice ID to use',
                type: 'string',
            },
            {
                name: 'model',
                required: false,
                description: 'ElevenLabs model to use',
                type: 'string',
            },
        ];
    }
}
exports.ElevenLabsNode = ElevenLabsNode;
//# sourceMappingURL=index.js.map