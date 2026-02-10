import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { YouTubeUpload } from '../../type';
import { resolve } from 'path';
import { YouTubeUploader } from '../../youtube-uploader';
import ejs from 'ejs';
import { readFileSync, existsSync } from 'fs';

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
  getTag(): string {
    return 'youtube';
  }

  validate(): void {
    // Validation now happens in execute() when we read credentials
  }

  async execute(
    project: Project,
    upload: YouTubeUpload,
    projectPath: string,
  ): Promise<void> {
    // Read credentials from .auth file
    const authDir = resolve(projectPath, '.auth');
    const credentialsPath = resolve(authDir, `${upload.name}.json`);

    if (!existsSync(credentialsPath)) {
      throw new Error(
        `❌ Error: YouTube credentials not found\n\n` +
          `Expected location: ${credentialsPath}\n\n` +
          `💡 Run authentication wizard:\n` +
          `   staticstripes auth --upload-name ${upload.name}\n\n` +
          `📖 Or view setup instructions:\n` +
          `   staticstripes auth-help youtube\n`,
      );
    }

    let credentials: { clientId?: string; clientSecret?: string };
    try {
      const credentialsJson = readFileSync(credentialsPath, 'utf-8');
      credentials = JSON.parse(credentialsJson);

      if (!credentials.clientId || !credentials.clientSecret) {
        throw new Error('Missing clientId or clientSecret');
      }
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to parse YouTube credentials from ${credentialsPath}\n` +
          `Ensure the file contains clientId and clientSecret.\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Delegate to existing handler
    await handleYouTubeUpload(project, {
      uploadName: upload.name,
      projectPath,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
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
