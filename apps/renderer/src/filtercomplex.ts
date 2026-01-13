/**
 * FFmpeg filter factory functions and graph rendering
 */

export type Filter = {
  inputs: string[];
  outputs: string[]; // Array to support filters with multiple outputs (e.g., split)
  render: () => string;
};

/**
 * Wraps a label in brackets
 */
function wrap(label: string): string {
  return `[${label}]`;
}

/**
 * Creates a concat filter
 * @param inputs - Array of input stream labels (e.g., ['0:v', '0:a', '1:v', '1:a'] for n=2:v=1:a=1)
 * @param outputs - Array of output stream labels (length must equal videoStreams + audioStreams)
 * @param options - Optional parameters
 */
export function makeConcat(
  inputs: string[],
  outputs: string | string[],
  options?: {
    videoStreams?: number;
    audioStreams?: number;
  },
): Filter {
  const v = options?.videoStreams ?? 1;
  const a = options?.audioStreams ?? 0;
  const totalOutputs = v + a;

  // Handle backward compatibility: single output string
  const outputArray = typeof outputs === 'string' ? [outputs] : outputs;

  // Validate output count
  if (outputArray.length !== totalOutputs) {
    throw new Error(
      `makeConcat: Expected ${totalOutputs} outputs (v=${v}, a=${a}), got ${outputArray.length}`,
    );
  }

  // Calculate n based on inputs and stream counts
  // For n segments with v video streams and a audio streams each:
  // total inputs = n * (v + a)
  const streamsPerSegment = v + a;
  const n = inputs.length / streamsPerSegment;

  if (!Number.isInteger(n)) {
    throw new Error(
      `makeConcat: Input count ${inputs.length} is not divisible by ${streamsPerSegment} (v=${v}, a=${a})`,
    );
  }

  return {
    inputs,
    outputs: outputArray,
    render: () =>
      `${inputs.map(wrap).join('')}concat=n=${n}:v=${v}:a=${a}${outputArray.map(wrap).join('')}`,
  };
}

/**
 * Creates an xfade filter
 * @param input1 - First input stream label (e.g., '0:v')
 * @param input2 - Second input stream label (e.g., '1:v')
 * @param output - Output stream label (e.g., 'outv')
 * @param options - Transition parameters
 */
export function makeXFade(
  input1: string,
  input2: string,
  output: string,
  options: {
    duration: number; // in seconds
    offset: number; // in seconds
    transition?: string;
  },
): Filter {
  const transition = options.transition ?? 'fade';

  return {
    inputs: [input1, input2],
    outputs: [output],
    render: () =>
      `${wrap(input1)}${wrap(input2)}xfade=transition=${transition}:duration=${options.duration}:offset=${options.offset}${wrap(output)}`,
  };
}

/**
 * Creates a copy filter (passthrough)
 * @param input - Input stream label (e.g., '0:v')
 * @param output - Output stream label (e.g., 'outv')
 */
export function makeCopy(input: string, output: string): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}copy${wrap(output)}`,
  };
}

/**
 * Creates an fps filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param fps - Frame rate (e.g., 30)
 */
export function makeFps(input: string, output: string, fps: number): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}fps=${fps}${wrap(output)}`,
  };
}

/**
 * Creates a format filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param format - Pixel format (e.g., 'yuv420p')
 */
export function makeFormat(
  input: string,
  output: string,
  format: string,
): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}format=${format}${wrap(output)}`,
  };
}

/**
 * Creates a scale filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Scale options (width, height, or both; -1 maintains aspect ratio)
 */
export function makeScale(
  input: string,
  output: string,
  options: { width: number | string; height: number | string },
): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () =>
      `${wrap(input)}scale=${options.width}:${options.height}${wrap(output)}`,
  };
}

/**
 * Creates a split filter (splits one input into multiple outputs)
 * @param input - Input stream label
 * @param outputLabels - Array of output stream labels
 */
export function makeSplit(input: string, outputLabels: string[]): Filter {
  return {
    inputs: [input],
    outputs: outputLabels, // Multiple outputs!
    render: () => `${wrap(input)}split${outputLabels.map(wrap).join('')}`,
  };
}

/**
 * Creates a crop filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Crop dimensions
 */
export function makeCrop(
  input: string,
  output: string,
  options: { width: number | string; height: number | string },
): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () =>
      `${wrap(input)}crop=${options.width}:${options.height}${wrap(output)}`,
  };
}

/**
 * Creates a gblur (Gaussian blur) filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param sigma - Blur strength
 */
export function makeGblur(
  input: string,
  output: string,
  sigma: number,
): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}gblur=sigma=${sigma}${wrap(output)}`,
  };
}

/**
 * Creates an eq (equalize) filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Equalization options
 */
export function makeEq(
  input: string,
  output: string,
  options: { contrast?: number; brightness?: number },
): Filter {
  const params: string[] = [];
  if (options.contrast !== undefined) params.push(`contrast=${options.contrast}`);
  if (options.brightness !== undefined)
    params.push(`brightness=${options.brightness}`);

  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}eq=${params.join(':')}${wrap(output)}`,
  };
}

/**
 * Creates an overlay filter
 * @param input1 - Background input stream label
 * @param input2 - Foreground input stream label
 * @param output - Output stream label
 * @param options - Overlay options
 */
export function makeOverlay(
  input1: string,
  input2: string,
  output: string,
  options?: { x?: string; y?: string; enable?: string },
): Filter {
  const params: string[] = [];
  if (options?.x !== undefined) params.push(`x=${options.x}`);
  if (options?.y !== undefined) params.push(`y=${options.y}`);
  if (options?.enable !== undefined) params.push(`enable=${options.enable}`);

  const paramStr = params.length > 0 ? `=${params.join(':')}` : '';

  return {
    inputs: [input1, input2],
    outputs: [output],
    render: () =>
      `${wrap(input1)}${wrap(input2)}overlay${paramStr}${wrap(output)}`,
  };
}

/**
 * Creates a drawtext filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Drawtext options
 */
export function makeDrawtext(
  input: string,
  output: string,
  options: {
    text: string;
    font?: string;
    fontsize?: number;
    fontcolor?: string;
    x?: string;
    y?: string;
    alpha?: string;
  },
): Filter {
  const params: string[] = [`text='${options.text}'`];
  if (options.font) params.push(`font='${options.font}'`);
  if (options.fontsize) params.push(`fontsize=${options.fontsize}`);
  if (options.fontcolor) params.push(`fontcolor=${options.fontcolor}`);
  if (options.x) params.push(`x=${options.x}`);
  if (options.y) params.push(`y=${options.y}`);
  if (options.alpha) params.push(`alpha='${options.alpha}'`);

  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}drawtext=${params.join(':')}${wrap(output)}`,
  };
}

/**
 * Creates a fade filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Fade options
 */
export function makeFade(
  input: string,
  output: string,
  options: {
    type: 'in' | 'out'; // t parameter
    start?: number; // st parameter (in seconds)
    duration: number; // d parameter (in seconds)
  },
): Filter {
  const params: string[] = [`t=${options.type}`];
  if (options.start !== undefined) params.push(`st=${options.start}`);
  params.push(`d=${options.duration}`);

  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}fade=${params.join(':')}${wrap(output)}`,
  };
}

/**
 * Creates a colorkey filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Colorkey options
 */
export function makeColorkey(
  input: string,
  output: string,
  options: { color: string; similarity: number; blend: number },
): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () =>
      `${wrap(input)}colorkey=${options.color}:${options.similarity}:${options.blend}${wrap(output)}`,
  };
}

/**
 * Creates a setpts filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param expression - PTS expression (e.g., 'PTS+10/TB')
 */
export function makeSetpts(
  input: string,
  output: string,
  expression: string,
): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}setpts=${expression}${wrap(output)}`,
  };
}

/**
 * Creates a transpose filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param direction - Transpose direction (0=90°CCW+vflip, 1=90°CW, 2=90°CCW, 3=90°CW+vflip)
 */
export function makeTranspose(
  input: string,
  output: string,
  direction: 0 | 1 | 2 | 3,
): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}transpose=${direction}${wrap(output)}`,
  };
}

/**
 * Creates an hflip filter (horizontal flip)
 * @param input - Input stream label
 * @param output - Output stream label
 */
export function makeHflip(input: string, output: string): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}hflip${wrap(output)}`,
  };
}

/**
 * Creates a vflip filter (vertical flip)
 * @param input - Input stream label
 * @param output - Output stream label
 */
export function makeVflip(input: string, output: string): Filter {
  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}vflip${wrap(output)}`,
  };
}

/**
 * Creates an atrim (audio trim) filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Trim options
 */
export function makeAtrim(
  input: string,
  output: string,
  options: { start?: number; end?: number },
): Filter {
  const params: string[] = [];
  if (options.start !== undefined) params.push(`${options.start}`);
  if (options.end !== undefined) params.push(`${options.end}`);

  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}atrim=${params.join(':')}${wrap(output)}`,
  };
}

/**
 * Creates an afade (audio fade) filter
 * @param input - Input stream label
 * @param output - Output stream label
 * @param options - Fade options
 */
export function makeAfade(
  input: string,
  output: string,
  options: {
    type: 'in' | 'out';
    start?: number; // in seconds
    duration: number; // in seconds
  },
): Filter {
  const params: string[] = [`t=${options.type}`];
  if (options.start !== undefined) params.push(`st=${options.start}`);
  params.push(`d=${options.duration}`);

  return {
    inputs: [input],
    outputs: [output],
    render: () => `${wrap(input)}afade=${params.join(':')}${wrap(output)}`,
  };
}
