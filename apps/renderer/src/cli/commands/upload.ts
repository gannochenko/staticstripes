import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { HTMLParser } from '../../html-parser.js';
import { HTMLProjectParser } from '../../html-project-parser.js';
import { UploadStrategyFactory } from '../upload-strategy-factory.js';

/**
 * Registers the generic upload command that works with any upload provider
 */
export function registerUploadCommand(
  program: Command,
  handleError: (error: any, operation: string) => void,
): void {
  program
    .command('upload')
    .description('Upload video to configured platform (YouTube, S3, etc.)')
    .option('-p, --project <path>', 'Path to project directory', '.')
    .requiredOption('--upload-name <name>', 'Name of the upload configuration')
    .action(async (options) => {
      try {
        // Resolve project path
        const projectPath = resolve(process.cwd(), options.project);
        const projectFilePath = resolve(projectPath, 'project.html');

        // Validate project.html exists
        if (!existsSync(projectFilePath)) {
          console.error(`❌ Error: project.html not found in ${projectPath}`);
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

        // Get the upload configuration
        const upload = project.getUpload(options.uploadName);
        if (!upload) {
          const availableUploads = Array.from(
            project.getUploads().keys(),
          );
          console.error(
            `❌ Upload "${options.uploadName}" not found in project.html\n`,
          );
          if (availableUploads.length > 0) {
            console.error(`Available uploads: ${availableUploads.join(', ')}`);
          } else {
            console.error('No uploads defined in project.html');
          }
          process.exit(1);
        }

        // Validate output file exists
        const output = project.getOutput(upload.outputName);
        if (output && !existsSync(output.path)) {
          console.error(`❌ Error: Output file not found: ${output.path}`);
          console.error(
            '💡 Please generate the video first with: staticstripes generate\n',
          );
          process.exit(1);
        }

        // Get the appropriate strategy for this upload tag
        const factory = UploadStrategyFactory.createDefault();
        const strategy = factory.getStrategy(upload.tag);

        // Validate strategy requirements
        strategy.validate();

        // Execute the upload
        await strategy.execute(project, upload, projectPath);
      } catch (error) {
        handleError(error, 'Upload');
        process.exit(1);
      }
    });
}
