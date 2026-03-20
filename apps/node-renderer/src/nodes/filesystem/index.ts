import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
  NodeExecutionContext,
} from '../../lib/node-interface';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

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

  public async execute(context: NodeExecutionContext): Promise<Record<string, any>> {
    console.log(`💾 Executing filesystem node: ${this.params.name || 'unnamed'}`);

    // Parse pathRef to extract node name and output name
    // Format: $nodeName.output.outputName
    const match = this.params.pathRef.match(/^\$([^.]+)\.output\.([^.]+)$/);
    if (!match) {
      throw new Error(
        `Invalid path reference format: "${this.params.pathRef}". Expected format: $nodeName.output.outputName`,
      );
    }

    const [, nodeName, outputName] = match;

    // Get source file path from upstream node
    const sourcePath = context.getOutput(nodeName, outputName);
    if (!sourcePath) {
      throw new Error(
        `Could not get output "${outputName}" from node "${nodeName}"`,
      );
    }

    console.log(`   Source: ${sourcePath}`);

    // Resolve destination path relative to project directory
    const destPath = resolve(context.projectDir, this.params.destinationPath);
    console.log(`   Destination: ${destPath}`);

    // Ensure destination directory exists
    const destDir = dirname(destPath);
    if (!existsSync(destDir)) {
      console.log(`   Creating directory: ${destDir}`);
      mkdirSync(destDir, { recursive: true });
    }

    // Copy file
    console.log(`   Copying file...`);
    copyFileSync(sourcePath, destPath);

    console.log(`   ✅ File copied successfully`);

    return {
      file: destPath,
    };
  }
}
