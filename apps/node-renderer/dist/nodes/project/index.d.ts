import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError } from '../../node-interface';
import type { Output, Sequence, Asset, FFmpegOption } from '../../type';
export interface ProjectNodeParams {
    name?: string;
    title?: string;
    tags: string[];
    outputs: Output[];
    sequences: Sequence[];
    assets: Asset[];
    ffmpegOptions: FFmpegOption[];
}
/**
 * Project Node - Main node that runs ffmpeg to render video
 */
export declare class ProjectNode implements INode {
    private params;
    constructor(params: ProjectNodeParams);
    getType(): string;
    getName(): string | undefined;
    getInputs(): NodeInput[];
    getOutputs(): NodeOutput[];
    validateParameters(): ValidationError[];
    getParameterSchema(): NodeParameter[];
}
//# sourceMappingURL=index.d.ts.map