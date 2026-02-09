import { UploadStrategy } from './upload-strategy';
import { YouTubeUploadStrategy } from './youtube/youtube-upload-strategy';

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
   * @param tag The upload provider tag (e.g., "youtube", "s3")
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

    // Register YouTube strategy (validation happens during execute)
    const youtubeClientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID || '';
    const youtubeClientSecret =
      process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET || '';

    factory.register(
      new YouTubeUploadStrategy(youtubeClientId, youtubeClientSecret),
    );

    // Future: Register S3 strategy, Azure strategy, etc.
    // factory.register(new S3UploadStrategy(s3Config));

    return factory;
  }
}
