import { HTMLParser } from './html-parser.js';
import { resolve } from 'path';
import { FilterBuffer } from './stream.js';
import { makeFFmpegCommand, runFFMpeg } from './ffmpeg.js';
import { Sequence } from './sequence.js';
import { getAssetDuration } from './ffprobe.js';
import {
  ExpressionContext,
  FragmentData,
  parseExpression,
} from './expression-parser.js';
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

  const filterBuf = project.build();

  console.log('\n=== Project stats ===\n');

  project.printStats();

  const ffmpegCommand = makeFFmpegCommand(project, filterBuf.render());

  console.log('\n=== Command ===');

  console.log(ffmpegCommand);

  console.log('\n=== Starting Render ===');
  console.log('Progress:\n');

  await runFFMpeg(ffmpegCommand);

  const resultPath = project.getOutput().path;
  console.log(`Output file: ${resultPath}`);
  const resultDuration = await getAssetDuration(resultPath);
  console.log(`Output duration: ${resultDuration}ms`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
