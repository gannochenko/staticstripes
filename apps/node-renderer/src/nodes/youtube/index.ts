import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../node-interface';

export interface YouTubeNodeParams {
  name?: string;
  pathRef: string; // Reference to video source
  unlisted?: boolean;
  madeForKids?: boolean;
  category?: string;
  language?: string;
  thumbnail?: string;
  description?: string;
}

/**
 * YouTube Node - Uploads video to YouTube
 */
export class YouTubeNode implements INode {
  constructor(private params: YouTubeNodeParams) {}

  public getType(): string {
    return 'youtube';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [
      {
        name: 'path',
        description: 'Video source to upload to YouTube',
      },
    ];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'url',
        description: 'YouTube video URL',
      },
      {
        name: 'video_id',
        description: 'YouTube video ID',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.pathRef) {
      errors.push({
        text: 'YouTube node requires a path reference to video source',
        field: 'pathRef',
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
        name: 'unlisted',
        required: false,
        description: 'Make video unlisted',
        type: 'boolean',
      },
      {
        name: 'madeForKids',
        required: false,
        description: 'Mark video as made for kids',
        type: 'boolean',
      },
      {
        name: 'category',
        required: false,
        description: 'Video category',
        type: 'string',
      },
      {
        name: 'language',
        required: false,
        description: 'Video language',
        type: 'string',
      },
      {
        name: 'thumbnail',
        required: false,
        description: 'Thumbnail timecode',
        type: 'string',
      },
      {
        name: 'description',
        required: false,
        description: 'Video description',
        type: 'string',
      },
    ];
  }
}
