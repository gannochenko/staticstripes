import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { Upload } from '../../type';
import ejs from 'ejs';
import { makeRequest } from '../../lib/net';
import { CredentialsManager, InstagramCredentials } from '../credentials';

/**
 * Instagram upload strategy implementation
 * Uses Instagram Graph API to post Reels/Videos
 */
export class InstagramUploadStrategy implements UploadStrategy {
  private readonly API_VERSION = 'v21.0';
  private readonly GRAPH_API_BASE = 'https://graph.instagram.com';

  constructor(private credentialsManager?: CredentialsManager) {}

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

    const { caption, shareToFeed, thumbOffset, coverUrl, videoUrl, locationId } =
      upload.instagram;

    // Load credentials from local .auth/<upload-name>.json or global ~/.staticstripes/auth/<upload-name>.json
    const manager =
      this.credentialsManager ||
      new CredentialsManager(projectPath, upload.name);

    let credentials: InstagramCredentials;
    try {
      credentials = manager.load<InstagramCredentials>([
        'accessToken',
        'igUserId',
      ]);
    } catch (error) {
      // Add helpful context about Instagram credentials
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `${errorMessage}\n\n` +
          `💡 Instagram credentials file should contain:\n` +
          `{\n` +
          `  "accessToken": "YOUR_LONG_LIVED_ACCESS_TOKEN",\n` +
          `  "igUserId": "YOUR_INSTAGRAM_USER_ID"\n` +
          `}\n\n` +
          `📖 Run authentication wizard:\n` +
          `   staticstripes auth --upload-name ${upload.name}\n\n` +
          `Or view detailed setup instructions:\n` +
          `   staticstripes auth-help instagram\n`,
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

    // Determine title (use upload-specific title or fall back to project title)
    const title = upload.title || project.getTitle();

    // Get date from project
    const date = project.getDate();

    // Format tags with # and space-separated (Instagram style)
    const formattedTags = upload.tags.map((tag) => `#${tag}`).join(' ');

    // Convert ${variable} syntax to <%= variable %> for EJS compatibility
    const ejsCaption = caption.replace(/\$\{(\w+)\}/g, '<%= $1 %>');

    const processedCaption = ejs.render(ejsCaption, {
      title,
      date,
      tags: formattedTags,
    });

    console.log(`\n📸 Preparing Instagram Reel upload...`);
    console.log(`   Title: ${title}`);
    console.log(`   Tags: ${formattedTags}`);
    console.log(`   Caption: ${processedCaption.substring(0, 50)}${processedCaption.length > 50 ? '...' : ''}`);
    console.log(`   Share to Feed: ${shareToFeed ? 'Yes' : 'No'}`);
    if (thumbOffset) {
      console.log(`   Thumbnail offset: ${thumbOffset}ms`);
    }
    console.log('');

    // Resolve location ID if search query is provided
    let resolvedLocationId = locationId;
    if (locationId && locationId.startsWith('search:')) {
      const searchQuery = locationId.substring(7); // Remove "search:" prefix
      console.log(`📍 Searching for location: ${searchQuery}...`);
      resolvedLocationId = await this.searchLocation(credentials, searchQuery);
      console.log(`✅ Found location ID: ${resolvedLocationId}\n`);
    }

    // Step 1: Create media container
    console.log('📦 Step 1: Creating media container...');
    const containerId = await this.createMediaContainer(
      credentials,
      publicVideoUrl,
      processedCaption,
      shareToFeed,
      thumbOffset,
      coverUrl,
      resolvedLocationId,
    );

    console.log(`✅ Container created: ${containerId}`);

    // Step 2: Wait for container to be ready
    console.log('\n⏳ Step 2: Waiting for Instagram to process video...');
    await this.waitForContainerReady(credentials, containerId);

    // Step 3: Publish the Reel
    console.log('\n📤 Step 3: Publishing Reel...');
    const mediaId = await this.publishMedia(credentials, containerId);

    // Step 4: Get permalink
    console.log('\n🔗 Getting permalink...');
    const permalink = await this.getPermalink(credentials, mediaId);

    console.log(`\n✅ Reel published successfully!`);
    console.log(`🔗 Media ID: ${mediaId}`);
    console.log(`📺 View at: ${permalink}\n`);
  }

  /**
   * Searches for a location by city and country name
   * Returns the location ID from Instagram's location database
   */
  private async searchLocation(
    credentials: InstagramCredentials,
    searchQuery: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      q: searchQuery,
      fields: 'id,name',
      access_token: credentials.accessToken,
    });

    const url = `${this.GRAPH_API_BASE}/${this.API_VERSION}/${credentials.igUserId}/locations?${params.toString()}`;

    try {
      const data = await makeRequest<{
        data?: Array<{ id: string; name: string }>;
      }>({
        url,
        method: 'GET',
      });

      if (!data.data || data.data.length === 0) {
        throw new Error(
          `No locations found for "${searchQuery}"\n\n` +
            `Tip: Try different variations of the city/country name\n` +
            `Example: "Paris, France" or "New York, USA"`,
        );
      }

      // Return the first (most relevant) result
      const location = data.data[0];
      console.log(`   Found: ${location.name} (ID: ${location.id})`);
      return location.id;
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to search for location "${searchQuery}"\n` +
          `${error instanceof Error ? error.message : String(error)}\n\n` +
          `Note: Location search requires a valid access token and may not be available in all regions.`,
      );
    }
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
    locationId?: string,
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

    if (locationId) {
      params.append('location_id', locationId);
    }

    const url = `${this.GRAPH_API_BASE}/${this.API_VERSION}/${credentials.igUserId}/media`;

    try {
      const data = await makeRequest<{ id?: string }>({
        url,
        method: 'POST',
        body: params,
      });

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
   * Waits for the container to be ready for publishing
   * Polls the status endpoint until status_code is FINISHED
   */
  private async waitForContainerReady(
    credentials: InstagramCredentials,
    containerId: string,
  ): Promise<void> {
    const maxAttempts = 60; // Maximum 60 attempts (5 minutes)
    const delayMs = 5000; // 5 seconds between checks

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const params = new URLSearchParams({
        fields: 'status_code',
        access_token: credentials.accessToken,
      });

      const url = `${this.GRAPH_API_BASE}/${this.API_VERSION}/${containerId}?${params.toString()}`;

      try {
        const data = await makeRequest<{ status_code?: string }>({
          url,
          method: 'GET',
        });

        if (data.status_code === 'FINISHED') {
          console.log(`✅ Video processed and ready!`);
          return;
        } else if (data.status_code === 'ERROR') {
          throw new Error('Instagram failed to process the video');
        } else if (data.status_code === 'IN_PROGRESS') {
          console.log(`   Processing... (${attempt}/${maxAttempts})`);
        } else {
          console.log(
            `   Status: ${data.status_code || 'UNKNOWN'} (${attempt}/${maxAttempts})`,
          );
        }
      } catch (error) {
        console.log(`   Warning: Status check failed, continuing...`);
      }

      // Wait before next check
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // If we get here, we timed out, but let's try to publish anyway
    console.log(
      `⚠️  Timeout waiting for status. Attempting to publish anyway...`,
    );
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
      const data = await makeRequest<{ id?: string }>({
        url,
        method: 'POST',
        body: params,
      });

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

    const { endpoint, region, bucket, paths } = s3Upload.s3;
    const output = project.getOutput(s3Upload.outputName);
    if (!output) {
      throw new Error(`Output "${s3Upload.outputName}" not found`);
    }

    // Get the file path
    const filePath = paths.get('file');
    if (!filePath) {
      throw new Error('S3 upload missing "file" path');
    }

    // Interpolate path variables
    const slug = this.slugify(project.getTitle());
    const outputName = output.name;
    const date = project.getDate() || '';
    const interpolatedPath = filePath
      .replace(/\$\{slug\}/g, slug)
      .replace(/\$\{output\}/g, outputName)
      .replace(/\$\{date\}/g, date);

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
   * Gets the permalink (URL) for the published media
   */
  private async getPermalink(
    credentials: InstagramCredentials,
    mediaId: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      fields: 'permalink',
      access_token: credentials.accessToken,
    });

    const url = `${this.GRAPH_API_BASE}/${this.API_VERSION}/${mediaId}?${params.toString()}`;

    try {
      const data = await makeRequest<{ permalink?: string }>({
        url,
        method: 'GET',
      });

      if (!data.permalink) {
        return `https://www.instagram.com/ (check your profile)`;
      }

      return data.permalink;
    } catch (error) {
      console.log(`   Warning: Failed to get permalink: ${error}`);
      return `https://www.instagram.com/ (check your profile)`;
    }
  }
}
