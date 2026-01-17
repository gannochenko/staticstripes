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

  public fps(value: number): Stream {
    const res = makeFps([this.looseEnd], value);
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
