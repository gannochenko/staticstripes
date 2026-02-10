import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { Upload } from '../../type';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Instagram credentials format stored in .auth/<upload-name>.json
 */
interface InstagramCredentials {
  accessToken: string; // Long-lived Instagram Graph API access token
  igUserId: string; // Instagram User ID (not the username)
}

/**
 * Instagram upload strategy implementation
 * Uses Facebook Graph API to post Reels/Videos
 */
export class InstagramUploadStrategy implements UploadStrategy {
  private readonly API_VERSION = 'v21.0';
  private readonly GRAPH_API_BASE = 'https://graph.facebook.com';

  constructor() {}

  getTag(): string {
    return 'instagram';
  }

  validate(): void {
    // Validation happens in execute() since we need upload config
  }

  async execute(
    project: Project,
    upload: Upload,
    projectPath: string,
  ): Promise<void> {
    // Validate Instagram configuration exists
    if (!upload.instagram) {
      throw new Error(
        `❌ Error: Instagram configuration missing for upload "${upload.name}"`,
      );
    }

    const { caption, shareToFeed, thumbOffset, coverUrl, videoUrl } =
      upload.instagram;

    // Load credentials from .auth/<upload-name>.json
    const authDir = resolve(projectPath, '.auth');
    const credentialsPath = resolve(authDir, `${upload.name}.json`);

    if (!existsSync(credentialsPath)) {
      throw new Error(
        `❌ Error: Instagram credentials not found\n\n` +
          `Expected location: ${credentialsPath}\n\n` +
          `💡 Run authentication wizard:\n` +
          `   staticstripes auth --upload-name ${upload.name}\n\n` +
          `📖 Or view detailed setup instructions:\n` +
          `   staticstripes auth-help instagram\n`,
      );
    }

    console.log(`🔐 Loading credentials from: ${credentialsPath}`);

    let credentials: InstagramCredentials;
    try {
      const credentialsJson = readFileSync(credentialsPath, 'utf-8');
      credentials = JSON.parse(credentialsJson);

      if (!credentials.accessToken || !credentials.igUserId) {
        throw new Error('Missing accessToken or igUserId');
      }
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to parse Instagram credentials from ${credentialsPath}\n` +
          `Ensure the file contains valid JSON with accessToken and igUserId.\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Determine video URL
    let publicVideoUrl: string;

    if (videoUrl) {
      // Use explicitly provided URL
      publicVideoUrl = videoUrl;
      console.log(`\n📹 Using provided video URL: ${publicVideoUrl}`);
    } else {
      // Try to infer from S3 upload if available
      const s3Upload = this.findS3Upload(project, upload);
      if (s3Upload && s3Upload.s3) {
        publicVideoUrl = this.constructS3Url(project, s3Upload);
        console.log(
          `\n📹 Using S3 URL from upload "${s3Upload.name}": ${publicVideoUrl}`,
        );
      } else {
        throw new Error(
          `❌ Error: No video URL specified for Instagram upload "${upload.name}"\n\n` +
            `Either:\n` +
            `1. Add <video-url value="https://..." /> to your Instagram config, or\n` +
            `2. Configure an S3 upload with the same output name to auto-generate the URL`,
        );
      }
    }

    console.log(`\n📸 Preparing Instagram Reel upload...`);
    console.log(`   Caption: ${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}`);
    console.log(`   Share to Feed: ${shareToFeed ? 'Yes' : 'No'}`);
    if (thumbOffset) {
      console.log(`   Thumbnail offset: ${thumbOffset}ms`);
    }
    console.log('');

    // Step 1: Create media container
    console.log('📦 Step 1: Creating media container...');
    const containerId = await this.createMediaContainer(
      credentials,
      publicVideoUrl,
      caption,
      shareToFeed,
      thumbOffset,
      coverUrl,
    );

    console.log(`✅ Container created: ${containerId}`);

    // Step 2: Publish the Reel
    console.log('\n📤 Step 2: Publishing Reel...');
    const mediaId = await this.publishMedia(credentials, containerId);

    console.log(`\n✅ Reel published successfully!`);
    console.log(
      `🔗 Media ID: ${mediaId}\n` +
        `   View at: https://www.instagram.com/p/${this.getShortcode(mediaId)}/\n`,
    );
  }

  /**
   * Creates a media container for the Reel
   */
  private async createMediaContainer(
    credentials: InstagramCredentials,
    videoUrl: string,
    caption: string,
    shareToFeed: boolean,
    thumbOffset?: number,
    coverUrl?: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption,
      access_token: credentials.accessToken,
    });

    if (shareToFeed) {
      params.append('share_to_feed', 'true');
    }

    if (thumbOffset !== undefined) {
      params.append('thumb_offset', thumbOffset.toString());
    }

    if (coverUrl) {
      params.append('cover_url', coverUrl);
    }

    const url = `${this.GRAPH_API_BASE}/${this.API_VERSION}/${credentials.igUserId}/media`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: params,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Graph API error: ${JSON.stringify(errorData, null, 2)}`,
        );
      }

      const data = (await response.json()) as { id?: string };

      if (!data.id) {
        throw new Error('No container ID returned from API');
      }

      return data.id;
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to create media container\n` +
          `${error instanceof Error ? error.message : String(error)}\n\n` +
          `Common issues:\n` +
          `- Video URL must be publicly accessible\n` +
          `- Access token may be expired (refresh it)\n` +
          `- Video must be MP4 format and meet Instagram requirements\n` +
          `- Instagram User ID must be correct`,
      );
    }
  }

  /**
   * Publishes the media container
   */
  private async publishMedia(
    credentials: InstagramCredentials,
    containerId: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: credentials.accessToken,
    });

    const url = `${this.GRAPH_API_BASE}/${this.API_VERSION}/${credentials.igUserId}/media_publish`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: params,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Graph API error: ${JSON.stringify(errorData, null, 2)}`,
        );
      }

      const data = (await response.json()) as { id?: string };

      if (!data.id) {
        throw new Error('No media ID returned from API');
      }

      return data.id;
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to publish media\n` +
          `${error instanceof Error ? error.message : String(error)}\n\n` +
          `The container may still be processing. Wait a few seconds and try again.`,
      );
    }
  }

  /**
   * Finds a corresponding S3 upload for the same output
   */
  private findS3Upload(project: Project, upload: Upload): Upload | undefined {
    const uploads = project.getUploads();
    for (const [name, u] of uploads.entries()) {
      if (
        u.tag === 's3' &&
        u.outputName === upload.outputName &&
        name !== upload.name
      ) {
        return u;
      }
    }
    return undefined;
  }

  /**
   * Constructs the public S3 URL for a video
   */
  private constructS3Url(project: Project, s3Upload: Upload): string {
    if (!s3Upload.s3) {
      throw new Error('S3 configuration missing');
    }

    const { endpoint, region, bucket, path } = s3Upload.s3;
    const output = project.getOutput(s3Upload.outputName);
    if (!output) {
      throw new Error(`Output "${s3Upload.outputName}" not found`);
    }

    // Interpolate path variables
    const slug = this.slugify(project.getTitle());
    const outputName = output.name;
    const interpolatedPath = path
      .replace(/\$\{slug\}/g, slug)
      .replace(/\$\{output\}/g, outputName);

    // Construct URL
    if (endpoint) {
      return `https://${bucket}.${region}.${endpoint}/${interpolatedPath}`;
    } else {
      return `https://${bucket}.s3.${region}.amazonaws.com/${interpolatedPath}`;
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
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  /**
   * Extracts Instagram shortcode from media ID (approximation)
   */
  private getShortcode(mediaId: string): string {
    // Note: This is a simplified version. The actual conversion is more complex.
    // For production, you might want to fetch the permalink from the Graph API
    return mediaId;
  }
}
