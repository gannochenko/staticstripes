import type { INode } from './node-interface';
import type { ParsedNode, Asset } from './type';
/**
 * Represents a reference to a node's output
 * Format: $nodeName.output.outputName
 */
export interface NodeReference {
    nodeName: string;
    outputName: string;
    originalString: string;
}
/**
 * Represents a dependency between two nodes
 */
export interface NodeDependency {
    from: string;
    to: string;
    via: string;
}
/**
 * Validation error with context
 */
export interface DAGValidationError {
    type: 'cycle' | 'unknown_node_type' | 'duplicate_node_name' | 'unresolved_node_reference' | 'unresolved_output_reference' | 'unresolved_asset_reference' | 'missing_parameter' | 'no_project_node' | 'multiple_project_nodes' | 'invalid_reference_format';
    message: string;
    nodeName?: string;
    field?: string;
    reference?: string;
}
/**
 * Result of DAG validation
 */
export interface DAGValidationResult {
    valid: boolean;
    errors: DAGValidationError[];
    dependencies: NodeDependency[];
    executionOrder?: string[];
}
/**
 * Validates the DAG structure of nodes
 */
export declare class DAGValidator {
    /**
     * Parses a node reference string
     * Format: $nodeName.output.outputName
     */
    static parseNodeReference(ref: string): NodeReference | null;
    /**
     * Parses an asset input reference
     * Format: $nodeName.output.outputName (same as node reference)
     */
    static parseAssetInputReference(input: string): NodeReference | null;
    /**
     * Extracts all node references from a node's parameters
     */
    static extractNodeReferences(parsedNode: ParsedNode): NodeReference[];
    /**
     * Extracts asset input references from project node
     */
    static extractAssetReferences(assets: Asset[]): NodeReference[];
    /**
     * Builds dependency graph from parsed nodes
     */
    static buildDependencyGraph(parsedNodes: ParsedNode[]): NodeDependency[];
    /**
     * Detects cycles in the dependency graph using DFS
     */
    static detectCycles(dependencies: NodeDependency[], nodeNames: string[]): string[][];
    /**
     * Performs topological sort to determine execution order
     * Returns null if there are cycles
     * Note: dependencies are {from: dependent, to: dependency}
     * For execution order, dependency must come before dependent
     */
    static topologicalSort(dependencies: NodeDependency[], nodeNames: string[]): string[] | null;
    /**
     * Validates the entire DAG structure
     */
    static validate(parsedNodes: ParsedNode[], nodes: INode[]): DAGValidationResult;
}
//# sourceMappingURL=dag-validator.d.ts.map