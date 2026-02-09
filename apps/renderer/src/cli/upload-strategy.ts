import { Project } from '../project';
import { YouTubeUpload } from '../type';

/**
 * Interface for upload strategies
 * Each upload provider (YouTube, S3, etc.) implements this interface
 */
export interface UploadStrategy {
  /**
   * Returns the tag name this strategy handles (e.g., "youtube", "s3")
   */
  getTag(): string;

  /**
   * Validates that required environment variables and configuration are present
   * @throws Error if validation fails
   */
  validate(): void;

  /**
   * Executes the upload
   * @param project The parsed project
   * @param upload The upload configuration
   * @param projectPath The absolute path to the project directory
   */
  execute(
    project: Project,
    upload: YouTubeUpload,
    projectPath: string,
  ): Promise<void>;
}
