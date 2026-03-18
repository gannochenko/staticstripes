import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../node-interface';
import type { Output, Sequence, Asset, FFmpegOption } from '../../type';

export interface ProjectNodeParams {
  name?: string;
  title?: string;
  tags: string[];
  outputs: Output[];
  sequences: Sequence[];
  assets: Asset[];
  ffmpegOptions: FFmpegOption[];
}

/**
 * Project Node - Main node that runs ffmpeg to render video
 */
export class ProjectNode implements INode {
  constructor(private params: ProjectNodeParams) {}

  public getType(): string {
    return 'project';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [];
  }

  public getOutputs(): NodeOutput[] {
    return this.params.outputs.map((output) => ({
      name: output.name,
      description: `Video output: ${output.resolution} @ ${output.fps}fps`,
    }));
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (this.params.outputs.length === 0) {
      errors.push({
        text: 'Project node must have at least one output defined',
        field: 'outputs',
      });
    }

    if (this.params.sequences.length === 0) {
      errors.push({
        text: 'Project node must have at least one sequence defined',
        field: 'sequences',
      });
    }

    if (this.params.assets.length === 0) {
      errors.push({
        text: 'Project node should have at least one asset defined',
        field: 'assets',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'title',
        required: false,
        description: 'Project title',
        type: 'string',
      },
      {
        name: 'tags',
        required: false,
        description: 'Project tags',
        type: 'string',
      },
      {
        name: 'sequences',
        required: true,
        description: 'Video sequences with fragments',
      },
      {
        name: 'assets',
        required: true,
        description: 'Media assets (video, audio, images)',
      },
      {
        name: 'outputs',
        required: true,
        description: 'Output configurations (resolution, fps)',
      },
      {
        name: 'ffmpeg',
        required: false,
        description: 'FFmpeg encoding options',
      },
    ];
  }
}
