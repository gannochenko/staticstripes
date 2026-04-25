import { useRef, useState, useLayoutEffect, useEffect } from "react";
import "@gannochenko/viewer-tools/styles.css";
import { VideoFrame, RenderingView, useAppParams, AnimationCapture } from "@gannochenko/viewer-tools";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

// ---------------------------------------------------------------------------
// SVG path builder with smart corner detection
// Each text line gets its own white shape. Where two lines touch, we compare
// edge positions to determine which corners should be concave vs round.
//
// Outer (convex) corner:  a r,r 0 0 1  dx,dy
// Inner (concave) corner: a r,r 0 0 0  dx,dy
// ---------------------------------------------------------------------------

const RO = 18; // outer radius

type CornerType = "round" | "concave";

interface LineGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  topLeft: CornerType;
  topRight: CornerType;
  bottomLeft: CornerType;
  bottomRight: CornerType;
}

const r = RO;

function buildPathWithCorners(geom: LineGeometry): string {
  const { width, height, topLeft, topRight, bottomLeft, bottomRight } = geom;

  const x = 0;
  const y = 0;

  return [
    `M ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    drawTRCorner(x + width - r, y, topRight === "concave"),
    `L ${x + width} ${y + height - r}`,
    drawBRCorner(x + width, y + height - r, bottomRight === "concave"),
    `L ${x + r} ${y + height}`,
    drawBLCorner(x + r, y + height, bottomLeft === "concave"),
    `L ${x} ${y + r}`,
    drawTLCorner(x, y + r, topLeft === "concave"),
    "Z",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Line detection using span elements
// ---------------------------------------------------------------------------

interface DetectedLine {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function detectLines(container: HTMLElement): DetectedLine[] {
  const spans = container.querySelectorAll("span[data-word]");
  if (spans.length === 0) return [];

  const lines: DetectedLine[] = [];
  let currentLine: DetectedLine | null = null;

  spans.forEach((span) => {
    const rect = span.getBoundingClientRect();

    if (!currentLine || rect.top > currentLine.bottom - 5) {
      // New line detected (5px tolerance for same line)
      if (currentLine) lines.push(currentLine);
      currentLine = {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    } else {
      // Same line, extend bounds
      currentLine.left = Math.min(currentLine.left, rect.left);
      currentLine.right = Math.max(currentLine.right, rect.right);
      currentLine.top = Math.min(currentLine.top, rect.top);
      currentLine.bottom = Math.max(currentLine.bottom, rect.bottom);
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

// ---------------------------------------------------------------------------
// Determine corner types based on adjacent line widths
// ---------------------------------------------------------------------------

function determineCornerTypes(lines: DetectedLine[]): LineGeometry[] {
  return lines.map((line, i) => {
    const isFirst = i === 0;
    const isLast = i === lines.length - 1;
    const prevLine = i > 0 ? lines[i - 1] : null;
    const nextLine = i < lines.length - 1 ? lines[i + 1] : null;

    let topLeft: CornerType = "round";
    let topRight: CornerType = "round";
    let bottomLeft: CornerType = "round";
    let bottomRight: CornerType = "round";

    const currentWidth = line.right - line.left;

    // First line always has round top corners
    // Last line always has round bottom corners

    // Compare with previous line for top corners
    if (prevLine && !isFirst) {
      const prevWidth = prevLine.right - prevLine.left;
      const widthDiff = Math.abs(prevWidth - currentWidth);

      if (widthDiff >= r * 2) {
        // Enough difference to place concave corners
        if (prevWidth > currentWidth) {
          // Previous line is wider - it gets round, current gets concave
          topLeft = "concave";
          topRight = "concave";
        }
        // If current is wider, previous gets concave (handled in its bottom corners)
      }
    }

    // Compare with next line for bottom corners
    if (nextLine && !isLast) {
      const nextWidth = nextLine.right - nextLine.left;
      const widthDiff = Math.abs(currentWidth - nextWidth);

      if (widthDiff >= r * 2) {
        // Enough difference to place concave corners
        if (currentWidth > nextWidth) {
          // Current line is wider - it gets round, next gets concave (handled there)
          bottomLeft = "round";
          bottomRight = "round";
        } else {
          // Next line is wider - current gets concave
          bottomLeft = "concave";
          bottomRight = "concave";
        }
      }
    }

    return {
      x: line.left,
      y: line.top,
      width: currentWidth,
      height: line.bottom - line.top,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    };
  });
}

// ---------------------------------------------------------------------------
// Main label component
// ---------------------------------------------------------------------------

function TextLine({ children, fontSize, fontWeight }: { children: string; fontSize: string; fontWeight: number }) {
  const textRef = useRef<HTMLDivElement>(null);
  const [geometries, setGeometries] = useState<LineGeometry[]>([]);
  const [leftEdgeWords, setLeftEdgeWords] = useState<Set<number>>(new Set());
  const [rightEdgeWords, setRightEdgeWords] = useState<Set<number>>(new Set());

  // Split text into words wrapped in spans
  const words = children.split(/\s+/).filter(Boolean);

  useLayoutEffect(() => {
    if (!textRef.current) return;

    const calculateGeometries = () => {
      if (!textRef.current) return;

      const lines = detectLines(textRef.current);
      const containerRect = textRef.current.getBoundingClientRect();

      // Convert absolute positions to relative
      const relativeLines = lines.map((line) => ({
        left: line.left - containerRect.left,
        right: line.right - containerRect.left,
        top: line.top - containerRect.top,
        bottom: line.bottom - containerRect.top,
      }));

      const geoms = determineCornerTypes(relativeLines);
      setGeometries(geoms);

      // Detect which words are at line edges
      const spans = textRef.current.querySelectorAll("span[data-word]");
      const leftEdges = new Set<number>();
      const rightEdges = new Set<number>();

      lines.forEach((line) => {
        let leftmostIndex = -1;
        let rightmostIndex = -1;
        let leftmostX = Infinity;
        let rightmostX = -Infinity;

        spans.forEach((span, idx) => {
          const rect = span.getBoundingClientRect();
          // Check if span is on this line (with 5px tolerance)
          if (Math.abs(rect.top - line.top) < 5) {
            if (rect.left < leftmostX) {
              leftmostX = rect.left;
              leftmostIndex = idx;
            }
            if (rect.right > rightmostX) {
              rightmostX = rect.right;
              rightmostIndex = idx;
            }
          }
        });

        if (leftmostIndex !== -1) leftEdges.add(leftmostIndex);
        if (rightmostIndex !== -1) rightEdges.add(rightmostIndex);
      });

      setLeftEdgeWords(leftEdges);
      setRightEdgeWords(rightEdges);
    };

    // Initial calculation
    calculateGeometries();

    // Watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      calculateGeometries();
    });
    resizeObserver.observe(textRef.current);

    // Watch for content/DOM changes
    const mutationObserver = new MutationObserver(() => {
      calculateGeometries();
    });
    mutationObserver.observe(textRef.current, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [children, fontSize, fontWeight]);

  return (
    <div className="text-line-container">
      {geometries.map((geom, i) => {
        const svgWidth = geom.width + r * 2;

        return (
          <svg
            key={i}
            width={svgWidth}
            height={geom.height}
            className="text-line-svg"
            style={{
              left: geom.x - r,
              top: geom.y,
            }}
          >
            <path d={buildPathWithCorners(geom)} fill="white" transform={`translate(${r}, 0)`} />
          </svg>
        );
      })}
      <div
        ref={textRef}
        className="text-line-content"
        style={{
          fontSize,
          fontWeight,
        }}
      >
        {words.map((word, i) => {
          const isLeftEdge = leftEdgeWords.has(i);
          const isRightEdge = rightEdgeWords.has(i);
          const className = [
            "text-line-word",
            isLeftEdge && "text-line-word--left-edge",
            isRightEdge && "text-line-word--right-edge",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span key={i} data-word className={className}>
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TafelLabel({
  title,
  verticalOffset,
  fontSize,
}: {
  title: string;
  verticalOffset: string;
  fontSize: string;
}) {
  const offset = parseFloat(verticalOffset) || 0;
  const titleFontSize = parseFloat(fontSize) || 4.5;

  return (
    <div
      className="tafel-label-container"
      style={{
        top: `${offset}%`,
      }}
    >
      {title && (
        <TextLine fontSize={`${titleFontSize}rem`} fontWeight={700}>
          {title}
        </TextLine>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const { title, verticalOffset, fontSize, rendering } = useAppParams();
  const resolvedTitle = title ?? "Grafrat – hidden gem";
  const resolvedVerticalOffset = verticalOffset ?? "20";
  const resolvedFontSize = fontSize ?? "4.5";

  useEffect(() => {
    if (!rendering) return;

    const capture = new AnimationCapture();
    if (!capture.isRendering) return;

    let cancelled = false;
    (async () => {
      // Double RAF ensures layout and paint are complete before screenshot
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      if (cancelled) return;
      // Capture frame 0 — mergeFramesToVideo duplicates it to fill the full duration
      await capture.captureFrame(0);
      capture.done();
    })();

    return () => {
      cancelled = true;
    };
  }, [rendering]);

  if (rendering) {
    return (
      <RenderingView>
        <div className="app-rendering-container">
          <TafelLabel title={resolvedTitle} verticalOffset={resolvedVerticalOffset} fontSize={resolvedFontSize} />
        </div>
      </RenderingView>
    );
  }

  return (
    <VideoFrame<AppParams>
      storageKey="tafel:content"
      initialContent={{
        title: resolvedTitle,
        verticalOffset: resolvedVerticalOffset,
        fontSize: resolvedFontSize,
      }}
      schema={PARAMETER_SCHEMA}
    >
      {(content) => (
        <div className="app-frame-container">
          <TafelLabel title={content.title} verticalOffset={content.verticalOffset} fontSize={content.fontSize} />
        </div>
      )}
    </VideoFrame>
  );
}

function drawTRCorner(x: number, y: number, concave: boolean): string {
  if (concave) {
    return `L ${x + r + r} ${y} A ${r} ${r} 0 0 0 ${x + r} ${y + r}`;
  }

  return `A ${r} ${r} 0 0 1 ${x + r} ${y + r}`;
}

function drawBRCorner(x: number, y: number, concave: boolean): string {
  if (concave) {
    return `A ${r} ${r} 0 0 0 ${x + r} ${y + r} L ${x} ${y + r}`;
  }

  return `A ${r} ${r} 0 0 1 ${x - r} ${y + r}`;
}

function drawBLCorner(x: number, y: number, concave: boolean): string {
  if (concave) {
    return `L ${x - r - r} ${y} A ${r} ${r} 0 0 0 ${x - r} ${y - r}`;
  }

  return `A ${r} ${r} 0 0 1 ${x - r} ${y - r}`;
}

function drawTLCorner(x: number, y: number, concave: boolean): string {
  if (concave) {
    return `A ${r} ${r} 0 0 0 ${x - r} ${y - r} L ${x} ${y - r} `;
  }

  return `A ${r} ${r} 0 0 1 ${x + r} ${y - r}`;
}
