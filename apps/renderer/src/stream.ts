import { wrap } from 'module';
import {
  Filter,
  Label,
  makeNull,
  makeFps,
  makeTranspose,
  makeTrim,
} from './ffmpeg';

type Dimensions = {
  width: number;
  height: number;
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

  public rotate(angle: number): Stream {
    return this;
  }

  public scale(dimensions: Dimensions, way: string): Stream {
    return this;
  }

  public trim(start: number, end: number): Stream {
    const res = makeTrim([this.looseEnd], start, end);
    this.looseEnd = res.outputs[0];

    this.buf.append(res);

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
