import { ExpressionContext, parseExpression } from './expression-parser';
import { Project } from './project';
import { Sequence } from './sequence';
import { FilterBuffer } from './stream';

export const getSampleSequences = (
  project: Project,
  buf: FilterBuffer,
  expressionContext: ExpressionContext,
) => {
  const seq1 = new Sequence(
    buf,
    {
      fragments: [
        {
          id: 'f_01',
          enabled: true,
          assetName: 'intro_image',
          duration: 4000, // asset duration is 0
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
        },
        {
          id: 'f_02',
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
        },
        {
          id: 'f_03',
          enabled: true,
          assetName: 'glitch',
          duration: 500, // asset duration is 10000
          trimLeft: 0,
          overlayLeft: -250,
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
        },
        {
          id: 'f_04',
          enabled: true,
          assetName: 'clip_02',
          duration: 3000, // asset duration is 90245
          trimLeft: 0,
          overlayLeft: -250,
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
        },
        {
          id: 'ending_screen',
          enabled: true,
          assetName: 'intro_image',
          duration: 4000, // asset duration is 0
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
        },
      ],
    },
    project.getOutput(),
    project.getAssetManager(),
    expressionContext,
  );
  seq1.build();

  const seq2 = new Sequence(
    buf,
    {
      fragments: [
        {
          id: 'f_06',
          enabled: true,
          assetName: 'guitar_music',
          duration: 4000, // asset duration is 224653
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
        },
      ],
    },
    project.getOutput(),
    project.getAssetManager(),
    expressionContext,
  );
  seq2.build();

  const seq3 = new Sequence(
    buf,
    {
      fragments: [
        {
          id: 'end_music',
          enabled: true,
          assetName: 'guitar_music',
          duration: 4000, // asset duration is 224653
          trimLeft: 0,
          overlayLeft: parseExpression('calc(#ending_screen.time.start)'),
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
        },
      ],
    },
    project.getOutput(),
    project.getAssetManager(),
    expressionContext,
  );
  seq3.build();

  seq1.overlayWith(seq2);
  seq1.overlayWith(seq3);

  seq1.getVideoStream().endTo({
    tag: 'outv',
    isAudio: false,
  });
  seq1.getAudioStream().endTo({
    tag: 'outa',
    isAudio: true,
  });
};
