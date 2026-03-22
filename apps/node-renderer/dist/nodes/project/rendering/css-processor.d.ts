import type { Sequence as ParsedSequence } from "../../../lib/type";
import type { SequenceDefinition } from "./types";
/**
 * Processes CSS properties and converts them to fragment properties
 * for the rendering engine
 */
export declare class CSSProcessor {
    /**
     * Converts parsed sequences to render-ready sequences
     */
    static processSequences(parsedSequences: ParsedSequence[], css: Map<any, Record<string, string>>): SequenceDefinition[];
    /**
     * Processes a single fragment
     */
    private static processFragment;
    /**
     * Parses time string (e.g., "3000ms", "3s") to milliseconds
     */
    private static parseTime;
    /**
     * Parses time string or calc() expression
     * Returns either a number (for simple time strings) or a CompiledExpression (for calc())
     */
    private static parseTimeOrExpression;
    /**
     * Parses transition string (e.g., "fade-in 500ms")
     */
    private static parseTransition;
    /**
     * Parses object-fit string
     */
    private static parseObjectFit;
}
//# sourceMappingURL=css-processor.d.ts.map