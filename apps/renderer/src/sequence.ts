import { AssetManager } from './project';
import {
  AMBIENT,
  FilterBuffer,
  makeStream,
  ObjectFitContainOptions,
  PILLARBOX,
  Stream,
} from './stream';
import { Output, SequenceDefinition } from './type';

// type FragmentLayout = {
//   duration: number;
//   trimStart: number;
//   trimEnd: number;
// };

// type Fragment = {
//   assetName: string;
//   duration: string | number;
//   trimStart?: string | number; // padding-left :)
//   layout?: FragmentLayout;
// };

export class Sequence {
  private time: number = 0; // time is absolute

  private initiailized = false;
  private videoStream: Stream;
  private audioStream: Stream;

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
      const currentAudioStream = makeStream(
        this.assetManager.getAudioInputLabelByAssetName(fragment.assetName),
        this.buf,
      );

      if (fragment.trimStart != 0 || fragment.duration < asset.duration) {
        currentVideoStream.trim(fragment.trimStart, fragment.duration);
        currentAudioStream.trim(fragment.trimStart, fragment.duration);
      }

      // must normalize fps and fit video into the output
      currentVideoStream.fps(this.output.fps);
      if (fragment.objectFit === 'cover') {
        currentVideoStream.fitOutputCover(this.output.resolution);
      } else {
        const options: ObjectFitContainOptions = {};
        if (fragment.objectFitContain === AMBIENT) {
          // todo: make configurable via CSS
          options.ambient = {
            blurStrength: 25,
            brightness: -0.1,
            saturation: 0.7,
          };
        } else if (fragment.objectFitContain === PILLARBOX) {
          // todo: make configurable via CSS
          options.pillarbox = {
            color: '#000000',
          };
        }
        currentVideoStream.fitOutputContain(this.output.resolution, options);
      }

      if (!firstOne) {
        // attach current streams to the main ones, depending on the stated overlap
        if (fragment.overlayLeft === 0) {
          // just concat with the previous one, faster
          this.videoStream.concatStream(currentVideoStream);
          this.audioStream.concatStream(currentAudioStream);

          this.time += fragment.duration;
        } else {
          // use overlay
        }
      }

      this.videoStream = currentVideoStream;
      this.audioStream = currentAudioStream;

      firstOne = false;
      this.initiailized = true;
    });
  }

  public getVideoStream(): Stream {
    return this.videoStream;
  }

  public getAudioStream(): Stream {
    return this.audioStream;
  }
}
