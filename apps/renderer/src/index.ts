import { parseHTMLFile } from './html-parser.js';
import { resolve } from 'path';
import { prepareProject as makeProject } from './project.js';
import { spawn } from 'child_process';
import { Direction, FilterBuffer, makeStream } from './stream.js';
import { makeFFmpegCommand } from './ffmpeg.js';

console.log('Renderer application starting...');

async function main() {
  console.log('Renderer ready');

  // Parse the demo project HTML file
  const projectPath = resolve(__dirname, '../../../examples/demo/project.html');

  const project = await makeProject(
    await parseHTMLFile(projectPath),
    projectPath,
  );

  const buf = new FilterBuffer();

  makeStream(project.getVideoInputLabelByAssetName('clip_02'), buf)
    .trim(0, 1)
    .fitOutput({ width: 1920, height: 1080 })
    .fps(30)
    .endTo({
      tag: 'outv',
      isAudio: false,
    });

  makeStream(project.getAudioInputLabelByAssetName('clip_02'), buf)
    .trim(0, 1)
    .endTo({
      tag: 'outa',
      isAudio: true,
    });

  const ffmpegCommand = makeFFmpegCommand(project, buf.render());

  console.log('\n=== Command ===');

  console.log(ffmpegCommand);

  console.log('\n=== Starting Render ===');
  console.log('Progress:\n');

  // Parse command into array (handle quoted paths)
  const args =
    ffmpegCommand
      .slice('ffmpeg '.length)
      .match(/(?:[^\s"]+|"[^"]*")+/g)
      ?.map((arg) => arg.replace(/^"|"$/g, '')) || [];

  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // FFmpeg outputs progress to stderr
    let stderrBuffer = '';
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stderrBuffer += output;

      // Show all output for debugging
      process.stderr.write(output);
    });

    ffmpeg.on('close', (code) => {
      process.stdout.write('\n');
      if (code === 0) {
        console.log('\n=== Render Complete ===');
        console.log(`Output file: ${project.output.path}`);
        resolve();
      } else {
        console.error(`\n=== Render Failed ===`);
        console.error(`FFmpeg exited with code ${code}`);
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('\n=== Render Failed ===');
      console.error('Error:', error.message);
      reject(error);
    });
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
