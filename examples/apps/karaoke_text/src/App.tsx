import { useMemo, useRef } from "react";
import {
  VideoFrame,
  RenderingView,
  useAppParams,
  useAnimationProgress,
} from "@gannochenko/viewer-tools";
import "@gannochenko/viewer-tools/styles.css";
import { PARAMETER_SCHEMA, type AppParams, type WordTiming } from "./schema";

interface KaraokeTextProps {
  words: WordTiming[];
  windowSize: number;
  fontSize: number;
  textColor: string;
  highlightColor: string;
}

function KaraokeText({
  words,
  windowSize,
  fontSize,
  textColor,
  highlightColor: _highlightColor,
}: KaraokeTextProps) {
  const capturedFrameIndexRef = useRef<Set<number>>(new Set());

  // Pre-process words into chunks based on significant pauses
  const chunks = useMemo(() => {
    const PAUSE_THRESHOLD_MS = 200; // Pauses longer than 200ms create a new chunk
    const result: Array<{ words: typeof words; startTime: number; endTime: number }> = [];
    let currentChunk: typeof words = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const prevWord = words[i - 1];

      // Check if there's a significant pause before this word
      if (prevWord && word.start - prevWord.end >= PAUSE_THRESHOLD_MS / 1000) {
        // Save current chunk and start new one
        if (currentChunk.length > 0) {
          result.push({
            words: currentChunk,
            startTime: currentChunk[0].start,
            endTime: currentChunk[currentChunk.length - 1].end,
          });
        }
        currentChunk = [word];
      } else {
        currentChunk.push(word);
      }
    }

    // Add the last chunk
    if (currentChunk.length > 0) {
      result.push({
        words: currentChunk,
        startTime: currentChunk[0].start,
        endTime: currentChunk[currentChunk.length - 1].end,
      });
    }

    return result;
  }, [words]);

  const { progress, isRendering, frameNumber, params, duration } = useAnimationProgress({
    onFrame: (frame, prog) => {
      // Calculate current time in seconds
      const currentTime = (prog * duration) / 1000;

      // Find active chunk
      let activeChunkIdx = -1;
      for (let i = 0; i < chunks.length; i++) {
        if (currentTime >= chunks[i].startTime) {
          activeChunkIdx = i;
        }
        if (currentTime < chunks[i].startTime) {
          break;
        }
      }

      const chunk = activeChunkIdx >= 0 ? chunks[activeChunkIdx] : null;
      const currentWordIndex = chunk?.words.findIndex(
        (w) => currentTime >= w.start && currentTime < w.end
      ) ?? -1;

      console.log(
        `Frame ${frame}: time=${currentTime.toFixed(2)}s, chunk=${activeChunkIdx}, word=${currentWordIndex >= 0 && chunk ? chunk.words[currentWordIndex].word : "none"}`
      );

      // Capture frames at word boundaries
      const globalWordIndex = chunk && currentWordIndex >= 0
        ? words.findIndex(w => w.word === chunk.words[currentWordIndex].word && w.start === chunk.words[currentWordIndex].start)
        : -1;

      if (globalWordIndex >= 0 && !capturedFrameIndexRef.current.has(globalWordIndex)) {
        capturedFrameIndexRef.current.add(globalWordIndex);
        console.log(`  → Capturing frame for word "${words[globalWordIndex].word}"`);
      }
    },
  });

  // Calculate current time from progress
  const currentTime = (progress * duration) / 1000;

  console.log(`[KaraokeText RENDER] progress=${progress.toFixed(3)}, currentTime=${currentTime.toFixed(3)}s, duration=${duration}`);

  // Find the active chunk based on current time
  const { activeChunk, currentWordIndexInChunk } = useMemo(() => {
    // Find which chunk we're currently in
    let chunkIndex = -1;
    for (let i = 0; i < chunks.length; i++) {
      if (currentTime >= chunks[i].startTime && currentTime < chunks[i].endTime) {
        chunkIndex = i;
        break;
      }
      // If we're past this chunk, keep track of it as the last completed chunk
      if (currentTime >= chunks[i].endTime) {
        chunkIndex = i;
      }
    }

    if (chunkIndex < 0) {
      return { activeChunk: null, currentWordIndexInChunk: -1 };
    }

    const chunk = chunks[chunkIndex];

    // Find current word within the chunk
    const wordIndex = chunk.words.findIndex(
      (w) => currentTime >= w.start && currentTime < w.end
    );

    return { activeChunk: chunk, currentWordIndexInChunk: wordIndex };
  }, [chunks, currentTime]);

  // Calculate paging window within the active chunk
  const { visibleWords, highlightIndex } = useMemo(() => {
    if (!activeChunk) {
      return { visibleWords: [], highlightIndex: -1 };
    }

    const chunkWords = activeChunk.words;

    // Find the last word that has been completed or is currently active
    let lastActiveWordIndex = -1;
    for (let i = chunkWords.length - 1; i >= 0; i--) {
      if (currentTime >= chunkWords[i].start) {
        lastActiveWordIndex = i;
        break;
      }
    }

    // If no word has started yet, don't show anything
    if (lastActiveWordIndex < 0) {
      return { visibleWords: [], highlightIndex: -1 };
    }

    // Calculate which page contains the last active word
    const pageIndex = Math.floor(lastActiveWordIndex / windowSize);
    const startIndex = pageIndex * windowSize;

    // Get the words for this page
    const visible = chunkWords.slice(startIndex, startIndex + windowSize).map((w, i) => ({
      ...w,
      index: startIndex + i,
    }));

    // Determine highlight: only if a word is currently being spoken
    let highlight = -1;
    if (currentWordIndexInChunk >= 0) {
      highlight = currentWordIndexInChunk % windowSize;
    } else {
      // If we're past the chunk end time, hide all text (pause or finished)
      if (currentTime >= activeChunk.endTime) {
        return { visibleWords: [], highlightIndex: -1 };
      }
    }

    return { visibleWords: visible, highlightIndex: highlight };
  }, [activeChunk, currentWordIndexInChunk, currentTime, windowSize, chunks]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        background: "transparent",
        gap: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "15px",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {visibleWords.map((word, i) => {
          const isHighlighted = i === highlightIndex;

          return (
            <span
              key={`${word.index}-${word.word}`}
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: "bold",
                color: isHighlighted ? "#000000" : textColor,
                textShadow: isHighlighted
                  ? "none"
                  : "0 2px 10px rgba(0, 0, 0, 0.5)",
                background: isHighlighted ? "#ffffff" : "transparent",
                padding: isHighlighted ? "8px 20px" : "0",
                borderRadius: isHighlighted ? "12px" : "0",
                transition: params.rendering ? "none" : "all 0.2s ease-out",
                transform: isHighlighted ? "scale(1.1)" : "scale(1)",
                display: "inline-block",
              }}
            >
              {word.word}
            </span>
          );
        })}
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
          Time: {currentTime.toFixed(2)}s<br />
          Current word: {currentWordIndexInChunk >= 0 && activeChunk ? activeChunk.words[currentWordIndexInChunk].word : "none"}
          <br />
          FPS: {params.fps}
          <br />
          Duration: {params.duration}ms
        </div>
      )}
    </div>
  );
}

export default function App() {
  const params = useAppParams();
  const { rendering } = params;

  // Parse parameters
  const words: WordTiming[] = useMemo(() => {
    try {
      const parsed = JSON.parse(params.words || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.words]);

  const windowSize = parseInt(params.windowSize || "3", 10);
  const fontSize = parseInt(params.fontSize || "72", 10);
  const textColor = params.textColor || "#ffffff";
  const highlightColor = params.highlightColor || "#ffff00";

  if (rendering) {
    return (
      <RenderingView>
        <div style={{ width: "100%", height: "100%", background: "transparent" }}>
          <KaraokeText
            words={words}
            windowSize={windowSize}
            fontSize={fontSize}
            textColor={textColor}
            highlightColor={highlightColor}
          />
        </div>
      </RenderingView>
    );
  }

  // Preview mode with VideoFrame for parameter editing
  return (
    <VideoFrame<AppParams>
      storageKey="karaoke_text:content"
      initialContent={{
        words: params.words || PARAMETER_SCHEMA.fields.find(f => f.name === "words")?.defaultValue || "[]",
        windowSize: params.windowSize || "3",
        fontSize: params.fontSize || "72",
        textColor: params.textColor || "#ffffff",
        highlightColor: params.highlightColor || "#ffff00",
      }}
      schema={PARAMETER_SCHEMA}
      duration={3000}
    >
      {(content) => (
        <div style={{ width: "100%", height: "100%" }}>
          <KaraokeText
            words={(() => {
              try {
                const parsed = JSON.parse(content.words);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()}
            windowSize={parseInt(content.windowSize, 10)}
            fontSize={parseInt(content.fontSize, 10)}
            textColor={content.textColor}
            highlightColor={content.highlightColor}
          />
        </div>
      )}
    </VideoFrame>
  );
}
