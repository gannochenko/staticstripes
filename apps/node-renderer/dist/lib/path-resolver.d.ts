import type { BasePath } from './type';
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
export declare function resolveAssetPath(assetPath: string, basePaths: BasePath[]): string;
//# sourceMappingURL=path-resolver.d.ts.map