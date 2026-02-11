/**
 * Configuration for AI asset generation
 */
export interface AIAssetConfig {
  assetName: string; // Name of the asset
  assetPath: string; // Where to save the generated file
  integrationName: string; // Name of AI integration (references provider in <ai> section)
  prompt: string; // Generation prompt
  model?: string; // Optional model name (from provider configuration)
  duration?: number; // Optional duration in seconds (from asset configuration)
}

/**
 * Interface for AI generation strategies
 * Each AI provider (AIMusicAPI.ai, etc.) implements this interface
 */
export interface AIGenerationStrategy {
  /**
   * Returns the tag name this strategy handles (e.g., "ai-music-api-ai")
   */
  getTag(): string;

  /**
   * Validates that required credentials and configuration are present
   * @throws Error if validation fails
   */
  validate(): void;

  /**
   * Generates an AI asset
   * @param config The AI asset configuration
   * @param projectPath The absolute path to the project directory
   */
  generate(config: AIAssetConfig, projectPath: string): Promise<void>;
}
