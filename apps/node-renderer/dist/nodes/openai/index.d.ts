import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError } from '../../node-interface';
export interface OpenAINodeParams {
    name?: string;
    prompt: string;
    model?: string;
}
/**
 * OpenAI Node - Text generation using OpenAI API
 */
export declare class OpenAINode implements INode {
    private params;
    constructor(params: OpenAINodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
}
//# sourceMappingURL=index.d.ts.map