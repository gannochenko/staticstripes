import { UploadStrategy } from '../upload-strategy';
import { Project } from '../../project';
import { YouTubeUpload } from '../../type';
import { handleYouTubeUpload } from './upload-handler';

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
