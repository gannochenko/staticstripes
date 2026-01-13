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
  makeFade,
  makeColorkey,
  makeSetpts,
  makeCrop,
  makeFormat,
  makeTranspose,
  makeHflip,
  makeVflip,
} from './filtercomplex.js';

export const makeStream = (inputLabel: string) => {
  return new StreamDAG().from(inputLabel);
};

/**
 * Creates a new stream by concatenating multiple streams
 * Creates a new DAG, appends all input streams, then concatenates them
 * @param streams - Array of StreamBuilder instances to concatenate
 * @returns A new StreamBuilder representing the concatenated result
 */
export const startStreamWithConcat = (streams: StreamBuilder[]): StreamBuilder => {
  if (streams.length === 0) {
    throw new Error('startStreamWithConcat requires at least one stream');
  }

  if (streams.length === 1) {
    // Single stream, just return a copy in a new DAG
    const newDag = new StreamDAG();
    newDag.appendStreams([streams[0]]);
    return newDag.from(streams[0].getLooseLabel());
  }

  // Create a new DAG and append all input streams
  const newDag = new StreamDAG();
  newDag.appendStreams(streams);

  // Get labels from all streams
  const inputLabels = streams.map((s) => s.getLooseLabel());

  // Create output label
  const outputLabel = newDag.makeLabel();

  // Add concat filter
  newDag.add(makeConcat(inputLabels, outputLabel));

  // Return StreamBuilder for the concatenated result
  return newDag.from(outputLabel);
};

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
   * Returns the underlying DAG
   */
  getDAG(): StreamDAG {
    return this.dag;
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
   * Scale with aspect ratio preservation (fit within bounds, letterbox if needed)
   */
  scaleContain(width: number, height: number): StreamBuilder {
    // Scale to fit within bounds, preserving aspect ratio
    // force_original_aspect_ratio=decrease ensures it fits within the box
    // Then pad to exact dimensions with black bars
    const scaledLabel = this.dag.makeLabel();
    const paddedLabel = this.dag.makeLabel();

    // Scale with aspect ratio preservation
    this.dag.add(
      makeScale(this.looseLabel, scaledLabel, {
        width: `${width}`,
        height: `${height}:force_original_aspect_ratio=decrease`,
      }),
    );

    // Pad to exact dimensions (centered)
    this.dag.add({
      inputs: [scaledLabel],
      outputs: [paddedLabel],
      render: () =>
        `[${scaledLabel}]pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[${paddedLabel}]`,
    });

    return new StreamBuilder(this.dag, paddedLabel);
  }

  /**
   * Scale with aspect ratio preservation (fill bounds, crop if needed)
   */
  scaleCover(width: number, height: number): StreamBuilder {
    // Scale to fill bounds, preserving aspect ratio
    // force_original_aspect_ratio=increase ensures it fills the box
    // Then crop to exact dimensions (centered)
    const scaledLabel = this.dag.makeLabel();
    const croppedLabel = this.dag.makeLabel();

    // Scale with aspect ratio preservation
    this.dag.add(
      makeScale(this.looseLabel, scaledLabel, {
        width: `${width}`,
        height: `${height}:force_original_aspect_ratio=increase`,
      }),
    );

    // Crop to exact dimensions (centered using expressions)
    this.dag.add({
      inputs: [scaledLabel],
      outputs: [croppedLabel],
      render: () =>
        `[${scaledLabel}]crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2[${croppedLabel}]`,
    });

    return new StreamBuilder(this.dag, croppedLabel);
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

  /**
   * Concatenates multiple streams with both video and audio
   * @param dag - Target DAG
   * @param streams - Array of StreamBuilder instances (must have both video and audio)
   * @param outputs - Array of output labels [videoOut, audioOut]
   * @returns Array of StreamBuilders [video, audio]
   */
  static concatVideoAudio(
    dag: StreamDAG,
    streams: StreamBuilder[],
    outputs?: [string, string],
  ): [StreamBuilder, StreamBuilder] {
    const [videoOut, audioOut] = outputs ?? [dag.makeLabel(), dag.makeLabel()];
    const inputs = streams.map((s) => s.getLooseLabel());

    dag.add(
      makeConcat(inputs, [videoOut, audioOut], {
        videoStreams: 1,
        audioStreams: 1,
      }),
    );

    return [new StreamBuilder(dag, videoOut), new StreamBuilder(dag, audioOut)];
  }
}
