import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError, NodeExecutionContext } from '../../lib/node-interface';
export interface S3PathConfig {
    name: string;
    path: string;
}
export interface S3NodeParams {
    name?: string;
    pathRef: string;
    endpoint: string;
    region: string;
    bucket: string;
    paths: S3PathConfig[];
    acl?: string;
    thumbnail?: string;
}
/**
 * S3 Node - Uploads video to S3-compatible storage
 */
export declare class S3Node implements INode {
    private params;
    constructor(params: S3NodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
    execute(context: NodeExecutionContext): Promise<Record<string, any>>;
    private parseThumbnailTimecode;
    private extractThumbnail;
    private getVideoDuration;
    private getRelativePath;
}
//# sourceMappingURL=index.d.ts.map