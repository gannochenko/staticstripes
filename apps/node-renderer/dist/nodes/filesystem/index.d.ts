import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError } from '../../node-interface';
export interface FilesystemNodeParams {
    name?: string;
    pathRef: string;
    destinationPath: string;
}
/**
 * Filesystem Node - Outputs video to local filesystem
 */
export declare class FilesystemNode implements INode {
    private params;
    constructor(params: FilesystemNodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
    getDestinationPath(): string;
    getPathRef(): string;
}
//# sourceMappingURL=index.d.ts.map