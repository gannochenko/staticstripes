import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError, NodeExecutionContext } from '../../lib/node-interface';
export interface OpenAINodeParams {
    name?: string;
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    salt?: string;
}
/**
 * OpenAI Node - Text generation using OpenAI API
 *
 * Credentials are loaded from:
 * - Local: <project>/.auth/openai.json
 * - Global: ~/.staticstripes/auth/openai.json
 *
 * Credentials file format:
 * {
 *   "apiKey": "sk-...",
 *   "organization": "org-..." (optional)
 * }
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
    execute(context: NodeExecutionContext): Promise<Record<string, any>>;
}
//# sourceMappingURL=index.d.ts.map