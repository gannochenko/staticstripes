import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { Upload } from '../../type';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * S3 credentials format stored in .auth/<upload-name>.json
 */
interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * S3 upload strategy implementation
 * Supports generic S3-compatible storage (AWS S3, DigitalOcean Spaces, etc.)
 */
export class S3UploadStrategy implements UploadStrategy {
  constructor() {}

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

    const { endpoint, region, bucket, path, acl } = upload.s3;

    // Validate ACL value if specified
    const allowedAcls = ['private', 'public-read', 'authenticated-read'];
    if (acl && !allowedAcls.includes(acl)) {
      throw new Error(
        `❌ Error: Invalid ACL value "${acl}" for upload "${upload.name}"\n\n` +
          `Allowed values: ${allowedAcls.join(', ')}\n` +
          `Note: "public-read-write" is not supported for security reasons.`,
      );
    }

    // Load credentials from .auth/<upload-name>.json
    const authDir = resolve(projectPath, '.auth');
    const credentialsPath = resolve(authDir, `${upload.name}.json`);

    if (!existsSync(credentialsPath)) {
      throw new Error(
        `❌ Error: S3 credentials not found\n\n` +
          `Expected location: ${credentialsPath}\n\n` +
          `💡 Create a JSON file with your S3 credentials:\n` +
          `{\n` +
          `  "accessKeyId": "YOUR_ACCESS_KEY",\n` +
          `  "secretAccessKey": "YOUR_SECRET_KEY"\n` +
          `}\n\n` +
          `📖 Get credentials from:\n` +
          `   • AWS: IAM → Users → Security Credentials\n` +
          `   • DigitalOcean: API → Spaces Keys\n`,
      );
    }

    console.log(`🔐 Loading credentials from: ${credentialsPath}`);

    let credentials: S3Credentials;
    try {
      const credentialsJson = readFileSync(credentialsPath, 'utf-8');
      credentials = JSON.parse(credentialsJson);

      if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        throw new Error('Missing accessKeyId or secretAccessKey');
      }
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to parse S3 credentials from ${credentialsPath}\n` +
          `Ensure the file contains valid JSON with accessKeyId and secretAccessKey.\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
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

    // Interpolate path variables
    const slug = this.slugify(project.getTitle());
    const outputName = output.name;
    const interpolatedPath = path
      .replace(/\$\{slug\}/g, slug)
      .replace(/\$\{output\}/g, outputName);

    console.log(`\n📦 Preparing S3 upload...`);
    console.log(`   Bucket: ${bucket}`);
    console.log(`   Region: ${region}`);
    if (endpoint) {
      console.log(`   Endpoint: ${endpoint}`);
    }
    console.log(`   Path: ${interpolatedPath}`);
    console.log(`   File: ${output.path}\n`);

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

    // Read file
    console.log(`📤 Uploading to S3...`);
    const fileBuffer = readFileSync(output.path);

    // Upload file
    const uploadParams: any = {
      Bucket: bucket,
      Key: interpolatedPath,
      Body: fileBuffer,
      ContentType: 'video/mp4',
    };

    // Add ACL if specified in configuration
    if (acl) {
      uploadParams.ACL = acl;
    }

    const command = new PutObjectCommand(uploadParams);

    try {
      await s3Client.send(command);

      // Construct public URL
      let publicUrl: string;
      if (endpoint) {
        // For DigitalOcean Spaces and similar services
        // Format: https://{bucket}.{region}.{endpoint}/{path}
        publicUrl = `https://${bucket}.${region}.${endpoint}/${interpolatedPath}`;
      } else {
        // For AWS S3
        publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${interpolatedPath}`;
      }

      console.log(`\n✅ Upload successful!`);
      console.log(`🔗 Public URL: ${publicUrl}\n`);
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
}
