import { useState, useEffect, useContext } from 'react';
import { captureAnimation, getAnimationParams } from '../animation';
import { ManualAnimationTimeContext, DurationOverrideContext } from '../components/VideoFrame/VideoFrame';

export interface UseAnimationProgressOptions {
  /**
   * Optional callback to execute for each frame.
   * Useful for custom logic beyond just setting progress.
   */
  onFrame?: (frameNumber: number, progress: number) => void | Promise<void>;
  /**
   * Manual time control for preview mode (in milliseconds).
   * When provided, the animation will be at this specific time instead of final state.
   */
  manualTime?: number;
  /**
   * Override duration for calculations (in milliseconds).
   * Useful when params.duration is 0 in preview mode.
   */
  durationOverride?: number;
}

export interface UseAnimationProgressResult {
  /** Current animation progress (0.0 to 1.0) */
  progress: number;
  /** Whether we're in rendering mode (vs preview) */
  isRendering: boolean;
  /** Current frame number (0-indexed) */
  frameNumber: number;
  /** Total number of frames */
  totalFrames: number;
  /** Animation parameters (fps, duration, rendering) */
  params: ReturnType<typeof getAnimationParams>;
}

/**
 * Hook to manage animation progress and frame capture.
 *
 * Automatically handles:
 * - Progress state management
 * - Preview vs rendering mode detection
 * - Frame-by-frame capture with proper timing
 *
 * @example
 * ```tsx
 * function MyAnimatedComponent() {
 *   const { progress } = useAnimationProgress();
 *
 *   const opacity = progress;
 *   const translateY = 50 * (1 - progress);
 *
 *   return <div style={{ opacity, transform: `translateY(${translateY}px)` }}>
 *     Animated Content
 *   </div>;
 * }
 * ```
 *
 * @example With custom frame logic
 * ```tsx
 * function MyComponent() {
 *   const { progress, frameNumber } = useAnimationProgress({
 *     onFrame: (frame, prog) => {
 *       console.log(`Rendering frame ${frame} at ${prog * 100}%`);
 *     }
 *   });
 *
 *   return <div>Frame: {frameNumber}, Progress: {progress}</div>;
 * }
 * ```
 */
export function useAnimationProgress(
  options: UseAnimationProgressOptions = {}
): UseAnimationProgressResult {
  const [progress, setProgress] = useState(0);
  const [frameNumber, setFrameNumber] = useState(0);
  const params = getAnimationParams();

  // Get manual time and duration from VideoFrame context if available
  const contextManualTime = useContext(ManualAnimationTimeContext);
  const contextDuration = useContext(DurationOverrideContext);
  const manualTime = options.manualTime ?? contextManualTime;

  const effectiveDuration = options.durationOverride ?? contextDuration ?? params.duration;
  const totalFrames = Math.ceil((params.fps * effectiveDuration) / 1000);

  useEffect(() => {
    if (!params.rendering) {
      // Preview mode
      if (manualTime !== undefined) {
        // Use manual time control for scrubbing
        const prog = effectiveDuration > 0 ? Math.min(1, Math.max(0, manualTime / effectiveDuration)) : 0;
        const frame = Math.floor((params.fps * manualTime) / 1000);
        setProgress(prog);
        setFrameNumber(frame);
      } else {
        // Default preview mode - show final state
        setProgress(1);
        setFrameNumber(0);
      }
      return;
    }

    // Rendering mode - capture animation frame by frame
    captureAnimation(async (frame, prog) => {
      setProgress(prog);
      setFrameNumber(frame);

      // Call optional custom frame handler
      if (options.onFrame) {
        await options.onFrame(frame, prog);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.rendering, manualTime, effectiveDuration]); // Intentionally exclude options.onFrame to prevent re-renders

  return {
    progress,
    isRendering: params.rendering,
    frameNumber,
    totalFrames,
    params,
  };
}
