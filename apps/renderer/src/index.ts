import { HTMLParser } from './html-parser.js';
import { resolve } from 'path';
import { HTMLProjectParser, Project } from './project.js';
import { spawn } from 'child_process';
import {
  ChromakeyBlend,
  ChromakeySimilarity,
  FilterBuffer,
  makeStream,
} from './stream.js';
import { makeFFmpegCommand } from './ffmpeg.js';
import { Sequence } from './sequence.js';
import { getAssetDuration } from './ffprobe.js';

console.log('Renderer application starting...');

async function main() {
  console.log('Renderer ready');

  // Parse the demo project HTML file
  const projectPath = resolve(__dirname, '../../../examples/demo/project.html');

  // parsing HTML into AST
  const htmlParser = new HTMLParser();
  const htmlAST = await htmlParser.parseFile(projectPath);

  // converting AST to the Project
  const parser = new HTMLProjectParser(htmlAST, projectPath);
  const project = await parser.parse();

  const buf = new FilterBuffer();

  const seq1 = new Sequence(
    buf,
    {
      fragments: [
        {
          enabled: true,
          assetName: 'intro_image',
          duration: 2000, // asset duration is 0
          trimLeft: 0,
          overlayLeft: 0,
          overlayZIndex: 1,
          transitionIn: '',
          transitionInDuration: 0,
          transitionOut: 'fade',
          transitionOutDuration: 500,
          objectFit: 'cover',
          objectFitContain: 'ambient',
          objectFitContainAmbientBlurStrength: 25,
          objectFitContainAmbientBrightness: -0.1,
          objectFitContainAmbientSaturation: 0.7,
          objectFitContainPillarboxColor: '#000000',
          chromakey: false,
          chromakeyBlend: 0.1,
          chromakeySimilarity: 0.1,
          chromakeyColor: '#000000',

          zIndex: 0, // ignore
          blendModeLeft: '', // ignore
        },
        {
          enabled: true,
          assetName: 'clip_01',
          duration: 11330 - 3000, // asset duration is 11330
          trimLeft: 3000,
          overlayLeft: 0,
          overlayZIndex: 1,
          transitionIn: 'fade',
          transitionInDuration: 1000,
          transitionOut: '',
          transitionOutDuration: 0,
          objectFit: 'contain',
          objectFitContain: 'ambient',
          objectFitContainAmbientBlurStrength: 25,
          objectFitContainAmbientBrightness: -0.1,
          objectFitContainAmbientSaturation: 0.7,
          objectFitContainPillarboxColor: '#000000',
          chromakey: false,
          chromakeyBlend: 0.1,
          chromakeySimilarity: 0.1,
          chromakeyColor: '#000000',

          zIndex: 0, // ignore
          blendModeLeft: '', // ignore
        },
        {
          enabled: true,
          assetName: 'glitch',
          duration: 2000, // asset duration is 10000
          trimLeft: 0,
          overlayLeft: -1000,
          overlayZIndex: 1,
          transitionIn: '',
          transitionInDuration: 0,
          transitionOut: '',
          transitionOutDuration: 0,
          objectFit: 'cover',
          objectFitContain: 'pillarbox',
          objectFitContainAmbientBlurStrength: 25,
          objectFitContainAmbientBrightness: -0.1,
          objectFitContainAmbientSaturation: 0.7,
          objectFitContainPillarboxColor: '#000000',
          chromakey: true,
          chromakeyBlend: 0.1,
          chromakeySimilarity: 0.1,
          chromakeyColor: '#000000',

          zIndex: 0, // ignore
          blendModeLeft: '', // ignore
        },
        {
          enabled: true,
          assetName: 'clip_02',
          duration: 3000, // asset duration is 90245
          trimLeft: 0,
          overlayLeft: -1000,
          overlayZIndex: -1,
          transitionIn: '',
          transitionInDuration: 0,
          transitionOut: 'fade',
          transitionOutDuration: 1000,
          objectFit: 'contain',
          objectFitContain: 'ambient',
          objectFitContainAmbientBlurStrength: 25,
          objectFitContainAmbientBrightness: -0.1,
          objectFitContainAmbientSaturation: 0.7,
          objectFitContainPillarboxColor: '#000000',
          chromakey: false,
          chromakeyBlend: 0.1,
          chromakeySimilarity: 0.1,
          chromakeyColor: '#000000',

          zIndex: 0, // ignore
          blendModeLeft: '', // ignore
        },
      ],
    },
    project.getOutput(),
    project.getAssetManager(),
  );
  seq1.build();

  const seq2 = new Sequence(
    buf,
    {
      fragments: [
        {
          enabled: true,
          assetName: 'guitar_music',
          duration: 2000, // asset duration is 224653
          trimLeft: 0,
          overlayLeft: 0,
          overlayZIndex: 1,
          transitionIn: '',
          transitionInDuration: 0,
          transitionOut: 'fade',
          transitionOutDuration: 500,
          objectFit: 'cover',
          objectFitContain: 'ambient',
          objectFitContainAmbientBlurStrength: 25,
          objectFitContainAmbientBrightness: -0.1,
          objectFitContainAmbientSaturation: 0.7,
          objectFitContainPillarboxColor: '#000000',
          chromakey: false,
          chromakeyBlend: 0.1,
          chromakeySimilarity: 0.1,
          chromakeyColor: '#000000',

          zIndex: 0, // ignore
          blendModeLeft: '', // ignore
        },
      ],
    },
    project.getOutput(),
    project.getAssetManager(),
  );
  seq2.build();

  seq1.overlayWith(seq2);

  seq1.getVideoStream().endTo({
    tag: 'outv',
    isAudio: false,
  });
  seq1.getAudioStream().endTo({
    tag: 'outa',
    isAudio: true,
  });

  // addSampleStreams(project, buf);

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
        const resultPath = project.getOutput().path;
        console.log(`Output file: ${resultPath}`);
        getAssetDuration(resultPath).then((resultDuration) => {
          console.log(`Output duration: ${resultDuration}ms`);
          resolve();
        });
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

const addSampleStreams = (project: Project, buf: FilterBuffer) => {
  const glitchStream = makeStream(
    project.getAssetManager().getVideoInputLabelByAssetName('glitch'),
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
    project.getAssetManager().getVideoInputLabelByAssetName('clip_02'),
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
    project.getAssetManager().getVideoInputLabelByAssetName('intro_image'),
    buf,
  )
    .fps(30)
    .fitOutputCover({ width: 1920, height: 1080 })
    .tPad({
      start: 3,
      startMode: 'clone',
    });

  makeStream(
    project.getAssetManager().getVideoInputLabelByAssetName('clip_01'),
    buf,
  )
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
        streamDuration: 5, // value from trim()
        otherStreamDuration: 2, // value from trim() of glitch
        otherStreamOffsetLeft: 4, // start of the glitch
      },
    })
    .overlayStream(clip02VideoStream, {
      // length = 11 ?
      flipLayers: true,
      offset: {
        streamDuration: 5, // value from trim()
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
    project.getAssetManager().getAudioInputLabelByAssetName('clip_02'),
    buf,
  ).trim(0, 5);

  makeStream(
    project.getAssetManager().getAudioInputLabelByAssetName('clip_01'),
    buf,
  )
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
};
