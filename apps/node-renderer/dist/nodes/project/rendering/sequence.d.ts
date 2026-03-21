import { AssetManager } from "./asset-manager";
import { ExpressionContext } from "./expression-parser";
import { FilterBuffer, Stream } from "./stream";
import { Output, SequenceDefinition, FragmentDebugInfo } from "./types";
export declare class Sequence {
    private buf;
    private definition;
    private output;
    private assetManager;
    private expressionContext;
    private time;
    private videoStream;
    private audioStream;
    private debugInfo;
    constructor(buf: FilterBuffer, definition: SequenceDefinition, output: Output, assetManager: AssetManager, expressionContext: ExpressionContext);
    build(): void;
    isEmpty(): boolean;
    overlayWith(sequence: Sequence): void;
    getVideoStream(): Stream;
    getAudioStream(): Stream;
    getDebugInfo(): FragmentDebugInfo[];
    getTotalDuration(): number;
}
//# sourceMappingURL=sequence.d.ts.map