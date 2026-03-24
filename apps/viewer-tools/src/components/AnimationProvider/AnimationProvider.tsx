import { ReactNode, createContext, useContext, useState } from "react";
import { AnimationTimeline } from "../AnimationTimeline";
import {
  useAnimationProgress,
  UseAnimationProgressOptions,
  UseAnimationProgressResult,
} from "../../hooks/useAnimationProgress";
import { getAnimationParams } from "../../animation";

interface AnimationContextValue extends UseAnimationProgressResult {
  currentTime: number; // milliseconds
}

const AnimationContext = createContext<AnimationContextValue | null>(null);

interface AnimationProviderProps extends UseAnimationProgressOptions {
  children: ReactNode;
  /**
   * Default duration for preview mode when not specified in URL (in milliseconds).
   * Defaults to 5000ms (5 seconds).
   */
  defaultDuration?: number;
}

/**
 * AnimationProvider wraps content and provides animation progress with timeline scrubbing.
 *
 * In preview mode, shows an interactive timeline bar for scrubbing through the animation.
 * In rendering mode, captures frames automatically without showing the timeline.
 *
 * @example
 * ```tsx
 * function MyAnimatedComponent() {
 *   const { progress } = useAnimation();
 *   return <div style={{ opacity: progress }}>Content</div>;
 * }
 *
 * function App() {
 *   return (
 *     <AnimationProvider>
 *       <MyAnimatedComponent />
 *     </AnimationProvider>
 *   );
 * }
 * ```
 */
export function AnimationProvider({ children, defaultDuration = 5000, ...options }: AnimationProviderProps) {
  const [manualTime, setManualTime] = useState(0);

  // Get initial params to determine effective duration
  const initialParams = getAnimationParams();
  const effectiveDuration = !initialParams.rendering && initialParams.duration === 0 ? defaultDuration : initialParams.duration;

  const animationResult = useAnimationProgress({
    ...options,
    manualTime,
    durationOverride: effectiveDuration,
  });

  const { isRendering, params } = animationResult;
  const currentTime = isRendering ? 0 : manualTime;

  const contextValue: AnimationContextValue = {
    ...animationResult,
    currentTime,
  };

  return (
    <AnimationContext.Provider value={contextValue}>
      {children}
      {!isRendering && (
        <AnimationTimeline
          duration={effectiveDuration}
          fps={params.fps}
          currentTime={currentTime}
          onTimeChange={setManualTime}
        />
      )}
    </AnimationContext.Provider>
  );
}

/**
 * Hook to access animation progress and state from AnimationProvider.
 * Must be used within an AnimationProvider component.
 */
export function useAnimation(): AnimationContextValue {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error("useAnimation must be used within AnimationProvider");
  }
  return context;
}
