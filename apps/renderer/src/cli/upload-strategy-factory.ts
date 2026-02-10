import { UploadStrategy } from './upload-strategy';
import { YouTubeUploadStrategy } from './youtube/youtube-upload-strategy';
import { S3UploadStrategy } from './s3/s3-upload-strategy';
import { InstagramUploadStrategy } from './instagram/instagram-upload-strategy';

/**
 * Factory for creating upload strategies based on upload tag
 */
export class UploadStrategyFactory {
  private strategies: Map<string, UploadStrategy> = new Map();

  /**
   * Registers an upload strategy
   */
  register(strategy: UploadStrategy): void {
    this.strategies.set(strategy.getTag(), strategy);
  }

  /**
   * Gets a strategy for the given tag
   * @param tag The upload provider tag (e.g., "youtube", "s3", "instagram")
   * @returns The strategy for this tag
   * @throws Error if no strategy is registered for the tag
   */
  getStrategy(tag: string): UploadStrategy {
    const strategy = this.strategies.get(tag);
    if (!strategy) {
      const availableTags = Array.from(this.strategies.keys());
      throw new Error(
        `No upload strategy registered for tag "${tag}".\n` +
          (availableTags.length > 0
            ? `Available: ${availableTags.join(', ')}`
            : 'No upload strategies registered.'),
      );
    }
    return strategy;
  }

  /**
   * Creates a factory with all available strategies registered
   */
  static createDefault(): UploadStrategyFactory {
    const factory = new UploadStrategyFactory();

    factory.register(new YouTubeUploadStrategy());

    // Register S3 strategy
    factory.register(new S3UploadStrategy());

    // Register Instagram strategy
    factory.register(new InstagramUploadStrategy());

    return factory;
  }
}
