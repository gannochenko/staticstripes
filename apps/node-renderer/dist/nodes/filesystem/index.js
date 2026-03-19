"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesystemNode = void 0;
/**
 * Filesystem Node - Outputs video to local filesystem
 */
class FilesystemNode {
    params;
    constructor(params) {
        this.params = params;
    }
    getType() {
        return 'filesystem';
    }
    getName() {
        return this.params.name;
    }
    getInputs() {
        return [
            {
                name: 'path',
                description: 'Video source to write to filesystem',
            },
        ];
    }
    getOutputs() {
        return [
            {
                name: 'file',
                description: 'Path to the written file',
            },
        ];
    }
    validateParameters() {
        const errors = [];
        if (!this.params.pathRef) {
            errors.push({
                text: 'Filesystem node requires a path reference to video source',
                field: 'pathRef',
            });
        }
        if (!this.params.destinationPath || this.params.destinationPath.trim() === '') {
            errors.push({
                text: 'Filesystem node requires a destination file path',
                field: 'destinationPath',
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
                name: 'destinationPath',
                required: true,
                description: 'Destination file path',
                type: 'string',
            },
        ];
    }
    getDestinationPath() {
        return this.params.destinationPath;
    }
    getPathRef() {
        return this.params.pathRef;
    }
}
exports.FilesystemNode = FilesystemNode;
//# sourceMappingURL=index.js.map