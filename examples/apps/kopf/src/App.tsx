import "@gannochenko/viewer-tools/styles.css";
import { VideoFrame, RenderingView } from "@gannochenko/viewer-tools";
import { useAppParams } from "./hooks/useAppParams";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

const OUTLINE =
  "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000," +
  " 0 -3px 0 #000,   0  3px 0 #000,  -3px 0  0 #000,  3px  0  0 #000";

function TopLabel({ text, subtext }: { text: string; subtext: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "8%",
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5em",
        padding: "0 6%",
        fontFamily: "'Montserrat', sans-serif",
        textAlign: "center",
        textShadow: OUTLINE,
        color: "#ffffff",
        lineHeight: 1,
      }}
    >
      <div
        style={{
          fontSize: "4.5rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
          lineHeight: "130%",
        }}
      >
        {text}
      </div>
      <div
        style={{
          fontSize: "2.5rem",
          fontWeight: 400,
          letterSpacing: "0.04em",
          paddingTop: "5rem",
        }}
      >
        {subtext}
      </div>
    </div>
  );
}

export default function App() {
  const { text, subtext, rendering } = useAppParams();
  const resolvedText = text ?? "Grafrat, Solingen";
  const resolvedSubtext = subtext ?? "hidden gem";

  if (rendering) {
    return (
      <RenderingView>
        <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
          <TopLabel text={resolvedText} subtext={resolvedSubtext} />
        </div>
      </RenderingView>
    );
  }

  return (
    <VideoFrame<AppParams>
      storageKey="kopf:content"
      initialContent={{ text: resolvedText, subtext: resolvedSubtext }}
      schema={PARAMETER_SCHEMA}
    >
      {(content) => (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <TopLabel text={content.text} subtext={content.subtext} />
        </div>
      )}
    </VideoFrame>
  );
}
