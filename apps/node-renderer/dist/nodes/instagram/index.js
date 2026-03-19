"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramNode = void 0;
/**
 * Instagram Node - Uploads video to Instagram
 */
class InstagramNode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'instagram';
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [
            {
                name: 'url',
                description: 'Video URL to upload to Instagram',
            },
        ];
    }
    getOutputs() {
        return [
            {
                name: 'post_id',
                description: 'Instagram post ID',
            },
            {
                name: 'url',
                description: 'Instagram post URL',
            },
        ];
    }
    validateParameters() {
        const errors = [];
        if (!this.params.urlRef) {
            errors.push({
                text: 'Instagram node requires a URL reference to video source',
                field: 'urlRef',
            });
        }
        return errors;
    }
    getParameterSchema() {
        return [
            {
                name: 'urlRef',
                required: true,
                description: 'Video URL reference',
                type: 'reference',
            },
            {
                name: 'thumbnail',
                required: false,
                description: 'Thumbnail timecode',
                type: 'string',
            },
            {
                name: 'caption',
                required: false,
                description: 'Post caption',
                type: 'string',
            },
        ];
    }
}
exports.InstagramNode = InstagramNode;
//# sourceMappingURL=index.js.map