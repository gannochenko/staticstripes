"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeNode = void 0;
/**
 * YouTube Node - Uploads video to YouTube
 */
class YouTubeNode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'youtube';
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [
            {
                name: 'path',
                description: 'Video source to upload to YouTube',
            },
        ];
    }
    getOutputs() {
        return [
            {
                name: 'url',
                description: 'YouTube video URL',
            },
            {
                name: 'video_id',
                description: 'YouTube video ID',
            },
        ];
    }
    validateParameters() {
        const errors = [];
        if (!this.params.pathRef) {
            errors.push({
                text: 'YouTube node requires a path reference to video source',
                field: 'pathRef',
            });
        }
        return errors;
    }
    getParameterSchema() {
        return [
            {
                name: 'pathRef',
                required: true,
                description: 'Video source reference',
                type: 'reference',
            },
            {
                name: 'unlisted',
                required: false,
                description: 'Make video unlisted',
                type: 'boolean',
            },
            {
                name: 'madeForKids',
                required: false,
                description: 'Mark video as made for kids',
                type: 'boolean',
            },
            {
                name: 'category',
                required: false,
                description: 'Video category',
                type: 'string',
            },
            {
                name: 'language',
                required: false,
                description: 'Video language',
                type: 'string',
            },
            {
                name: 'thumbnail',
                required: false,
                description: 'Thumbnail timecode',
                type: 'string',
            },
            {
                name: 'description',
                required: false,
                description: 'Video description',
                type: 'string',
            },
        ];
    }
}
exports.YouTubeNode = YouTubeNode;
//# sourceMappingURL=index.js.map