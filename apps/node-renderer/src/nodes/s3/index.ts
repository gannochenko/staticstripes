import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
} from '../../node-interface';

export interface S3PathConfig {
  name: string;
  path: string;
}

export interface S3NodeParams {
  name?: string;
  pathRef: string; // Reference to video source
  endpoint: string;
  region: string;
  bucket: string;
  paths: S3PathConfig[]; // Multiple upload paths
  acl?: string;
  thumbnail?: string;
}

/**
 * S3 Node - Uploads video to S3-compatible storage
 */
export class S3Node implements INode {
  constructor(private params: S3NodeParams) {}

  public getType(): string {
    return 's3';
  }

  public getName(): string | undefined {
    return this.params.name;
  }

  public getInputs(): NodeInput[] {
    return [
      {
        name: 'path',
        description: 'Video source to upload to S3',
      },
    ];
  }

  public getOutputs(): NodeOutput[] {
    return [
      {
        name: 'url',
        description: 'S3 URL of uploaded video',
      },
    ];
  }

  public validateParameters(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.params.pathRef) {
      errors.push({
        text: 'S3 node requires a path reference to video source',
        field: 'pathRef',
      });
    }

    if (!this.params.endpoint) {
      errors.push({
        text: 'S3 node requires an endpoint',
        field: 'endpoint',
      });
    }

    if (!this.params.region) {
      errors.push({
        text: 'S3 node requires a region',
        field: 'region',
      });
    }

    if (!this.params.bucket) {
      errors.push({
        text: 'S3 node requires a bucket',
        field: 'bucket',
      });
    }

    if (this.params.paths.length === 0) {
      errors.push({
        text: 'S3 node requires at least one path configuration',
        field: 'paths',
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
        name: 'endpoint',
        required: true,
        description: 'S3 endpoint URL',
        type: 'string',
      },
      {
        name: 'region',
        required: true,
        description: 'S3 region',
        type: 'string',
      },
      {
        name: 'bucket',
        required: true,
        description: 'S3 bucket name',
        type: 'string',
      },
      {
        name: 'paths',
        required: true,
        description: 'Upload path configurations',
        type: 'string',
      },
      {
        name: 'acl',
        required: false,
        description: 'Access control list',
        type: 'string',
      },
      {
        name: 'thumbnail',
        required: false,
        description: 'Thumbnail timecode',
        type: 'string',
      },
    ];
  }
}
