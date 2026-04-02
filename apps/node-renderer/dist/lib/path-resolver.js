"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAssetPath = resolveAssetPath;
const path_1 = require("path");
/**
 * Resolves asset paths using base paths
 *
 * Supports the following formats:
 * - "basePath:relative/path.mp4" - Resolves using named base path
 * - "/absolute/path.mp4" - Returns as-is
 * - "./relative/path.mp4" - Returns as-is
 *
 * @param assetPath - The asset path to resolve (may contain base path prefix)
 * @param basePaths - Array of base path definitions
 * @returns Resolved absolute or relative path
 *
 * @example
 * const basePaths = [
 *   { name: 'clips', path: '/Users/john/Videos' },
 *   { name: 'global', path: '/Users/john/GlobalAssets' }
 * ];
 *
 * resolveAssetPath('clips:intro.mp4', basePaths)
 * // Returns: '/Users/john/Videos/intro.mp4'
 *
 * resolveAssetPath('global:audio/music.mp3', basePaths)
 * // Returns: '/Users/john/GlobalAssets/audio/music.mp3'
 *
 * resolveAssetPath('./local/file.mp4', basePaths)
 * // Returns: './local/file.mp4'
 */
function resolveAssetPath(assetPath, basePaths) {
    // Check if path contains a base path prefix (format: "name:path")
    const colonIndex = assetPath.indexOf(':');
    if (colonIndex === -1) {
        // No base path prefix, return as-is
        return assetPath;
    }
    // Extract base path name and relative path
    const basePathName = assetPath.substring(0, colonIndex);
    const relativePath = assetPath.substring(colonIndex + 1);
    // Find the matching base path
    const basePath = basePaths.find((bp) => bp.name === basePathName);
    if (!basePath) {
        // Base path not found, return original path
        console.warn(`Warning: Base path "${basePathName}" not found. Available base paths: ${basePaths.map((bp) => bp.name).join(', ')}`);
        return assetPath;
    }
    // Join base path with relative path
    return (0, path_1.join)(basePath.path, relativePath);
}
//# sourceMappingURL=path-resolver.js.map