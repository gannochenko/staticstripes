#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { registerGenerateCommand } from './cli/commands/generate.js';
import { registerBootstrapCommand } from './cli/commands/bootstrap.js';
import { registerAddAssetsCommand } from './cli/commands/add-assets.js';
import { registerUploadCommand } from './cli/commands/upload.js';
import { registerYouTubeCommands } from './cli/youtube/cli.js';

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

// Register all commands
registerGenerateCommand(program, () => isDebugMode, handleError);
registerBootstrapCommand(program, handleError);
registerAddAssetsCommand(program, handleError);
registerUploadCommand(program, handleError);

// Register provider-specific commands (auth, etc.)
registerYouTubeCommands(program);

program.parse(process.argv);
