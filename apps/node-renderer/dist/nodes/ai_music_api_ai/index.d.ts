import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError } from '../../lib/node-interface';
export interface AIMusicAPINodeParams {
    name?: string;
    prompt: string;
    model?: string;
}
/**
 * AI Music API Node - Generates music using AI Music API
 */
export declare class AIMusicAPINode implements INode {
    private params;
    constructor(params: AIMusicAPINodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
}
//# sourceMappingURL=index.d.ts.map