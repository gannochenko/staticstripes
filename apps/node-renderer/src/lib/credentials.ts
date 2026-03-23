import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

/**
 * Generic credentials interface for API services
 */
export interface Credentials {
  [key: string]: any;
}

/**
 * OpenAI-specific credentials format
 */
export interface OpenAICredentials extends Credentials {
  apiKey: string;
  organization?: string;
}

/**
 * ElevenLabs-specific credentials format
 */
export interface ElevenLabsCredentials extends Credentials {
  apiKey: string;
}

/**
 * S3-specific credentials format
 */
export interface S3Credentials extends Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * YouTube-specific credentials format
 */
export interface YouTubeCredentials extends Credentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Instagram-specific credentials format
 */
export interface InstagramCredentials extends Credentials {
  accessToken: string;
  igUserId: string;
}

/**
 * AI Music API credentials format
 */
export interface MusicAPICredentials extends Credentials {
  apiKey: string;
}

/**
 * Credentials manager that handles loading credentials from local or global locations
 *
 * Search priority:
 * 1. Local: <projectPath>/.auth/<credentialName>.json
 * 2. Global: $HOME/.staticstripes/auth/<credentialName>.json
 */
export class CredentialsManager {
  private projectPath: string;
  private credentialName: string;

  constructor(projectPath: string, credentialName: string) {
    this.projectPath = projectPath;
    this.credentialName = credentialName;
  }

  /**
   * Get the local credentials path
   */
  private getLocalPath(): string {
    const authDir = resolve(this.projectPath, '.auth');
    return resolve(authDir, `${this.credentialName}.json`);
  }

  /**
   * Get the global credentials path
   * Works cross-platform (Windows, macOS, Linux)
   */
  private getGlobalPath(): string {
    const homeDir = homedir();
    const globalAuthDir = resolve(homeDir, '.staticstripes', 'auth');
    return resolve(globalAuthDir, `${this.credentialName}.json`);
  }

  /**
   * Find and return the credentials file path
   * Returns the path and whether it was found locally or globally
   */
  private findCredentialsPath(): { path: string; location: 'local' | 'global' } | null {
    const localPath = this.getLocalPath();
    if (existsSync(localPath)) {
      return { path: localPath, location: 'local' };
    }

    const globalPath = this.getGlobalPath();
    if (existsSync(globalPath)) {
      return { path: globalPath, location: 'global' };
    }

    return null;
  }

  /**
   * Load credentials from local or global location
   *
   * @param requiredFields - Array of required field names to validate
   * @returns The credentials object
   * @throws Error if credentials not found or invalid
   */
  load<T extends Credentials>(requiredFields: string[] = []): T {
    const found = this.findCredentialsPath();

    if (!found) {
      const localPath = this.getLocalPath();
      const globalPath = this.getGlobalPath();

      throw new Error(
        `❌ Error: Credentials not found for "${this.credentialName}"\n\n` +
          `Searched in:\n` +
          `   1. Local:  ${localPath}\n` +
          `   2. Global: ${globalPath}\n\n` +
          `💡 Create a JSON file in one of these locations with your credentials.\n` +
          `   The global location is useful for sharing credentials across projects.\n`,
      );
    }

    const { path: credentialsPath, location } = found;
    console.log(`🔐 Loading credentials from ${location} storage: ${credentialsPath}`);

    try {
      const credentialsJson = readFileSync(credentialsPath, 'utf-8');
      const credentials = JSON.parse(credentialsJson) as T;

      // Validate required fields
      const missingFields = requiredFields.filter(
        (field) => !credentials[field],
      );

      if (missingFields.length > 0) {
        throw new Error(
          `Missing required fields: ${missingFields.join(', ')}`,
        );
      }

      return credentials;
    } catch (error) {
      throw new Error(
        `❌ Error: Failed to parse credentials from ${credentialsPath}\n` +
          `Ensure the file contains valid JSON.\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if credentials exist (locally or globally)
   */
  exists(): boolean {
    return this.findCredentialsPath() !== null;
  }

  /**
   * Get information about where credentials are stored
   */
  getInfo(): {
    localPath: string;
    globalPath: string;
    exists: boolean;
    location?: 'local' | 'global';
  } {
    const found = this.findCredentialsPath();
    return {
      localPath: this.getLocalPath(),
      globalPath: this.getGlobalPath(),
      exists: found !== null,
      location: found?.location,
    };
  }
}
