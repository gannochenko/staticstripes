import { resolve } from 'path';
import { YouTubeUploader } from '../../youtube-uploader';
import { Project } from '../../project';

export interface YouTubeUploadOptions {
  uploadName: string;
  projectPath: string;
  clientId: string;
  clientSecret: string;
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

  // Upload video
  const videoId = await uploader.uploadVideo(output.path, upload, title);

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
