import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { Upload } from '../../type';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { CredentialsManager, S3Credentials } from '../credentials';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dirname, resolve } from 'path';

const execAsync = promisify(exec);

/**
 * S3 upload strategy implementation
 * Supports generic S3-compatible storage (AWS S3, DigitalOcean Spaces, etc.)
 */
export class S3UploadStrategy implements UploadStrategy {
  constructor(private credentialsManager?: CredentialsManager) {}

  getTag(): string {
    return 's3';
  }

  validate(): void {
    // Validation happens in execute() since we need upload config
  }

  async execute(
    project: Project,
    upload: Upload,
    projectPath: string,
  ): Promise<void> {
    // Validate S3 configuration exists
    if (!upload.s3) {
      throw new Error(
        `❌ Error: S3 configuration missing for upload "${upload.name}"`,
      );
    }

    const { endpoint, region, bucket, paths, acl } = upload.s3;

    // Validate that we have a "file" path
    if (!paths.has('file')) {
      throw new Error(
        `❌ Error: S3 upload "${upload.name}" missing required <path name="file"> element`,
      );
    }

    // Validate ACL value if specified
    const allowedAcls = ['private', 'public-read', 'authenticated-read'];
    if (acl && !allowedAcls.includes(acl)) {
      throw new Error(
        `❌ Error: Invalid ACL value "${acl}" for upload "${upload.name}"\n\n` +
          `Allowed values: ${allowedAcls.join(', ')}\n` +
          `Note: "public-read-write" is not supported for security reasons.`,
      );
    }

    // Load credentials from local .auth/<upload-name>.json or global ~/.staticstripes/auth/<upload-name>.json
    const manager =
      this.credentialsManager ||
      new CredentialsManager(projectPath, upload.name);

    let credentials: S3Credentials;
    try {
      credentials = manager.load<S3Credentials>([
        'accessKeyId',
        'secretAccessKey',
      ]);
    } catch (error) {
      // Add helpful context about S3 credentials format
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `${errorMessage}\n\n` +
          `💡 S3 credentials file should contain:\n` +
          `{\n` +
          `  "accessKeyId": "YOUR_ACCESS_KEY",\n` +
          `  "secretAccessKey": "YOUR_SECRET_KEY"\n` +
          `}\n\n` +
          `📖 Get credentials from:\n` +
          `   • AWS: IAM → Users → Security Credentials\n` +
          `   • DigitalOcean: API → Spaces Keys\n`,
      );
    }

    // Get the output file
    const output = project.getOutput(upload.outputName);
    if (!output) {
      throw new Error(`❌ Error: Output "${upload.outputName}" not found`);
    }

    if (!existsSync(output.path)) {
      throw new Error(
        `❌ Error: Output file not found: ${output.path}\n` +
          '💡 Please generate the video first',
      );
    }

    // Prepare interpolation variables
    const slug = this.slugify(project.getTitle());
    const outputName = output.name;
    const date = project.getDate() || '';
    const title = project.getTitle();
    const tags = upload.tags;

    // Helper function to interpolate path variables
    const interpolatePath = (pathTemplate: string): string => {
      return pathTemplate
        .replace(/\$\{slug\}/g, slug)
        .replace(/\$\{output\}/g, outputName)
        .replace(/\$\{date\}/g, date);
    };

    // Get and interpolate the file path
    const filePath = interpolatePath(paths.get('file')!);

    console.log(`\n📦 Preparing S3 upload...`);
    console.log(`   Bucket: ${bucket}`);
    console.log(`   Region: ${region}`);
    if (endpoint) {
      console.log(`   Endpoint: ${endpoint}`);
    }
    console.log(`   File path: ${filePath}`);
    console.log(`   Video file: ${output.path}`);
    if (paths.has('metadata')) {
      const metadataPath = interpolatePath(paths.get('metadata')!);
      console.log(`   Metadata path: ${metadataPath}`);
    }
    if (upload.thumbnailTimecode !== undefined && paths.has('thumbnail')) {
      const thumbnailPath = interpolatePath(paths.get('thumbnail')!);
      console.log(`   Thumbnail path: ${thumbnailPath}`);
      console.log(`   Thumbnail timecode: ${upload.thumbnailTimecode}ms`);
    }
    console.log('');

    // Configure S3 client
    const s3Config: any = {
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    };

    // Add custom endpoint for S3-compatible services (DigitalOcean Spaces, etc.)
    if (endpoint) {
      // Construct the endpoint URL with region for S3-compatible services
      // e.g., "ams3.digitaloceanspaces.com" for DigitalOcean Spaces
      s3Config.endpoint = `https://${region}.${endpoint}`;
      // Use virtual-hosted-style addressing (bucket.region.endpoint.com)
      s3Config.forcePathStyle = false;
    }

    const s3Client = new S3Client(s3Config);

    // Upload video file
    console.log(`📤 Uploading video file...`);
    const fileBuffer = readFileSync(output.path);

    const fileUploadParams: any = {
      Bucket: bucket,
      Key: filePath,
      Body: fileBuffer,
      ContentType: 'video/mp4',
    };

    // Add ACL if specified in configuration
    if (acl) {
      fileUploadParams.ACL = acl;
    }

    try {
      await s3Client.send(new PutObjectCommand(fileUploadParams));

      // Construct public URL for video
      let fileUrl: string;
      if (endpoint) {
        // For DigitalOcean Spaces and similar services
        // Format: https://{bucket}.{region}.{endpoint}/{path}
        fileUrl = `https://${bucket}.${region}.${endpoint}/${filePath}`;
      } else {
        // For AWS S3
        fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${filePath}`;
      }

      console.log(`✅ Video uploaded successfully!`);
      console.log(`🔗 Video URL: ${fileUrl}`);

      // Upload thumbnail if specified
      if (upload.thumbnailTimecode !== undefined && paths.has('thumbnail')) {
        console.log(
          `\n🖼️  Extracting thumbnail at ${upload.thumbnailTimecode}ms...`,
        );
        const thumbnailPath = resolve(
          dirname(projectPath),
          '.cache',
          'thumbnail.jpeg',
        );
        await this.extractThumbnail(
          output.path,
          upload.thumbnailTimecode,
          thumbnailPath,
        );

        console.log(`📤 Uploading thumbnail...`);
        const s3ThumbnailPath = interpolatePath(paths.get('thumbnail')!);
        const thumbnailBuffer = readFileSync(thumbnailPath);

        const thumbnailUploadParams: any = {
          Bucket: bucket,
          Key: s3ThumbnailPath,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        };

        // Add ACL if specified
        if (acl) {
          thumbnailUploadParams.ACL = acl;
        }

        await s3Client.send(new PutObjectCommand(thumbnailUploadParams));

        // Construct public URL for thumbnail
        let thumbnailUrl: string;
        if (endpoint) {
          thumbnailUrl = `https://${bucket}.${region}.${endpoint}/${s3ThumbnailPath}`;
        } else {
          thumbnailUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3ThumbnailPath}`;
        }

        console.log(`✅ Thumbnail uploaded successfully!`);
        console.log(`🔗 Thumbnail URL: ${thumbnailUrl}`);
      }

      // Upload metadata file if specified
      if (paths.has('metadata')) {
        console.log(`\n📤 Uploading metadata file...`);
        const metadataPath = interpolatePath(paths.get('metadata')!);

        // Create metadata JSON
        const metadata = {
          title,
          date: date || null,
          tags,
        };

        const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');

        const metadataUploadParams: any = {
          Bucket: bucket,
          Key: metadataPath,
          Body: metadataBuffer,
          ContentType: 'application/json',
        };

        // Add ACL if specified
        if (acl) {
          metadataUploadParams.ACL = acl;
        }

        await s3Client.send(new PutObjectCommand(metadataUploadParams));

        // Construct public URL for metadata
        let metadataUrl: string;
        if (endpoint) {
          metadataUrl = `https://${bucket}.${region}.${endpoint}/${metadataPath}`;
        } else {
          metadataUrl = `https://${bucket}.s3.${region}.amazonaws.com/${metadataPath}`;
        }

        console.log(`✅ Metadata uploaded successfully!`);
        console.log(`🔗 Metadata URL: ${metadataUrl}`);
      }

      console.log('');
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to upload to S3\n` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Converts a string to a URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start
      .replace(/-+$/, ''); // Trim - from end
  }

  /**
   * Extracts a frame from video at specific timecode using ffmpeg
   */
  private async extractThumbnail(
    videoPath: string,
    timecode: number,
    outputPath: string,
  ): Promise<void> {
    // Ensure the output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timeInSeconds = timecode / 1000;
    const command = `ffmpeg -y -ss ${timeInSeconds} -i "${videoPath}" -frames:v 1 -q:v 2 "${outputPath}"`;

    await execAsync(command);
  }
}
