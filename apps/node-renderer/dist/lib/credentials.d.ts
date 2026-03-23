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
export declare class CredentialsManager {
    private projectPath;
    private credentialName;
    constructor(projectPath: string, credentialName: string);
    /**
     * Get the local credentials path
     */
    private getLocalPath;
    /**
     * Get the global credentials path
     * Works cross-platform (Windows, macOS, Linux)
     */
    private getGlobalPath;
    /**
     * Find and return the credentials file path
     * Returns the path and whether it was found locally or globally
     */
    private findCredentialsPath;
    /**
     * Load credentials from local or global location
     *
     * @param requiredFields - Array of required field names to validate
     * @returns The credentials object
     * @throws Error if credentials not found or invalid
     */
    load<T extends Credentials>(requiredFields?: string[]): T;
    /**
     * Check if credentials exist (locally or globally)
     */
    exists(): boolean;
    /**
     * Get information about where credentials are stored
     */
    getInfo(): {
        localPath: string;
        globalPath: string;
        exists: boolean;
        location?: 'local' | 'global';
    };
}
//# sourceMappingURL=credentials.d.ts.map