"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectNode = void 0;
/**
 * Project Node - Main node that runs ffmpeg to render video
 */
class ProjectNode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'project';
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [];
    }
    getOutputs() {
        return this.params.outputs.map((output) => ({
            name: output.name,
            description: `Video output: ${output.resolution} @ ${output.fps}fps`,
        }));
    }
    validateParameters() {
        const errors = [];
        if (this.params.outputs.length === 0) {
            errors.push({
                text: 'Project node must have at least one output defined',
                field: 'outputs',
            });
        }
        if (this.params.sequences.length === 0) {
            errors.push({
                text: 'Project node must have at least one sequence defined',
                field: 'sequences',
            });
        }
        if (this.params.assets.length === 0) {
            errors.push({
                text: 'Project node should have at least one asset defined',
                field: 'assets',
            });
        }
        return errors;
    }
    getParameterSchema() {
        return [
            {
                name: 'title',
                required: false,
                description: 'Project title',
                type: 'string',
            },
            {
                name: 'tags',
                required: false,
                description: 'Project tags',
                type: 'string',
            },
            {
                name: 'sequences',
                required: true,
                description: 'Video sequences with fragments',
            },
            {
                name: 'assets',
                required: true,
                description: 'Media assets (video, audio, images)',
            },
            {
                name: 'outputs',
                required: true,
                description: 'Output configurations (resolution, fps)',
            },
            {
                name: 'ffmpeg',
                required: false,
                description: 'FFmpeg encoding options',
            },
        ];
    }
}
exports.ProjectNode = ProjectNode;
//# sourceMappingURL=index.js.map