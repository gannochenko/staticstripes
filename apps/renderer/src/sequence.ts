import { AssetManager } from './project';
import {
  AMBIENT,
  FilterBuffer,
  makeStream,
  makeSilentStream,
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
  ) {}

  build() {
    let firstOne = true;
    this.definition.fragments.forEach((fragment) => {
      if (!fragment.enabled) {
        return;
      }

      const asset = this.assetManager.getAssetByName(fragment.assetName);
      if (!asset) {
        return;
      }

      const currentVideoStream = makeStream(
        this.assetManager.getVideoInputLabelByAssetName(fragment.assetName),
        this.buf,
      );

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
        console.log('fragment.trimLeft=' + fragment.trimLeft);
        console.log('fragment.duration=' + fragment.duration);
        console.log('asset.duration=' + asset.duration);
        currentVideoStream.trim(
          fragment.trimLeft,
          fragment.trimLeft + fragment.duration,
        );
        if (asset.hasAudio) {
          // Only trim if the audio came from an actual source
          currentAudioStream.trim(
            fragment.trimLeft,
            fragment.trimLeft + fragment.duration,
          );
        }
      }
      if (asset.duration === 0 && fragment.duration > 0) {
        // special case for images
        currentVideoStream.tPad({
          start: fragment.duration,
          startMode: 'clone',
        });
      }

      // stream normalization

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

      // adding effects if needed

      // chromakey
      if (fragment.chromakey) {
        currentVideoStream.chromakey({
          blend: fragment.chromakeyBlend,
          similarity: fragment.chromakeySimilarity,
          color: fragment.chromakeyColor,
        });
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

      // merging to the main streams
      if (!firstOne) {
        // attach current streams to the main ones, depending on the stated overlap
        if (fragment.overlayLeft === 0) {
          // just concat with the previous one, faster
          this.videoStream.concatStream(currentVideoStream);
          this.audioStream.concatStream(currentAudioStream);

          this.time += fragment.duration;
        } else {
          console.log('this.time=' + this.time);
          console.log('streamDuration=' + this.time);
          console.log('otherStreamDuration=' + fragment.duration);
          const otherStreamOffsetLeft = this.time + fragment.overlayLeft;
          console.log('otherStreamOffsetLeft=' + otherStreamOffsetLeft);

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

          this.time += fragment.duration + fragment.overlayLeft;
        }
      } else {
        this.videoStream = currentVideoStream;
        this.audioStream = currentAudioStream;
        this.time += fragment.duration;
      }

      console.log('new time=' + this.time);

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
