import { type ReactNode, useEffect } from "react";
import styles from "./RenderingView.module.css";

interface RenderingViewProps {
  children: ReactNode;
}

export function RenderingView({ children }: RenderingViewProps) {
  useEffect(() => {
    // Set up transparent background for video rendering
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.background = "transparent";

    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.background = "transparent";
    document.body.style.overflow = "hidden";

    // Note: __stsRenderComplete is handled by AnimationCapture.done() in animation.ts
    // Don't set it here as it would signal completion too early!
  }, []);

  return <div className={styles.container}>{children}</div>;
}
