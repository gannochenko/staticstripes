# @gannochenko/viewer-tools

React components for video frame preview and rendering.

## Installation

```bash
npm install @gannochenko/viewer-tools
```

## Usage

```tsx
import { VideoFrame, RenderingView, FormatPanel } from "@gannochenko/viewer-tools";
import "@gannochenko/viewer-tools/styles.css";

// VideoFrame example
function App() {
  return (
    <VideoFrame initialContent={{ title: "Hello", date: "", tags: "", extra: "" }}>
      {(content) => <div>{content.title}</div>}
    </VideoFrame>
  );
}

// RenderingView example
function RenderApp() {
  return <RenderingView title="Hello World" />;
}
```

## Components

### VideoFrame

Provides a scalable video frame container with format selection and preview controls.

### RenderingView

A wrapper component that marks the rendering as complete for automated rendering tools.

### FormatPanel

A UI panel for selecting video formats (YouTube, YT Shorts, etc.).

## License

MIT
