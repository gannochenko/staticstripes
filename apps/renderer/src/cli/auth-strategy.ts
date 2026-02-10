/**
 * Interface for authentication strategies
 * Each upload provider (YouTube, Instagram, etc.) implements this interface
 */
export interface AuthStrategy {
  /**
   * Returns the tag name this strategy handles (e.g., "youtube", "instagram")
   */
  getTag(): string;

  /**
   * Executes the authentication flow
   * @param uploadName The name of the upload configuration to authenticate
   * @param projectPath The absolute path to the project directory
   */
  execute(uploadName: string, projectPath: string): Promise<void>;

  /**
   * Optional: Returns help/setup instructions for this provider
   */
  getSetupInstructions?(): string;
}
