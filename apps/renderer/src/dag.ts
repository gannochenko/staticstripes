import { Filter } from './ffmpeg';

/**
 * StreamDAG - Represents FFmpeg filter_complex as a DAG
 * Vertices: Stream labels (0:v, outv, etc.)
 * Edges: Filters connecting streams
 */
export class StreamDAG {
  private filters: Filter[] = [];

  /**
   * Generates a random intermediate label
   */
  label(): string {
    const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
    const num = Math.floor(Math.random() * 1000);
    return `${letter}${num}`;
  }

  /**
   * Adds a filter to the DAG
   * Returns the output label for chaining
   */
  add(filter: Filter): string {
    this.filters.push(filter);
    return filter.output;
  }

  /**
   * Renders the DAG into filter_complex string
   */
  render(): string {
    return this.filters.map((f) => f.render()).join(';');
  }
}
