import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError } from '../../lib/node-interface';
export interface ElevenLabsNodeParams {
    name?: string;
    textRef: string;
    voice?: string;
    model?: string;
}
/**
 * ElevenLabs Node - Text-to-speech using ElevenLabs API
 */
export declare class ElevenLabsNode implements INode {
    private params;
    constructor(params: ElevenLabsNodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
}
//# sourceMappingURL=index.d.ts.map