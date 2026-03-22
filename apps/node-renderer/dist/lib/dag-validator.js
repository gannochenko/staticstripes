"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAGValidator = void 0;
/**
 * Validates the DAG structure of nodes
 */
class DAGValidator {
    /**
     * Parses a node reference string
     * Format: $nodeName.output.outputName
     */
    static parseNodeReference(ref) {
        if (!ref || !ref.startsWith('$')) {
            return null;
        }
        const match = ref.match(/^\$([^.]+)\.output\.([^.]+)$/);
        if (!match) {
            return null;
        }
        return {
            nodeName: match[1],
            outputName: match[2],
            originalString: ref,
        };
    }
    /**
     * Parses an asset input reference
     * Format: $nodeName.output.outputName (same as node reference)
     */
    static parseAssetInputReference(input) {
        // Asset inputs now use the same format as node references
        return this.parseNodeReference(input);
    }
    /**
     * Extracts all node references from a node's parameters
     */
    static extractNodeReferences(parsedNode) {
        const references = [];
        // Check attributes for references (e.g., path="$project.output.youtube")
        for (const [key, value] of parsedNode.attributes.entries()) {
            const ref = this.parseNodeReference(value);
            if (ref) {
                references.push(ref);
            }
        }
        return references;
    }
    /**
     * Extracts asset input references from project node
     */
    static extractAssetReferences(assets) {
        const references = [];
        for (const asset of assets) {
            if (asset.input) {
                const ref = this.parseAssetInputReference(asset.input);
                if (ref) {
                    references.push(ref);
                }
            }
        }
        return references;
    }
    /**
     * Builds dependency graph from parsed nodes
     */
    static buildDependencyGraph(parsedNodes) {
        const dependencies = [];
        for (const parsedNode of parsedNodes) {
            const nodeName = parsedNode.name || parsedNode.type;
            // Extract references from node attributes
            const references = this.extractNodeReferences(parsedNode);
            for (const ref of references) {
                dependencies.push({
                    from: nodeName,
                    to: ref.nodeName,
                    via: ref.originalString,
                });
            }
            // Extract references from project assets
            if (parsedNode.type === 'project' && parsedNode.projectContent) {
                const assetRefs = this.extractAssetReferences(parsedNode.projectContent.assets);
                for (const ref of assetRefs) {
                    dependencies.push({
                        from: nodeName,
                        to: ref.nodeName,
                        via: ref.originalString,
                    });
                }
            }
        }
        return dependencies;
    }
    /**
     * Detects cycles in the dependency graph using DFS
     */
    static detectCycles(dependencies, nodeNames) {
        const graph = new Map();
        const cycles = [];
        // Build adjacency list
        for (const name of nodeNames) {
            graph.set(name, []);
        }
        for (const dep of dependencies) {
            const neighbors = graph.get(dep.from) || [];
            neighbors.push(dep.to);
            graph.set(dep.from, neighbors);
        }
        // DFS to detect cycles
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        const dfs = (node) => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);
            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) {
                        return true;
                    }
                }
                else if (recursionStack.has(neighbor)) {
                    // Found a cycle
                    const cycleStart = path.indexOf(neighbor);
                    cycles.push([...path.slice(cycleStart), neighbor]);
                    return true;
                }
            }
            path.pop();
            recursionStack.delete(node);
            return false;
        };
        for (const node of nodeNames) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }
        return cycles;
    }
    /**
     * Performs topological sort to determine execution order
     * Returns null if there are cycles
     * Note: dependencies are {from: dependent, to: dependency}
     * For execution order, dependency must come before dependent
     */
    static topologicalSort(dependencies, nodeNames) {
        const graph = new Map();
        const inDegree = new Map();
        // Initialize graph
        for (const name of nodeNames) {
            graph.set(name, []);
            inDegree.set(name, 0);
        }
        // Build graph and calculate in-degrees
        // Reverse the edge: if A depends on B, edge goes B -> A (B executes before A)
        for (const dep of dependencies) {
            const neighbors = graph.get(dep.to) || [];
            neighbors.push(dep.from);
            graph.set(dep.to, neighbors);
            inDegree.set(dep.from, (inDegree.get(dep.from) || 0) + 1);
        }
        // Kahn's algorithm
        const queue = [];
        const result = [];
        // Start with nodes that have no dependencies
        for (const [node, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(node);
            }
        }
        while (queue.length > 0) {
            const node = queue.shift();
            result.push(node);
            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }
        // If result doesn't contain all nodes, there's a cycle
        if (result.length !== nodeNames.length) {
            return null;
        }
        return result;
    }
    /**
     * Validates the entire DAG structure
     */
    static validate(parsedNodes, nodes, projectOutputs = []) {
        const errors = [];
        // 1. Check for project node
        const projectNodes = parsedNodes.filter((n) => n.type === 'project');
        if (projectNodes.length === 0) {
            errors.push({
                type: 'no_project_node',
                message: 'No project node found. Every DAG must have exactly one project node.',
            });
        }
        else if (projectNodes.length > 1) {
            errors.push({
                type: 'multiple_project_nodes',
                message: `Found ${projectNodes.length} project nodes. Only one project node is allowed.`,
            });
        }
        // 2. Check for duplicate node names
        const nodeNames = parsedNodes
            .map((n) => n.name || n.type)
            .filter((name) => name);
        const uniqueNames = new Set(nodeNames);
        if (uniqueNames.size !== nodeNames.length) {
            const duplicates = nodeNames.filter((name, index) => nodeNames.indexOf(name) !== index);
            for (const dup of [...new Set(duplicates)]) {
                errors.push({
                    type: 'duplicate_node_name',
                    message: `Duplicate node name: "${dup}"`,
                    nodeName: dup,
                });
            }
        }
        // 3. Build node name to node map
        const nodeMap = new Map();
        for (const parsedNode of parsedNodes) {
            const name = parsedNode.name || parsedNode.type;
            nodeMap.set(name, parsedNode);
        }
        // 4. Build output map for validation
        const outputMap = new Map();
        for (let i = 0; i < parsedNodes.length; i++) {
            const parsedNode = parsedNodes[i];
            const name = parsedNode.name || parsedNode.type;
            const node = nodes[i];
            // For project node, use outputs from parameter instead of node.getOutputs()
            // because node was created before validation
            const outputs = parsedNode.type === 'project'
                ? projectOutputs.map((o) => o.name)
                : node.getOutputs().map((o) => o.name);
            outputMap.set(name, new Set(outputs));
        }
        // 5. Validate all node references
        for (const parsedNode of parsedNodes) {
            const nodeName = parsedNode.name || parsedNode.type;
            const references = this.extractNodeReferences(parsedNode);
            for (const ref of references) {
                // Check if referenced node exists
                if (!nodeMap.has(ref.nodeName)) {
                    errors.push({
                        type: 'unresolved_node_reference',
                        message: `Node "${nodeName}" references unknown node "${ref.nodeName}"`,
                        nodeName,
                        reference: ref.originalString,
                    });
                    continue;
                }
                // Check if referenced output exists
                const outputs = outputMap.get(ref.nodeName);
                if (!outputs || !outputs.has(ref.outputName)) {
                    errors.push({
                        type: 'unresolved_output_reference',
                        message: `Node "${nodeName}" references unknown output "${ref.outputName}" from node "${ref.nodeName}"`,
                        nodeName,
                        reference: ref.originalString,
                    });
                }
            }
            // Validate asset references
            if (parsedNode.type === 'project' && parsedNode.projectContent) {
                const assetRefs = this.extractAssetReferences(parsedNode.projectContent.assets);
                for (const ref of assetRefs) {
                    // Check if referenced node exists
                    if (!nodeMap.has(ref.nodeName)) {
                        errors.push({
                            type: 'unresolved_asset_reference',
                            message: `Asset references unknown node "${ref.nodeName}"`,
                            nodeName,
                            reference: ref.originalString,
                        });
                        continue;
                    }
                    // Check if referenced output exists
                    const outputs = outputMap.get(ref.nodeName);
                    if (!outputs || !outputs.has(ref.outputName)) {
                        errors.push({
                            type: 'unresolved_asset_reference',
                            message: `Asset references unknown output "${ref.outputName}" from node "${ref.nodeName}"`,
                            nodeName,
                            reference: ref.originalString,
                        });
                    }
                }
            }
        }
        // 6. Validate node parameters
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const parsedNode = parsedNodes[i];
            const nodeName = parsedNode.name || parsedNode.type;
            const paramErrors = node.validateParameters();
            for (const paramError of paramErrors) {
                errors.push({
                    type: 'missing_parameter',
                    message: paramError.text,
                    nodeName,
                    field: paramError.field,
                });
            }
        }
        // 7. Build dependency graph
        const dependencies = this.buildDependencyGraph(parsedNodes);
        // 8. Detect cycles
        const cycles = this.detectCycles(dependencies, Array.from(uniqueNames));
        for (const cycle of cycles) {
            errors.push({
                type: 'cycle',
                message: `Cycle detected in dependency graph: ${cycle.join(' -> ')}`,
            });
        }
        // 9. Determine execution order
        let executionOrder;
        if (cycles.length === 0 && errors.length === 0) {
            const order = this.topologicalSort(dependencies, Array.from(uniqueNames));
            if (order) {
                executionOrder = order;
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            dependencies,
            executionOrder,
        };
    }
}
exports.DAGValidator = DAGValidator;
//# sourceMappingURL=dag-validator.js.map