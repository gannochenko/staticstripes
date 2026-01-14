import { getLabel } from './label-generator';
import type { ProjectStructure } from './type';

export type Label = {
  tag: string;
  isAudio: boolean; // false for video, true for audio
};

export type Filter = {
  inputs: Label[];
  outputs: Label[]; // Array to support filters with multiple outputs (e.g., split)
  render: () => string;
};

/**
 * Generates the complete ffmpeg command for rendering the project
 */
export function makeFFmpegCommand(
  project: ProjectStructure,
  filterComplex: string,
): string {
  const parts: string[] = ['ffmpeg'];

  // Overwrite output file without asking
  parts.push('-y');

  // Add input files in order of their index mapping
  const inputsByIndex = new Map<number, string>();
  for (const [assetName, index] of project.assetIndexMap) {
    const asset = project.assets.get(assetName);
    if (asset) {
      inputsByIndex.set(index, asset.path);
    }
  }

  // Add inputs in sorted order
  const sortedIndices = Array.from(inputsByIndex.keys()).sort((a, b) => a - b);
  for (const index of sortedIndices) {
    const path = inputsByIndex.get(index);
    if (path) {
      parts.push(`-i "${path}"`);
    }
  }

  // Add filter_complex
  if (filterComplex) {
    parts.push(`-filter_complex "${filterComplex}"`);
  }

  // Map the output streams (video and audio)
  parts.push('-map "[outv]"');
  parts.push('-map "[outa]"');

  // Increase buffer queue size for complex filter graphs
  parts.push('-max_muxing_queue_size 4096');

  // Add output parameters
  const { width, height } = project.output.resolution;

  // Video encoding parameters
  parts.push(`-s ${width}x${height}`);
  parts.push(`-r ${project.output.fps}`);
  parts.push('-pix_fmt yuv420p'); // Standard pixel format for compatibility
  parts.push('-preset ultrafast'); // Fast encoding for quick results

  // Audio encoding parameters
  parts.push('-c:a aac'); // AAC audio codec
  parts.push('-b:a 192k'); // Audio bitrate

  // Add output path
  parts.push(`"${project.output.path}"`);

  return parts.join(' ');
}

/**
 * Creates a concat filter
 * Automatically determines the number of segments (n) and stream counts (v, a) from input labels
 * and generates appropriate output labels
 * @param inputs - Array of input stream labels
 * @returns Filter with auto-generated outputs
 */
export function makeConcat(inputs: Label[]): Filter {
  if (inputs.length === 0) {
    throw new Error('makeConcat: inputs cannot be empty');
  }

  // Count total video and audio streams in inputs
  let totalVideo = 0;
  let totalAudio = 0;
  for (const input of inputs) {
    if (input.isAudio) {
      totalAudio++;
    } else {
      totalVideo++;
    }
  }

  // Find the pattern: try to determine n, v, a where:
  // - n * v = totalVideo
  // - n * a = totalAudio
  // - n * (v + a) = inputs.length
  // We want the largest n (most segments, fewest streams per segment)
  // Note: n=1 always works, so we're guaranteed to find a pattern

  let n = 0;
  let v = 0;
  let a = 0;

  // Try from largest n down to 1
  for (let tryN = inputs.length; tryN >= 1; tryN--) {
    if (totalVideo % tryN === 0 && totalAudio % tryN === 0) {
      const tryV = totalVideo / tryN;
      const tryA = totalAudio / tryN;
      if (tryV + tryA === inputs.length / tryN) {
        n = tryN;
        v = tryV;
        a = tryA;
        break;
      }
    }
  }

  // n should always be set (at minimum n=1 always works), but check to be safe
  if (n === 0) {
    throw new Error(
      'makeConcat: Internal error - failed to determine pattern (this should never happen)',
    );
  }

  // Generate output labels
  const outputs: Label[] = [];

  // Add video outputs
  for (let i = 0; i < v; i++) {
    outputs.push({
      tag: getLabel(),
      isAudio: false,
    });
  }

  // Add audio outputs
  for (let i = 0; i < a; i++) {
    outputs.push({
      tag: getLabel(),
      isAudio: true,
    });
  }

  return {
    inputs,
    outputs,
    render: () =>
      `${inputs.map((l) => wrap(l.tag)).join('')}concat=n=${n}:v=${v}:a=${a}${outputs.map((l) => wrap(l.tag)).join('')}`,
  };
}

/**
 * Creates an xfade (crossfade) filter for video streams
 * Note: xfade only works with video, not audio
 * @param input1 - First video input stream label
 * @param input2 - Second video input stream label
 * @param options - Transition parameters
 * @returns Filter with auto-generated video output
 */
export function makeXFade(
  inputs: Label[],
  options: {
    duration: number; // in seconds
    offset: number; // in seconds
    transition?: string;
  },
): Filter {
  if (inputs.length !== 2) {
    throw new Error(`makeXFade: expects two inputs`);
  }

  const input1 = inputs[0];
  const input2 = inputs[1];

  // Validate that both inputs are video (xfade doesn't support audio)
  if (input1.isAudio) {
    throw new Error(
      `makeXFade: input1 must be video, got audio (tag: ${input1.tag})`,
    );
  }
  if (input2.isAudio) {
    throw new Error(
      `makeXFade: input2 must be video, got audio (tag: ${input2.tag})`,
    );
  }

  const transition = options.transition ?? 'fade';

  // Auto-generate video output
  const output: Label = {
    tag: getLabel(),
    isAudio: false,
  };

  return {
    inputs: [input1, input2],
    outputs: [output],
    render: () =>
      `${wrap(input1.tag)}${wrap(input2.tag)}xfade=transition=${transition}:duration=${options.duration}:offset=${options.offset}${wrap(output.tag)}`,
  };
}

/**
 * Creates a copy filter (passthrough)
 * @param input - Input stream label
 */
export function makeCopy(inputs: Label[]): Filter {
  if (inputs.length !== 1) {
    throw new Error(`makeCopy: expects one input`);
  }

  const input1 = inputs[0];

  const outputLabelTag = getLabel();
  return {
    inputs: [input1],
    outputs: [
      {
        tag: outputLabelTag,
        isAudio: input1.isAudio,
      },
    ],
    render: () => `${wrap(input1.tag)}copy${wrap(outputLabelTag)}`,
  };
}

export function makeOverlay(inputs: Label[]): Filter {
  if (inputs.length !== 2) {
    throw new Error(`makeOverlay: expects two inputs`);
  }

  const input1 = inputs[0];
  const input2 = inputs[1];

  // Validate that both inputs are video (xfade doesn't support audio)
  if (input1.isAudio) {
    throw new Error(
      `makeOverlay: input1 must be video, got audio (tag: ${input1.tag})`,
    );
  }
  if (input2.isAudio) {
    throw new Error(
      `makeOverlay: input2 must be video, got audio (tag: ${input2.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  return {
    inputs: inputs,
    outputs: [output],
    render: () =>
      `${wrap(input1.tag)}${wrap(input2.tag)}overlay=format=auto${wrap(output.tag)}`,
  };
}

export function makeFps(inputs: Label[], fps: number): Filter {
  if (inputs.length !== 1) {
    throw new Error(`makeFps: expects one input`);
  }

  const input1 = inputs[0];
  if (input1.isAudio) {
    throw new Error(
      `makeFps: input1 must be video, got audio (tag: ${input1.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  return {
    inputs: inputs,
    outputs: [output],
    render: () => `${wrap(input1.tag)}fps=${fps}${wrap(output.tag)}`,
  };
}

export function makeScale(
  inputs: Label[],
  options: { width: number | string; height: number | string },
): Filter {
  if (inputs.length !== 1) {
    throw new Error(`makeFps: expects one input`);
  }

  const input1 = inputs[0];
  if (input1.isAudio) {
    throw new Error(
      `makeScale: input1 must be video, got audio (tag: ${input1.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  return {
    inputs: inputs,
    outputs: [output],
    render: () =>
      `${wrap(input1.tag)}scale=${options.width}:${options.height}${wrap(output.tag)}`,
  };
}

/**
 * Creates a split filter (splits one input into multiple outputs)
 * @param input - Input stream label
 * @param outputLabels - Array of output stream labels
 */
export function makeSplit(inputs: Label[]): Filter {
  if (inputs.length !== 1) {
    throw new Error(`makeFps: expects one input`);
  }

  const input1 = inputs[0];

  const output1 = {
    tag: getLabel(),
    isAudio: input1.isAudio,
  };
  const output2 = {
    tag: getLabel(),
    isAudio: input1.isAudio,
  };

  return {
    inputs: inputs,
    outputs: [output1, output2], // Multiple outputs!
    render: () =>
      `${wrap(input1.tag)}split${[output1.tag, output2.tag].map(wrap).join('')}`,
  };
}

/**
 * Wraps a label in brackets
 */
function wrap(label: string): string {
  return `[${label}]`;
}
