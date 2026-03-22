import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError, NodeExecutionContext } from '../../lib/node-interface';
export interface AppNodeParams {
    name?: string;
    src: string;
    parameters: Record<string, string>;
}
/**
 * Application Node - Renders React/SPA apps using Puppeteer
 * Apps can be static (single frame) or animated (multiple frames)
 *
 * Apps must:
 * - Call window.__stsCaptureFrame(frameNumber) to capture animated frames
 * - Emit 'sts-done-rendering' event when complete
 * - Receive parameters via URL query string (fps, duration, title, date, tags, + custom params)
 */
export declare class AppNode implements INode {
    private params;
    constructor(params: AppNodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
    /**
     * Calculate the duration for the app based on its parameters
     * For karaoke text apps, parse word timings to determine actual duration
     * THROWS ERROR if no duration can be determined - NO HARDCODED DEFAULTS!
     */
    private calculateDuration;
    execute(context: NodeExecutionContext): Promise<Record<string, any>>;
}
//# sourceMappingURL=index.d.ts.map