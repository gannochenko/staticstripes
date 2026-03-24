import { useEffect, useRef, useState } from "react";
import styles from "./AnimationTimeline.module.css";

interface AnimationTimelineProps {
  duration: number; // milliseconds
  fps: number;
  currentTime: number; // milliseconds
  onTimeChange: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export function AnimationTimeline({
  duration,
  fps,
  currentTime,
  onTimeChange,
  onDurationChange,
}: AnimationTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [durationInput, setDurationInput] = useState(duration.toString());

  // Sync input when duration changes externally
  useEffect(() => {
    setDurationInput(duration.toString());
  }, [duration]);

  const totalFrames = Math.ceil((fps * duration) / 1000);
  const currentFrame = Math.floor((fps * currentTime) / 1000);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDurationInput(value);

    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0 && onDurationChange) {
      onDurationChange(parsed);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    return `${seconds.toFixed(2)}s`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateTime(e);
  };

  const updateTime = (e: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const progress = x / rect.width;
    const newTime = Math.floor(progress * duration);

    onTimeChange(newTime);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      updateTime(e);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, duration]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={styles.container}>
      <div className={styles.info}>
        <span className={styles.label}>Frame {currentFrame} / {totalFrames}</span>
        <span className={styles.label}>{formatTime(currentTime)}</span>
        {onDurationChange && (
          <div className={styles.durationControl}>
            <label className={styles.durationLabel}>Duration (ms):</label>
            <input
              type="number"
              className={styles.durationInput}
              value={durationInput}
              onChange={handleDurationChange}
              min="100"
              step="100"
            />
          </div>
        )}
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
      >
        <div
          className={styles.progress}
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className={styles.knob}
          style={{ left: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
