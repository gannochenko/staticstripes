import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError } from '../../node-interface';
export interface YouTubeNodeParams {
    name?: string;
    pathRef: string;
    unlisted?: boolean;
    madeForKids?: boolean;
    category?: string;
    language?: string;
    thumbnail?: string;
    description?: string;
}
/**
 * YouTube Node - Uploads video to YouTube
 */
export declare class YouTubeNode implements INode {
    private params;
    constructor(params: YouTubeNodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
}
//# sourceMappingURL=index.d.ts.map