import { StreamDAG } from './dag.js';
import {
  makeScale,
  makeFps,
  makeCopy,
  makeConcat,
  makeXFade,
  makeOverlay,
  makeSplit,
  makeGblur,
  makeEq,
  makeDrawtext,
  makeFade,
  makeColorkey,
  makeSetpts,
  makeCrop,
  makeFormat,
  makeTranspose,
  makeHflip,
  makeVflip,
} from './filtercomplex.js';

/**
 * StreamBuilder - Fluent API for building filter graphs
 *
 * Usage:
 *   dag.from('0:v')
 *      .scale({ width: 1920, height: 1080 })
 *      .fps(30)
 *      .label();
 */
export class StreamBuilder {
  constructor(
    private dag: StreamDAG,
    private looseLabel: string,
  ) {}

  /**
   * Returns the current stream label
   */
  getLooseLabel(): string {
    return this.looseLabel;
  }

  /**
   * Scale filter
   */
  scale(options: {
    width: number | string;
    height: number | string;
  }): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeScale(this.looseLabel, outputLabel, options));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * FPS normalization filter
   */
  fps(fps: number): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeFps(this.looseLabel, outputLabel, fps));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Copy/passthrough filter
   */
  copy(): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeCopy(this.looseLabel, outputLabel));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Copy to a specific output label (for final outputs)
   */
  copyTo(outputLabel: string): StreamBuilder {
    this.dag.add(makeCopy(this.looseLabel, outputLabel));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Gaussian blur filter
   */
  gblur(sigma: number): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeGblur(this.looseLabel, outputLabel, sigma));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Equalization filter
   */
  eq(options: { contrast?: number; brightness?: number }): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeEq(this.looseLabel, outputLabel, options));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Crop filter
   */
  crop(options: {
    width: number | string;
    height: number | string;
  }): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeCrop(this.looseLabel, outputLabel, options));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Format filter
   */
  format(format: string): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeFormat(this.looseLabel, outputLabel, format));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Fade filter
   */
  fade(options: {
    type: 'in' | 'out';
    start?: number;
    duration: number;
  }): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeFade(this.looseLabel, outputLabel, options));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Colorkey filter
   */
  colorkey(options: {
    color: string;
    similarity: number;
    blend: number;
  }): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeColorkey(this.looseLabel, outputLabel, options));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Setpts filter
   */
  setpts(expression: string): StreamBuilder {
    const output = this.dag.makeLabel();
    this.dag.add(makeSetpts(this.looseLabel, output, expression));
    return new StreamBuilder(this.dag, output);
  }

  /**
   * Overlay another stream on top of this one
   */
  overlay(
    otherStream: StreamBuilder,
    options?: { x?: string; y?: string; enable?: string },
  ): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(
      makeOverlay(
        this.looseLabel,
        otherStream.getLooseLabel(),
        outputLabel,
        options,
      ),
    );
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * XFade transition with another stream
   */
  xfade(
    otherStream: StreamBuilder,
    options: { duration: number; offset: number; transition?: string },
  ): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(
      makeXFade(
        this.looseLabel,
        otherStream.getLooseLabel(),
        outputLabel,
        options,
      ),
    );
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * XFade transition with another stream, outputting to a specific label
   */
  xfadeTo(
    otherStream: StreamBuilder,
    outputLabel: string,
    options: { duration: number; offset: number; transition?: string },
  ): StreamBuilder {
    this.dag.add(
      makeXFade(
        this.looseLabel,
        otherStream.getLooseLabel(),
        outputLabel,
        options,
      ),
    );
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Transpose filter
   */
  transpose(direction: 0 | 1 | 2 | 3): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeTranspose(this.looseLabel, outputLabel, direction));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Horizontal flip filter
   */
  hflip(): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeHflip(this.looseLabel, outputLabel));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Vertical flip filter
   */
  vflip(): StreamBuilder {
    const outputLabel = this.dag.makeLabel();
    this.dag.add(makeVflip(this.looseLabel, outputLabel));
    return new StreamBuilder(this.dag, outputLabel);
  }

  /**
   * Split this stream into multiple outputs for branching
   */
  split(count: number): MultiStreamBuilder {
    const outputLabels = Array.from({ length: count }, () =>
      this.dag.makeLabel(),
    );
    this.dag.add(makeSplit(this.looseLabel, outputLabels));
    return new MultiStreamBuilder(
      outputLabels.map((label) => new StreamBuilder(this.dag, label)),
    );
  }

  /**
   * Applies rotation correction based on metadata rotation
   * @param rotation - Rotation in degrees (0, 90, 180, 270)
   */
  correctRotation(rotation: number): StreamBuilder {
    if (rotation === 0) {
      return this; // No rotation needed
    }

    if (rotation === 90) {
      // 90° rotation -> transpose 2 (90° CCW)
      return this.transpose(2);
    }

    if (rotation === 180) {
      // 180° rotation -> hflip + vflip
      return this.hflip().vflip();
    }

    if (rotation === 270) {
      // 270° rotation -> transpose 1 (90° CW)
      return this.transpose(1);
    }

    // Unknown rotation, skip
    console.warn(`Unknown rotation value: ${rotation}°, skipping correction`);
    return this;
  }
}

/**
 * MultiStreamBuilder - Handles multiple streams from split operations
 */
export class MultiStreamBuilder {
  constructor(private streamBuilders: StreamBuilder[]) {}

  /**
   * Returns all stream builders as an array
   */
  getStreams(): StreamBuilder[] {
    return this.streamBuilders;
  }

  /**
   * Branch processing - applies a function to the streams and returns results
   */
  branch<T>(fn: (streams: StreamBuilder[]) => T): T {
    return fn(this.streamBuilders);
  }
}

/**
 * Static utility for concatenating multiple streams
 */
export class StreamUtils {
  static concat(
    dag: StreamDAG,
    streams: StreamBuilder[],
    outputLabel?: string,
  ): StreamBuilder {
    const output = outputLabel ?? dag.makeLabel();
    const inputs = streams.map((s) => s.getLooseLabel());
    dag.add(makeConcat(inputs, output));
    return new StreamBuilder(dag, output);
  }

  static concatTo(
    dag: StreamDAG,
    streams: StreamBuilder[],
    outputLabel: string,
  ): StreamBuilder {
    const inputs = streams.map((s) => s.getLooseLabel());
    dag.add(makeConcat(inputs, outputLabel));
    return new StreamBuilder(dag, outputLabel);
  }
}
