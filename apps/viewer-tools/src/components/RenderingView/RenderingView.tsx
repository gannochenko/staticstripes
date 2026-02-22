import { type ReactNode, useEffect } from "react";
import styles from "./RenderingView.module.css";

interface RenderingViewProps {
  children: ReactNode;
}

export function RenderingView({ children }: RenderingViewProps) {
  useEffect(() => {
    document.body.style.background = "transparent";
    (window as unknown as Record<string, unknown>)["__stsRenderComplete"] = true;
  }, []);

  return <div className={styles.container}>{children}</div>;
}
