import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { YouTubeUpload } from '../../type';
import { handleYouTubeUpload } from './upload-handler';

/**
 * YouTube upload strategy implementation
 */
export class YouTubeUploadStrategy implements UploadStrategy {
  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  getTag(): string {
    return 'youtube';
  }

  validate(): void {
    if (!this.clientId || !this.clientSecret) {
      const error = new Error(
        '❌ Error: STATICSTRIPES_GOOGLE_CLIENT_ID and STATICSTRIPES_GOOGLE_CLIENT_SECRET environment variables are not set\n\n' +
          '💡 Run: staticstripes auth --help\n' +
          '   for complete setup instructions',
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
