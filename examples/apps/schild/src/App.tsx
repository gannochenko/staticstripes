import "@gannochenko/viewer-tools/styles.css";
import { VideoFrame, RenderingView } from "@gannochenko/viewer-tools";
import { useAppParams } from "./hooks/useAppParams";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

function LowerThird({
  title,
  narration,
}: {
  title: string;
  narration: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "18%",
        left: "4%",
        right: "4%",
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(6px)",
        borderRadius: "6px",
        padding: "0.7em 1em",
        borderLeft: "10px solid rgba(255, 255, 255, 0.7)",
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: "3rem",
          fontWeight: 400,
          color: "#ffffff",
          letterSpacing: "0.05em",
          lineHeight: 1.2,
          marginBottom: "0.3em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: "2.2rem",
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.78)",
          letterSpacing: "0.01em",
          lineHeight: 1.4,
        }}
      >
        {narration}
      </div>
    </div>
  );
}

export default function App() {
  const { title, narration, rendering } = useAppParams();

  const resolvedTitle = title ?? "Grafrat – hidden gem of Solingen";
  const resolvedNarration =
    narration ?? "A quiet corner most locals don't even know about.";

  if (rendering) {
    return (
      <RenderingView>
        <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
          <LowerThird title={resolvedTitle} narration={resolvedNarration} />
        </div>
      </RenderingView>
    );
  }

  return (
    <VideoFrame<AppParams>
      storageKey="schild:content"
      initialContent={{ title: resolvedTitle, narration: resolvedNarration }}
      schema={PARAMETER_SCHEMA}
    >
      {(content) => (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <LowerThird title={content.title} narration={content.narration} />
        </div>
      )}
    </VideoFrame>
  );
}
