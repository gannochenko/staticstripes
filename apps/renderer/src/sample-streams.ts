import { Project } from './project';
import {
  ChromakeyBlend,
  ChromakeySimilarity,
  FilterBuffer,
  makeStream,
} from './stream';

// @ts-expect-error unused
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
