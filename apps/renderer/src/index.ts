import { HTMLParser } from './html-parser.js';
import { resolve } from 'path';
import { makeFFmpegCommand, runFFMpeg } from './ffmpeg.js';
import { getAssetDuration } from './ffprobe.js';
import { HTMLProjectParser } from './html-project-parser.js';

async function main() {
  // Parse the demo project HTML file
  const projectPath = resolve(__dirname, '../../../examples/demo/project.html');

  // converting AST to the Project
  const parser = new HTMLProjectParser(
    await new HTMLParser().parseFile(projectPath),
    projectPath,
  );
  const project = await parser.parse();

  // Use the default output name
  const outputName = 'youtube';

  await project.renderContainers(outputName);

  project.printStats();

  const filterBuf = await project.build(outputName);
  const filter = filterBuf.render();

  console.log('\n=== Filter ===\n');

  console.log(filter);

  const ffmpegCommand = makeFFmpegCommand(project, filter, outputName);

  console.log('\n=== Starting Render ===\n');

  await runFFMpeg(ffmpegCommand);

  const output = project.getOutput(outputName);
  if (!output) {
    throw new Error(`Output "${outputName}" not found`);
  }
  const resultPath = output.path;
  console.log(`Output file: ${resultPath}`);
  const resultDuration = await getAssetDuration(resultPath);
  console.log(`Output duration: ${resultDuration}ms`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
