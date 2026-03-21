export interface BuildAppOptions {
    appSrc: string;
    projectDir: string;
    force?: boolean;
}
/**
 * Checks if an app needs building and builds it if necessary.
 * If the app src points to a 'dst' or 'dist' directory, this function
 * will look for a package.json in the parent directory and run 'npm run build'.
 * @param options.force - If true, rebuilds the app even if output exists
 */
export declare function buildAppIfNeeded(options: BuildAppOptions): Promise<void>;
/**
 * Builds multiple apps concurrently.
 * @param force - If true, rebuilds all apps even if output exists
 */
export declare function buildAppsIfNeeded(appSources: string[], projectDir: string, force?: boolean): Promise<void>;
//# sourceMappingURL=app-builder.d.ts.map