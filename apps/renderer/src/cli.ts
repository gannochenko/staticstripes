#!/usr/bin/env node

import { Command } from 'commander';
import { resolve, dirname, relative } from 'path';
import {
  existsSync,
  mkdirSync,
  cpSync,
  realpathSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'fs';
import { join } from 'path';
import { HTMLParser } from './html-parser.js';
import { HTMLProjectParser } from './html-project-parser.js';
import {
  makeFFmpegCommand,
  runFFMpeg,
  checkFFmpegInstalled,
} from './ffmpeg.js';
import { getAssetDuration } from './ffprobe.js';
import { cleanupStaleCache } from './container-renderer.js';
import { YouTubeUploader } from './youtube-uploader.js';
import open from 'open';

// Read version from package.json
// In built code, this file is at dist/cli.js, package.json is at ../package.json
const packageJsonPath = resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const program = new Command();

// Global debug flag
let isDebugMode = false;

/**
 * Pretty prints an error to the user
 */
function handleError(error: any, operation: string) {
  console.error(`\n❌ ${operation} failed\n`);

  if (error.message) {
    console.error(`Error: ${error.message}\n`);
  }

  if (isDebugMode) {
    console.error('=== Debug Information ===\n');
    console.error('Full error object:', error);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('\n========================\n');
  } else {
    console.error(
      '💡 Tip: Run with --debug flag for detailed error information\n',
    );
  }
}

program
  .name('staticstripes')
  .description('CLI tool for rendering video projects')
  .version(version)
  .option('-d, --debug', 'Enable debug mode with detailed error messages')
  .hook('preAction', (thisCommand) => {
    // Check if --debug flag is set on any command
    const opts = thisCommand.opts();
    if (opts.debug) {
      isDebugMode = true;
      console.log('🐛 Debug mode enabled\n');
    }
  });

program
  .command('generate')
  .description('Generate video output from a project')
  .option('-p, --project <path>', 'Path to project directory', '.')
  .option(
    '-o, --output <name>',
    'Output name to render (renders all if not specified)',
  )
  .option(
    '--option <name>',
    'FFmpeg option preset to use (from project.html <ffmpeg> section)',
  )
  .action(async (options) => {
    try {
      // Check if FFmpeg is installed
      console.log('🔍 Checking for FFmpeg...');
      await checkFFmpegInstalled();
      console.log('✅ FFmpeg found\n');

      // Resolve project path
      const projectPath = resolve(process.cwd(), options.project);
      const projectFilePath = resolve(projectPath, 'project.html');

      // Validate project.html exists
      if (!existsSync(projectFilePath)) {
        console.error(`Error: project.html not found in ${projectPath}`);
        process.exit(1);
      }

      console.log(`📁 Project: ${projectPath}`);
      console.log(`📄 Loading: ${projectFilePath}\n`);

      // Parse the project HTML file once to get output names
      const initialParser = new HTMLProjectParser(
        await new HTMLParser().parseFile(projectFilePath),
        projectFilePath,
      );
      const initialProject = await initialParser.parse();

      // Determine which outputs to render
      const allOutputs = Array.from(initialProject.getOutputs().keys());
      const outputsToRender = options.output ? [options.output] : allOutputs;

      if (outputsToRender.length === 0) {
        console.error('Error: No outputs defined in project.html');
        process.exit(1);
      }

      // Validate requested output exists
      if (options.output && !allOutputs.includes(options.output)) {
        console.error(
          `Error: Output "${options.output}" not found in project.html`,
        );
        console.error(`Available outputs: ${allOutputs.join(', ')}`);
        process.exit(1);
      }

      // Log which outputs will be rendered
      console.log(`🎬 Rendering outputs: ${outputsToRender.join(', ')}\n`);

      // Create a shared cache key store for all outputs
      const activeCacheKeys = new Set<string>();

      // Render each output
      for (const outputName of outputsToRender) {
        // Re-parse the project for each output to ensure clean state
        const parser = new HTMLProjectParser(
          await new HTMLParser().parseFile(projectFilePath),
          projectFilePath,
        );
        const project = await parser.parse();

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📹 Rendering: ${outputName}`);
        console.log(`${'='.repeat(60)}\n`);

        // Get output info and ensure output directory exists
        const output = project.getOutput(outputName);
        if (!output) {
          throw new Error(`Output "${outputName}" not found`);
        }

        const outputDir = dirname(output.path);
        if (!existsSync(outputDir)) {
          console.log(`📂 Creating output directory: ${outputDir}`);
          mkdirSync(outputDir, { recursive: true });
        }

        // Render containers for this output (accumulate cache keys)
        await project.renderContainers(outputName, activeCacheKeys);

        // Print project statistics
        project.printStats();

        // Build filter graph
        const filterBuf = await project.build(outputName);
        const filter = filterBuf.render();

        // Determine FFmpeg arguments to use
        let ffmpegArgs: string;
        const defaultArgs =
          '-pix_fmt yuv420p -preset medium -c:a aac -b:a 192k';

        if (options.option) {
          // User specified an option name, look it up in project
          const ffmpegOption = project.getFfmpegOption(options.option);
          if (!ffmpegOption) {
            const availableOptions = Array.from(
              project.getFfmpegOptions().keys(),
            );
            console.error(
              `Error: FFmpeg option "${options.option}" not found in project.html`,
            );
            if (availableOptions.length > 0) {
              console.error(
                `Available options: ${availableOptions.join(', ')}`,
              );
            } else {
              console.error(
                'No FFmpeg options defined in project.html <ffmpeg> section',
              );
            }
            process.exit(1);
          }
          ffmpegArgs = ffmpegOption.args;
          console.log(`⚡ Using FFmpeg option: ${options.option}`);
        } else {
          // No option specified, use default
          ffmpegArgs = defaultArgs;
          console.log(`⚡ Using default FFmpeg arguments`);
        }

        // Generate FFmpeg command
        const ffmpegCommand = makeFFmpegCommand(
          project,
          filter,
          outputName,
          ffmpegArgs,
        );

        if (isDebugMode) {
          console.log('\n=== FFmpeg Command ===\n');
          console.log(ffmpegCommand);
          console.log('\n======================\n');
        }

        console.log('\n=== Starting Render ===\n');

        // Run FFmpeg
        await runFFMpeg(ffmpegCommand);

        const resultPath = output.path;
        console.log(`\n✅ Output file: ${resultPath}`);

        const resultDuration = await getAssetDuration(resultPath);
        console.log(`⏱️  Duration: ${resultDuration}ms`);
      }

      // Clean up stale cache entries after all outputs are rendered
      if (activeCacheKeys.size > 0) {
        console.log('\n=== Cleaning up stale cache ===\n');
        await cleanupStaleCache(projectPath, activeCacheKeys);
      }

      console.log('\n🎉 All outputs rendered successfully!\n');
    } catch (error) {
      handleError(error, 'Video generation');
      process.exit(1);
    }
  });

program
  .command('bootstrap')
  .description('Create a new project from template')
  .requiredOption('-n, --name <name>', 'Name of the new project')
  .action((options) => {
    try {
      const projectName = options.name;
      const targetPath = resolve(process.cwd(), projectName);

      // Check if target directory already exists
      if (existsSync(targetPath)) {
        console.error(`Error: Directory "${projectName}" already exists`);
        process.exit(1);
      }

      // Get the template path (relative to the CLI script location)
      // When built, cli.js is in apps/renderer/dist/, and template is at ../../../examples/template
      // Use realpathSync to resolve symlinks when globally linked via npm link
      const scriptPath = realpathSync(process.argv[1]);
      const scriptDir = dirname(scriptPath);
      const templatePath = resolve(scriptDir, '../../../examples/template');

      // Validate template exists
      if (!existsSync(templatePath)) {
        console.error(`Error: Template directory not found at ${templatePath}`);
        process.exit(1);
      }

      console.log(`📦 Creating new project "${projectName}"...`);
      console.log(`📂 Template: ${templatePath}`);
      console.log(`🎯 Target: ${targetPath}\n`);

      // Create target directory and copy template contents
      mkdirSync(targetPath, { recursive: true });
      cpSync(templatePath, targetPath, { recursive: true });

      console.log(`✅ Project "${projectName}" created successfully!\n`);
      console.log('Next steps:');
      console.log(`  cd ${projectName}`);
      console.log('  # Edit project.html to customize your video');
      console.log(`  staticstripes generate -p . -o youtube -d\n`);
    } catch (error) {
      handleError(error, 'Project bootstrap');
      process.exit(1);
    }
  });

program
  .command('add-assets')
  .description('Scan for media files and add them as assets to project.html')
  .option('-p, --project <path>', 'Path to project directory', '.')
  .action((options) => {
    try {
      // Resolve project path
      const projectPath = resolve(process.cwd(), options.project);
      const projectFilePath = resolve(projectPath, 'project.html');

      // Validate project.html exists
      if (!existsSync(projectFilePath)) {
        console.error(`Error: project.html not found in ${projectPath}`);
        process.exit(1);
      }

      console.log(`📁 Project: ${projectPath}`);
      console.log(`📄 Scanning for media files...\n`);

      // Find all media files recursively
      const mediaFiles: {
        path: string;
        relativePath: string;
        type: 'video' | 'audio' | 'image';
      }[] = [];

      const scanDirectory = (dir: string) => {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else {
            const ext = entry.toLowerCase().split('.').pop();
            let type: 'video' | 'audio' | 'image' | null = null;

            if (ext === 'mp4') {
              type = 'video';
            } else if (ext === 'mp3') {
              type = 'audio';
            } else if (ext === 'jpg' || ext === 'png') {
              type = 'image';
            }

            if (type) {
              const relativePath = relative(projectPath, fullPath);
              mediaFiles.push({ path: fullPath, relativePath, type });
            }
          }
        }
      };

      scanDirectory(projectPath);

      // Sort by relative path (name)
      mediaFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

      // Group by type and assign names
      const videos = mediaFiles.filter((f) => f.type === 'video');
      const audios = mediaFiles.filter((f) => f.type === 'audio');
      const images = mediaFiles.filter((f) => f.type === 'image');

      console.log(
        `Found ${videos.length} video(s), ${audios.length} audio(s), ${images.length} image(s)\n`,
      );

      if (mediaFiles.length === 0) {
        console.log('No media files found.');
        process.exit(0);
      }

      // Generate asset tags
      const assetTags: string[] = [];

      videos.forEach((file, index) => {
        const name = `clip_${index + 1}`;
        assetTags.push(
          `  <asset data-name="${name}" data-path="./${file.relativePath}" />`,
        );
        console.log(`${name}: ${file.relativePath}`);
      });

      audios.forEach((file, index) => {
        const name = `track_${index + 1}`;
        assetTags.push(
          `  <asset data-name="${name}" data-path="./${file.relativePath}" />`,
        );
        console.log(`${name}: ${file.relativePath}`);
      });

      images.forEach((file, index) => {
        const name = `image_${index + 1}`;
        assetTags.push(
          `  <asset data-name="${name}" data-path="./${file.relativePath}" />`,
        );
        console.log(`${name}: ${file.relativePath}`);
      });

      // Read project.html
      let content = readFileSync(projectFilePath, 'utf-8');

      // Check if <assets> section exists
      const assetsMatch = content.match(/<assets>([\s\S]*?)<\/assets>/);

      if (assetsMatch) {
        // Replace existing assets section
        const newAssetsSection = `<assets>\n${assetTags.join('\n')}\n</assets>`;
        content = content.replace(
          /<assets>[\s\S]*?<\/assets>/,
          newAssetsSection,
        );
      } else {
        // Add assets section before </project> or at the end
        const newAssetsSection = `\n<assets>\n${assetTags.join('\n')}\n</assets>\n`;

        if (content.includes('</outputs>')) {
          content = content.replace(
            '</outputs>',
            `</outputs>${newAssetsSection}`,
          );
        } else if (content.includes('</style>')) {
          content = content.replace('</style>', `</style>${newAssetsSection}`);
        } else {
          content += newAssetsSection;
        }
      }

      // Write back to project.html
      writeFileSync(projectFilePath, content, 'utf-8');

      console.log(`\n✅ Assets added to ${projectFilePath}`);
    } catch (error) {
      handleError(error, 'Asset scanning');
      process.exit(1);
    }
  });

program
  .command('auth')
  .description('Authenticate with YouTube for uploading')
  .option('-p, --project <path>', 'Path to project directory', '.')
  .requiredOption('--upload-name <name>', 'Name of the upload configuration')
  .action(async (options) => {
    try {
      // Get OAuth credentials from environment variables
      const clientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('❌ Error: STATICSTRIPES_GOOGLE_CLIENT_ID and STATICSTRIPES_GOOGLE_CLIENT_SECRET environment variables are not set\n');
        console.error('📋 Getting Google OAuth Credentials:\n');
        console.error('1. Go to Google Cloud Console:');
        console.error('   https://console.cloud.google.com/\n');
        console.error('2. Create or select a project\n');
        console.error('3. Enable YouTube Data API v3:');
        console.error('   - Go to "APIs & Services" > "Library"');
        console.error('   - Search for "YouTube Data API v3"');
        console.error('   - Click "Enable"\n');
        console.error('4. Configure OAuth Consent Screen:');
        console.error('   - Go to "APIs & Services" > "OAuth consent screen"');
        console.error('   - Choose "External" user type');
        console.error('   - Fill in app name and contact emails');
        console.error('   - Add scope: https://www.googleapis.com/auth/youtube.upload');
        console.error('   - Add your email as a test user\n');
        console.error('5. Create OAuth 2.0 Credentials:');
        console.error('   - Go to "APIs & Services" > "Credentials"');
        console.error('   - Click "Create Credentials" > "OAuth client ID"');
        console.error('   - Choose "Web application"');
        console.error('   - Add redirect URI: http://localhost:3000/oauth2callback');
        console.error('   - Click "Create"\n');
        console.error('6. Copy your Client ID and Client Secret\n');
        console.error('7. Set environment variables:\n');

        // Platform-specific instructions
        const platform = process.platform;
        if (platform === 'win32') {
          console.error('   PowerShell (Recommended) - Run as Administrator:');
          console.error('     [System.Environment]::SetEnvironmentVariable("STATICSTRIPES_GOOGLE_CLIENT_ID", "your-client-id.apps.googleusercontent.com", "User")');
          console.error('     [System.Environment]::SetEnvironmentVariable("STATICSTRIPES_GOOGLE_CLIENT_SECRET", "your-client-secret", "User")');
          console.error('   Then restart your terminal\n');
          console.error('   Or Command Prompt - Run as Administrator:');
          console.error('     setx STATICSTRIPES_GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"');
          console.error('     setx STATICSTRIPES_GOOGLE_CLIENT_SECRET "your-client-secret"');
          console.error('   Then restart your terminal\n');
        } else if (platform === 'darwin') {
          console.error('   Add to ~/.zshrc (or ~/.bash_profile for bash):');
          console.error('     export STATICSTRIPES_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"');
          console.error('     export STATICSTRIPES_GOOGLE_CLIENT_SECRET="your-client-secret"\n');
          console.error('   Then reload your shell:');
          console.error('     source ~/.zshrc\n');
        } else {
          // Linux and others
          console.error('   Add to ~/.bashrc (or ~/.zshrc for zsh):');
          console.error('     export STATICSTRIPES_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"');
          console.error('     export STATICSTRIPES_GOOGLE_CLIENT_SECRET="your-client-secret"\n');
          console.error('   Then reload your shell:');
          console.error('     source ~/.bashrc  # or source ~/.zshrc\n');
        }

        process.exit(1);
      }

      // Resolve project path
      const projectPath = resolve(process.cwd(), options.project);
      const projectFilePath = resolve(projectPath, 'project.html');

      // Validate project.html exists
      if (!existsSync(projectFilePath)) {
        console.error(`Error: project.html not found in ${projectPath}`);
        process.exit(1);
      }

      console.log(`📁 Project: ${projectPath}`);
      console.log(`🔐 Authenticating: ${options.uploadName}\n`);

      // Create uploader instance
      const uploader = new YouTubeUploader(clientId, clientSecret);

      // Get authorization URL
      const authUrl = uploader.getAuthUrl();

      console.log('🌐 Opening browser for authorization...\n');

      // Open browser automatically
      try {
        await open(authUrl);
        console.log('✅ Browser opened successfully\n');
      } catch (err) {
        console.log('⚠️  Could not open browser automatically');
        console.log('🌐 Please visit this URL to authorize:\n');
        console.log(authUrl);
      }

      console.log('\n⚠️  After authorizing, copy the authorization code from the URL');
      console.log(
        '⚠️  Then run: staticstripes auth-complete --upload-name <name> --code <code>',
      );
    } catch (error) {
      handleError(error, 'Authentication');
      process.exit(1);
    }
  });

program
  .command('auth-complete')
  .description('Complete authentication with authorization code')
  .option('-p, --project <path>', 'Path to project directory', '.')
  .requiredOption('--upload-name <name>', 'Name of the upload configuration')
  .requiredOption('--code <code>', 'Authorization code from OAuth flow')
  .action(async (options) => {
    try {
      const clientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('❌ Error: STATICSTRIPES_GOOGLE_CLIENT_ID and STATICSTRIPES_GOOGLE_CLIENT_SECRET environment variables are not set');
        console.error('\n💡 Run: staticstripes auth --help');
        console.error('   for complete setup instructions\n');
        process.exit(1);
      }

      const projectPath = resolve(process.cwd(), options.project);

      // Create uploader and complete authentication
      const uploader = new YouTubeUploader(clientId, clientSecret);
      await uploader.authenticate(options.code, options.uploadName, projectPath);

      console.log(`✅ Authentication complete for ${options.uploadName}`);
    } catch (error) {
      handleError(error, 'Authentication completion');
      process.exit(1);
    }
  });

program
  .command('upload')
  .description('Upload video to YouTube')
  .option('-p, --project <path>', 'Path to project directory', '.')
  .requiredOption('--upload-name <name>', 'Name of the upload configuration')
  .action(async (options) => {
    try {
      const clientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('❌ Error: STATICSTRIPES_GOOGLE_CLIENT_ID and STATICSTRIPES_GOOGLE_CLIENT_SECRET environment variables are not set');
        console.error('\n💡 Run: staticstripes auth --help');
        console.error('   for complete setup instructions\n');
        process.exit(1);
      }

      // Resolve project path
      const projectPath = resolve(process.cwd(), options.project);
      const projectFilePath = resolve(projectPath, 'project.html');

      // Validate project.html exists
      if (!existsSync(projectFilePath)) {
        console.error(`Error: project.html not found in ${projectPath}`);
        process.exit(1);
      }

      console.log(`📁 Project: ${projectPath}`);
      console.log(`📄 Loading: ${projectFilePath}\n`);

      // Parse the project HTML file
      const parser = new HTMLProjectParser(
        await new HTMLParser().parseFile(projectFilePath),
        projectFilePath,
      );
      const project = await parser.parse();

      // Get upload configuration
      const upload = project.getYouTubeUpload(options.uploadName);
      if (!upload) {
        const availableUploads = Array.from(
          project.getYouTubeUploads().keys(),
        );
        console.error(
          `Error: Upload "${options.uploadName}" not found in project.html`,
        );
        if (availableUploads.length > 0) {
          console.error(`Available uploads: ${availableUploads.join(', ')}`);
        } else {
          console.error('No uploads defined in project.html');
        }
        process.exit(1);
      }

      // Get the output file
      const output = project.getOutput(upload.outputName);
      if (!output) {
        console.error(`Error: Output "${upload.outputName}" not found`);
        process.exit(1);
      }

      if (!existsSync(output.path)) {
        console.error(`Error: Output file not found: ${output.path}`);
        console.error('Please generate the video first with: staticstripes generate');
        process.exit(1);
      }

      console.log(`📹 Video file: ${output.path}`);
      console.log(`🎬 Upload config: ${options.uploadName}\n`);

      // Create uploader and load tokens
      const uploader = new YouTubeUploader(clientId, clientSecret);
      const hasTokens = uploader.loadTokens(options.uploadName, projectPath);

      if (!hasTokens) {
        console.error(
          `Error: Not authenticated. Please run: staticstripes auth --upload-name ${options.uploadName}`,
        );
        process.exit(1);
      }

      // Determine title (use upload-specific title or fall back to project title)
      const title = upload.title || project.getTitle();
      console.log(`📝 Title: ${title}\n`);

      // Upload video
      const videoId = await uploader.uploadVideo(
        output.path,
        upload,
        title,
      );

      // Handle thumbnail if specified
      if (upload.thumbnailTimecode !== undefined) {
        console.log(
          `\n🖼️  Extracting thumbnail at ${upload.thumbnailTimecode}ms...`,
        );
        const thumbnailPath = resolve(projectPath, '.youtube-tokens', 'thumbnail.png');
        await uploader.extractThumbnail(
          output.path,
          upload.thumbnailTimecode,
          thumbnailPath,
        );
        await uploader.uploadThumbnail(videoId, thumbnailPath);
      }

      // TODO: Update project.html with video ID
      console.log('\n✅ Upload complete!');
    } catch (error) {
      handleError(error, 'Upload');
      process.exit(1);
    }
  });

program.parse(process.argv);
