import type { ReactNode } from "react";
import styles from "./VideoFrame.module.css";

interface VideoFrameProps {
  children?: ReactNode;
  width?: number;
  height?: number;
}

export function VideoFrame({
  children,
  width = 1080,
  height = 1920,
}: VideoFrameProps) {
  return (
    <div className={styles.root}>
      <div
        className={styles.frame}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
