import { spawn } from 'child_process';
import { getLabel } from './label-generator';
import { Project } from './project';

export type Label = {
  tag: string;
  isAudio: boolean; // false for video, true for audio
};

/**
 * Checks if FFmpeg is installed and available in the system PATH
 * @throws Error if FFmpeg is not found
 */
export async function checkFFmpegInstalled(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let hasOutput = false;

    ffmpeg.stdout.on('data', () => {
      hasOutput = true;
    });

    ffmpeg.on('close', (code) => {
      if (code === 0 && hasOutput) {
        resolve();
      } else {
        reject(
          new Error(
            'FFmpeg not found. Please install FFmpeg to use StaticStripes.\n' +
              'Visit https://ffmpeg.org/download.html for installation instructions.',
          ),
        );
      }
    });

    ffmpeg.on('error', (error) => {
      if (error.message.includes('ENOENT')) {
        reject(
          new Error(
            'FFmpeg not found in system PATH. Please install FFmpeg to use StaticStripes.\n' +
              'Visit https://ffmpeg.org/download.html for installation instructions.\n\n' +
              'Quick install:\n' +
              '  macOS:          brew install ffmpeg\n' +
              '  Ubuntu/Debian:  sudo apt-get install ffmpeg\n' +
              '  Windows:        Download from https://ffmpeg.org/download.html',
          ),
        );
      } else {
        reject(error);
      }
    });
  });
}

export type Millisecond = number;

/**
 * Helper function to format milliseconds for FFmpeg time parameters
 * @param value - Time value in milliseconds
 * @returns Formatted string with 'ms' suffix (e.g., "1500ms")
 */
export function ms(value: Millisecond): string {
  return `${value}ms`;
}

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
  outputName: string,
  preset: 'ultrafast' | 'medium' = 'medium',
  extraArgs?: string,
): string {
  const parts: string[] = ['ffmpeg'];

  // Overwrite output file without asking
  parts.push('-y');

  // Add input files in order of their index mapping
  const inputsByIndex = new Map<number, string>();
  const missingAssets: string[] = [];

  for (const [assetName, index] of project.getAssetIndexMap()) {
    const asset = project.getAssetByName(assetName);
    if (asset) {
      inputsByIndex.set(index, asset.path);
    } else {
      missingAssets.push(`${assetName} (index ${index})`);
    }
  }

  // Validate that all referenced assets exist
  if (missingAssets.length > 0) {
    throw new Error(
      `Filter graph references assets that don't exist:\n${missingAssets.map(a => `  - ${a}`).join('\n')}\n\n` +
      `This is likely a bug in the filter graph generation. Please report this issue.`
    );
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
  const output = project.getOutput(outputName);
  if (!output) {
    throw new Error(`Output "${outputName}" not found`);
  }

  const { width, height } = output.resolution;

  // Video encoding parameters
  parts.push(`-s ${width}x${height}`);
  parts.push(`-r ${output.fps}`);
  parts.push('-pix_fmt yuv420p'); // Standard pixel format for compatibility
  parts.push(`-preset ${preset}`); // Encoding speed preset

  // Audio encoding parameters
  parts.push('-c:a aac'); // AAC audio codec
  parts.push('-b:a 192k'); // Audio bitrate

  // Add extra FFmpeg arguments if provided
  if (extraArgs) {
    parts.push(extraArgs);
  }

  // Add output path
  parts.push(`"${output.path}"`);

  return parts.join(' ');
}

export const runFFMpeg = async (ffmpegCommand: string) => {
  const args =
    ffmpegCommand
      .slice('ffmpeg '.length)
      .match(/(?:[^\s"]+|"[^"]*")+/g)
      ?.map((arg) => arg.replace(/^"|"$/g, '')) || [];

  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // FFmpeg outputs progress to stderr
    let stderrBuffer = '';
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stderrBuffer += output;

      // Show all output for debugging
      process.stderr.write(output);
    });

    ffmpeg.on('close', (code) => {
      process.stdout.write('\n');
      if (code === 0) {
        console.log('\n=== Render Complete ===');
        resolve();
      } else {
        console.error(`\n=== Render Failed ===`);
        console.error(`FFmpeg exited with code ${code}`);
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('\n=== Render Failed ===');
      console.error('Error:', error.message);
      reject(error);
    });
  });
};

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
    duration: Millisecond;
    offset: Millisecond;
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
    `xfade=transition=${transition}:duration=${ms(options.duration)}:offset=${ms(options.offset)}`,
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

export function makeOverlay(
  inputs: Label[],
  options?: {
    x?: string | number;
    y?: string | number;
  },
): Filter {
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

  let overlayParams = 'format=auto';
  if (options?.x !== undefined || options?.y !== undefined) {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    overlayParams = `x=${x}:y=${y}:format=auto`;
  }

  return new Filter(
    inputs,
    [output],
    `overlay=${overlayParams}:eof_action=pass`,
  );
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

/**
 * Creates a trim filter to cut streams to a specific time range
 * @param inputs - Input stream labels (video or audio)
 * @param start - Start time in milliseconds
 * @param end - End time in milliseconds
 * @returns Filter with trimmed output
 */
export function makeTrim(
  inputs: Label[],
  start: Millisecond,
  end: Millisecond,
): Filter {
  const input1 = inputs[0];

  const output = {
    tag: getLabel(),
    isAudio: input1.isAudio,
  };

  const prefix = input1.isAudio ? 'a' : '';

  return new Filter(
    inputs,
    [output],
    `${prefix}trim=start=${ms(start)}:end=${ms(end)},${prefix}setpts=PTS-STARTPTS`,
  );
}

/**
 * Creates a tpad/apad filter to add temporal padding (frames/silence)
 * @param inputs - Input stream labels (video or audio)
 * @param options - Padding parameters
 *   - start: Duration to add at the beginning (in milliseconds, default: 0)
 *   - stop: Duration to add at the end (in milliseconds, default: 0)
 *   - start_mode: 'clone' (duplicate frames) or 'add' (colored frames/silence, default)
 *   - stop_mode: 'clone' (duplicate frames) or 'add' (colored frames/silence, default)
 *   - color: Color of added frames (video only, e.g., 'black', '#00FF00', default: 'black')
 */
export function makeTPad(
  inputs: Label[],
  options: {
    start?: Millisecond;
    stop?: Millisecond;
    color?: string;
    startMode?: 'clone' | 'add';
    stopMode?: 'clone' | 'add';
  } = {},
): Filter {
  const input = inputs[0];

  const output = {
    tag: getLabel(),
    isAudio: input.isAudio,
  };

  const start = options.start ?? 0;
  const stop = options.stop ?? 0;
  const start_mode = options.startMode ?? 'add';
  const stop_mode = options.stopMode ?? 'add';
  const color = options.color ?? 'black';

  const filterName = input.isAudio ? 'apad' : 'tpad';

  if (input.isAudio) {
    // For audio: use adelay for start padding, apad for stop padding
    const filters: string[] = [];

    // Add silence at the start using adelay (already in milliseconds)
    if (start > 0) {
      filters.push(`adelay=${start}|${start}`);
    }

    // Add silence at the end using apad
    if (stop > 0) {
      filters.push(`apad=pad_dur=${ms(stop)}`);
    }

    const filterStr = filters.length > 0 ? filters.join(',') : 'anull';
    return new Filter(inputs, [output], filterStr);
  } else {
    // tpad for video
    const params: string[] = [];
    if (start > 0) {
      params.push(`start_duration=${ms(start)}`);
      params.push(`start_mode=${start_mode}`);
    }
    if (stop > 0) {
      params.push(`stop_duration=${ms(stop)}`);
      params.push(`stop_mode=${stop_mode}`);
    }
    // Add color parameter for added frames (when mode is 'add')
    if (
      (start_mode === 'add' && start > 0) ||
      (stop_mode === 'add' && stop > 0)
    ) {
      params.push(`color=${color}`);
    }
    const filterParams = params.length > 0 ? `=${params.join(':')}` : '';
    return new Filter(inputs, [output], `${filterName}${filterParams}`);
  }
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
 * Creates a crop filter to cut video to specific dimensions
 * @param inputs - Input stream labels (must be video)
 * @param options - Crop parameters
 *   - width: Output width (can be expression or number)
 *   - height: Output height (can be expression or number)
 *   - x: X position to start crop (default: center using '(in_w-out_w)/2')
 *   - y: Y position to start crop (default: center using '(in_h-out_h)/2')
 */
export function makeCrop(
  inputs: Label[],
  options: {
    width: number | string;
    height: number | string;
    x?: string;
    y?: string;
  },
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeCrop: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const x = options.x ?? '(in_w-out_w)/2';
  const y = options.y ?? '(in_h-out_h)/2';

  return new Filter(
    inputs,
    [output],
    `crop=${options.width}:${options.height}:${x}:${y}`,
  );
}

/**
 * Creates an eq (equalization) filter for color correction
 * @param inputs - Input stream labels (must be video)
 * @param options - Color adjustment parameters
 *   - brightness: -1.0 to 1.0 (default: 0)
 *   - contrast: -1000 to 1000 (default: 1.0)
 *   - saturation: 0 to 3 (default: 1.0)
 *   - gamma: 0.1 to 10 (default: 1.0)
 */
export function makeEq(
  inputs: Label[],
  options: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    gamma?: number;
  },
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeEq: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const params: string[] = [];
  if (options.brightness !== undefined)
    params.push(`brightness=${options.brightness}`);
  if (options.contrast !== undefined)
    params.push(`contrast=${options.contrast}`);
  if (options.saturation !== undefined)
    params.push(`saturation=${options.saturation}`);
  if (options.gamma !== undefined) params.push(`gamma=${options.gamma}`);

  const filterStr = params.length > 0 ? `eq=${params.join(':')}` : 'eq';

  return new Filter(inputs, [output], filterStr);
}

/**
 * Creates a colorchannelmixer filter for advanced color adjustment
 * @param inputs - Input stream labels (must be video)
 * @param options - Color channel mixing parameters
 *   - rr: Red contribution to red channel (-2 to 2, default: 1)
 *   - rg: Green contribution to red channel (-2 to 2, default: 0)
 *   - rb: Blue contribution to red channel (-2 to 2, default: 0)
 *   - ra: Alpha contribution to red channel (-2 to 2, default: 0)
 *   - gr: Red contribution to green channel (-2 to 2, default: 0)
 *   - gg: Green contribution to green channel (-2 to 2, default: 1)
 *   - gb: Blue contribution to green channel (-2 to 2, default: 0)
 *   - ga: Alpha contribution to green channel (-2 to 2, default: 0)
 *   - br: Red contribution to blue channel (-2 to 2, default: 0)
 *   - bg: Green contribution to blue channel (-2 to 2, default: 0)
 *   - bb: Blue contribution to blue channel (-2 to 2, default: 1)
 *   - ba: Alpha contribution to blue channel (-2 to 2, default: 0)
 */
export function makeColorChannelMixer(
  inputs: Label[],
  options: {
    rr?: number;
    rg?: number;
    rb?: number;
    ra?: number;
    gr?: number;
    gg?: number;
    gb?: number;
    ga?: number;
    br?: number;
    bg?: number;
    bb?: number;
    ba?: number;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeColorChannelMixer: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const params: string[] = [];
  if (options.rr !== undefined) params.push(`rr=${options.rr}`);
  if (options.rg !== undefined) params.push(`rg=${options.rg}`);
  if (options.rb !== undefined) params.push(`rb=${options.rb}`);
  if (options.ra !== undefined) params.push(`ra=${options.ra}`);
  if (options.gr !== undefined) params.push(`gr=${options.gr}`);
  if (options.gg !== undefined) params.push(`gg=${options.gg}`);
  if (options.gb !== undefined) params.push(`gb=${options.gb}`);
  if (options.ga !== undefined) params.push(`ga=${options.ga}`);
  if (options.br !== undefined) params.push(`br=${options.br}`);
  if (options.bg !== undefined) params.push(`bg=${options.bg}`);
  if (options.bb !== undefined) params.push(`bb=${options.bb}`);
  if (options.ba !== undefined) params.push(`ba=${options.ba}`);

  const filterStr =
    params.length > 0
      ? `colorchannelmixer=${params.join(':')}`
      : 'colorchannelmixer';

  return new Filter(inputs, [output], filterStr);
}

/**
 * Creates a curves filter for color grading (similar to Photoshop curves)
 * @param inputs - Input stream labels (must be video)
 * @param options - Curves parameters
 *   - preset: Preset curve name (e.g., 'darker', 'lighter', 'increase_contrast', 'vintage', etc.)
 *   - master: Master curve points (affects all channels, e.g., '0/0 0.5/0.6 1/1')
 *   - red: Red channel curve points
 *   - green: Green channel curve points
 *   - blue: Blue channel curve points
 *   - all: Apply same curve to all RGB channels
 */
export function makeCurves(
  inputs: Label[],
  options: {
    preset?: string;
    master?: string;
    red?: string;
    green?: string;
    blue?: string;
    all?: string;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeCurves: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const params: string[] = [];
  if (options.preset !== undefined) params.push(`preset=${options.preset}`);
  if (options.master !== undefined) params.push(`master='${options.master}'`);
  if (options.red !== undefined) params.push(`red='${options.red}'`);
  if (options.green !== undefined) params.push(`green='${options.green}'`);
  if (options.blue !== undefined) params.push(`blue='${options.blue}'`);
  if (options.all !== undefined) params.push(`all='${options.all}'`);

  const filterStr = params.length > 0 ? `curves=${params.join(':')}` : 'curves';

  return new Filter(inputs, [output], filterStr);
}

/**
 * Creates a vignette filter to darken the corners/edges
 * @param inputs - Input stream labels (must be video)
 * @param options - Vignette parameters
 *   - angle: Lens angle (0 to PI/2, default: PI/5)
 *   - x0: X coordinate of vignette center (0 to 1, default: w/2)
 *   - y0: Y coordinate of vignette center (0 to 1, default: h/2)
 *   - mode: Vignette mode ('forward' or 'backward', default: 'forward')
 *   - eval: When to evaluate expressions ('init' or 'frame', default: 'init')
 */
export function makeVignette(
  inputs: Label[],
  options: {
    angle?: string;
    x0?: string;
    y0?: string;
    mode?: 'forward' | 'backward';
    eval?: 'init' | 'frame';
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeVignette: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const params: string[] = [];
  if (options.angle !== undefined) params.push(`angle='${options.angle}'`);
  if (options.x0 !== undefined) params.push(`x0='${options.x0}'`);
  if (options.y0 !== undefined) params.push(`y0='${options.y0}'`);
  if (options.mode !== undefined) params.push(`mode=${options.mode}`);
  if (options.eval !== undefined) params.push(`eval=${options.eval}`);

  const filterStr =
    params.length > 0 ? `vignette=${params.join(':').replace(/'/g, '')}` : 'vignette';

  return new Filter(inputs, [output], filterStr);
}

/**
 * Creates a colorbalance filter to adjust colors in shadows, midtones, and highlights
 * @param inputs - Input stream labels (must be video)
 * @param options - Color balance parameters
 *   - rs: Red shift for shadows (-1 to 1, default: 0)
 *   - gs: Green shift for shadows (-1 to 1, default: 0)
 *   - bs: Blue shift for shadows (-1 to 1, default: 0)
 *   - rm: Red shift for midtones (-1 to 1, default: 0)
 *   - gm: Green shift for midtones (-1 to 1, default: 0)
 *   - bm: Blue shift for midtones (-1 to 1, default: 0)
 *   - rh: Red shift for highlights (-1 to 1, default: 0)
 *   - gh: Green shift for highlights (-1 to 1, default: 0)
 *   - bh: Blue shift for highlights (-1 to 1, default: 0)
 */
export function makeColorBalance(
  inputs: Label[],
  options: {
    rs?: number;
    gs?: number;
    bs?: number;
    rm?: number;
    gm?: number;
    bm?: number;
    rh?: number;
    gh?: number;
    bh?: number;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeColorBalance: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const params: string[] = [];
  if (options.rs !== undefined) params.push(`rs=${options.rs}`);
  if (options.gs !== undefined) params.push(`gs=${options.gs}`);
  if (options.bs !== undefined) params.push(`bs=${options.bs}`);
  if (options.rm !== undefined) params.push(`rm=${options.rm}`);
  if (options.gm !== undefined) params.push(`gm=${options.gm}`);
  if (options.bm !== undefined) params.push(`bm=${options.bm}`);
  if (options.rh !== undefined) params.push(`rh=${options.rh}`);
  if (options.gh !== undefined) params.push(`gh=${options.gh}`);
  if (options.bh !== undefined) params.push(`bh=${options.bh}`);

  const filterStr =
    params.length > 0 ? `colorbalance=${params.join(':')}` : 'colorbalance';

  return new Filter(inputs, [output], filterStr);
}

/**
 * Creates a Gaussian blur filter
 * @param inputs - Input stream labels (must be video)
 * @param sigma - Blur strength (0.01 to 1024, default: 1.0)
 * @param steps - Number of blur steps (1 to 6, default: 1, higher = smoother but slower)
 */
export function makeGblur(
  inputs: Label[],
  options: {
    sigma?: number;
    steps?: number;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeGblur: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const sigma = options.sigma ?? 1.0;
  const steps = options.steps ?? 1;

  return new Filter(inputs, [output], `gblur=sigma=${sigma}:steps=${steps}`);
}

/**
 * Creates a box blur filter (simpler, faster blur)
 * @param inputs - Input stream labels (must be video)
 * @param options - Blur parameters
 *   - luma_radius (lr): Horizontal luma blur radius (0 to min(w,h)/2)
 *   - luma_power (lp): Number of times to apply luma blur (0 to 2)
 *   - chroma_radius (cr): Horizontal chroma blur radius (0 to min(w,h)/2)
 *   - chroma_power (cp): Number of times to apply chroma blur (0 to 2)
 */
export function makeBoxblur(
  inputs: Label[],
  options: {
    luma_radius?: number;
    luma_power?: number;
    chroma_radius?: number;
    chroma_power?: number;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeBoxblur: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const lr = options.luma_radius ?? 2;
  const lp = options.luma_power ?? 1;
  const cr = options.chroma_radius ?? lr;
  const cp = options.chroma_power ?? lp;

  return new Filter(
    inputs,
    [output],
    `boxblur=lr=${lr}:lp=${lp}:cr=${cr}:cp=${cp}`,
  );
}

/**
 * Creates an unsharp filter (sharpen or blur)
 * @param inputs - Input stream labels (must be video)
 * @param options - Sharpening parameters
 *   - luma_amount: Luma sharpening amount (-2 to 5, default: 1.0, negative = blur)
 *   - chroma_amount: Chroma sharpening amount (-2 to 5, default: 0)
 */
export function makeUnsharp(
  inputs: Label[],
  options: {
    luma_amount?: number;
    chroma_amount?: number;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeUnsharp: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const la = options.luma_amount ?? 1.0;
  const ca = options.chroma_amount ?? 0;

  return new Filter(
    inputs,
    [output],
    `unsharp=luma_amount=${la}:chroma_amount=${ca}`,
  );
}

/**
 * Creates a hue adjustment filter
 * @param inputs - Input stream labels (must be video)
 * @param options - Hue adjustment parameters
 *   - hue: Hue angle in degrees (0 to 360)
 *   - saturation: Saturation multiplier (-10 to 10, default: 1.0)
 *   - brightness: Brightness adjustment (-10 to 10, default: 0)
 */
export function makeHue(
  inputs: Label[],
  options: {
    hue?: number;
    saturation?: number;
    brightness?: number;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeHue: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const params: string[] = [];
  if (options.hue !== undefined) params.push(`h=${options.hue}`);
  if (options.saturation !== undefined) params.push(`s=${options.saturation}`);
  if (options.brightness !== undefined) params.push(`b=${options.brightness}`);

  const filterStr = params.length > 0 ? `hue=${params.join(':')}` : 'hue';

  return new Filter(inputs, [output], filterStr);
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
 * Creates a chromakey filter for green/blue screen removal
 * @param inputs - Input stream labels (must be video)
 * @param options - Chromakey parameters
 *   - color: Color to key out (e.g., 'green', '0x00FF00', '#00FF00')
 *   - similarity: How similar colors need to be to match (0.01 to 1.0, default: 0.01)
 *   - blend: Blend percentage for edges (0.0 to 1.0, default: 0.0)
 */
export function makeChromakey(
  inputs: Label[],
  options: {
    color: string;
    similarity?: number;
    blend?: number;
  },
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeChromakey: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const similarity = options.similarity ?? 0.01;
  const blend = options.blend ?? 0.0;

  return new Filter(
    inputs,
    [output],
    `chromakey=${options.color}:${similarity}:${blend}`,
  );
}

/**
 * Creates a despill filter to remove color spill from chromakey
 * @param inputs - Input stream labels (must be video)
 * @param options - Despill parameters
 *   - type: Color to despill ('green' or 'blue', default: 'green')
 *   - mix: Mix factor (0.0 to 1.0, default: 0.5)
 *   - expand: Expand factor (0.0 to 1.0, default: 0.0)
 */
export function makeDespill(
  inputs: Label[],
  options: {
    type?: 'green' | 'blue';
    mix?: number;
    expand?: number;
  } = {},
): Filter {
  const input = inputs[0];

  if (input.isAudio) {
    throw new Error(
      `makeDespill: input must be video, got audio (tag: ${input.tag})`,
    );
  }

  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const type = options.type ?? 'green';
  const mix = options.mix ?? 0.5;
  const expand = options.expand ?? 0.0;

  return new Filter(
    inputs,
    [output],
    `despill=type=${type}:mix=${mix}:expand=${expand}`,
  );
}

export function makeFade(
  inputs: Label[],
  options: {
    fades: Array<{
      type: 'in' | 'out';
      startTime: Millisecond;
      duration: Millisecond;
      color?: string;
      curve?: string;
    }>;
  },
): Filter {
  const input = inputs[0];

  if (!options.fades || options.fades.length === 0) {
    throw new Error(`makeFade: at least one fade operation is required`);
  }

  const output = {
    tag: getLabel(),
    isAudio: input.isAudio,
  };

  // Use 'afade' for audio, 'fade' for video
  const filterName = input.isAudio ? 'afade' : 'fade';

  // Build fade filter string by chaining multiple fade operations
  const fadeStrings = options.fades.map((fade) => {
    const params: string[] = [];
    params.push(`t=${fade.type}`);
    params.push(`st=${ms(fade.startTime)}`);
    params.push(`d=${ms(fade.duration)}`);

    // Color parameter only applies to video (fade, not afade)
    if (fade.color && !input.isAudio) {
      params.push(`color=${fade.color}`);
    }

    // Curve parameter works for both video and audio
    if (fade.curve) {
      params.push(`curve=${fade.curve}`);
    }

    return `${filterName}=${params.join(':')}`;
  });

  return new Filter(inputs, [output], fadeStrings.join(','));
}

/**
 * Creates a color source filter to generate blank video
 * @param options - Video parameters
 *   - duration: Duration in milliseconds
 *   - width: Video width in pixels
 *   - height: Video height in pixels
 *   - fps: Frame rate (default: 30)
 *   - color: Color (default: 'black', supports alpha with format '#RRGGBBAA')
 * @returns Filter with video output
 */
export function makeColor(options: {
  duration: Millisecond;
  width: number;
  height: number;
  fps?: number;
  color?: string;
}): Filter {
  const output = {
    tag: getLabel(),
    isAudio: false,
  };

  const color = options.color ?? 'black';
  const fps = options.fps ?? 30;

  // Check if color has alpha channel (8-digit hex with alpha)
  const hasAlpha = color.length === 9 && color.startsWith('#');

  // color source generates video, add format filter for alpha if needed
  let filterStr = `color=c=${color}:s=${options.width}x${options.height}:r=${fps}:d=${ms(options.duration)}`;

  if (hasAlpha) {
    // Add format filter to ensure proper alpha channel handling
    filterStr += ',format=yuva420p';
  }

  return new Filter([], [output], filterStr);
}

/**
 * Creates an anullsrc filter to generate silent audio
 * @param options - Audio parameters
 *   - duration: Duration in milliseconds
 *   - channel_layout: Audio channel layout (default: 'stereo')
 *   - sample_rate: Sample rate in Hz (default: 48000)
 * @returns Filter with audio output
 */
export function makeAnullsrc(options: {
  duration: Millisecond;
  channel_layout?: string;
  sample_rate?: number;
}): Filter {
  const output = {
    tag: getLabel(),
    isAudio: true,
  };

  const channelLayout = options.channel_layout ?? 'stereo';
  const sampleRate = options.sample_rate ?? 48000;
  const duration = options.duration;

  // anullsrc generates infinite silence, so we trim to the desired duration
  const filterStr = `anullsrc=channel_layout=${channelLayout}:sample_rate=${sampleRate},atrim=duration=${ms(duration)},asetpts=PTS-STARTPTS`;

  return new Filter([], [output], filterStr);
}

/**
 * Creates an amix filter to mix multiple audio streams
 * @param inputs - Input stream labels (must all be audio)
 * @param options - Mix parameters
 *   - duration: Output duration mode ('longest', 'shortest', 'first', default: 'longest')
 *   - dropout_transition: Transition time when input ends in seconds (default: 2)
 *   - weights: Array of weights for each input (e.g., [1, 0.5] makes second input quieter)
 *   - normalize: If true, automatically normalize weights to prevent clipping (default: true)
 */
export function makeAmix(
  inputs: Label[],
  options: {
    duration?: 'longest' | 'shortest' | 'first';
    dropout_transition?: number;
    weights?: number[];
    normalize?: boolean;
  } = {},
): Filter {
  if (inputs.length < 2) {
    throw new Error('makeAmix: requires at least 2 input streams');
  }

  // Validate that all inputs are audio
  for (const input of inputs) {
    if (!input.isAudio) {
      throw new Error(
        `makeAmix: all inputs must be audio, got video (tag: ${input.tag})`,
      );
    }
  }

  const output = {
    tag: getLabel(),
    isAudio: true,
  };

  const params: string[] = [];
  params.push(`inputs=${inputs.length}`);

  if (options.duration) {
    params.push(`duration=${options.duration}`);
  }

  if (options.dropout_transition !== undefined) {
    params.push(`dropout_transition=${options.dropout_transition}`);
  }

  if (options.weights && options.weights.length > 0) {
    // Ensure weights array matches inputs length
    const weights =
      options.weights.length === inputs.length
        ? options.weights
        : [
            ...options.weights,
            ...Array(inputs.length - options.weights.length).fill(1),
          ];

    params.push(`weights=${weights.join(' ')}`);
  }

  if (options.normalize !== undefined) {
    params.push(`normalize=${options.normalize ? '1' : '0'}`);
  }

  return new Filter(inputs, [output], `amix=${params.join(':')}`);
}

/**
 * Wraps a label in brackets
 */
function wrap(label: string): string {
  return `[${label}]`;
}
