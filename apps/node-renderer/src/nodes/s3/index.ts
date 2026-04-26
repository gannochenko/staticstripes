import type {
  INode,
  NodeInput,
  NodeOutput,
  NodeParameter,
  ValidationError,
  NodeExecutionContext,
} from '../../lib/node-interface';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, readFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dirname, resolve } from 'path';
import { CredentialsManager } from '../../lib/credentials';

const execAsync = promisify(exec);

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

  public async execute(context: NodeExecutionContext): Promise<Record<string, any>> {
    console.log(`📦 Executing S3 node: ${this.params.name || 'unnamed'}`);

    // Parse pathRef to extract node name and output name
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

    if (!existsSync(sourcePath)) {
      throw new Error(`❌ Error: Source file not found: ${sourcePath}`);
    }

    // Find the "file" path config
    const filePathConfig = this.params.paths.find(p => p.name === 'file');
    if (!filePathConfig) {
      throw new Error('S3 node requires a path config with name="file"');
    }

    const filePath = filePathConfig.path;

    // Load credentials
    const credentialsManager = new CredentialsManager(
      context.projectDir,
      this.params.name || 's3'
    );

    let credentials: { accessKeyId: string; secretAccessKey: string };
    try {
      credentials = credentialsManager.load<{ accessKeyId: string; secretAccessKey: string }>([
        'accessKeyId',
        'secretAccessKey',
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${errorMessage}\n\n` +
          `💡 S3 credentials file should contain:\n` +
          `{\n` +
          `  "accessKeyId": "YOUR_ACCESS_KEY",\n` +
          `  "secretAccessKey": "YOUR_SECRET_KEY"\n` +
          `}\n`,
      );
    }

    console.log(`   Bucket: ${this.params.bucket}`);
    console.log(`   Region: ${this.params.region}`);
    console.log(`   Endpoint: ${this.params.endpoint}`);
    console.log(`   File path: ${filePath}`);

    // Configure S3 client
    const s3Config: any = {
      region: this.params.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    };

    // Add custom endpoint for S3-compatible services
    if (this.params.endpoint) {
      s3Config.endpoint = `https://${this.params.region}.${this.params.endpoint}`;
      s3Config.forcePathStyle = false;
    }

    const s3Client = new S3Client(s3Config);

    // Upload video file using a stream to avoid loading the full file into RAM
    const fileSizeBytes = statSync(sourcePath).size;
    const fileSizeMb = (fileSizeBytes / 1024 / 1024).toFixed(1);
    console.log(`📤 Uploading video file (${fileSizeMb} MB)...`);

    const fileUploadParams: any = {
      Bucket: this.params.bucket,
      Key: filePath,
      Body: createReadStream(sourcePath),
      ContentType: 'video/mp4',
      ContentLength: fileSizeBytes,
      ContentDisposition: 'inline',
      CacheControl: 'public, max-age=31536000, immutable',
    };

    if (this.params.acl) {
      fileUploadParams.ACL = this.params.acl;
    }

    await s3Client.send(new PutObjectCommand(fileUploadParams));

    // Construct public URL for video
    let fileUrl: string;
    if (this.params.endpoint) {
      fileUrl = `https://${this.params.bucket}.${this.params.region}.${this.params.endpoint}/${filePath}`;
    } else {
      fileUrl = `https://${this.params.bucket}.s3.${this.params.region}.amazonaws.com/${filePath}`;
    }

    console.log(`✅ Video uploaded successfully!`);
    console.log(`🔗 Video URL: ${fileUrl}`);

    // Upload thumbnail if specified
    let thumbnailUrl: string | undefined;
    if (this.params.thumbnail) {
      const thumbnailPathConfig = this.params.paths.find(p => p.name === 'thumbnail');
      if (thumbnailPathConfig) {
        const thumbnailTimecode = this.parseThumbnailTimecode(this.params.thumbnail);
        console.log(`\n🖼️  Extracting thumbnail at ${thumbnailTimecode}ms...`);

        const thumbnailPath = resolve(context.projectDir, '.cache', 'thumbnail.jpeg');
        await this.extractThumbnail(sourcePath, thumbnailTimecode, thumbnailPath);

        console.log(`📤 Uploading thumbnail...`);
        const s3ThumbnailPath = thumbnailPathConfig.path;
        const thumbnailBuffer = readFileSync(thumbnailPath);

        const thumbnailUploadParams: any = {
          Bucket: this.params.bucket,
          Key: s3ThumbnailPath,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        };

        if (this.params.acl) {
          thumbnailUploadParams.ACL = this.params.acl;
        }

        await s3Client.send(new PutObjectCommand(thumbnailUploadParams));

        if (this.params.endpoint) {
          thumbnailUrl = `https://${this.params.bucket}.${this.params.region}.${this.params.endpoint}/${s3ThumbnailPath}`;
        } else {
          thumbnailUrl = `https://${this.params.bucket}.s3.${this.params.region}.amazonaws.com/${s3ThumbnailPath}`;
        }

        console.log(`✅ Thumbnail uploaded successfully!`);
        console.log(`🔗 Thumbnail URL: ${thumbnailUrl}`);
      }
    }

    // Upload metadata file if specified
    const metadataPathConfig = this.params.paths.find(p => p.name === 'metadata');
    if (metadataPathConfig) {
      console.log(`\n📤 Uploading metadata file...`);
      const metadataPath = metadataPathConfig.path;

      // Get video duration
      const durationMs = await this.getVideoDuration(sourcePath);

      // Calculate relative path to thumbnail if it exists
      let relativeThumbnailPath: string | undefined;
      if (thumbnailUrl) {
        const thumbnailPathConfig = this.params.paths.find(p => p.name === 'thumbnail');
        if (thumbnailPathConfig) {
          relativeThumbnailPath = this.getRelativePath(metadataPath, thumbnailPathConfig.path);
        }
      }

      // Create metadata JSON
      const metadata = {
        title: null,
        date: null,
        tags: [],
        duration: durationMs,
        thumbnail: relativeThumbnailPath || null,
      };

      const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');

      const metadataUploadParams: any = {
        Bucket: this.params.bucket,
        Key: metadataPath,
        Body: metadataBuffer,
        ContentType: 'application/json',
      };

      if (this.params.acl) {
        metadataUploadParams.ACL = this.params.acl;
      }

      await s3Client.send(new PutObjectCommand(metadataUploadParams));

      let metadataUrl: string;
      if (this.params.endpoint) {
        metadataUrl = `https://${this.params.bucket}.${this.params.region}.${this.params.endpoint}/${metadataPath}`;
      } else {
        metadataUrl = `https://${this.params.bucket}.s3.${this.params.region}.amazonaws.com/${metadataPath}`;
      }

      console.log(`✅ Metadata uploaded successfully!`);
      console.log(`🔗 Metadata URL: ${metadataUrl}`);
    }

    return {
      url: fileUrl,
    };
  }

  private parseThumbnailTimecode(timecode: string): number {
    // Parse timecode format like "1000ms" or "1s"
    const msMatch = timecode.match(/^(\d+)ms$/);
    if (msMatch) {
      return parseInt(msMatch[1], 10);
    }

    const sMatch = timecode.match(/^(\d+)s$/);
    if (sMatch) {
      return parseInt(sMatch[1], 10) * 1000;
    }

    // Assume milliseconds if no unit
    return parseInt(timecode, 10);
  }

  private async extractThumbnail(
    videoPath: string,
    timecode: number,
    outputPath: string,
  ): Promise<void> {
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timeInSeconds = timecode / 1000;
    const command = `ffmpeg -y -ss ${timeInSeconds} -i "${videoPath}" -frames:v 1 -q:v 2 "${outputPath}"`;

    await execAsync(command);
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;

    const { stdout } = await execAsync(command);
    const durationSeconds = parseFloat(stdout.trim());

    return Math.round(durationSeconds * 1000);
  }

  private getRelativePath(from: string, to: string): string {
    const fromParts = from.split('/').slice(0, -1);
    const toParts = to.split('/');

    let commonLength = 0;
    while (
      commonLength < fromParts.length &&
      commonLength < toParts.length &&
      fromParts[commonLength] === toParts[commonLength]
    ) {
      commonLength++;
    }

    const upLevels = fromParts.length - commonLength;
    const relativeParts = [];

    for (let i = 0; i < upLevels; i++) {
      relativeParts.push('..');
    }

    relativeParts.push(...toParts.slice(commonLength));

    const result = relativeParts.join('/');
    return upLevels === 0 ? `./${result}` : result;
  }
}
