import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError } from '../../lib/node-interface';
export interface InstagramNodeParams {
    name?: string;
    urlRef: string;
    thumbnail?: string;
    caption?: string;
}
/**
 * Instagram Node - Uploads video to Instagram
 */
export declare class InstagramNode implements INode {
    private params;
    constructor(params: InstagramNodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
}
//# sourceMappingURL=index.d.ts.map