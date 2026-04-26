import type { INode } from './node-interface';
import type { ParsedNode, Output } from './type';
/**
 * Stores the output values from executed nodes
 */
export interface NodeOutputValue {
    nodeName: string;
    outputName: string;
    value: any;
}
/**
 * Execution context that stores all node outputs
 */
export declare class ExecutionContext {
    private outputs;
    /**
     * Sets an output value for a node
     */
    setOutput(nodeName: string, outputName: string, value: any): void;
    /**
     * Gets an output value from a node
     */
    getOutput(nodeName: string, outputName: string): any | undefined;
    /**
     * Checks if a node has executed (has outputs)
     */
    hasNodeExecuted(nodeName: string): boolean;
    /**
     * Gets all outputs for a node
     */
    getNodeOutputs(nodeName: string): Map<string, any> | undefined;
    /**
     * Clears all outputs
     */
    clear(): void;
}
/**
 * Cache entry for a node execution
 */
export interface CacheEntry {
    nodeName: string;
    cacheKey: string;
    outputs: Map<string, any>;
    timestamp: number;
}
/**
 * Cache system for node execution results
 */
export declare class NodeCache {
    private cache;
    /**
     * Generates a cache key from node name and parameters
     */
    static generateCacheKey(nodeName: string, parameters: Record<string, any>): string;
    /**
     * Gets a cached entry for a node
     */
    get(cacheKey: string): CacheEntry | undefined;
    /**
     * Sets a cache entry for a node
     */
    set(entry: CacheEntry): void;
    /**
     * Invalidates cache for a specific node
     */
    invalidate(cacheKey: string): void;
    /**
     * Invalidates cache for all nodes
     */
    invalidateAll(): void;
    /**
     * Checks if a cache entry exists
     */
    has(cacheKey: string): boolean;
    /**
     * Gets all cache keys
     */
    getCacheKeys(): string[];
}
/**
 * Result of a node execution
 */
export interface NodeExecutionResult {
    nodeName: string;
    success: boolean;
    outputs?: Map<string, any>;
    error?: Error;
    fromCache: boolean;
    duration: number;
}
/**
 * Result of a DAG execution
 */
export interface DAGExecutionResult {
    success: boolean;
    executedNodes: string[];
    results: NodeExecutionResult[];
    error?: {
        nodeName: string;
        error: Error;
    };
    totalDuration: number;
}
/**
 * Options for DAG execution
 */
export interface DAGRunnerOptions {
    enableCache?: boolean;
    onNodeStart?: (nodeName: string) => void;
    onNodeComplete?: (result: NodeExecutionResult) => void;
    onNodeError?: (nodeName: string, error: Error) => void;
    outputResolution?: {
        width: number;
        height: number;
    };
    outputFps?: number;
    ffmpegProfile?: string;
}
/**
 * Executes a DAG of nodes
 */
export declare class DAGRunner {
    private parsedNodes;
    private nodes;
    private projectDir;
    private options;
    private outputs;
    private basePaths;
    private cache;
    private context;
    constructor(parsedNodes: ParsedNode[], nodes: INode[], projectDir: string, options?: DAGRunnerOptions, outputs?: Output[], basePaths?: import('./node-interface').BasePath[]);
    /**
     * Gets the execution context
     */
    getContext(): ExecutionContext;
    /**
     * Gets the cache
     */
    getCache(): NodeCache;
    /**
     * Extracts parameters from a parsed node for cache key generation
     */
    private extractNodeParameters;
    /**
     * Resolves input values for a node from the execution context
     */
    private resolveInputs;
    /**
     * Executes a single node
     */
    private executeNode;
    /**
     * Invalidates cache for a node and all downstream nodes
     */
    private invalidateDownstreamCache;
    /**
     * Executes the entire DAG
     */
    execute(): Promise<DAGExecutionResult>;
    /**
     * Clears execution context and cache
     */
    reset(): void;
}
//# sourceMappingURL=dag-runner.d.ts.map