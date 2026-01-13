import { Filter } from './filtercomplex';
import { StreamBuilder } from './stream-builder';

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

  /**
   * Generates a random intermediate label
   */
  makeLabel(): string {
    const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
    const num = Math.floor(Math.random() * 1000);
    return `${letter}${num}`;
  }

  /**
   * Adds a filter edge to the DAG
   * Automatically creates nodes for all referenced streams
   * Returns the first output label for chaining
   */
  add(filter: Filter): string {
    // Add nodes for all input streams
    for (const input of filter.inputs) {
      if (!this.nodes.has(input)) {
        this.nodes.set(input, { id: input });
      }
    }

    // Add nodes for all output streams
    for (const output of filter.outputs) {
      if (!this.nodes.has(output)) {
        this.nodes.set(output, { id: output });
      }
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
  from(inputLabel: string): StreamBuilder {
    // Ensure the input node exists in the graph
    if (!this.nodes.has(inputLabel)) {
      this.nodes.set(inputLabel, { id: inputLabel });
    }
    return new StreamBuilder(this, inputLabel);
  }
}
