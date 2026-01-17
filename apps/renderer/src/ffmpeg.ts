import { getLabel } from './label-generator';
import { Project } from './project';
import type { ProjectStructure } from './type';

export type Label = {
  tag: string;
  isAudio: boolean; // false for video, true for audio
};

// export type Filter = {
//   inputs: Label[];
//   outputs: Label[]; // Array to support filters with multiple outputs (e.g., split)
//   render: () => string;
// };

export class Filter {
  constructor(
    private inputs: Label[],
    public outputs: Label[],
    public body: string,
  ) {}

  public render(): string {
    let result = '';
    this.inputs.forEach((input) => {
      result += wrap(input.tag);
    });

    result += this.body;

    this.outputs.forEach((input) => {
      result += wrap(input.tag);
    });

    return result;
  }
}

/**
 * Generates the complete ffmpeg command for rendering the project
 */
export function makeFFmpegCommand(
  project: Project,
  filterComplex: string,
): string {
  const parts: string[] = ['ffmpeg'];

  // Overwrite output file without asking
  parts.push('-y');

  // Add input files in order of their index mapping
  const inputsByIndex = new Map<number, string>();
  for (const [assetName, index] of project.getAssetIndexMap()) {
    const asset = project.getAssetByName(assetName);
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
  const { width, height } = project.getOutput().resolution;

  // Video encoding parameters
  parts.push(`-s ${width}x${height}`);
  parts.push(`-r ${project.getOutput().fps}`);
  parts.push('-pix_fmt yuv420p'); // Standard pixel format for compatibility
  parts.push('-preset ultrafast'); // Fast encoding for quick results

  // Audio encoding parameters
  parts.push('-c:a aac'); // AAC audio codec
  parts.push('-b:a 192k'); // Audio bitrate

  // Add output path
  parts.push(`"${project.getOutput().path}"`);

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

  return new Filter(inputs, outputs, `concat=n=${n}:v=${v}:a=${a}`);
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

  return new Filter(
    [input1, input2],
    [output],
    `xfade=transition=${transition}:duration=${options.duration}:offset=${options.offset}`,
  );
}

/**
 * Creates a null filter (passthrough)
 * @param input - Input stream label
 */
export function makeNull(inputs: Label[]): Filter {
  if (inputs.length !== 1) {
    throw new Error(`makeNull: expects one input`);
  }

  const input1 = inputs[0];

  const outputLabelTag = getLabel();

  return new Filter(
    [input1],
    [
      {
        tag: outputLabelTag,
        isAudio: input1.isAudio,
      },
    ],
    input1.isAudio ? 'anull' : 'null',
  );
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

  return new Filter(inputs, [output], 'overlay=format=auto');
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

  return new Filter(inputs, [output], `fps=${fps}`);
}

export function makeScale(
  inputs: Label[],
  options: { width: number | string; height: number | string; flags?: string },
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

  const algo = options.flags;

  return new Filter(
    inputs,
    [output],
    `scale=${options.width}:${options.height}${algo ? `:${algo}` : ''}`,
  );
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

  return new Filter(inputs, [output1, output2], 'split');
}

export function makeTranspose(
  inputs: Label[],
  direction: 0 | 1 | 2 | 3,
): Filter {
  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const input1 = inputs[0];
  if (input1.isAudio) {
    throw new Error(
      `makeTranspose: input1 must be video, got audio (tag: ${input1.tag})`,
    );
  }

  return new Filter(inputs, [output], `transpose=${direction}`);
}

export function makeTrim(inputs: Label[], start: number, end: number): Filter {
  const input1 = inputs[0];

  const output = {
    tag: getLabel(),
    isAudio: input1.isAudio,
  };

  const prefix = input1.isAudio ? 'a' : '';

  return new Filter(
    inputs,
    [output],
    `${prefix}trim=start=${start}:end=${end},${prefix}setpts=PTS-STARTPTS`,
  );
}

/**
 * Creates a pad filter to add borders/letterboxing
 * @param inputs - Input stream labels (must be video)
 * @param width - Output width (can be expression like 'iw' or number)
 * @param height - Output height (can be expression like 'ih' or number)
 * @param x - X position (default: center using '(ow-iw)/2')
 * @param y - Y position (default: center using '(oh-ih)/2')
 * @param color - Background color (default: 'black')
 */
export function makePad(
  inputs: Label[],
  options: {
    width: number | string;
    height: number | string;
    x?: string;
    y?: string;
    color?: string;
  },
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makePad: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const x = options.x ?? '(ow-iw)/2';
  const y = options.y ?? '(oh-ih)/2';
  const color = options.color ?? 'black';

  return new Filter(
    inputs,
    [output],
    `pad=${options.width}:${options.height}:${x}:${y}:${color}`,
  );
}

/**
 * Creates a horizontal flip filter (mirrors video left-right)
 * Note: Only works with video streams
 */
export function makeHflip(inputs: Label[]): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeHflip: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  return new Filter(inputs, [output], 'hflip');
}

/**
 * Creates a vertical flip filter (mirrors video top-bottom)
 * Note: Only works with video streams
 */
export function makeVflip(inputs: Label[]): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeVflip: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  return new Filter(inputs, [output], 'vflip');
}

/**
 * Wraps a label in brackets
 */
function wrap(label: string): string {
  return `[${label}]`;
}
