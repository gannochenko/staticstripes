import { AssetManager } from './asset-manager';
import {
  calculateFinalValue,
  ExpressionContext,
  TimeData,
} from './expression-parser';

import {
  AMBIENT,
  FilterBuffer,
  makeStream,
  makeSilentStream,
  makeBlankStream,
  ObjectFitContainOptions,
  PILLARBOX,
  Stream,
} from './stream';
import { Output, SequenceDefinition } from './type';

export class Sequence {
  private time: number = 0; // time is absolute

  private videoStream!: Stream;
  private audioStream!: Stream;

  constructor(
    private buf: FilterBuffer,
    private definition: SequenceDefinition,
    private output: Output,
    private assetManager: AssetManager,
    private expressionContext: ExpressionContext,
  ) {}

  build() {
    let firstOne = true;
    this.definition.fragments.forEach((fragment) => {
      if (!fragment.enabled) {
        return;
      }

      const calculatedOverlayLeft = calculateFinalValue(
        fragment.overlayLeft,
        this.expressionContext,
      );

      const timeContext: TimeData = {
        start: 0,
        end: 0,
        duration: fragment.duration,
      };

      const asset = this.assetManager.getAssetByName(fragment.assetName);
      if (!asset) {
        return;
      }

      // Create video stream: use actual video if available, otherwise create blank stream
      let currentVideoStream: Stream;
      if (asset.hasVideo) {
        currentVideoStream = makeStream(
          this.assetManager.getVideoInputLabelByAssetName(fragment.assetName),
          this.buf,
        );
      } else {
        // Create blank transparent video stream for audio-only assets
        currentVideoStream = makeBlankStream(
          fragment.duration,
          this.output.resolution.width,
          this.output.resolution.height,
          this.output.fps,
          this.buf,
        );
      }

      // Create audio stream: use actual audio if available, otherwise create silent stream
      let currentAudioStream: Stream;
      if (asset.hasAudio) {
        currentAudioStream = makeStream(
          this.assetManager.getAudioInputLabelByAssetName(fragment.assetName),
          this.buf,
        );
      } else {
        // Create silent audio stream matching the video duration
        currentAudioStream = makeSilentStream(fragment.duration, this.buf);
      }

      // duration and clipping adjustment
      if (fragment.trimLeft != 0 || fragment.duration < asset.duration) {
        // console.log('fragment.trimLeft=' + fragment.trimLeft);
        // console.log('fragment.duration=' + fragment.duration);
        // console.log('asset.duration=' + asset.duration);

        // Only trim video if it came from an actual source
        if (asset.hasVideo) {
          currentVideoStream.trim(
            fragment.trimLeft,
            fragment.trimLeft + fragment.duration,
          );
        }

        // Only trim audio if it came from an actual source
        if (asset.hasAudio) {
          currentAudioStream.trim(
            fragment.trimLeft,
            fragment.trimLeft + fragment.duration,
          );
        }
      }
      if (
        asset.duration === 0 &&
        fragment.duration > 0 &&
        asset.type === 'image'
      ) {
        // special case for images - extend static image to desired duration
        currentVideoStream.tPad({
          start: fragment.duration,
          startMode: 'clone',
        });
      }

      // stream normalization (only for actual video, not synthetic blank video)
      if (asset.hasVideo) {
        // fps reduction
        currentVideoStream.fps(this.output.fps);

        // fitting the video stream into the output frame
        if (fragment.objectFit === 'cover') {
          currentVideoStream.fitOutputCover(this.output.resolution);
        } else {
          const options: ObjectFitContainOptions = {};
          if (fragment.objectFitContain === AMBIENT) {
            options.ambient = {
              blurStrength: fragment.objectFitContainAmbientBlurStrength,
              brightness: fragment.objectFitContainAmbientBrightness,
              saturation: fragment.objectFitContainAmbientSaturation,
            };
          } else if (fragment.objectFitContain === PILLARBOX) {
            options.pillarbox = {
              color: fragment.objectFitContainPillarboxColor,
            };
          }
          currentVideoStream.fitOutputContain(this.output.resolution, options);
        }
      }

      // adding effects if needed (only for actual video, not synthetic blank video)
      if (asset.hasVideo) {
        // chromakey
        if (fragment.chromakey) {
          currentVideoStream.chromakey({
            blend: fragment.chromakeyBlend,
            similarity: fragment.chromakeySimilarity,
            color: fragment.chromakeyColor,
          });
        }
      }

      // transitions
      if (fragment.transitionIn === 'fade') {
        currentVideoStream.fade({
          fades: [
            {
              type: 'in',
              startTime: 0,
              duration: fragment.transitionInDuration,
            },
          ],
        });
        currentAudioStream.fade({
          fades: [
            {
              type: 'in',
              startTime: 0,
              duration: fragment.transitionInDuration,
            },
          ],
        });
      }
      if (fragment.transitionOut === 'fade') {
        currentVideoStream.fade({
          fades: [
            {
              type: 'out',
              startTime: fragment.duration - fragment.transitionOutDuration,
              duration: fragment.transitionOutDuration,
            },
          ],
        });
        currentAudioStream.fade({
          fades: [
            {
              type: 'out',
              startTime: fragment.duration - fragment.transitionOutDuration,
              duration: fragment.transitionOutDuration,
            },
          ],
        });
      }

      // console.log(
      //   'id=' +
      //     fragment.id +
      //     ' overlay=' +
      //     calculatedOverlayLeft +
      //     ' duration=' +
      //     fragment.duration,
      // );

      // merging to the main streams
      if (!firstOne) {
        // attach current streams to the main ones, depending on the stated overlap
        if (calculatedOverlayLeft === 0) {
          // just concat with the previous one, faster
          this.videoStream.concatStream(currentVideoStream);
          this.audioStream.concatStream(currentAudioStream);
        } else {
          const otherStreamOffsetLeft = this.time + calculatedOverlayLeft;

          // console.log('this.time=' + this.time);
          // console.log('streamDuration=' + this.time);
          // console.log('otherStreamDuration=' + fragment.duration);
          // console.log('otherStreamOffsetLeft=' + otherStreamOffsetLeft);

          // use overlay
          this.videoStream.overlayStream(currentVideoStream, {
            flipLayers: fragment.overlayZIndex < 0,
            offset: {
              streamDuration: this.time,
              otherStreamDuration: fragment.duration,
              otherStreamOffsetLeft: otherStreamOffsetLeft,
            },
          });
          this.audioStream.overlayStream(currentAudioStream, {
            offset: {
              streamDuration: this.time,
              otherStreamDuration: fragment.duration,
              otherStreamOffsetLeft: otherStreamOffsetLeft,
            },
          });
        }
      } else {
        // here an overlay can only be positive
        if (calculatedOverlayLeft > 0) {
          currentVideoStream.tPad({
            start: calculatedOverlayLeft,
            startMode: 'clone',
          });
          currentAudioStream.tPad({
            start: calculatedOverlayLeft,
            startMode: 'clone',
          });
        } else if (calculatedOverlayLeft < 0) {
          throw new Error(
            'overlay cannot be negative for the first fragment in a sequence (fragment id = ' +
              fragment.id +
              ')',
          );
        }

        // if (fragment.id === 'end_music') {
        //   console.log(
        //     this.expressionContext.fragments.get('ending_screen')!.time,
        //   );
        // }

        this.videoStream = currentVideoStream;
        this.audioStream = currentAudioStream;
      }

      timeContext.start = this.time + calculatedOverlayLeft;
      timeContext.end = this.time + fragment.duration + calculatedOverlayLeft;
      this.time += fragment.duration + calculatedOverlayLeft;

      this.expressionContext.fragments.set(fragment.id, {
        time: timeContext,
      });

      // console.log('new time=' + this.time);

      firstOne = false;
    });
  }

  overlayWith(sequence: Sequence) {
    this.videoStream.overlayStream(sequence.getVideoStream(), {});
    this.audioStream.overlayStream(sequence.getAudioStream(), {});
  }

  public getVideoStream(): Stream {
    return this.videoStream;
  }

  public getAudioStream(): Stream {
    return this.audioStream;
  }
}
