import type { INode, NodeInput, NodeOutput, NodeParameter, ValidationError, NodeExecutionContext } from "../../lib/node-interface";
import type { Output, Sequence, Asset, BasePath, FFmpegOption } from "../../lib/type";
export interface ProjectNodeParams {
    name?: string;
    title?: string;
    tags: string[];
    basePaths: BasePath[];
    outputs: Output[];
    sequences: Sequence[];
    assets: Asset[];
    ffmpegOptions: FFmpegOption[];
    css?: Map<any, Record<string, string>>;
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
    execute(context: NodeExecutionContext): Promise<Record<string, any>>;
    private prepareAssets;
    private buildFilterGraph;
}
//# sourceMappingURL=index.d.ts.map