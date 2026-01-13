import { Filter } from './filtercomplex';
import { LabelGenerator } from './label-generator';

/**
 * A node in the stream DAG (represents a stream label)
 */
export type StreamNode = {
  id: string; // e.g., "0:v", "outv", "g0"
};

/**
 * An edge in the stream DAG (represents a filter connecting streams)
 */
export type FilterEdge = {
  filter: Filter;
  from: string[]; // Input stream IDs
  to: string[]; // Output stream IDs (array to support split filter)
};

/**
 * StreamDAG - Represents FFmpeg filter_complex as a DAG
 * Vertices: Stream nodes (stream labels)
 * Edges: Filter edges connecting streams
 */
export class StreamDAG {
  private nodes: Map<string, StreamNode> = new Map();
  private edges: FilterEdge[] = [];
  private labelGenerator: LabelGenerator = new LabelGenerator();

  /**
   * Generates a unique intermediate label
   */
  makeLabel(): string {
    return this.labelGenerator.generate();
  }

  /**
   * Adds a filter edge to the DAG
   * Automatically creates nodes for all referenced streams
   * Returns the first output label for chaining
   */
  add(filter: Filter): string {
    // Add nodes for all input streams and mark labels as used
    for (const input of filter.inputs) {
      if (!this.nodes.has(input)) {
        this.nodes.set(input, { id: input });
      }
      this.labelGenerator.markUsed(input);
    }

    // Add nodes for all output streams and mark labels as used
    for (const output of filter.outputs) {
      if (!this.nodes.has(output)) {
        this.nodes.set(output, { id: output });
      }
      this.labelGenerator.markUsed(output);
    }

    // Add edge
    this.edges.push({
      filter,
      from: filter.inputs,
      to: filter.outputs,
    });

    return filter.outputs[0]; // Return first output for chaining
  }

  /**
   * Gets all input nodes (not produced by any filter)
   */
  getInputs(): Set<string> {
    const outputs = new Set(this.edges.flatMap((e) => e.to));
    const inputs = new Set<string>();
    for (const nodeId of this.nodes.keys()) {
      if (!outputs.has(nodeId)) {
        inputs.add(nodeId);
      }
    }
    return inputs;
  }

  /**
   * Gets all output nodes (not consumed by any filter)
   */
  getOutputs(): Set<string> {
    const consumed = new Set(this.edges.flatMap((e) => e.from));
    const outputs = new Set<string>();
    for (const nodeId of this.nodes.keys()) {
      if (!consumed.has(nodeId)) {
        outputs.add(nodeId);
      }
    }
    return outputs;
  }

  /**
   * Gets all nodes in the DAG
   */
  getNodes(): Map<string, StreamNode> {
    return new Map(this.nodes);
  }

  /**
   * Gets all edges in the DAG
   */
  getEdges(): FilterEdge[] {
    return [...this.edges];
  }

  /**
   * Renders the DAG into filter_complex string
   */
  render(): string {
    return this.edges.map((e) => e.filter.render()).join(';');
  }

  /**
   * Creates a StreamBuilder starting from an input label
   * @param inputLabel - The starting stream label (e.g., '0:v', '1:v')
   */
  from(inputLabel: string) {
    // Ensure the input node exists in the graph and mark as used
    if (!this.nodes.has(inputLabel)) {
      this.nodes.set(inputLabel, { id: inputLabel });
    }
    this.labelGenerator.markUsed(inputLabel);

    // Dynamic import to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StreamBuilder } = require('./stream-builder');
    return new StreamBuilder(this, inputLabel);
  }

  /**
   * Appends streams from other DAGs into this DAG
   * Merges all nodes and edges from the source DAGs
   * @param streams - Array of StreamBuilder instances to append
   */
  appendStreams(streams: Array<{ getDAG(): StreamDAG }>): void {
    const sourceDags = new Set<StreamDAG>();

    // Collect unique source DAGs from all streams
    for (const stream of streams) {
      const sourceDAG = stream.getDAG();
      if (sourceDAG && sourceDAG !== this) {
        sourceDags.add(sourceDAG);
      }
    }

    // Merge each source DAG into this DAG
    for (const sourceDAG of sourceDags) {
      // Copy all nodes from source and mark labels as used
      for (const [nodeId, node] of sourceDAG.getNodes()) {
        if (!this.nodes.has(nodeId)) {
          this.nodes.set(nodeId, { ...node });
        }
        this.labelGenerator.markUsed(nodeId);
      }

      // Copy all edges from source
      for (const edge of sourceDAG.getEdges()) {
        // Check if this edge already exists (avoid duplicates)
        const exists = this.edges.some(
          (e) =>
            e.filter === edge.filter &&
            JSON.stringify(e.from) === JSON.stringify(edge.from) &&
            JSON.stringify(e.to) === JSON.stringify(edge.to),
        );

        if (!exists) {
          this.edges.push({ ...edge });
        }
      }
    }
  }
}
