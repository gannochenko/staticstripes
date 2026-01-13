import { parseHTMLFile } from './parser.js';
import { resolve } from 'path';
import { generateFilterComplex } from './generator.js';
import { prepareProject } from './project.js';
import { generateFFmpegCommand } from './ffmpeg.js';
import { spawn } from 'child_process';
import { StreamDAG } from './dag.js';
import { makeConcat } from './filtercomplex.js';
import {
  makeStream as startStream,
  startStreamWithConcat,
} from './stream-builder.js';

console.log('Renderer application starting...');

async function main() {
  console.log('Renderer ready');

  // Parse the demo project HTML file
  const projectPath = resolve(__dirname, '../../../examples/demo/project.html');

  const fileContent = await parseHTMLFile(projectPath);
  const project = await prepareProject(fileContent, projectPath);

  console.log('\n=== Filter Complex ===');
  // const filterComplex = generateFilterComplex(project);
  // console.log(filterComplex);

  const dag = new StreamDAG();

  // asset transformation streams
  const assetVideoStream0 = startStream('0:v')
    .correctRotation(90)
    .scale({ width: 1920, height: 1080 })
    .fps(30);
  const assetVideoStream1 = startStream('1:v')
    .scale({ width: 1920, height: 1080 })
    .fps(30);

  const assetAudioStream0 = startStream('0:a');
  const assetAudioStream1 = startStream('1:a');

  // Concat video streams
  const videoStream = startStreamWithConcat([
    assetVideoStream0,
    assetVideoStream1,
  ]);

  const audioStream = startStreamWithConcat([
    assetAudioStream0,
    assetAudioStream1,
  ]);

  // Append the concatenated streams to main DAG
  dag.appendStreams([videoStream, audioStream]);

  // Wire streams to output labels
  dag.from(videoStream.getLooseLabel()).copyTo('outv');
  dag.from(audioStream.getLooseLabel()).copyTo('outa');

  const filterComplex = dag.render();

  console.log('\n=== Filter ===');
  console.log(filterComplex);

  console.log('\n=== Output ===');
  console.log(project.output);

  console.log('\n=== FFmpeg Command ===');
  const ffmpegCommand = generateFFmpegCommand(project, filterComplex);
  console.log(ffmpegCommand);

  return;

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
