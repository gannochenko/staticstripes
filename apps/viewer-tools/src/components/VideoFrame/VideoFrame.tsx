import { type ReactNode, useEffect, useRef, useState, useMemo, createContext, useCallback } from "react";
import { FormatPanel, FORMATS, type Format } from "../FormatPanel";
import { PreviewPanel, type ContentParams, type ParameterSchema } from "../PreviewPanel";
import { AnimationTimeline } from "../AnimationTimeline";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { getAnimationParams } from "../../animation";
import styles from "./VideoFrame.module.css";

// Context for providing manual animation time from VideoFrame to apps
export const ManualAnimationTimeContext = createContext<number | undefined>(undefined);

// Context for providing duration override to apps
export const DurationOverrideContext = createContext<number | undefined>(undefined);

interface VideoFrameProps<T extends ContentParams = ContentParams> {
  storageKey?: string;
  initialContent?: Partial<T>;
  schema?: ParameterSchema;
  /**
   * Animation duration in milliseconds for preview mode.
   * Defaults to 5000ms (5 seconds).
   */
  duration?: number;
  children: (content: T) => ReactNode;
}

export function VideoFrame<T extends ContentParams = ContentParams>({
  storageKey = "viewer-tools:content",
  initialContent,
  schema,
  duration: initialDuration = 5000,
  children,
}: VideoFrameProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<Format>(FORMATS[1]); // default: YT Shorts
  const [scale, setScale] = useState(1);
  const [duration, setDuration] = useState(initialDuration); // Editable duration
  const [displayTime, setDisplayTime] = useState(0); // For knob visual position (instant)
  const [contentTime, setContentTime] = useState(0); // For content updates (throttled)
  const throttleTimeoutRef = useRef<number | null>(null);

  // Get animation params
  const params = getAnimationParams();
  const effectiveDuration = params.duration === 0 ? duration : params.duration;

  // Time change handler - updates knob instantly, content throttled
  const handleTimeChange = useCallback((time: number) => {
    // Update display immediately for smooth knob movement
    setDisplayTime(time);

    // Throttle content updates to 60fps
    if (throttleTimeoutRef.current !== null) {
      window.clearTimeout(throttleTimeoutRef.current);
    }

    throttleTimeoutRef.current = window.setTimeout(() => {
      console.log(`[VideoFrame] setContentTime(${time})`);
      setContentTime(time);
      throttleTimeoutRef.current = null;
    }, 16);
  }, []);

  // Compute default content from schema
  const defaultContent = useMemo<T>(() => {
    if (!schema) {
      return {
        title: "",
        date: "",
        tags: "",
      } as unknown as T;
    }

    const defaults: Record<string, string> = {};
    schema.fields.forEach((field) => {
      defaults[field.name] = field.defaultValue || "";
    });
    return defaults as unknown as T;
  }, [schema]);

  const [content, setContent] = useLocalStorage<T>(storageKey, {
    ...defaultContent,
    ...initialContent,
  } as T);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      setScale(Math.min(cw / format.width, ch / format.height));
    });

    observer.observe(root);
    return () => observer.disconnect();
  }, [format.width, format.height]);

  // Cleanup throttle timeout on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current !== null) {
        window.clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <div
        className={styles.frame}
        style={{
          width: `${format.width}px`,
          height: `${format.height}px`,
          transform: `scale(${scale})`,
        }}
      >
        <DurationOverrideContext.Provider value={effectiveDuration}>
          <ManualAnimationTimeContext.Provider value={contentTime}>
            {children(content)}
          </ManualAnimationTimeContext.Provider>
        </DurationOverrideContext.Provider>
      </div>
      <FormatPanel selected={format} onSelect={setFormat} />
      <PreviewPanel value={content} onChange={setContent} schema={schema} />
      <AnimationTimeline
        duration={effectiveDuration}
        fps={params.fps}
        currentTime={displayTime}
        onTimeChange={handleTimeChange}
        onDurationChange={setDuration}
      />
    </div>
  );
}
