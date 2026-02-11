import { AIGenerationStrategy } from './ai-generation-strategy';
import { MusicAPIGenerationStrategy } from './music-api/music-api-generation-strategy';

/**
 * Factory for creating AI generation strategies based on provider tag
 */
export class AIGenerationStrategyFactory {
  private strategies: Map<string, AIGenerationStrategy> = new Map();

  /**
   * Registers an AI generation strategy
   */
  register(strategy: AIGenerationStrategy): void {
    this.strategies.set(strategy.getTag(), strategy);
  }

  /**
   * Gets a strategy for the given tag
   * @param tag The AI provider tag (e.g., "music-api-ai")
   * @returns The strategy for this tag
   * @throws Error if no strategy is registered for the tag
   */
  getStrategy(tag: string): AIGenerationStrategy {
    const strategy = this.strategies.get(tag);
    if (!strategy) {
      const availableTags = Array.from(this.strategies.keys());
      throw new Error(
        `No AI generation strategy registered for tag "${tag}".\n` +
          (availableTags.length > 0
            ? `Available: ${availableTags.join(', ')}`
            : 'No AI generation strategies registered.'),
      );
    }
    return strategy;
  }

  /**
   * Creates a factory with all available strategies registered
   */
  static createDefault(): AIGenerationStrategyFactory {
    const factory = new AIGenerationStrategyFactory();

    // Register MusicAPI.AI strategy
    factory.register(new MusicAPIGenerationStrategy());

    return factory;
  }
}
