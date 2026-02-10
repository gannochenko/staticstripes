import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { YouTubeUpload } from '../../type';
import { resolve } from 'path';
import { YouTubeUploader } from '../../youtube-uploader';
import ejs from 'ejs';

export interface YouTubeUploadOptions {
  uploadName: string;
  projectPath: string;
  clientId: string;
  clientSecret: string;
}

/**
 * YouTube upload strategy implementation
 */
export class YouTubeUploadStrategy implements UploadStrategy {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET || '';
  }

  getTag(): string {
    return 'youtube';
  }

  validate(): void {
    if (!this.clientId || !this.clientSecret) {
      const error = new Error(
        '❌ Error: STATICSTRIPES_GOOGLE_CLIENT_ID and STATICSTRIPES_GOOGLE_CLIENT_SECRET environment variables are not set\n\n' +
          '📖 View setup instructions:\n' +
          '   staticstripes auth-help youtube\n\n' +
          '💡 After setting env vars, run authentication:\n' +
          '   staticstripes auth --upload-name YOUR_UPLOAD_NAME\n',
      );
      throw error;
    }
  }

  async execute(
    project: Project,
    upload: YouTubeUpload,
    projectPath: string,
  ): Promise<void> {
    // Delegate to existing handler
    await handleYouTubeUpload(project, {
      uploadName: upload.name,
      projectPath,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
  }
}

/**
 * Handles YouTube video upload process
 */
export async function handleYouTubeUpload(
  project: Project,
  options: YouTubeUploadOptions,
): Promise<void> {
  // Get upload configuration
  const upload = project.getYouTubeUpload(options.uploadName);
  if (!upload) {
    const availableUploads = Array.from(project.getYouTubeUploads().keys());
    throw new Error(
      `Upload "${options.uploadName}" not found in project.html\n` +
        (availableUploads.length > 0
          ? `Available uploads: ${availableUploads.join(', ')}`
          : 'No uploads defined in project.html'),
    );
  }

  // Get the output file
  const output = project.getOutput(upload.outputName);
  if (!output) {
    throw new Error(`Output "${upload.outputName}" not found`);
  }

  console.log(`📹 Video file: ${output.path}`);
  console.log(`🎬 Upload config: ${options.uploadName}\n`);

  // Create uploader and load tokens
  const uploader = new YouTubeUploader(options.clientId, options.clientSecret);
  const hasTokens = uploader.loadTokens(
    options.uploadName,
    options.projectPath,
  );

  if (!hasTokens) {
    throw new Error(
      `Not authenticated. Please run: staticstripes auth --upload-name ${options.uploadName}`,
    );
  }

  // Determine title (use upload-specific title or fall back to project title)
  const title = upload.title || project.getTitle();
  console.log(`📝 Title: ${title}\n`);

  // Build the project to populate fragment times (needed for timecodes)
  console.log('🔨 Building project to calculate timecodes...');
  await project.build(upload.outputName);

  // Get timecodes and process description with EJS
  const timecodes = project.getTimecodes();

  // Format tags (space-separated, no hashtags for YouTube)
  const formattedTags = upload.tags.join(' ');

  // Convert ${variable} syntax to <%= variable %> for EJS compatibility
  const ejsDescription = upload.description.replace(
    /\$\{(\w+)\}/g,
    '<%= $1 %>',
  );

  const processedDescription = ejs.render(ejsDescription, {
    title,
    tags: formattedTags,
    timecodes: timecodes.join('\n'),
  });

  // Create a processed upload object with rendered description
  const processedUpload = {
    ...upload,
    description: processedDescription,
  };

  // Upload video
  const videoId = await uploader.uploadVideo(
    output.path,
    processedUpload,
    title,
  );

  // Handle thumbnail if specified
  if (upload.thumbnailTimecode !== undefined) {
    console.log(
      `\n🖼️  Extracting thumbnail at ${upload.thumbnailTimecode}ms...`,
    );
    const thumbnailPath = resolve(
      options.projectPath,
      '.cache',
      'thumbnail.png',
    );
    await uploader.extractThumbnail(
      output.path,
      upload.thumbnailTimecode,
      thumbnailPath,
    );
    await uploader.uploadThumbnail(videoId, thumbnailPath);
  }

  // TODO: Update project.html with video ID
  console.log('\n✅ Upload complete!');
}
