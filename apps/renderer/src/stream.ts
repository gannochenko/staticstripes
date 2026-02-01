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
  makeVignette,
  makeColorBalance,
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

export enum VisualFilter {
  InstagramClarendon = 'instagram-clarendon',
  InstagramGingham = 'instagram-gingham',
  InstagramJuno = 'instagram-juno',
  InstagramLark = 'instagram-lark',
  InstagramLudwig = 'instagram-ludwig',
  InstagramNashville = 'instagram-nashville',
  InstagramValencia = 'instagram-valencia',
  InstagramXProII = 'instagram-xpro2',
  InstagramWillow = 'instagram-willow',
  InstagramLoFi = 'instagram-lofi',
  InstagramInkwell = 'instagram-inkwell',
  InstagramMoon = 'instagram-moon',
  InstagramHudson = 'instagram-hudson',
  InstagramToaster = 'instagram-toaster',
  InstagramWalden = 'instagram-walden',
  InstagramRise = 'instagram-rise',
  InstagramAmaro = 'instagram-amaro',
  InstagramMayfair = 'instagram-mayfair',
  InstagramEarlybird = 'instagram-earlybird',
  InstagramSutro = 'instagram-sutro',
  InstagramAden = 'instagram-aden',
  InstagramCrema = 'instagram-crema',
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

export function makeSilentStream(
  duration: Millisecond,
  buf: FilterBuffer,
): Stream {
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
  const filter = makeColor({
    duration,
    width,
    height,
    fps,
    color: '#00000000',
  });
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

  /**
   * Applies an Instagram-style filter to the video stream
   * @param filterName - The filter to apply
   */
  public filter(filterName: VisualFilter): Stream {
    if (this.looseEnd.isAudio) {
      throw new Error('filter() can only be applied to video streams');
    }

    switch (filterName) {
      case VisualFilter.InstagramClarendon:
        // Brightens, increases contrast and saturation
        const clarendonEq = makeEq([this.looseEnd], {
          contrast: 1.2,
          brightness: 0.1,
          saturation: 1.3,
        });
        this.looseEnd = clarendonEq.outputs[0];
        this.buf.append(clarendonEq);
        break;

      case VisualFilter.InstagramGingham:
        // Vintage washed-out look
        const ginghamEq = makeEq([this.looseEnd], {
          saturation: 0.6,
          brightness: 0.05,
        });
        this.looseEnd = ginghamEq.outputs[0];
        this.buf.append(ginghamEq);

        const ginghamBalance = makeColorBalance([this.looseEnd], {
          rm: 0.1,
          bm: 0.05,
        });
        this.looseEnd = ginghamBalance.outputs[0];
        this.buf.append(ginghamBalance);
        break;

      case VisualFilter.InstagramJuno:
        // High contrast, saturated, cool tones
        const junoEq = makeEq([this.looseEnd], {
          contrast: 1.3,
          saturation: 1.4,
        });
        this.looseEnd = junoEq.outputs[0];
        this.buf.append(junoEq);

        const junoBalance = makeColorBalance([this.looseEnd], {
          bh: 0.15,
          gh: 0.1,
        });
        this.looseEnd = junoBalance.outputs[0];
        this.buf.append(junoBalance);
        break;

      case VisualFilter.InstagramLark:
        // Brightens, desaturated, cool tones
        const larkEq = makeEq([this.looseEnd], {
          brightness: 0.15,
          saturation: 0.7,
        });
        this.looseEnd = larkEq.outputs[0];
        this.buf.append(larkEq);

        const larkBalance = makeColorBalance([this.looseEnd], {
          bm: 0.1,
        });
        this.looseEnd = larkBalance.outputs[0];
        this.buf.append(larkBalance);
        break;

      case VisualFilter.InstagramLudwig:
        // Cool tones, subtle vignette
        const ludwigBalance = makeColorBalance([this.looseEnd], {
          bm: 0.08,
          bs: 0.05,
        });
        this.looseEnd = ludwigBalance.outputs[0];
        this.buf.append(ludwigBalance);

        const ludwigVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4',
        });
        this.looseEnd = ludwigVignette.outputs[0];
        this.buf.append(ludwigVignette);
        break;

      case VisualFilter.InstagramNashville:
        // Warm vintage, pink tint, vignette
        const nashvilleBalance = makeColorBalance([this.looseEnd], {
          rm: 0.2,
          rh: 0.1,
          bm: -0.1,
        });
        this.looseEnd = nashvilleBalance.outputs[0];
        this.buf.append(nashvilleBalance);

        const nashvilleEq = makeEq([this.looseEnd], {
          contrast: 0.9,
          saturation: 1.2,
        });
        this.looseEnd = nashvilleEq.outputs[0];
        this.buf.append(nashvilleEq);

        const nashvilleVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4.5',
        });
        this.looseEnd = nashvilleVignette.outputs[0];
        this.buf.append(nashvilleVignette);
        break;

      case VisualFilter.InstagramValencia:
        // Warm tones, slight fade
        const valenciaBalance = makeColorBalance([this.looseEnd], {
          rm: 0.15,
          gm: 0.05,
        });
        this.looseEnd = valenciaBalance.outputs[0];
        this.buf.append(valenciaBalance);

        const valenciaEq = makeEq([this.looseEnd], {
          contrast: 0.95,
          brightness: 0.05,
        });
        this.looseEnd = valenciaEq.outputs[0];
        this.buf.append(valenciaEq);
        break;

      case VisualFilter.InstagramXProII:
        // High contrast, warm highlights, cool shadows, vignette
        const xproBalance = makeColorBalance([this.looseEnd], {
          rh: 0.2,
          bs: 0.15,
        });
        this.looseEnd = xproBalance.outputs[0];
        this.buf.append(xproBalance);

        const xproEq = makeEq([this.looseEnd], {
          contrast: 1.4,
          saturation: 1.2,
        });
        this.looseEnd = xproEq.outputs[0];
        this.buf.append(xproEq);

        const xproVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4',
        });
        this.looseEnd = xproVignette.outputs[0];
        this.buf.append(xproVignette);
        break;

      case VisualFilter.InstagramWillow:
        // Black and white-ish, desaturated, slight yellow tint
        const willowEq = makeEq([this.looseEnd], {
          saturation: 0.2,
          brightness: 0.05,
        });
        this.looseEnd = willowEq.outputs[0];
        this.buf.append(willowEq);

        const willowBalance = makeColorBalance([this.looseEnd], {
          rm: 0.05,
          gm: 0.05,
        });
        this.looseEnd = willowBalance.outputs[0];
        this.buf.append(willowBalance);
        break;

      case VisualFilter.InstagramLoFi:
        // High contrast, high saturation, vignette
        const lofiEq = makeEq([this.looseEnd], {
          contrast: 1.5,
          saturation: 1.4,
        });
        this.looseEnd = lofiEq.outputs[0];
        this.buf.append(lofiEq);

        const lofiVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4',
        });
        this.looseEnd = lofiVignette.outputs[0];
        this.buf.append(lofiVignette);
        break;

      case VisualFilter.InstagramInkwell:
        // Classic black and white
        const inkwellEq = makeEq([this.looseEnd], {
          saturation: 0,
          contrast: 1.1,
        });
        this.looseEnd = inkwellEq.outputs[0];
        this.buf.append(inkwellEq);
        break;

      case VisualFilter.InstagramMoon:
        // Black and white with high contrast and cool tone
        const moonEq = makeEq([this.looseEnd], {
          saturation: 0,
          contrast: 1.4,
          brightness: -0.05,
        });
        this.looseEnd = moonEq.outputs[0];
        this.buf.append(moonEq);

        const moonBalance = makeColorBalance([this.looseEnd], {
          bs: 0.1,
          bm: 0.08,
        });
        this.looseEnd = moonBalance.outputs[0];
        this.buf.append(moonBalance);

        const moonVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4.5',
        });
        this.looseEnd = moonVignette.outputs[0];
        this.buf.append(moonVignette);
        break;

      case VisualFilter.InstagramHudson:
        // Cool tones, high contrast, vignette
        const hudsonBalance = makeColorBalance([this.looseEnd], {
          bm: 0.2,
          bs: 0.15,
        });
        this.looseEnd = hudsonBalance.outputs[0];
        this.buf.append(hudsonBalance);

        const hudsonEq = makeEq([this.looseEnd], {
          contrast: 1.3,
        });
        this.looseEnd = hudsonEq.outputs[0];
        this.buf.append(hudsonEq);

        const hudsonVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4.5',
        });
        this.looseEnd = hudsonVignette.outputs[0];
        this.buf.append(hudsonVignette);
        break;

      case VisualFilter.InstagramToaster:
        // Warm tones, vignette
        const toasterBalance = makeColorBalance([this.looseEnd], {
          rm: 0.25,
          rh: 0.15,
        });
        this.looseEnd = toasterBalance.outputs[0];
        this.buf.append(toasterBalance);

        const toasterEq = makeEq([this.looseEnd], {
          contrast: 1.2,
        });
        this.looseEnd = toasterEq.outputs[0];
        this.buf.append(toasterEq);

        const toasterVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4',
        });
        this.looseEnd = toasterVignette.outputs[0];
        this.buf.append(toasterVignette);
        break;

      case VisualFilter.InstagramWalden:
        // Increased exposure, yellow tones
        const waldenBalance = makeColorBalance([this.looseEnd], {
          rm: 0.1,
          gm: 0.1,
        });
        this.looseEnd = waldenBalance.outputs[0];
        this.buf.append(waldenBalance);

        const waldenEq = makeEq([this.looseEnd], {
          brightness: 0.15,
          saturation: 1.1,
        });
        this.looseEnd = waldenEq.outputs[0];
        this.buf.append(waldenEq);
        break;

      case VisualFilter.InstagramRise:
        // Soft, warm glow
        const riseBalance = makeColorBalance([this.looseEnd], {
          rm: 0.12,
          rh: 0.08,
        });
        this.looseEnd = riseBalance.outputs[0];
        this.buf.append(riseBalance);

        const riseEq = makeEq([this.looseEnd], {
          brightness: 0.1,
          contrast: 0.9,
          saturation: 1.15,
        });
        this.looseEnd = riseEq.outputs[0];
        this.buf.append(riseEq);
        break;

      case VisualFilter.InstagramAmaro:
        // Increases contrast, adds vignette, cool tone
        const amaroBalance = makeColorBalance([this.looseEnd], {
          bm: 0.1,
        });
        this.looseEnd = amaroBalance.outputs[0];
        this.buf.append(amaroBalance);

        const amaroEq = makeEq([this.looseEnd], {
          contrast: 1.3,
          saturation: 1.2,
        });
        this.looseEnd = amaroEq.outputs[0];
        this.buf.append(amaroEq);

        const amaroVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4.5',
        });
        this.looseEnd = amaroVignette.outputs[0];
        this.buf.append(amaroVignette);
        break;

      case VisualFilter.InstagramMayfair:
        // Warm center, cool edges, vignette
        const mayfairBalance = makeColorBalance([this.looseEnd], {
          rh: 0.15,
          bs: 0.1,
        });
        this.looseEnd = mayfairBalance.outputs[0];
        this.buf.append(mayfairBalance);

        const mayfairEq = makeEq([this.looseEnd], {
          contrast: 1.1,
          saturation: 1.15,
        });
        this.looseEnd = mayfairEq.outputs[0];
        this.buf.append(mayfairEq);

        const mayfairVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4',
        });
        this.looseEnd = mayfairVignette.outputs[0];
        this.buf.append(mayfairVignette);
        break;

      case VisualFilter.InstagramEarlybird:
        // Vintage sepia, vignette
        const earlybirdBalance = makeColorBalance([this.looseEnd], {
          rm: 0.2,
          gm: 0.1,
          bm: -0.15,
        });
        this.looseEnd = earlybirdBalance.outputs[0];
        this.buf.append(earlybirdBalance);

        const earlybirdEq = makeEq([this.looseEnd], {
          contrast: 1.2,
          saturation: 1.1,
        });
        this.looseEnd = earlybirdEq.outputs[0];
        this.buf.append(earlybirdEq);

        const earlybirdVignette = makeVignette([this.looseEnd], {
          angle: 'PI/4',
        });
        this.looseEnd = earlybirdVignette.outputs[0];
        this.buf.append(earlybirdVignette);
        break;

      case VisualFilter.InstagramSutro:
        // Muted colors, purple/brown tint, vignette
        const sutroBalance = makeColorBalance([this.looseEnd], {
          rm: 0.1,
          bm: 0.15,
        });
        this.looseEnd = sutroBalance.outputs[0];
        this.buf.append(sutroBalance);

        const sutroEq = makeEq([this.looseEnd], {
          saturation: 0.8,
          contrast: 1.2,
        });
        this.looseEnd = sutroEq.outputs[0];
        this.buf.append(sutroEq);

        const sutroVignette = makeVignette([this.looseEnd], {
          angle: 'PI/3.5',
        });
        this.looseEnd = sutroVignette.outputs[0];
        this.buf.append(sutroVignette);
        break;

      case VisualFilter.InstagramAden:
        // Muted, cool tones, slight vignette
        const adenBalance = makeColorBalance([this.looseEnd], {
          bm: 0.12,
        });
        this.looseEnd = adenBalance.outputs[0];
        this.buf.append(adenBalance);

        const adenEq = makeEq([this.looseEnd], {
          saturation: 0.85,
          brightness: 0.08,
        });
        this.looseEnd = adenEq.outputs[0];
        this.buf.append(adenEq);

        const adenVignette = makeVignette([this.looseEnd], {
          angle: 'PI/5',
        });
        this.looseEnd = adenVignette.outputs[0];
        this.buf.append(adenVignette);
        break;

      case VisualFilter.InstagramCrema:
        // Creamy warmth, slight vignette
        const cremaBalance = makeColorBalance([this.looseEnd], {
          rm: 0.08,
          gm: 0.05,
        });
        this.looseEnd = cremaBalance.outputs[0];
        this.buf.append(cremaBalance);

        const cremaEq = makeEq([this.looseEnd], {
          brightness: 0.05,
          contrast: 0.95,
        });
        this.looseEnd = cremaEq.outputs[0];
        this.buf.append(cremaEq);

        const cremaVignette = makeVignette([this.looseEnd], {
          angle: 'PI/5',
        });
        this.looseEnd = cremaVignette.outputs[0];
        this.buf.append(cremaVignette);
        break;

      default:
        throw new Error(`Unknown Instagram filter: ${filterName}`);
    }

    return this;
  }

  public getLooseEnd(): Label {
    return this.looseEnd;
  }

  public render(): string {
    return this.buf.render();
  }
}
