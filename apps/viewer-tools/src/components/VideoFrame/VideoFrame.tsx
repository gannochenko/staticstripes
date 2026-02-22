import { type ReactNode, useEffect, useRef, useState, useMemo } from "react";
import { FormatPanel, FORMATS, type Format } from "../FormatPanel";
import { PreviewPanel, type ContentParams, type ParameterSchema } from "../PreviewPanel";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import styles from "./VideoFrame.module.css";

interface VideoFrameProps<T extends ContentParams = ContentParams> {
  storageKey?: string;
  initialContent?: Partial<T>;
  schema?: ParameterSchema;
  children: (content: T) => ReactNode;
}

export function VideoFrame<T extends ContentParams = ContentParams>({
  storageKey = "viewer-tools:content",
  initialContent,
  schema,
  children,
}: VideoFrameProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<Format>(FORMATS[1]); // default: YT Shorts
  const [scale, setScale] = useState(1);

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
      <PreviewPanel value={content} onChange={setContent} schema={schema} />
    </div>
  );
}
