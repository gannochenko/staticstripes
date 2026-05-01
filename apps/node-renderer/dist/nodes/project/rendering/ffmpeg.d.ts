import type { Asset, Output } from './types';
export type Label = {
    tag: string;
    isAudio: boolean;
};
/**
 * Checks if FFmpeg is installed and available in the system PATH
 * @throws Error if FFmpeg is not found
 */
export declare function checkFFmpegInstalled(): Promise<void>;
export type Millisecond = number;
/**
 * Helper function to format milliseconds for FFmpeg time parameters
 * @param value - Time value in milliseconds
 * @returns Formatted string with 'ms' suffix (e.g., "1500ms")
 */
export declare function ms(value: Millisecond): string;
export declare class Filter {
    private inputs;
    outputs: Label[];
    body: string;
    constructor(inputs: Label[], outputs: Label[], body: string);
    render(): string;
}
/**
 * Generates the complete ffmpeg command for rendering the project
 */
export declare function makeFFmpegCommand(assetIndexMap: Map<string, number>, assets: Map<string, Asset>, output: Output, filterComplex: string, ffmpegArgs?: string): string;
export declare const runFFMpeg: (ffmpegCommand: string) => Promise<void>;
/**
 * Creates a concat filter
 * Automatically determines the number of segments (n) and stream counts (v, a) from input labels
 * and generates appropriate output labels
 * @param inputs - Array of input stream labels
 * @returns Filter with auto-generated outputs
 */
export declare function makeConcat(inputs: Label[]): Filter;
/**
 * Creates an xfade (crossfade) filter for video streams
 * Note: xfade only works with video, not audio
 * @param input1 - First video input stream label
 * @param input2 - Second video input stream label
 * @param options - Transition parameters
 * @returns Filter with auto-generated video output
 */
export declare function makeXFade(inputs: Label[], options: {
    duration: Millisecond;
    offset: Millisecond;
    transition?: string;
}): Filter;
/**
 * Creates a null filter (passthrough)
 * @param input - Input stream label
 */
export declare function makeNull(inputs: Label[]): Filter;
export declare function makeOverlay(inputs: Label[], options?: {
    x?: string | number;
    y?: string | number;
}): Filter;
export declare function makeFps(inputs: Label[], fps: number): Filter;
export declare function makeFormat(inputs: Label[], format: string): Filter;
export declare function makeScale(inputs: Label[], options: {
    width: number | string;
    height: number | string;
    flags?: string;
}): Filter;
/**
 * Creates a split filter (splits one input into multiple outputs)
 * @param input - Input stream label
 * @param outputLabels - Array of output stream labels
 */
export declare function makeSplit(inputs: Label[]): Filter;
export declare function makeTranspose(inputs: Label[], direction: 0 | 1 | 2 | 3): Filter;
/**
 * Creates a trim filter to cut streams to a specific time range
 * @param inputs - Input stream labels (video or audio)
 * @param start - Start time in milliseconds
 * @param end - End time in milliseconds
 * @returns Filter with trimmed output
 */
export declare function makeTrim(inputs: Label[], start: Millisecond, end: Millisecond): Filter;
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
export declare function makeTPad(inputs: Label[], options?: {
    start?: Millisecond;
    stop?: Millisecond;
    color?: string;
    startMode?: 'clone' | 'add';
    stopMode?: 'clone' | 'add';
}): Filter;
/**
 * Creates a pad filter to add borders/letterboxing
 * @param inputs - Input stream labels (must be video)
 * @param width - Output width (can be expression like 'iw' or number)
 * @param height - Output height (can be expression like 'ih' or number)
 * @param x - X position (default: center using '(ow-iw)/2')
 * @param y - Y position (default: center using '(oh-ih)/2')
 * @param color - Background color (default: 'black')
 */
export declare function makePad(inputs: Label[], options: {
    width: number | string;
    height: number | string;
    x?: string;
    y?: string;
    color?: string;
}): Filter;
/**
 * Creates a crop filter to cut video to specific dimensions
 * @param inputs - Input stream labels (must be video)
 * @param options - Crop parameters
 *   - width: Output width (can be expression or number)
 *   - height: Output height (can be expression or number)
 *   - x: X position to start crop (default: center using '(in_w-out_w)/2')
 *   - y: Y position to start crop (default: center using '(in_h-out_h)/2')
 */
export declare function makeCrop(inputs: Label[], options: {
    width: number | string;
    height: number | string;
    x?: string;
    y?: string;
}): Filter;
/**
 * Creates an eq (equalization) filter for color correction
 * @param inputs - Input stream labels (must be video)
 * @param options - Color adjustment parameters
 *   - brightness: -1.0 to 1.0 (default: 0)
 *   - contrast: -1000 to 1000 (default: 1.0)
 *   - saturation: 0 to 3 (default: 1.0)
 *   - gamma: 0.1 to 10 (default: 1.0)
 */
export declare function makeEq(inputs: Label[], options: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    gamma?: number;
}): Filter;
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
export declare function makeColorChannelMixer(inputs: Label[], options?: {
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
}): Filter;
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
export declare function makeCurves(inputs: Label[], options?: {
    preset?: string;
    master?: string;
    red?: string;
    green?: string;
    blue?: string;
    all?: string;
}): Filter;
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
export declare function makeVignette(inputs: Label[], options?: {
    angle?: string;
    x0?: string;
    y0?: string;
    mode?: 'forward' | 'backward';
    eval?: 'init' | 'frame';
}): Filter;
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
export declare function makeColorBalance(inputs: Label[], options?: {
    rs?: number;
    gs?: number;
    bs?: number;
    rm?: number;
    gm?: number;
    bm?: number;
    rh?: number;
    gh?: number;
    bh?: number;
}): Filter;
/**
 * Creates a Gaussian blur filter
 * @param inputs - Input stream labels (must be video)
 * @param sigma - Blur strength (0.01 to 1024, default: 1.0)
 * @param steps - Number of blur steps (1 to 6, default: 1, higher = smoother but slower)
 */
export declare function makeGblur(inputs: Label[], options?: {
    sigma?: number;
    steps?: number;
}): Filter;
/**
 * Creates a box blur filter (simpler, faster blur)
 * @param inputs - Input stream labels (must be video)
 * @param options - Blur parameters
 *   - luma_radius (lr): Horizontal luma blur radius (0 to min(w,h)/2)
 *   - luma_power (lp): Number of times to apply luma blur (0 to 2)
 *   - chroma_radius (cr): Horizontal chroma blur radius (0 to min(w,h)/2)
 *   - chroma_power (cp): Number of times to apply chroma blur (0 to 2)
 */
export declare function makeBoxblur(inputs: Label[], options?: {
    luma_radius?: number;
    luma_power?: number;
    chroma_radius?: number;
    chroma_power?: number;
}): Filter;
/**
 * Creates an unsharp filter (sharpen or blur)
 * @param inputs - Input stream labels (must be video)
 * @param options - Sharpening parameters
 *   - luma_amount: Luma sharpening amount (-2 to 5, default: 1.0, negative = blur)
 *   - chroma_amount: Chroma sharpening amount (-2 to 5, default: 0)
 */
export declare function makeUnsharp(inputs: Label[], options?: {
    luma_amount?: number;
    chroma_amount?: number;
}): Filter;
/**
 * Creates a hue adjustment filter
 * @param inputs - Input stream labels (must be video)
 * @param options - Hue adjustment parameters
 *   - hue: Hue angle in degrees (0 to 360)
 *   - saturation: Saturation multiplier (-10 to 10, default: 1.0)
 *   - brightness: Brightness adjustment (-10 to 10, default: 0)
 */
export declare function makeHue(inputs: Label[], options?: {
    hue?: number;
    saturation?: number;
    brightness?: number;
}): Filter;
/**
 * Creates a horizontal flip filter (mirrors video left-right)
 * Note: Only works with video streams
 */
export declare function makeHflip(inputs: Label[]): Filter;
/**
 * Creates a vertical flip filter (mirrors video top-bottom)
 * Note: Only works with video streams
 */
export declare function makeVflip(inputs: Label[]): Filter;
/**
 * Creates a chromakey filter for green/blue screen removal
 * @param inputs - Input stream labels (must be video)
 * @param options - Chromakey parameters
 *   - color: Color to key out (e.g., 'green', '0x00FF00', '#00FF00')
 *   - similarity: How similar colors need to be to match (0.01 to 1.0, default: 0.01)
 *   - blend: Blend percentage for edges (0.0 to 1.0, default: 0.0)
 */
export declare function makeChromakey(inputs: Label[], options: {
    color: string;
    similarity?: number;
    blend?: number;
}): Filter;
/**
 * Creates a Ken Burns effect (zoom/pan) filter for images
 * @param inputs - Input stream labels (must be video)
 * @param options - Ken Burns parameters
 *   - effect: Type of effect (zoom-in, zoom-out, pan-left, pan-right, pan-top, pan-bottom)
 *   - zoom: Zoom percentage (30 = 30%, applies to all effects)
 *   - effectDuration: Duration of the ken burns animation in milliseconds (0 = use fragment duration)
 *   - fragmentDuration: Total duration of the fragment in milliseconds
 *   - easing: Easing function (linear, ease-in, ease-out, ease-in-out)
 *   - width: Output width
 *   - height: Output height
 *   - fps: Output frame rate
 *   - focalX: Focal point X in percent (0-100, for zoom effects)
 *   - focalY: Focal point Y in percent (0-100, for zoom effects)
 */
export declare function makeKenBurns(inputs: Label[], options: {
    effect: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-top' | 'pan-bottom';
    zoom: number;
    effectDuration: number;
    fragmentDuration: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    width: number;
    height: number;
    fps: number;
    focalX?: number;
    focalY?: number;
    panStartX?: number;
    panStartY?: number;
    panEndX?: number;
    panEndY?: number;
}): Filter;
/**
 * Creates a despill filter to remove color spill from chromakey
 * @param inputs - Input stream labels (must be video)
 * @param options - Despill parameters
 *   - type: Color to despill ('green' or 'blue', default: 'green')
 *   - mix: Mix factor (0.0 to 1.0, default: 0.5)
 *   - expand: Expand factor (0.0 to 1.0, default: 0.0)
 */
export declare function makeDespill(inputs: Label[], options?: {
    type?: 'green' | 'blue';
    mix?: number;
    expand?: number;
}): Filter;
export declare function makeFade(inputs: Label[], options: {
    fades: Array<{
        type: 'in' | 'out';
        startTime: Millisecond;
        duration: Millisecond;
        color?: string;
        curve?: string;
    }>;
}): Filter;
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
export declare function makeColor(options: {
    duration: Millisecond;
    width: number;
    height: number;
    fps?: number;
    color?: string;
}): Filter;
/**
 * Creates an anullsrc filter to generate silent audio
 * @param options - Audio parameters
 *   - duration: Duration in milliseconds
 *   - channel_layout: Audio channel layout (default: 'stereo')
 *   - sample_rate: Sample rate in Hz (default: 48000)
 * @returns Filter with audio output
 */
export declare function makeAnullsrc(options: {
    duration: Millisecond;
    channel_layout?: string;
    sample_rate?: number;
}): Filter;
/**
 * Creates an amix filter to mix multiple audio streams
 * @param inputs - Input stream labels (must all be audio)
 * @param options - Mix parameters
 *   - duration: Output duration mode ('longest', 'shortest', 'first', default: 'longest')
 *   - dropout_transition: Transition time when input ends in seconds (default: 2)
 *   - weights: Array of weights for each input (e.g., [1, 0.5] makes second input quieter)
 *   - normalize: If true, automatically normalize weights to prevent clipping (default: true)
 */
export declare function makeAmix(inputs: Label[], options?: {
    duration?: 'longest' | 'shortest' | 'first';
    dropout_transition?: number;
    weights?: number[];
    normalize?: boolean;
}): Filter;
/**
 * Creates a drawtext filter to overlay text on video
 */
export declare function makeDrawtext(inputs: Label[], options: {
    text: string;
    x?: string | number;
    y?: string | number;
    fontsize?: number;
    fontcolor?: string;
    boxcolor?: string;
    boxborderw?: number;
}): Filter;
//# sourceMappingURL=ffmpeg.d.ts.map