"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialsManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
/**
 * Credentials manager that handles loading credentials from local or global locations
 *
 * Search priority:
 * 1. Local: <projectPath>/.auth/<credentialName>.json
 * 2. Global: $HOME/.staticstripes/auth/<credentialName>.json
 */
class CredentialsManager {
    projectPath;
    credentialName;
    constructor(projectPath, credentialName) {
        this.projectPath = projectPath;
        this.credentialName = credentialName;
    }
    /**
     * Get the local credentials path
     */
    getLocalPath() {
        const authDir = (0, path_1.resolve)(this.projectPath, '.auth');
        return (0, path_1.resolve)(authDir, `${this.credentialName}.json`);
    }
    /**
     * Get the global credentials path
     * Works cross-platform (Windows, macOS, Linux)
     */
    getGlobalPath() {
        const homeDir = (0, os_1.homedir)();
        const globalAuthDir = (0, path_1.resolve)(homeDir, '.staticstripes', 'auth');
        return (0, path_1.resolve)(globalAuthDir, `${this.credentialName}.json`);
    }
    /**
     * Find and return the credentials file path
     * Returns the path and whether it was found locally or globally
     */
    findCredentialsPath() {
        const localPath = this.getLocalPath();
        if ((0, fs_1.existsSync)(localPath)) {
            return { path: localPath, location: 'local' };
        }
        const globalPath = this.getGlobalPath();
        if ((0, fs_1.existsSync)(globalPath)) {
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
    load(requiredFields = []) {
        const found = this.findCredentialsPath();
        if (!found) {
            const localPath = this.getLocalPath();
            const globalPath = this.getGlobalPath();
            throw new Error(`❌ Error: Credentials not found for "${this.credentialName}"\n\n` +
                `Searched in:\n` +
                `   1. Local:  ${localPath}\n` +
                `   2. Global: ${globalPath}\n\n` +
                `💡 Create a JSON file in one of these locations with your credentials.\n` +
                `   The global location is useful for sharing credentials across projects.\n`);
        }
        const { path: credentialsPath, location } = found;
        console.log(`🔐 Loading credentials from ${location} storage: ${credentialsPath}`);
        try {
            const credentialsJson = (0, fs_1.readFileSync)(credentialsPath, 'utf-8');
            const credentials = JSON.parse(credentialsJson);
            // Validate required fields
            const missingFields = requiredFields.filter((field) => !credentials[field]);
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
            return credentials;
        }
        catch (error) {
            throw new Error(`❌ Error: Failed to parse credentials from ${credentialsPath}\n` +
                `Ensure the file contains valid JSON.\n` +
                `Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Check if credentials exist (locally or globally)
     */
    exists() {
        return this.findCredentialsPath() !== null;
    }
    /**
     * Get information about where credentials are stored
     */
    getInfo() {
        const found = this.findCredentialsPath();
        return {
            localPath: this.getLocalPath(),
            globalPath: this.getGlobalPath(),
            exists: found !== null,
            location: found?.location,
        };
    }
}
exports.CredentialsManager = CredentialsManager;
//# sourceMappingURL=credentials.js.map