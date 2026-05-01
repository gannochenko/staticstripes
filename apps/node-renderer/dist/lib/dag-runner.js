"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAGRunner = exports.NodeCache = exports.ExecutionContext = void 0;
const dag_validator_1 = require("./dag-validator");
const crypto = __importStar(require("crypto"));
/**
 * Execution context that stores all node outputs
 */
class ExecutionContext {
    outputs = new Map();
    /**
     * Sets an output value for a node
     */
    setOutput(nodeName, outputName, value) {
        if (!this.outputs.has(nodeName)) {
            this.outputs.set(nodeName, new Map());
        }
        this.outputs.get(nodeName).set(outputName, value);
    }
    /**
     * Gets an output value from a node
     */
    getOutput(nodeName, outputName) {
        return this.outputs.get(nodeName)?.get(outputName);
    }
    /**
     * Checks if a node has executed (has outputs)
     */
    hasNodeExecuted(nodeName) {
        return this.outputs.has(nodeName);
    }
    /**
     * Gets all outputs for a node
     */
    getNodeOutputs(nodeName) {
        return this.outputs.get(nodeName);
    }
    /**
     * Clears all outputs
     */
    clear() {
        this.outputs.clear();
    }
}
exports.ExecutionContext = ExecutionContext;
/**
 * Cache system for node execution results
 */
class NodeCache {
    cache = new Map();
    /**
     * Generates a cache key from node name and parameters
     */
    static generateCacheKey(nodeName, parameters) {
        const hash = crypto.createHash('sha256');
        hash.update(nodeName);
        hash.update(JSON.stringify(parameters, Object.keys(parameters).sort()));
        return hash.digest('hex');
    }
    /**
     * Gets a cached entry for a node
     */
    get(cacheKey) {
        return this.cache.get(cacheKey);
    }
    /**
     * Sets a cache entry for a node
     */
    set(entry) {
        this.cache.set(entry.cacheKey, entry);
    }
    /**
     * Invalidates cache for a specific node
     */
    invalidate(cacheKey) {
        this.cache.delete(cacheKey);
    }
    /**
     * Invalidates cache for all nodes
     */
    invalidateAll() {
        this.cache.clear();
    }
    /**
     * Checks if a cache entry exists
     */
    has(cacheKey) {
        return this.cache.has(cacheKey);
    }
    /**
     * Gets all cache keys
     */
    getCacheKeys() {
        return Array.from(this.cache.keys());
    }
}
exports.NodeCache = NodeCache;
/**
 * Executes a DAG of nodes
 */
class DAGRunner {
    parsedNodes;
    nodes;
    projectDir;
    options;
    outputs;
    basePaths;
    cache;
    context;
    constructor(parsedNodes, nodes, projectDir, options = {}, outputs = [], basePaths = []) {
        this.parsedNodes = parsedNodes;
        this.nodes = nodes;
        this.projectDir = projectDir;
        this.options = options;
        this.outputs = outputs;
        this.basePaths = basePaths;
        this.cache = new NodeCache();
        this.context = new ExecutionContext();
    }
    /**
     * Gets the execution context
     */
    getContext() {
        return this.context;
    }
    /**
     * Gets the cache
     */
    getCache() {
        return this.cache;
    }
    /**
     * Extracts parameters from a parsed node for cache key generation
     */
    extractNodeParameters(parsedNode) {
        const params = {
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
    resolveInputs(parsedNode, node) {
        const resolvedInputs = new Map();
        const inputs = node.getInputs();
        for (const input of inputs) {
            // Check attributes for references
            for (const [attrKey, attrValue] of parsedNode.attributes.entries()) {
                if (attrKey === input.name ||
                    attrKey.toLowerCase() === input.name.toLowerCase()) {
                    const ref = dag_validator_1.DAGValidator.parseNodeReference(attrValue);
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
    async executeNode(parsedNode, node) {
        const nodeName = parsedNode.name || parsedNode.type;
        const startTime = Date.now();
        try {
            // Check cache if enabled
            if (this.options.enableCache !== false) {
                const params = this.extractNodeParameters(parsedNode);
                const cacheKey = NodeCache.generateCacheKey(nodeName, params);
                if (this.cache.has(cacheKey)) {
                    const cached = this.cache.get(cacheKey);
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
            const outputs = new Map();
            if (node.execute) {
                // Node has execute() method - call it with execution context
                const nodeContext = {
                    getOutput: (nodeName, outputName) => {
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
            }
            else {
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
            const result = {
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
        }
        catch (error) {
            const err = error;
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
    invalidateDownstreamCache(nodeName, dependencies) {
        const visited = new Set();
        const queue = [nodeName];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current))
                continue;
            visited.add(current);
            // Find all nodes that depend on current node
            for (const dep of dependencies) {
                if (dep.to === current && !visited.has(dep.from)) {
                    queue.push(dep.from);
                    // Invalidate cache for dependent node
                    const parsedNode = this.parsedNodes.find((n) => (n.name || n.type) === dep.from);
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
    async execute() {
        const startTime = Date.now();
        const results = [];
        const executedNodes = [];
        try {
            // Validate DAG first
            const validation = dag_validator_1.DAGValidator.validate(this.parsedNodes, this.nodes, this.outputs);
            if (!validation.valid) {
                throw new Error(`DAG validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
            }
            if (!validation.executionOrder) {
                throw new Error('No execution order determined');
            }
            // Execute nodes in topological order
            for (const nodeName of validation.executionOrder) {
                const index = this.parsedNodes.findIndex((n) => (n.name || n.type) === nodeName);
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
                            error: result.error,
                        },
                        totalDuration: Date.now() - startTime,
                    };
                }
                executedNodes.push(nodeName);
                // If this was a cache miss, invalidate downstream cache
                if (this.options.enableCache !== false &&
                    !result.fromCache &&
                    validation.dependencies) {
                    this.invalidateDownstreamCache(nodeName, validation.dependencies);
                }
            }
            return {
                success: true,
                executedNodes,
                results,
                totalDuration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                executedNodes,
                results,
                error: {
                    nodeName: 'unknown',
                    error: error,
                },
                totalDuration: Date.now() - startTime,
            };
        }
    }
    /**
     * Clears execution context and cache
     */
    reset() {
        this.context.clear();
        this.cache.invalidateAll();
    }
}
exports.DAGRunner = DAGRunner;
//# sourceMappingURL=dag-runner.js.map