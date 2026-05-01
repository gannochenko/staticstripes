import type { INode } from './node-interface';
import type { ParsedNode, Output } from './type';
import { DAGValidator } from './dag-validator';
import * as crypto from 'crypto';

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
export class ExecutionContext {
  private outputs = new Map<string, Map<string, any>>();

  /**
   * Sets an output value for a node
   */
  public setOutput(nodeName: string, outputName: string, value: any): void {
    if (!this.outputs.has(nodeName)) {
      this.outputs.set(nodeName, new Map());
    }
    this.outputs.get(nodeName)!.set(outputName, value);
  }

  /**
   * Gets an output value from a node
   */
  public getOutput(nodeName: string, outputName: string): any | undefined {
    return this.outputs.get(nodeName)?.get(outputName);
  }

  /**
   * Checks if a node has executed (has outputs)
   */
  public hasNodeExecuted(nodeName: string): boolean {
    return this.outputs.has(nodeName);
  }

  /**
   * Gets all outputs for a node
   */
  public getNodeOutputs(nodeName: string): Map<string, any> | undefined {
    return this.outputs.get(nodeName);
  }

  /**
   * Clears all outputs
   */
  public clear(): void {
    this.outputs.clear();
  }
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
export class NodeCache {
  private cache = new Map<string, CacheEntry>();

  /**
   * Generates a cache key from node name and parameters
   */
  public static generateCacheKey(
    nodeName: string,
    parameters: Record<string, any>,
  ): string {
    const hash = crypto.createHash('sha256');
    hash.update(nodeName);
    hash.update(JSON.stringify(parameters, Object.keys(parameters).sort()));
    return hash.digest('hex');
  }

  /**
   * Gets a cached entry for a node
   */
  public get(cacheKey: string): CacheEntry | undefined {
    return this.cache.get(cacheKey);
  }

  /**
   * Sets a cache entry for a node
   */
  public set(entry: CacheEntry): void {
    this.cache.set(entry.cacheKey, entry);
  }

  /**
   * Invalidates cache for a specific node
   */
  public invalidate(cacheKey: string): void {
    this.cache.delete(cacheKey);
  }

  /**
   * Invalidates cache for all nodes
   */
  public invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Checks if a cache entry exists
   */
  public has(cacheKey: string): boolean {
    return this.cache.has(cacheKey);
  }

  /**
   * Gets all cache keys
   */
  public getCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }
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
  duration: number; // milliseconds
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
  totalDuration: number; // milliseconds
}

/**
 * Options for DAG execution
 */
export interface DAGRunnerOptions {
  enableCache?: boolean;
  onNodeStart?: (nodeName: string) => void;
  onNodeComplete?: (result: NodeExecutionResult) => void;
  onNodeError?: (nodeName: string, error: Error) => void;
  outputResolution?: { width: number; height: number };
  outputFps?: number;
  ffmpegProfile?: string;
  force?: boolean;
  showTime?: boolean;
  timeFormat?: 'ms' | 'hms';
}

/**
 * Executes a DAG of nodes
 */
export class DAGRunner {
  private cache: NodeCache;
  private context: ExecutionContext;

  constructor(
    private parsedNodes: ParsedNode[],
    private nodes: INode[],
    private projectDir: string,
    private options: DAGRunnerOptions = {},
    private outputs: Output[] = [],
    private basePaths: import('./node-interface').BasePath[] = [],
  ) {
    this.cache = new NodeCache();
    this.context = new ExecutionContext();
  }

  /**
   * Gets the execution context
   */
  public getContext(): ExecutionContext {
    return this.context;
  }

  /**
   * Gets the cache
   */
  public getCache(): NodeCache {
    return this.cache;
  }

  /**
   * Extracts parameters from a parsed node for cache key generation
   */
  private extractNodeParameters(parsedNode: ParsedNode): Record<string, any> {
    const params: Record<string, any> = {
      type: parsedNode.type,
      name: parsedNode.name,
    };

    // Add all attributes
    for (const [key, value] of parsedNode.attributes.entries()) {
      params[key] = value;
    }

    // Add project content if it's a project node
    if (parsedNode.projectContent) {
      params.projectContent = parsedNode.projectContent;
    }

    return params;
  }

  /**
   * Resolves input values for a node from the execution context
   */
  private resolveInputs(
    parsedNode: ParsedNode,
    node: INode,
  ): Map<string, any> {
    const resolvedInputs = new Map<string, any>();
    const inputs = node.getInputs();

    for (const input of inputs) {
      // Check attributes for references
      for (const [attrKey, attrValue] of parsedNode.attributes.entries()) {
        if (
          attrKey === input.name ||
          attrKey.toLowerCase() === input.name.toLowerCase()
        ) {
          const ref = DAGValidator.parseNodeReference(attrValue);
          if (ref) {
            const value = this.context.getOutput(ref.nodeName, ref.outputName);
            if (value !== undefined) {
              resolvedInputs.set(input.name, value);
            }
          }
        }
      }
    }

    return resolvedInputs;
  }

  /**
   * Executes a single node
   */
  private async executeNode(
    parsedNode: ParsedNode,
    node: INode,
  ): Promise<NodeExecutionResult> {
    const nodeName = parsedNode.name || parsedNode.type;
    const startTime = Date.now();

    try {
      // Check cache if enabled
      if (this.options.enableCache !== false) {
        const params = this.extractNodeParameters(parsedNode);
        const cacheKey = NodeCache.generateCacheKey(nodeName, params);

        if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey)!;
          // Restore outputs to context
          for (const [outputName, value] of cached.outputs.entries()) {
            this.context.setOutput(nodeName, outputName, value);
          }

          return {
            nodeName,
            success: true,
            outputs: cached.outputs,
            fromCache: true,
            duration: Date.now() - startTime,
          };
        }
      }

      // Notify start
      if (this.options.onNodeStart) {
        this.options.onNodeStart(nodeName);
      }

      // Resolve inputs
      const inputs = this.resolveInputs(parsedNode, node);

      // Execute node
      const outputs = new Map<string, any>();

      if (node.execute) {
        // Node has execute() method - call it with execution context
        const nodeContext = {
          getOutput: (nodeName: string, outputName: string) => {
            return this.context.getOutput(nodeName, outputName);
          },
          inputs, // Pass resolved inputs to the node
          projectDir: this.projectDir,
          basePaths: this.basePaths,
          cacheDir: undefined, // TODO: Implement cache directory
          outputResolution: this.options.outputResolution || { width: 1920, height: 1080 },
          outputFps: this.options.outputFps || 30,
          ffmpegProfile: this.options.ffmpegProfile,
          force: this.options.force,
          showTime: this.options.showTime,
          timeFormat: this.options.timeFormat,
        };

        const result = await node.execute(nodeContext);

        // Store results in outputs map
        for (const [key, value] of Object.entries(result)) {
          outputs.set(key, value);
        }
      } else {
        // Node doesn't have execute() - create stub outputs
        for (const output of node.getOutputs()) {
          outputs.set(output.name, `${nodeName}.${output.name}.result`);
        }
      }

      // Store outputs in context
      for (const [outputName, value] of outputs.entries()) {
        this.context.setOutput(nodeName, outputName, value);
      }

      // Cache the result if enabled
      if (this.options.enableCache !== false) {
        const params = this.extractNodeParameters(parsedNode);
        const cacheKey = NodeCache.generateCacheKey(nodeName, params);
        this.cache.set({
          nodeName,
          cacheKey,
          outputs,
          timestamp: Date.now(),
        });
      }

      const result: NodeExecutionResult = {
        nodeName,
        success: true,
        outputs,
        fromCache: false,
        duration: Date.now() - startTime,
      };

      // Notify complete
      if (this.options.onNodeComplete) {
        this.options.onNodeComplete(result);
      }

      return result;
    } catch (error) {
      const err = error as Error;

      // Notify error
      if (this.options.onNodeError) {
        this.options.onNodeError(nodeName, err);
      }

      return {
        nodeName,
        success: false,
        error: err,
        fromCache: false,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Invalidates cache for a node and all downstream nodes
   */
  private invalidateDownstreamCache(
    nodeName: string,
    dependencies: Array<{ from: string; to: string }>,
  ): void {
    const visited = new Set<string>();
    const queue: string[] = [nodeName];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all nodes that depend on current node
      for (const dep of dependencies) {
        if (dep.to === current && !visited.has(dep.from)) {
          queue.push(dep.from);

          // Invalidate cache for dependent node
          const parsedNode = this.parsedNodes.find(
            (n) => (n.name || n.type) === dep.from,
          );
          if (parsedNode) {
            const params = this.extractNodeParameters(parsedNode);
            const cacheKey = NodeCache.generateCacheKey(dep.from, params);
            this.cache.invalidate(cacheKey);
          }
        }
      }
    }
  }

  /**
   * Executes the entire DAG
   */
  public async execute(): Promise<DAGExecutionResult> {
    const startTime = Date.now();
    const results: NodeExecutionResult[] = [];
    const executedNodes: string[] = [];

    try {
      // Validate DAG first
      const validation = DAGValidator.validate(this.parsedNodes, this.nodes, this.outputs);

      if (!validation.valid) {
        throw new Error(
          `DAG validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
        );
      }

      if (!validation.executionOrder) {
        throw new Error('No execution order determined');
      }

      // Execute nodes in topological order
      for (const nodeName of validation.executionOrder) {
        const index = this.parsedNodes.findIndex(
          (n) => (n.name || n.type) === nodeName,
        );
        if (index === -1) {
          throw new Error(`Node ${nodeName} not found in parsed nodes`);
        }

        const parsedNode = this.parsedNodes[index];
        const node = this.nodes[index];

        // Execute the node
        const result = await this.executeNode(parsedNode, node);
        results.push(result);

        if (!result.success) {
          // Stop execution on error
          return {
            success: false,
            executedNodes,
            results,
            error: {
              nodeName: result.nodeName,
              error: result.error!,
            },
            totalDuration: Date.now() - startTime,
          };
        }

        executedNodes.push(nodeName);

        // If this was a cache miss, invalidate downstream cache
        if (
          this.options.enableCache !== false &&
          !result.fromCache &&
          validation.dependencies
        ) {
          this.invalidateDownstreamCache(nodeName, validation.dependencies);
        }
      }

      return {
        success: true,
        executedNodes,
        results,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        executedNodes,
        results,
        error: {
          nodeName: 'unknown',
          error: error as Error,
        },
        totalDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Clears execution context and cache
   */
  public reset(): void {
    this.context.clear();
    this.cache.invalidateAll();
  }
}
