/**
 * Animation helpers for event-driven frame capture
 *
 * These utilities enable React apps to emit frames to Puppeteer for
 * rendering animated content. The app controls when frames are captured
 * by calling captureFrame(), and Puppeteer acknowledges each capture
 * before the app proceeds to the next frame.
 */

export interface AnimationParams {
  fps: number;
  duration: number; // milliseconds
  rendering: boolean;
}

/**
 * Extract animation parameters from URL search params
 */
export function getAnimationParams(): AnimationParams {
  const params = new URLSearchParams(window.location.search);
  return {
    fps: parseInt(params.get('fps') || '30', 10),
    duration: parseInt(params.get('duration') || '0', 10),
    rendering: params.has('rendering'),
  };
}

/**
 * AnimationCapture class for controlling frame-by-frame rendering
 *
 * Usage:
 *   const capture = new AnimationCapture();
 *   await capture.captureFrame(); // Request frame capture, wait for ACK
 *   capture.done(); // Signal rendering complete
 */
export class AnimationCapture {
  private frameCount = 0;
  private params: AnimationParams;

  constructor() {
    this.params = getAnimationParams();
  }

  /**
   * Target FPS from the output configuration
   */
  get fps(): number {
    return this.params.fps;
  }

  /**
   * Fragment duration in milliseconds
   */
  get duration(): number {
    return this.params.duration;
  }

  /**
   * Total number of frames to capture for this animation
   */
  get totalFrames(): number {
    return Math.ceil((this.fps * this.duration) / 1000);
  }

  /**
   * Whether we're in rendering mode (vs preview mode)
   */
  get isRendering(): boolean {
    return this.params.rendering;
  }

  /**
   * Number of frames captured so far
   */
  get capturedFrames(): number {
    return this.frameCount;
  }

  /**
   * Request frame capture and wait for Puppeteer ACK.
   * This function returns a Promise that resolves when the screenshot is complete.
   *
   * @param frameNumber - Explicit frame number (0-indexed). If not provided, uses internal counter.
   *                      The renderer will fill gaps between frame numbers with duplicates.
   *
   * In preview mode (not rendering), this is a no-op.
   */
  async captureFrame(frameNumber?: number): Promise<void> {
    if (!this.isRendering) return;

    const actualFrameNumber = frameNumber ?? this.frameCount;

    // Call the exposed function from Puppeteer
    // The promise won't resolve until Puppeteer completes the screenshot
    if (window.__stsCaptureFrame) {
      try {
        await window.__stsCaptureFrame(actualFrameNumber);
        this.frameCount++;
      } catch (error) {
        console.error('[AnimationCapture] Frame capture failed:', error);
        throw error;
      }
    } else {
      console.warn('[AnimationCapture] Frame capture not available - are you running in Puppeteer?');
    }
  }

  /**
   * Signal that rendering is complete
   */
  done(): void {
    if (this.isRendering) {
      document.dispatchEvent(new CustomEvent('sts-done-rendering'));
      console.log(
        `[AnimationCapture] Rendering complete: ${this.frameCount} frames @ ${this.fps}fps over ${this.duration}ms`
      );
    }
  }
}

/**
 * Auto-capture frames at the specified FPS for the fragment duration.
 * Each frame waits for Puppeteer ACK before proceeding.
 *
 * Usage:
 *   await captureAnimation(async (frameNumber, progress) => {
 *     // Update your animation state based on progress (0.0 to 1.0)
 *     setProgress(progress);
 *   });
 *
 * @param onFrame - Callback called before each frame capture
 *                  Receives frameNumber (0-indexed) and progress (0.0 to 1.0)
 */
export async function captureAnimation(
  onFrame: (frameNumber: number, progress: number) => void | Promise<void>
): Promise<void> {
  const capture = new AnimationCapture();

  if (!capture.isRendering) {
    // Preview mode - just call onFrame once for initial render
    await onFrame(0, 0);
    return;
  }

  const totalFrames = capture.totalFrames;

  for (let i = 0; i < totalFrames; i++) {
    const progress = totalFrames > 1 ? i / (totalFrames - 1) : 1;

    // Update app state
    await onFrame(i, progress);

    // Wait for React/DOM to render the changes
    // Double RAF ensures layout and paint are complete
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Request capture with explicit frame number and WAIT for Puppeteer ACK
    await capture.captureFrame(i);

    // Optional: maintain consistent timing (useful for debugging)
    // In production, Puppeteer's screenshot speed controls pacing
    if (i < totalFrames - 1) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  capture.done();
}

/**
 * TypeScript declarations for Puppeteer-injected functions
 */
declare global {
  interface Window {
    __stsCaptureFrame?: (frameNumber: number) => Promise<void>;
  }
}
