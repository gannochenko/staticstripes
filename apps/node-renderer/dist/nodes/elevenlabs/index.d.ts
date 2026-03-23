import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError, NodeExecutionContext } from '../../lib/node-interface';
export interface ElevenLabsNodeParams {
    name?: string;
    textRef: string;
    voice?: string;
    model?: string;
    outputFormat?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    salt?: string;
}
/**
 * Word-level timing information
 */
export interface WordTiming {
    word: string;
    start: number;
    end: number;
}
/**
 * ElevenLabs Node - Text-to-speech using ElevenLabs API
 *
 * Credentials are loaded from:
 * - Local: <project>/.auth/elevenlabs.json
 * - Global: ~/.staticstripes/auth/elevenlabs.json
 *
 * Credentials file format:
 * {
 *   "apiKey": "your-api-key"
 * }
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
    execute(context: NodeExecutionContext): Promise<Record<string, any>>;
}
//# sourceMappingURL=index.d.ts.map