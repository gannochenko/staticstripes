#!/usr/bin/env node

import { Command } from 'commander';
import { resolve, dirname, relative } from 'path';
import { existsSync, mkdirSync, cpSync, realpathSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { HTMLParser } from './html-parser.js';
import { HTMLProjectParser } from './html-project-parser.js';
import { makeFFmpegCommand, runFFMpeg } from './ffmpeg.js';
import { getAssetDuration } from './ffprobe.js';

const program = new Command();

program
  .name('staticstripes')
  .description('CLI tool for rendering video projects')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate video output from a project')
  .option('-p, --project <path>', 'Path to project directory', '.')
  .option('-o, --output <name>', 'Output name to render (renders all if not specified)')
  .option('-d, --dev', 'Use fast encoding preset for development (ultrafast)')
  .action(async (options) => {
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
      console.log(`📄 Loading: ${projectFilePath}\n`);

      // Parse the project HTML file
      const parser = new HTMLProjectParser(
        await new HTMLParser().parseFile(projectFilePath),
        projectFilePath,
      );
      const project = await parser.parse();

      // Determine which outputs to render
      const allOutputs = Array.from(project.getOutputs().keys());
      const outputsToRender = options.output ? [options.output] : allOutputs;

      if (outputsToRender.length === 0) {
        console.error('Error: No outputs defined in project.html');
        process.exit(1);
      }

      // Validate requested output exists
      if (options.output && !allOutputs.includes(options.output)) {
        console.error(`Error: Output "${options.output}" not found in project.html`);
        console.error(`Available outputs: ${allOutputs.join(', ')}`);
        process.exit(1);
      }

      // Determine encoding preset based on -d flag
      const preset = options.dev ? 'ultrafast' : 'medium';
      console.log(`⚡ Encoding preset: ${preset}`);
      console.log(`🎬 Rendering outputs: ${outputsToRender.join(', ')}\n`);

      // Render each output
      for (const outputName of outputsToRender) {
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

        // Render containers for this output
        await project.renderContainers(outputName);

        // Print project statistics
        project.printStats();

        // Build filter graph
        const filterBuf = await project.build(outputName);
        const filter = filterBuf.render();

        console.log('\n=== Filter Graph ===\n');
        console.log(filter);

        // Generate FFmpeg command with appropriate preset
        const ffmpegCommand = makeFFmpegCommand(project, filter, outputName, preset);

        console.log('\n=== Starting Render ===\n');

        // Run FFmpeg
        await runFFMpeg(ffmpegCommand);

        const resultPath = output.path;
        console.log(`\n✅ Output file: ${resultPath}`);

        const resultDuration = await getAssetDuration(resultPath);
        console.log(`⏱️  Duration: ${resultDuration}ms`);
      }

      console.log('\n🎉 All outputs rendered successfully!\n');
    } catch (error) {
      console.error('\n❌ Error:', error);
      process.exit(1);
    }
  });

program
  .command('upload')
  .description('Upload video to platforms (not yet implemented)')
  .option('-p, --project <path>', 'Path to project directory', '.')
  .option('-u, --upload <platform>', 'Platform to upload to (e.g., youtube)')
  .action(() => {
    console.log('Upload command is not yet implemented.');
    console.log('This feature will allow uploading videos to platforms like YouTube.');
    process.exit(0);
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
      console.error('\n❌ Error:', error);
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
      const mediaFiles: { path: string; relativePath: string; type: 'video' | 'audio' | 'image' }[] = [];

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
      const videos = mediaFiles.filter(f => f.type === 'video');
      const audios = mediaFiles.filter(f => f.type === 'audio');
      const images = mediaFiles.filter(f => f.type === 'image');

      console.log(`Found ${videos.length} video(s), ${audios.length} audio(s), ${images.length} image(s)\n`);

      if (mediaFiles.length === 0) {
        console.log('No media files found.');
        process.exit(0);
      }

      // Generate asset tags
      const assetTags: string[] = [];

      videos.forEach((file, index) => {
        const name = `clip_${index + 1}`;
        assetTags.push(`  <asset data-name="${name}" data-path="./${file.relativePath}" />`);
        console.log(`${name}: ${file.relativePath}`);
      });

      audios.forEach((file, index) => {
        const name = `track_${index + 1}`;
        assetTags.push(`  <asset data-name="${name}" data-path="./${file.relativePath}" />`);
        console.log(`${name}: ${file.relativePath}`);
      });

      images.forEach((file, index) => {
        const name = `image_${index + 1}`;
        assetTags.push(`  <asset data-name="${name}" data-path="./${file.relativePath}" />`);
        console.log(`${name}: ${file.relativePath}`);
      });

      // Read project.html
      let content = readFileSync(projectFilePath, 'utf-8');

      // Check if <assets> section exists
      const assetsMatch = content.match(/<assets>([\s\S]*?)<\/assets>/);

      if (assetsMatch) {
        // Replace existing assets section
        const newAssetsSection = `<assets>\n${assetTags.join('\n')}\n</assets>`;
        content = content.replace(/<assets>[\s\S]*?<\/assets>/, newAssetsSection);
      } else {
        // Add assets section before </project> or at the end
        const newAssetsSection = `\n<assets>\n${assetTags.join('\n')}\n</assets>\n`;

        if (content.includes('</outputs>')) {
          content = content.replace('</outputs>', `</outputs>${newAssetsSection}`);
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
      console.error('\n❌ Error:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
