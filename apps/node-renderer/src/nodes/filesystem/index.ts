import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../node-interface';

export interface FilesystemNodeParams {
  name?: string;
  pathRef: string; // Reference to video source (e.g., "$project.output.youtube")
  destinationPath: string; // Destination file path
}

/**
 * Filesystem Node - Outputs video to local filesystem
 */
export class FilesystemNode implements INode {
  constructor(private params: FilesystemNodeParams) {}

  public getType(): string {
    return 'filesystem';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [
      {
        name: 'path',
        description: 'Video source to write to filesystem',
      },
    ];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'file',
        description: 'Path to the written file',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.pathRef) {
      errors.push({
        text: 'Filesystem node requires a path reference to video source',
        field: 'pathRef',
      });
    }

    if (!this.params.destinationPath || this.params.destinationPath.trim() === '') {
      errors.push({
        text: 'Filesystem node requires a destination file path',
        field: 'destinationPath',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'pathRef',
        required: true,
        description: 'Video source reference',
        type: 'reference',
      },
      {
        name: 'destinationPath',
        required: true,
        description: 'Destination file path',
        type: 'string',
      },
    ];
  }

  public getDestinationPath(): string {
    return this.params.destinationPath;
  }

  public getPathRef(): string {
    return this.params.pathRef;
  }
}
