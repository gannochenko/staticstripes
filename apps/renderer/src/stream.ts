import { wrap } from 'module';
import {
  Filter,
  Label,
  makeNull,
  makeFps,
  makeTranspose,
  makeTrim,
  makeHflip,
  makeVflip,
  makeScale,
  makePad,
  makeGblur,
  makeCrop,
  makeSplit,
  makeOverlay,
  makeEq,
} from './ffmpeg';

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

export class FilterBuffer {
  private filters: Filter[] = [];

  public append(filter: Filter) {
    this.filters.push(filter);
  }

  public render(): string {
    return this.filters.map((filter) => filter.render()).join(';');
  }
}

export function makeStream(label: Label, buf?: FilterBuffer): Stream {
  return new Stream(label, buf);
}

class Stream {
  private finished = false;
  private buf: FilterBuffer;

  constructor(
    private looseEnd: Label,
    fBuf?: FilterBuffer,
  ) {
    this.buf = fBuf ?? new FilterBuffer();
  }

  public trim(start: number, end: number): Stream {
    const res = makeTrim([this.looseEnd], start, end);
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

    return this;
  }

  public fitOutput(dimensions: Dimensions): Stream {
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

  public coverOutput(dimensions: Dimensions): Stream {
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

  /**
   * Creates the "blurred background" effect:
   * - Background: blurred + darkened version that covers the entire output
   * - Foreground: original video fitted with aspect ratio preserved
   * @param dimensions - Target output dimensions
   * @param options - Effect parameters
   */
  public fitOutputV2(
    dimensions: Dimensions,
    options: {
      ambient: {
        blurStrength?: number; // Gaussian blur sigma (default: 20)
        brightness?: number; // Background brightness reduction (default: -0.3)
        saturation?: number; // Background saturation (default: 0.8)
      };
    } = {
      ambient: {},
    },
  ): Stream {
    const blurStrength = options.ambient.blurStrength ?? 20;
    const brightness = options.ambient.brightness ?? -0.3;
    const saturation = options.ambient.saturation ?? 0.8;

    // // Split input into 2 streams: background and foreground
    // const splitRes = makeSplit([this.looseEnd]);
    // this.buf.append(splitRes);

    // const [bgLabel, fgLabel] = splitRes.outputs;

    // // Background stream: cover + blur + darken
    const bgScaleRes = makeScale([this.looseEnd], {
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

    const bgEqRes = makeEq(bgBlurRes.outputs, {
      brightness,
      saturation,
    });
    this.buf.append(bgEqRes);

    ////////////////////////////////////////////////////////////////////////////////////

    // const fgScale = makeScale([this.looseEnd], {
    //   width: dimensions.width,
    //   height: dimensions.height,
    //   flags: 'force_original_aspect_ratio=decrease',
    // });
    // this.buf.append(fgScale);

    // // Step 2: Pad to exact dimensions with black bars (centered)
    // const fgPad = makePad(fgScale.outputs, {
    //   width: dimensions.width,
    //   height: dimensions.height,
    //   color: '#ffffff',
    //   // x and y default to '(ow-iw)/2' and '(oh-ih)/2' which centers the video
    // });
    // this.buf.append(fgPad);

    ////////////////////////////////////////////////////////////////////////////////////

    // // Overlay foreground centered on background
    // // (W-w)/2 and (H-h)/2 center the overlay on the background
    // const overlayRes = makeOverlay([bgEqRes.outputs[0], fgScaleRes.outputs[0]], {
    //   x: '(W-w)/2',
    //   y: '(H-h)/2',
    // });
    // this.buf.append(overlayRes);

    this.looseEnd = bgEqRes.outputs[0];

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

  public endTo(label: Label): Stream {
    const res = makeNull([this.looseEnd]);
    res.outputs[0] = label;
    this.buf.append(res);
    this.finished = true;

    return this;
  }

  public render(): string {
    return this.buf.render();
  }
}
