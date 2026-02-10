import { AuthStrategy } from './auth-strategy';
import { YouTubeAuthStrategy } from './youtube/youtube-auth-strategy';
import { InstagramAuthStrategy } from './instagram/instagram-auth-strategy';

/**
 * Factory for creating authentication strategies based on upload tag
 */
export class AuthStrategyFactory {
  private strategies: Map<string, AuthStrategy> = new Map();

  /**
   * Registers an authentication strategy
   */
  register(strategy: AuthStrategy): void {
    this.strategies.set(strategy.getTag(), strategy);
  }

  /**
   * Gets a strategy for the given tag
   * @param tag The upload provider tag (e.g., "youtube", "instagram")
   * @returns The strategy for this tag
   * @throws Error if no strategy is registered for the tag
   */
  getStrategy(tag: string): AuthStrategy {
    const strategy = this.strategies.get(tag);
    if (!strategy) {
      const availableTags = Array.from(this.strategies.keys());
      throw new Error(
        `No authentication strategy registered for tag "${tag}".\n` +
          (availableTags.length > 0
            ? `Available: ${availableTags.join(', ')}`
            : 'No authentication strategies registered.'),
      );
    }
    return strategy;
  }

  /**
   * Gets setup instructions for a specific tag
   */
  getSetupInstructions(tag: string): string | undefined {
    const strategy = this.strategies.get(tag);
    if (strategy && strategy.getSetupInstructions) {
      return strategy.getSetupInstructions();
    }
    return undefined;
  }

  /**
   * Lists all available authentication providers
   */
  listProviders(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Creates a factory with all available strategies registered
   */
  static createDefault(): AuthStrategyFactory {
    const factory = new AuthStrategyFactory();

    factory.register(new YouTubeAuthStrategy());
    factory.register(new InstagramAuthStrategy());

    return factory;
  }
}
