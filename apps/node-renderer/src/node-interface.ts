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
}
