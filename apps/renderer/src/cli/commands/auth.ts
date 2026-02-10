import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { HTMLParser } from '../../html-parser.js';
import { HTMLProjectParser } from '../../html-project-parser.js';
import { AuthStrategyFactory } from '../auth-strategy-factory.js';

/**
 * Registers the generic auth command that works with any upload provider
 */
export function registerAuthCommand(
  program: Command,
  handleError: (error: any, operation: string) => void,
): void {
  program
    .command('auth')
    .description('Authenticate with upload provider (YouTube, Instagram, etc.)')
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

        console.log(`📁 Project: ${projectPath}\n`);

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

        // Get the appropriate strategy for this upload tag
        const factory = AuthStrategyFactory.createDefault();

        try {
          const strategy = factory.getStrategy(upload.tag);

          // Execute the authentication
          await strategy.execute(options.uploadName, projectPath);
        } catch (error: any) {
          // If strategy not found, show available options and setup instructions
          if (error.message.includes('No authentication strategy')) {
            console.error(`\n${error.message}\n`);

            // Show setup instructions if available
            const instructions = factory.getSetupInstructions(upload.tag);
            if (instructions) {
              console.error('📋 Setup Instructions:');
              console.error(instructions);
            }

            console.error('\n💡 Tip: Make sure required environment variables are set\n');
          }
          throw error;
        }
      } catch (error) {
        handleError(error, 'Authentication');
        process.exit(1);
      }
    });

  // Add auth-help command to show setup instructions
  program
    .command('auth-help')
    .description('Show authentication setup instructions for a provider')
    .argument('<provider>', 'Provider name (youtube, instagram, etc.)')
    .action((provider) => {
      try {
        const factory = AuthStrategyFactory.createDefault();
        const instructions = factory.getSetupInstructions(provider);

        if (instructions) {
          console.log(instructions);
        } else {
          const availableProviders = factory.listProviders();
          console.error(`❌ No setup instructions available for "${provider}"\n`);
          if (availableProviders.length > 0) {
            console.error(`Available providers: ${availableProviders.join(', ')}\n`);
          }
          process.exit(1);
        }
      } catch (error: any) {
        console.error(`\n❌ Error: ${error.message}\n`);
        process.exit(1);
      }
    });
}
