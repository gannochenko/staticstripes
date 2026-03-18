import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../node-interface';

export interface InstagramNodeParams {
  name?: string;
  urlRef: string; // Reference to video URL
  thumbnail?: string;
  caption?: string;
}

/**
 * Instagram Node - Uploads video to Instagram
 */
export class InstagramNode implements INode {
  constructor(private params: InstagramNodeParams) {}

  public getType(): string {
    return 'instagram';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [
      {
        name: 'url',
        description: 'Video URL to upload to Instagram',
      },
    ];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'post_id',
        description: 'Instagram post ID',
      },
      {
        name: 'url',
        description: 'Instagram post URL',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.urlRef) {
      errors.push({
        text: 'Instagram node requires a URL reference to video source',
        field: 'urlRef',
      });
    }

    return errors;
  }

  public getParameterSchema(): NodeParameter[] {
    return [
      {
        name: 'urlRef',
        required: true,
        description: 'Video URL reference',
        type: 'reference',
      },
      {
        name: 'thumbnail',
        required: false,
        description: 'Thumbnail timecode',
        type: 'string',
      },
      {
        name: 'caption',
        required: false,
        description: 'Post caption',
        type: 'string',
      },
    ];
  }
}
