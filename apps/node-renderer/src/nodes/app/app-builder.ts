import { existsSync } from 'fs';
import { resolve, dirname, basename, isAbsolute } from 'path';
import { spawn } from 'child_process';

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
export async function buildAppIfNeeded(options: BuildAppOptions): Promise<void> {
  const { appSrc, projectDir, force = false } = options;

  // Resolve the app directory path
  const appDir = isAbsolute(appSrc) ? appSrc : resolve(projectDir, appSrc);
  const dirName = basename(appDir);

  // Check if the app src points to a build output directory
  if (dirName !== 'dst' && dirName !== 'dist') {
    // Not a build output directory, no need to build
    return;
  }

  // Get the parent directory (where package.json should be)
  const appSourceDir = dirname(appDir);
  const packageJsonPath = resolve(appSourceDir, 'package.json');

  // Check if package.json exists
  if (!existsSync(packageJsonPath)) {
    console.log(`ℹ️  No package.json found at ${packageJsonPath}, skipping build`);
    return;
  }

  // Check if the build output directory exists
  if (existsSync(appDir) && !force) {
    console.log(`ℹ️  Build output already exists at ${appDir}, skipping build`);
    return;
  }

  if (force && existsSync(appDir)) {
    console.log(`\n🔨 Force rebuilding app at ${appSourceDir}...`);
  } else {
    console.log(`\n🔨 Building app at ${appSourceDir}...`);
  }

  // Run npm install first
  console.log('📦 Installing dependencies...');
  await new Promise<void>((resolve, reject) => {
    const npmInstall = spawn('npm', ['install'], {
      cwd: appSourceDir,
      stdio: 'inherit',
      shell: true,
    });

    npmInstall.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm install failed with exit code ${code}`));
      }
    });

    npmInstall.on('error', (err) => {
      reject(new Error(`Failed to run npm install: ${err.message}`));
    });
  });

  // Run npm run build
  console.log('🔧 Building app...');
  await new Promise<void>((resolve, reject) => {
    const npmProcess = spawn('npm', ['run', 'build'], {
      cwd: appSourceDir,
      stdio: 'inherit', // Inherit stdio to show build output
      shell: true,
    });

    npmProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ App built successfully at ${appDir}\n`);
        resolve();
      } else {
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
export async function buildAppsIfNeeded(
  appSources: string[],
  projectDir: string,
  force: boolean = false,
): Promise<void> {
  // Build apps in parallel
  const buildPromises = appSources.map((appSrc) =>
    buildAppIfNeeded({ appSrc, projectDir, force }),
  );

  await Promise.all(buildPromises);
}
