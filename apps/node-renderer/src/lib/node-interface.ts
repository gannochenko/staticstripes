/**
 * Node interface and related types for the node system
 */

export interface NodeInput {
  name: string;
  description?: string;
}

export interface NodeOutput {
  name: string;
  description?: string;
}

export interface ValidationError {
  text: string;
  field?: string;
}

export interface NodeParameter {
  name: string;
  required: boolean;
  description?: string;
  type?: 'string' | 'number' | 'boolean' | 'reference';
}

/**
 * Base path definition
 */
export interface BasePath {
  /** Base path name (e.g., "clips", "global") */
  name: string;
  /** Absolute or relative path */
  path: string;
}

/**
 * Execution context passed to nodes during execution
 * Contains outputs from upstream nodes
 */
export interface NodeExecutionContext {
  /**
   * Gets an output value from an upstream node
   * @param nodeName - Name of the upstream node
   * @param outputName - Name of the output
   * @returns The output value (typically a file path or data)
   */
  getOutput(nodeName: string, outputName: string): any;

  /**
   * Resolved input values for this node
   * Maps input names to their resolved values from upstream nodes
   */
  inputs?: Map<string, any>;

  /**
   * Project directory path (where project.html lives)
   */
  projectDir: string;

  /**
   * Base paths for resolving asset paths
   */
  basePaths: BasePath[];

  /**
   * Cache directory for this node
   */
  cacheDir?: string;

  /**
   * Output resolution from project configuration
   */
  outputResolution: { width: number; height: number };

  /**
   * Output FPS from project configuration
   */
  outputFps: number;

  /**
   * FFmpeg option profile name to use (e.g. "preview", "prod")
   * Defaults to the first defined option if not set
   */
  ffmpegProfile?: string;
}

/**
 * Base interface that all node types must implement
 */
export interface INode {
  /**
   * Returns the list of inputs this node accepts
   */
  getInputs(): NodeInput[];

  /**
   * Returns the list of outputs this node produces
   */
  getOutputs(): NodeOutput[];

  /**
   * Validates the parameters of this node instance
   * Returns an array of validation errors, empty if valid
   */
  validateParameters(): ValidationError[];

  /**
   * Returns the parameter schema for this node type
   */
  getParameterSchema(): NodeParameter[];

  /**
   * Returns the node type (e.g., 'project', 'filesystem', etc.)
   */
  getType(): string;

  /**
   * Returns the node name (optional, from 'name' attribute)
   */
  getName(): string | undefined;

  /**
   * Executes the node logic
   * @param context - Execution context with access to upstream outputs
   * @returns Map of output name to output value (e.g., file paths)
   */
  execute?(context: NodeExecutionContext): Promise<Record<string, any>>;
}
