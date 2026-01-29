import {
  Filter,
  Label,
  Millisecond,
  makeNull,
  makeFps,
  makeTranspose,
  makeTrim,
  makeTPad,
  makeHflip,
  makeVflip,
  makeScale,
  makePad,
  makeGblur,
  makeCrop,
  makeSplit,
  makeOverlay,
  makeEq,
  makeChromakey,
  makeConcat,
  makeFade,
  makeAmix,
  makeAnullsrc,
  makeColor,
} from './ffmpeg';

export const PILLARBOX = 'pillarbox';
export const AMBIENT = 'ambient';

type Dimensions = {
  width: number;
  height: number;
};

export enum Direction {
  CW,
  CW2,
  CCW,
  CCW2,
}

export enum ChromakeySimilarity {
  Strict = 0.1,
  Good = 0.3,
  Forgiving = 0.5,
  Loose = 0.7,
}

export enum ChromakeyBlend {
  Hard = 0.0,
  Smooth = 0.1,
  Soft = 0.2,
}

export enum Colors {
  Transparent = '#00000000',
}

export type ObjectFitContainOptions = {
  ambient?: {
    blurStrength?: number; // Gaussian blur sigma (default: 20)
    brightness?: number; // Background brightness reduction (default: -0.3)
    saturation?: number; // Background saturation (default: 0.8)
  };
  pillarbox?: {
    color: string;
  };
};

export class FilterBuffer {
  private filters: Filter[] = [];

  public append(filter: Filter) {
    this.filters.push(filter);
  }

  public render(): string {
    return this.filters.map((filter) => filter.render()).join(';');
  }
}

export function makeStream(label: Label, buf: FilterBuffer): Stream {
  return new Stream(label, buf);
}

export function makeSilentStream(duration: Millisecond, buf: FilterBuffer): Stream {
  const filter = makeAnullsrc({ duration });
  buf.append(filter);
  return new Stream(filter.outputs[0], buf);
}

export function makeBlankStream(
  duration: Millisecond,
  width: number,
  height: number,
  fps: number,
  buf: FilterBuffer,
): Stream {
  const filter = makeColor({ duration, width, height, fps, color: '#00000000' });
  buf.append(filter);
  return new Stream(filter.outputs[0], buf);
}

export class Stream {
  constructor(
    private looseEnd: Label,
    private buf: FilterBuffer,
  ) {}

  public trim(start: Millisecond, end: Millisecond): Stream {
    const res = makeTrim([this.looseEnd], start, end);
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  public fitOutputSimple(dimensions: Dimensions): Stream {
    // Step 1: Scale video to fit within dimensions while maintaining aspect ratio
    // Using 'force_original_aspect_ratio=decrease' ensures the video fits inside the box
    const scaleRes = makeScale([this.looseEnd], {
      width: dimensions.width,
      height: dimensions.height,
      flags: 'force_original_aspect_ratio=decrease',
    });
    this.looseEnd = scaleRes.outputs[0];
    this.buf.append(scaleRes);

    // Step 2: Pad to exact dimensions with black bars (centered)
    const padRes = makePad([this.looseEnd], {
      width: dimensions.width,
      height: dimensions.height,
      // x and y default to '(ow-iw)/2' and '(oh-ih)/2' which centers the video
    });
    this.looseEnd = padRes.outputs[0];
    this.buf.append(padRes);

    return this;
  }

  public fitOutputCover(dimensions: Dimensions): Stream {
    // Step 1: Scale video to cover dimensions while maintaining aspect ratio
    // Using 'force_original_aspect_ratio=increase' ensures the video fills the entire box
    const scaleRes = makeScale([this.looseEnd], {
      width: dimensions.width,
      height: dimensions.height,
      flags: 'force_original_aspect_ratio=increase',
    });
    this.looseEnd = scaleRes.outputs[0];
    this.buf.append(scaleRes);

    // Step 2: Crop to exact dimensions (centered)
    const cropRes = makeCrop([this.looseEnd], {
      width: dimensions.width,
      height: dimensions.height,
      // x and y default to '(in_w-out_w)/2' and '(in_h-out_h)/2' which centers the crop
    });
    this.looseEnd = cropRes.outputs[0];
    this.buf.append(cropRes);

    return this;
  }

  public fitOutputContain(
    dimensions: Dimensions,
    options: ObjectFitContainOptions = {},
  ): Stream {
    if (options.ambient) {
      const blurStrength = options.ambient?.blurStrength ?? 20;
      const brightness = options.ambient?.brightness ?? -0.3;
      const saturation = options.ambient?.saturation ?? 0.8;

      // Split input into 2 streams: background and foreground
      const splitRes = makeSplit([this.looseEnd]);
      this.buf.append(splitRes);

      const [bgLabel, fgLabel] = splitRes.outputs;

      // // Background stream: cover + blur + darken
      const bgScaleRes = makeScale([bgLabel], {
        width: dimensions.width,
        height: dimensions.height,
        flags: 'force_original_aspect_ratio=increase',
      });
      this.buf.append(bgScaleRes);

      const bgCropRes = makeCrop(bgScaleRes.outputs, {
        width: dimensions.width,
        height: dimensions.height,
      });
      this.buf.append(bgCropRes);

      const bgBlurRes = makeGblur(bgCropRes.outputs, {
        sigma: blurStrength,
        steps: 2,
      });
      this.buf.append(bgBlurRes);

      const bgFinal = makeEq(bgBlurRes.outputs, {
        brightness,
        saturation,
      });
      this.buf.append(bgFinal);

      ////////////////////////////////////////////////////////////////////////////////////

      const fgScale = makeScale([fgLabel], {
        width: dimensions.width,
        height: dimensions.height,
        flags: 'force_original_aspect_ratio=decrease',
      });
      this.buf.append(fgScale);

      // Step 2: Pad to exact dimensions with black bars (centered)
      const fgFinal = makePad(fgScale.outputs, {
        width: dimensions.width,
        height: dimensions.height,
        color: '#00000000', // transparent
        // x and y default to '(ow-iw)/2' and '(oh-ih)/2' which centers the video
      });
      this.buf.append(fgFinal);

      ////////////////////////////////////////////////////////////////////////////////////

      // Overlay foreground centered on background
      // (W-w)/2 and (H-h)/2 center the overlay on the background
      const overlayRes = makeOverlay([bgFinal.outputs[0], fgFinal.outputs[0]], {
        x: '(W-w)/2',
        y: '(H-h)/2',
      });
      this.buf.append(overlayRes);

      this.looseEnd = overlayRes.outputs[0];
    } else {
      // usual pillarbox
      const color = options?.pillarbox?.color ?? '#000000';

      const scaleRes = makeScale([this.looseEnd], {
        width: dimensions.width,
        height: dimensions.height,
        flags: 'force_original_aspect_ratio=decrease',
      });
      this.looseEnd = scaleRes.outputs[0];
      this.buf.append(scaleRes);

      // Step 2: Pad to exact dimensions with black bars (centered)
      const padRes = makePad([this.looseEnd], {
        width: dimensions.width,
        height: dimensions.height,
        color: color,
        // x and y default to '(ow-iw)/2' and '(oh-ih)/2' which centers the video
      });
      this.looseEnd = padRes.outputs[0];
      this.buf.append(padRes);
    }

    return this;
  }

  public chromakey(parameters: {
    color: string;
    similarity?: number | ChromakeySimilarity;
    blend?: number | ChromakeyBlend;
  }): Stream {
    // Apply chromakey filter
    const chromakeyRes = makeChromakey([this.looseEnd], {
      color: parameters.color,
      similarity: parameters.similarity,
      blend: parameters.blend,
    });
    this.looseEnd = chromakeyRes.outputs[0];
    this.buf.append(chromakeyRes);

    return this;
  }

  public fps(value: number): Stream {
    const res = makeFps([this.looseEnd], value);
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  public blur(strength: number): Stream {
    const res = makeGblur([this.looseEnd], {
      sigma: strength,
    });
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  public fade(options: {
    fades: Array<{
      type: 'in' | 'out';
      startTime: Millisecond;
      duration: Millisecond;
      color?: string;
      curve?: string;
    }>;
  }): Stream {
    const res = makeFade([this.looseEnd], options);
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  public transpose(value: 0 | 1 | 2 | 3): Stream {
    const res = makeTranspose([this.looseEnd], value);
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  public cwRotate(direction: Direction): Stream {
    switch (direction) {
      case Direction.CW:
        // 90° clockwise: transpose=1
        this.transpose(1);
        break;

      case Direction.CCW:
        // 90° counterclockwise: transpose=2
        this.transpose(2);
        break;

      case Direction.CW2:
      case Direction.CCW2:
        // 180° rotation (same for both directions): hflip + vflip
        const hflipRes = makeHflip([this.looseEnd]);
        this.looseEnd = hflipRes.outputs[0];
        this.buf.append(hflipRes);

        const vflipRes = makeVflip([this.looseEnd]);
        this.looseEnd = vflipRes.outputs[0];
        this.buf.append(vflipRes);
        break;
    }

    return this;
  }

  public concatStream(stream: Stream): Stream {
    return this.concatStreams([stream]);
  }

  public concatStreams(streams: Stream[]): Stream {
    // todo: check streams type here, it can either be all audio or all video

    const res = makeConcat([
      this.looseEnd,
      ...streams.map((st) => st.getLooseEnd()),
    ]);
    this.looseEnd = res.outputs[0];

    if (res.outputs.length > 1) {
      throw new Error(
        'concat produced several outputs, possible mixup between video and audio streams',
      );
    }

    this.buf.append(res);

    return this;
  }

  public mixStream(
    stream: Stream,
    options?: {
      duration?: 'longest' | 'shortest' | 'first';
      dropout_transition?: number;
      weights?: number[];
      normalize?: boolean;
    },
  ): Stream {
    return this.mixStreams([stream], options);
  }

  public mixStreams(
    streams: Stream[],
    options?: {
      duration?: 'longest' | 'shortest' | 'first';
      dropout_transition?: number;
      weights?: number[];
      normalize?: boolean;
    },
  ): Stream {
    const res = makeAmix(
      [this.looseEnd, ...streams.map((st) => st.getLooseEnd())],
      options,
    );
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  public tPad(
    options: {
      start?: Millisecond;
      stop?: Millisecond;
      color?: string;
      startMode?: 'clone' | 'add';
      stopMode?: 'clone' | 'add';
    } = {},
  ): Stream {
    const res = makeTPad([this.looseEnd], options);
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  /*
  this stream becomes the bottom layer, and the joining stream - top layer
  For video: uses overlay filter
  For audio: uses amix filter
  */
  public overlayStream(
    stream: Stream,
    options: {
      flipLayers?: boolean;
      offset?: {
        streamDuration: number; // duration of this stream
        otherStreamDuration: number; // duration of the joining stream
        otherStreamOffsetLeft: number; // offset of the joining stream in seconds
      };
    },
  ): Stream {
    const offset = options.offset;
    const flip = !!options.flipLayers;
    const isAudio = this.looseEnd.isAudio;

    // Validate that both streams are of the same type
    if (isAudio !== stream.getLooseEnd().isAudio) {
      throw new Error(
        'overlayStream: both streams must be of the same type (both video or both audio)',
      );
    }

    if (!offset || !offset.otherStreamOffsetLeft) {
      // usual overlay/mix, no offset
      if (isAudio) {
        const res = makeAmix([this.looseEnd, stream.getLooseEnd()]);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
      } else {
        const res = makeOverlay(
          flip
            ? [stream.getLooseEnd(), this.looseEnd]
            : [this.looseEnd, stream.getLooseEnd()],
        );
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
      }
    } else {
      if (offset.streamDuration === undefined) {
        throw new Error(
          'exact duration of the fragment in the stream must be provided',
        );
      }
      if (offset.otherStreamDuration === undefined) {
        throw new Error(
          'exact duration of the fragment in the joining stream must be provided',
        );
      }

      const offsetLeft = offset.otherStreamOffsetLeft;

      if (offsetLeft > 0) {
        // Pad the joining stream on the left
        stream.tPad({
          start: offsetLeft,
          ...(isAudio ? {} : { color: Colors.Transparent }),
        });

        // Pad the main stream on the right if needed
        const mainLeftover =
          offset.otherStreamDuration + offsetLeft - offset.streamDuration;
        if (mainLeftover > 0) {
          this.tPad({
            stop: mainLeftover,
            ...(isAudio ? {} : { color: Colors.Transparent }),
          });
        }

        // Mix or overlay the streams
        if (isAudio) {
          const res = makeAmix([this.looseEnd, stream.getLooseEnd()]);
          this.looseEnd = res.outputs[0];
          this.buf.append(res);
        } else {
          const overlayRes = makeOverlay(
            flip
              ? [stream.getLooseEnd(), this.looseEnd]
              : [this.looseEnd, stream.getLooseEnd()],
          );
          this.looseEnd = overlayRes.outputs[0];
          this.buf.append(overlayRes);
        }
      } else if (offsetLeft < 0) {
        throw new Error('negative offset is not supported for overlayStream');
      }
    }

    return this;
  }

  public endTo(label: Label): Stream {
    const res = makeNull([this.looseEnd]);
    res.outputs[0] = label;
    this.buf.append(res);

    return this;
  }

  public getLooseEnd(): Label {
    return this.looseEnd;
  }

  public render(): string {
    return this.buf.render();
  }
}
