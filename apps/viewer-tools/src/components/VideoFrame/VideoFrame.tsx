import { type ReactNode, useEffect, useRef, useState } from "react";
import { FormatPanel, FORMATS, type Format } from "../FormatPanel";
import { PreviewPanel, type ContentParams } from "../PreviewPanel";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import styles from "./VideoFrame.module.css";

const STORAGE_KEY = "central_text:content";

const DEFAULT_CONTENT: ContentParams = {
  title: "Central Text",
  date: "",
  tags: "",
  extra: "",
};

interface VideoFrameProps {
  initialContent?: Partial<ContentParams>;
  children: (content: ContentParams) => ReactNode;
}

export function VideoFrame({ initialContent, children }: VideoFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<Format>(FORMATS[1]); // default: YT Shorts
  const [scale, setScale] = useState(1);
  const [content, setContent] = useLocalStorage<ContentParams>(STORAGE_KEY, {
    ...DEFAULT_CONTENT,
    ...initialContent,
  });

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
        {children(content)}
      </div>
      <FormatPanel selected={format} onSelect={setFormat} />
      <PreviewPanel value={content} onChange={setContent} />
    </div>
  );
}
