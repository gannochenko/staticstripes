/**
 * FFmpeg filter factory functions and graph rendering
 */

export type Filter = {
  inputs: string[];
  output: string;
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
 * @param inputs - Array of input stream labels (e.g., ['0:v', '1:v'])
 * @param output - Output stream label (e.g., 'outv')
 * @param options - Optional parameters
 */
export function makeConcat(
  inputs: string[],
  output: string,
  options?: {
    videoStreams?: number;
    audioStreams?: number;
  },
): Filter {
  const n = inputs.length;
  const v = options?.videoStreams ?? 1;
  const a = options?.audioStreams ?? 0;

  return {
    inputs,
    output,
    render: () =>
      `${inputs.map(wrap).join('')}concat=n=${n}:v=${v}:a=${a}${wrap(output)}`,
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
    output,
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
    output,
    render: () => `${wrap(input)}copy${wrap(output)}`,
  };
}
