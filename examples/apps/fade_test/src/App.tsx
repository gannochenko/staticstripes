import {
  VideoFrame,
  RenderingView,
  useAppParams,
  useAnimationProgress,
} from "@gannochenko/viewer-tools";
import "@gannochenko/viewer-tools/styles.css";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

interface AnimatedFadeProps {
  text: string;
}

function AnimatedFade({ text }: AnimatedFadeProps) {
  const { progress, isRendering, frameNumber, params } = useAnimationProgress({
    onFrame: (frame, prog) => {
      console.log(`Frame ${frame}: progress=${prog.toFixed(2)}`);
    },
  });

  const opacity = progress;
  const translateY = 50 * (1 - progress);
  const scale = 0.8 + 0.2 * progress;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        background: "transparent",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          transition: params.rendering ? "none" : "all 0.3s ease-out",
          fontSize: "4rem",
          fontWeight: "bold",
          color: "#ffffff",
          textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        {text}
      </div>

      {isRendering && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            color: "#ffffff",
            fontSize: "12px",
            fontFamily: "monospace",
            padding: "8px",
            borderRadius: "4px",
          }}
        >
          Frame: {frameNumber} ({Math.round(progress * 100)}%)<br />
          FPS: {params.fps}
          <br />
          Duration: {params.duration}ms
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { text, rendering } = useAppParams();
  const resolvedText = text ?? "Animated Text";

  if (rendering) {
    return (
      <RenderingView>
        <div style={{ width: "100%", height: "100%", background: "transparent" }}>
          <AnimatedFade text={resolvedText} />
        </div>
      </RenderingView>
    );
  }

  // Preview mode with VideoFrame for parameter editing
  return (
    <VideoFrame<AppParams>
      storageKey="fade_test:content"
      initialContent={{
        text: resolvedText,
      }}
      schema={PARAMETER_SCHEMA}
      duration={3000}
    >
      {(content) => (
        <div style={{ width: "100%", height: "100%" }}>
          <AnimatedFade text={content.text} />
        </div>
      )}
    </VideoFrame>
  );
}
