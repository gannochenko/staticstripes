import type { INode } from './node-interface';
import type { ParsedNode, Output } from './type';
/**
 * Factory for creating node instances from parsed nodes
 * Extracts parameters from HTML structure and passes them to node constructors
 */
export declare class NodeFactory {
    /**
     * Creates a node instance based on the parsed node type
     */
    static createNode(parsedNode: ParsedNode, outputs?: Output[]): INode;
    /**
     * Creates node instances for all parsed nodes
     */
    static createNodes(parsedNodes: ParsedNode[], outputs?: Output[]): INode[];
    /**
     * Checks if a node type is supported
     */
    static isSupportedNodeType(nodeType: string): boolean;
    private static extractProjectParams;
    private static extractFilesystemParams;
    private static extractYouTubeParams;
    private static extractS3Params;
    private static extractInstagramParams;
    private static extractAIMusicAPIParams;
    private static extractElevenLabsParams;
    private static extractOpenAIParams;
    private static extractAppParams;
}
//# sourceMappingURL=node-factory.d.ts.map