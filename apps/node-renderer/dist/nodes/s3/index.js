"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Node = void 0;
/**
 * S3 Node - Uploads video to S3-compatible storage
 */
class S3Node {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 's3';
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [
            {
                name: 'path',
                description: 'Video source to upload to S3',
            },
        ];
    }
    getOutputs() {
        return [
            {
                name: 'url',
                description: 'S3 URL of uploaded video',
            },
        ];
    }
    validateParameters() {
        const errors = [];
        if (!this.params.pathRef) {
            errors.push({
                text: 'S3 node requires a path reference to video source',
                field: 'pathRef',
            });
        }
        if (!this.params.endpoint) {
            errors.push({
                text: 'S3 node requires an endpoint',
                field: 'endpoint',
            });
        }
        if (!this.params.region) {
            errors.push({
                text: 'S3 node requires a region',
                field: 'region',
            });
        }
        if (!this.params.bucket) {
            errors.push({
                text: 'S3 node requires a bucket',
                field: 'bucket',
            });
        }
        if (this.params.paths.length === 0) {
            errors.push({
                text: 'S3 node requires at least one path configuration',
                field: 'paths',
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
                name: 'endpoint',
                required: true,
                description: 'S3 endpoint URL',
                type: 'string',
            },
            {
                name: 'region',
                required: true,
                description: 'S3 region',
                type: 'string',
            },
            {
                name: 'bucket',
                required: true,
                description: 'S3 bucket name',
                type: 'string',
            },
            {
                name: 'paths',
                required: true,
                description: 'Upload path configurations',
                type: 'string',
            },
            {
                name: 'acl',
                required: false,
                description: 'Access control list',
                type: 'string',
            },
            {
                name: 'thumbnail',
                required: false,
                description: 'Thumbnail timecode',
                type: 'string',
            },
        ];
    }
}
exports.S3Node = S3Node;
//# sourceMappingURL=index.js.map