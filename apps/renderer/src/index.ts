import { parseHTMLFile } from './html-parser.js';
import { resolve } from 'path';
import { prepareProject as makeProject } from './project.js';
import { spawn } from 'child_process';
import {
  ChromakeyBlend,
  ChromakeySimilarity,
  FilterBuffer,
  makeStream,
} from './stream.js';
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

  const glitchStream = makeStream(
    project.getVideoInputLabelByAssetName('glitch'),
    buf,
  )
    .trim(0, 2)
    .fitOutputContain({ width: 1920, height: 1080 })
    .fps(30)
    .chromakey({
      blend: ChromakeyBlend.Smooth,
      similarity: ChromakeySimilarity.Strict,
      color: '#000000',
    });

  const clip02VideoStream = makeStream(
    project.getVideoInputLabelByAssetName('clip_02'),
    buf,
  )
    .trim(0, 5)
    .fitOutputContain(
      {
        width: 1920,
        height: 1080,
      },
      {
        ambient: {
          blurStrength: 25,
          brightness: -0.1,
          saturation: 0.7,
        },
      },
    )
    .fps(30);

  const introImageStream = makeStream(
    project.getVideoInputLabelByAssetName('intro_image'),
    buf,
  )
    .fps(30)
    .fitOutputCover({ width: 1920, height: 1080 })
    .tPad({
      start: 3,
      startMode: 'clone',
    });

  makeStream(project.getVideoInputLabelByAssetName('clip_01'), buf)
    .trim(0, 5) // length = 5
    .fitOutputContain(
      {
        width: 1920,
        height: 1080,
      },
      {
        ambient: {
          blurStrength: 25,
          brightness: -0.1,
          saturation: 0.7,
        },
        // pillarbox: {
        //   color: '#ff0000',
        // },
      },
    )
    .fps(30)
    .fade({
      fades: [
        {
          type: 'in',
          startTime: 0,
          duration: 1,
        },
      ],
    })
    .overlayStream(glitchStream, {
      // length = 5
      offset: {
        duration: 5, // value from trim()
        otherStreamDuration: 2, // value from trim() of glitch
        otherStreamOffsetLeft: 4, // start of the glitch
      },
    })
    .overlayStream(clip02VideoStream, {
      // length = 11 ?
      flipLayers: true,
      offset: {
        duration: 5, // value from trim()
        otherStreamDuration: 6, // 5 seconds of clip01, 1 second of glitch
        otherStreamOffsetLeft: 5, // start of the of clip01stream
      },
    })
    .fade({
      fades: [
        {
          type: 'out',
          startTime: 9,
          duration: 1,
        },
      ],
    })
    .concatStream(introImageStream)
    .endTo({
      tag: 'outv',
      isAudio: false,
    });

  const clip02AudioStream = makeStream(
    project.getAudioInputLabelByAssetName('clip_02'),
    buf,
  ).trim(0, 5);

  makeStream(project.getAudioInputLabelByAssetName('clip_01'), buf)
    .trim(0, 5)
    .fade({
      fades: [
        {
          type: 'in',
          startTime: 0,
          duration: 1,
        },
      ],
    })
    .concatStream(clip02AudioStream)
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
