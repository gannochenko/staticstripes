"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAppIfNeeded = buildAppIfNeeded;
exports.buildAppsIfNeeded = buildAppsIfNeeded;
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const path_resolver_1 = require("../../lib/path-resolver");
/**
 * Checks if an app needs building and builds it if necessary.
 * If the app src points to a 'dst' or 'dist' directory, this function
 * will look for a package.json in the parent directory and run 'npm run build'.
 * @param options.force - If true, rebuilds the app even if output exists
 */
async function buildAppIfNeeded(options) {
    const { appSrc, projectDir, basePaths = [], force = false } = options;
    // Resolve the app directory path (with base path support)
    const resolvedSrc = (0, path_resolver_1.resolveAssetPath)(appSrc, basePaths);
    const appDir = (0, path_1.isAbsolute)(resolvedSrc) ? resolvedSrc : (0, path_1.resolve)(projectDir, resolvedSrc);
    const dirName = (0, path_1.basename)(appDir);
    // Check if the app src points to a build output directory
    if (dirName !== 'dst' && dirName !== 'dist') {
        // Not a build output directory, no need to build
        return;
    }
    // Get the parent directory (where package.json should be)
    const appSourceDir = (0, path_1.dirname)(appDir);
    const packageJsonPath = (0, path_1.resolve)(appSourceDir, 'package.json');
    // Check if package.json exists
    if (!(0, fs_1.existsSync)(packageJsonPath)) {
        console.log(`ℹ️  No package.json found at ${packageJsonPath}, skipping build`);
        return;
    }
    // Check if the build output directory exists
    if ((0, fs_1.existsSync)(appDir) && !force) {
        console.log(`ℹ️  Build output already exists at ${appDir}, skipping build`);
        return;
    }
    if (force && (0, fs_1.existsSync)(appDir)) {
        console.log(`\n🔨 Force rebuilding app at ${appSourceDir}...`);
    }
    else {
        console.log(`\n🔨 Building app at ${appSourceDir}...`);
    }
    // Run npm install first
    console.log('📦 Installing dependencies...');
    await new Promise((resolve, reject) => {
        const npmInstall = (0, child_process_1.spawn)('npm', ['install'], {
            cwd: appSourceDir,
            stdio: 'inherit',
            shell: true,
        });
        npmInstall.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`npm install failed with exit code ${code}`));
            }
        });
        npmInstall.on('error', (err) => {
            reject(new Error(`Failed to run npm install: ${err.message}`));
        });
    });
    // Run npm run build
    console.log('🔧 Building app...');
    await new Promise((resolve, reject) => {
        const npmProcess = (0, child_process_1.spawn)('npm', ['run', 'build'], {
            cwd: appSourceDir,
            stdio: 'inherit', // Inherit stdio to show build output
            shell: true,
        });
        npmProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ App built successfully at ${appDir}\n`);
                resolve();
            }
            else {
                reject(new Error(`npm run build failed with exit code ${code}`));
            }
        });
        npmProcess.on('error', (err) => {
            reject(new Error(`Failed to run npm run build: ${err.message}`));
        });
    });
}
/**
 * Builds multiple apps concurrently.
 * @param force - If true, rebuilds all apps even if output exists
 */
async function buildAppsIfNeeded(appSources, projectDir, force = false) {
    // Build apps in parallel
    const buildPromises = appSources.map((appSrc) => buildAppIfNeeded({ appSrc, projectDir, force }));
    await Promise.all(buildPromises);
}
//# sourceMappingURL=app-builder.js.map