import { Command } from 'commander';
import { registerYouTubeAuthCommands } from './auth-commands.js';

/**
 * Registers YouTube-specific commands (authentication only)
 * Upload functionality is handled by the generic upload command with strategy pattern
 */
export function registerYouTubeCommands(program: Command): void {
  // Register YouTube auth commands
  registerYouTubeAuthCommands(program);
}
