import "./index.css";
import "./App.css";
import "@gannochenko/viewer-tools/styles.css";
import { VideoFrame, RenderingView, useAnimationProgress } from "@gannochenko/viewer-tools";
import { useAppParams } from "./hooks/useAppParams";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

function GeoSchild({ text, opacity }: { text: string; opacity: number }) {
  return (
    <div className="geo-schild" style={{ opacity }}>
      <span className="geo-schild__pin">📍</span>
      <span className="geo-schild__text">{text}</span>
    </div>
  );
}

export default function App() {
  const { text, rendering } = useAppParams();

  const resolvedText = text ?? "Prague, Czech Republic";

  if (rendering) {
    // Use animation progress hook (required for frame capture)
    useAnimationProgress();

    // Always fully visible - no fades
    const opacity = 1;

    return (
      <RenderingView>
        <div className="geo-root geo-root--fullscreen">
          <GeoSchild text={resolvedText} opacity={opacity} />
        </div>
      </RenderingView>
    );
  }

  return (
    <VideoFrame<AppParams>
      storageKey="geo:content"
      initialContent={{ text: resolvedText }}
      schema={PARAMETER_SCHEMA}
    >
      {(content) => (
        <div className="geo-root">
          <GeoSchild text={content.text} />
        </div>
      )}
    </VideoFrame>
  );
}
