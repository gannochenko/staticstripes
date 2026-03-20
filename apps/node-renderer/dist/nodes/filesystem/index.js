"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesystemNode = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
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
    async execute(context) {
        console.log(`💾 Executing filesystem node: ${this.params.name || 'unnamed'}`);
        // Parse pathRef to extract node name and output name
        // Format: $nodeName.output.outputName
        const match = this.params.pathRef.match(/^\$([^.]+)\.output\.([^.]+)$/);
        if (!match) {
            throw new Error(`Invalid path reference format: "${this.params.pathRef}". Expected format: $nodeName.output.outputName`);
        }
        const [, nodeName, outputName] = match;
        // Get source file path from upstream node
        const sourcePath = context.getOutput(nodeName, outputName);
        if (!sourcePath) {
            throw new Error(`Could not get output "${outputName}" from node "${nodeName}"`);
        }
        console.log(`   Source: ${sourcePath}`);
        // Resolve destination path relative to project directory
        const destPath = (0, path_1.resolve)(context.projectDir, this.params.destinationPath);
        console.log(`   Destination: ${destPath}`);
        // Ensure destination directory exists
        const destDir = (0, path_1.dirname)(destPath);
        if (!(0, fs_1.existsSync)(destDir)) {
            console.log(`   Creating directory: ${destDir}`);
            (0, fs_1.mkdirSync)(destDir, { recursive: true });
        }
        // Copy file
        console.log(`   Copying file...`);
        (0, fs_1.copyFileSync)(sourcePath, destPath);
        console.log(`   ✅ File copied successfully`);
        return {
            file: destPath,
        };
    }
}
exports.FilesystemNode = FilesystemNode;
//# sourceMappingURL=index.js.map