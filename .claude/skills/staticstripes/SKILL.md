---
name: staticstripes
description: You are an expert at using staticstripes, a declarative HTML-based video rendering tool powered by FFmpeg.
license: MIT
---

## What is StaticStripes?

StaticStripes is a CLI tool that generates videos from HTML/CSS project definitions. It allows you to:

- Define video sequences using HTML syntax
- Style video elements with CSS (including custom CSS properties)
- Apply filters, transitions, and effects
- Generate multiple output formats from a single project
- Use AI to generate music and other assets
- Upload videos to platforms like YouTube
- Use hardware acceleration for faster rendering

## System Requirements

- **Node.js 22+** (required)
- **FFmpeg** installed and in system PATH
- **npm 10+**

## Installation

```bash
# Global installation
npm install -g @gannochenko/staticstripes

# Verify installation
staticstripes --version
```

## Core Commands

### 1. Bootstrap - Create New Project

```bash
staticstripes bootstrap -n <project-name>
```

Creates a new video project from template.

**Example:**

```bash
staticstripes bootstrap -n my-video
cd my-video
```

### 2. Add Assets - Scan Media Files

```bash
staticstripes add-assets -p <project-path>
```

Scans for video, audio, and image files and adds them to project.html.

**Supported formats:**

- Video: `.mp4`
- Audio: `.mp3`
- Images: `.jpg`, `.png`

**Example:**

```bash
# Add all media files in current project
staticstripes add-assets -p .
```

### 3. Generate - Render Video

```bash
staticstripes generate [options]
```

**Options:**

- `-p, --project <path>` - Project directory (default: current)
- `-o, --output <name>` - Specific output to render (default: all)
- `-d, --dev` - Development mode (ultrafast encoding)
- `--debug` - Show debug information (FFmpeg command, stack traces)

**Examples:**

```bash
# Render all outputs in production quality
staticstripes generate -p .

# Render specific output in dev mode (fast)
staticstripes generate -p . -o youtube -d

# Debug mode with full details
staticstripes generate -p . -o youtube --debug
```

### 4. Auth - Authenticate with Upload Platforms

```bash
staticstripes auth --upload-name <upload-name>
```

Starts the authentication sequence for video uploads (e.g., YouTube).

**Example:**

```bash
staticstripes auth --upload-name yt_primary
```

### 5. Upload - Upload Videos to Platforms

```bash
staticstripes upload --upload-name <upload-name>
```

Uploads the rendered video to the specified platform using stored credentials.

**Example:**

```bash
staticstripes upload --upload-name yt_primary
```

## Project Structure

```
my-video-project/
├── project.html          # Main project file (HTML-based definition)
├── input/                # Video clips
├── audio/                # Audio tracks
├── images/               # Image assets
├── effects/              # Effect clips
├── output/               # Generated videos
├── .cache/               # Temporary rendering cache
└── .auth/                # Authentication credentials (excluded from git)
    └── youtube_<name>.json
    └── <ai-provider-name>.json
```

## Project File Format (project.html)

### Basic Structure

```html
<style>
  /* CSS for styling video elements */
  .video-fragment {
    -offset-start: 0s;
    -offset-end: 5s;
  }
</style>

<outputs>
  <output
    data-name="youtube"
    data-path="./output/youtube.mp4"
    data-fps="30"
    data-resolution="1920x1080"
  />
</outputs>

<assets>
  <asset data-name="clip_1" data-path="./input/video1.mp4" />
  <asset data-name="track_1" data-path="./audio/music.mp3" />
</assets>

<sequence id="main">
  <fragment data-asset="clip_1" class="video-fragment" />
</sequence>
```

### Key CSS Properties

**Timing:**

- `-offset-start: <time>` - Start time (e.g., `0s`, `1500ms`)
- `-offset-end: <time>` - End time (controls `-offset-start` of next fragment)
- `-duration: <time|percentage|auto>` - Fragment duration (e.g., `5s`, `50%`, `auto`)
- `-trim-start: <time>` - Trim from beginning of asset (skip first N seconds)
- `-trim-end: <time>` - Trim from end of asset (cut last N seconds)
- Can use `calc()` expressions: `calc(url(#main.time.end) + 500ms)` - this will find the fragment with id="main", and get the absolute time.end of the fragment. Also `#<ID>.time.start` and `#<ID>.time.duration` are available. This can be used to sync two unrelated fragments in parallel sequences. Important: since there is no "pre compilation" of durations, the referred fragment must already be processed before, otherwise it won't be resolved.

**Display:**

- `display: none` - Disable fragment (enabled by default)

**Asset:**

- `-asset: <asset-name>` - Reference asset by name (can also use `data-asset` attribute)

**Object Fit:**

- `-object-fit: cover` - Fill frame (crop to fit) - **default**
- `-object-fit: contain pillarbox <color>` - Fit inside frame with colored bars of specified color
- `-object-fit: contain ambient <blur> <brightness> <saturation>` - Ambient background with parameters:
  - `blur`: integer (blur strength)
  - `brightness`: float (e.g., `-0.1` for darker)
  - `saturation`: float (e.g., `0.7` for less saturated)

**Transitions:**

- `-transition-start: <name> <duration>` - Fade in effect (e.g., `fade-in 1s`)
- `-transition-end: <name> <duration>` - Fade out effect (e.g., `fade-out 500ms`)

**Filters:**

- `filter: <filter-name>` - Instagram like filters. Available filters:
  - instagram-clarendon
  - instagram-gingham
  - instagram-juno
  - instagram-lark
  - instagram-ludwig
  - instagram-nashville
  - instagram-valencia
  - instagram-xpro2
  - instagram-willow
  - instagram-lofi
  - instagram-inkwell
  - instagram-moon
  - instagram-hudson
  - instagram-toaster
  - instagram-walden
  - instagram-rise
  - instagram-amaro
  - instagram-mayfair
  - instagram-earlybird
  - instagram-sutro
  - instagram-aden
  - instagram-crema
- `-chromakey: <blend> <similarity> <color>` - Green screen removal
  - `blend`: float or constant (`hard`=0.0, `smooth`=0.1, `soft`=0.2)
  - `similarity`: float or constant (`strict`=0.1, `good`=0.3, `forgiving`=0.5, `loose`=0.7)
  - `color`: color with transparency (e.g., `#00ff00`)

**Overlay/Layering:**

- `-overlay-start-z-index: <number>` - if positive, the fragment goes on top of the previous fragment, if negative, then the other way around
- `-overlay-end-z-index: <number>` - fragment overlaying at end (sets next fragment's start z-index)

---

## Technical Reference: project.html Structure

### Complete XML Schema

The `project.html` file consists of the following root-level elements:

<!-- Video metadata: title and tags -->
<title>Video title</title>
<tag name="travel" />
<tag name="blog" />
...

<project>
<!-- Video sequence definition -->
  <sequence id="main">
    <fragment id="..." data-asset="..." class="..." />
    <fragment class="..." />
  </sequence>
  ...
</project>

```html
<!-- CSS styles for fragments and containers -->
<style>
  /* Standard CSS with custom properties */
</style>

<!-- Output video configurations -->
<outputs>
  <output
    data-name="..."
    data-path="..."
    data-fps="..."
    data-resolution="..."
  />
</outputs>

<!-- AI provider integrations -->
<ai>
  <ai-music-api-ai name="...">
    <model name="..." />
  </ai-music-api-ai>
</ai>

<!-- Media asset definitions -->
<assets>
  <asset data-name="..." data-path="...">
    <ai data-integration-name="...">
      <prompt>...</prompt>
      <duration value="..." />
    </ai>
  </asset>
</assets>

<!-- Upload platform configurations -->
<uploads>
  <youtube name="..." data-output-name="..." id="...">
    <!-- YouTube-specific tags -->
  </youtube>
</uploads>

<!-- HTML/CSS containers rendered as PNG overlays -->
<container id="...">
  <!-- Standard HTML/CSS content -->
</container>
```

### CSS Property Parsing Rules

#### 1. `-duration` Property

Accepts three types of values:

**a) `auto` (default):**

```css
-duration: auto;
```

Duration equals asset duration minus `-trim-start` value.

**b) Percentage:**

```css
-duration: 50%; /* 50% of asset duration, ignoring trim */
```

Takes the specified percentage of the asset's total duration.

**c) Time value:**

```css
-duration: 5s; /* 5 seconds */
-duration: 3000ms; /* 3000 milliseconds */
```

Sets exact duration. All time values are normalized to seconds internally.

#### 2. `-offset-start` and `-offset-end` Properties

Control fragment positioning in the timeline.

**a) Simple time value:**

```css
-offset-start: 1s;
-offset-end: 2s;
```

**b) Calc() expression:**

```css
-offset-start: calc(url(#intro.time.end) + 500ms);
```

**Important:** `-offset-end` of fragment N controls the `-offset-start` of fragment N+1. They are additive:

```css
/* Fragment 1 */
.frag1 {
  -offset-start: 0s;
  -offset-end: 1s; /* Adds 1s to next fragment's start */
}

/* Fragment 2 */
.frag2 {
  -offset-start: 500ms; /* Total offset: 1s + 500ms = 1.5s */
}
```

#### 3. `-object-fit` Property

Three possible configurations:

**a) Cover mode (default):**

```css
-object-fit: cover;
```

**b) Contain with pillarbox:**

```css
-object-fit: contain pillarbox #000000;
-object-fit: contain pillarbox #000000ff; /* With alpha */
```

Maps to:

- `objectFit = 'contain'`
- `objectFitContain = 'pillarbox'`
- `objectFitContainPillarboxColor = '#000000'`

**c) Contain with ambient background:**

```css
-object-fit: contain ambient 25 -0.1 0.7;
```

Syntax: `contain ambient <blur> <brightness> <saturation>`

#### 4. `-chromakey` Property

Syntax: `-chromakey: <blend> <similarity> <color>`

```css
-chromakey: 0.1 0.3 #00ff00;
-chromakey: smooth good #00ff00; /* Using constants */
```

**Canned Constants:**

Blend constants:

- `hard` = `0.0`
- `smooth` = `0.1`
- `soft` = `0.2`

Similarity constants:

- `strict` = `0.1`
- `good` = `0.3`
- `forgiving` = `0.5`
- `loose` = `0.7`

Example with constants:

```css
.greenscreen {
  -chromakey: smooth good #00ff00; /* Same as: 0.1 0.3 #00ff00 */
}
```

#### 5. `-transition-start` and `-transition-end` Properties

Syntax: `<transition-name> <duration>`

```css
-transition-start: fade-in 1s;
-transition-start: fade-out 500ms;
```

Available transition names:

- `fade-in`
- `fade-out`

#### 6. `-overlay-start-z-index` and `-overlay-end-z-index` Properties

Control layering of overlaid fragments.

```css
.overlay {
  -overlay-start-z-index: 10; /* This fragment's z-index */
  -overlay-end-z-index: 5; /* Next fragment's z-index (becomes -5) */
}
```

**Important:** `-overlay-end-z-index` value is **negated** when applied to the next fragment:

- If current fragment has `-overlay-end-z-index: 100`
- The next fragment's `-overlay-start-z-index` becomes `-100`
- If the next fragment has its own `-overlay-start-z-index`, it takes precedence

#### 7. `-trim-start` and `-trim-end` Properties

Trim the beginning and/or end of the asset:

```css
-trim-start: 2s; /* Skip first 2 seconds of asset */
-trim-start: 1500ms; /* Skip first 1.5 seconds */
```

```css
-trim-end: 3s; /* Cut last 3 seconds of asset */
-trim-end: 2500ms; /* Cut last 2.5 seconds */
```

Both properties work together with `-duration`:

```css
/* Example: 10-second video */
-trim-start: 2s;    /* Skip first 2 seconds */
-trim-end: 3s;      /* Cut last 3 seconds */
-duration: auto;    /* Auto = 10s - 2s - 3s = 5s */
/* Result: Shows content from second 2 to second 7 (5 seconds total) */
```

```css
/* Example: Explicit duration overrides auto calculation */
-trim-start: 2s;    /* Skip first 2 seconds */
-trim-end: 3s;      /* Ignored when duration is explicit */
-duration: 4s;      /* Use 4 seconds starting from second 2 */
/* Result: Shows content from second 2 to second 6 (4 seconds total) */
```

Cannot be negative.

### CSS Class Merging Rules

CSS classes are merged like a browser would, with standard CSS specificity:

**Priority (lowest to highest):**

1. CSS class definitions (in `<style>`)
2. Multiple classes (last class wins for conflicts)
3. Inline `style` attribute (highest priority)

**Example:**

```html
<style>
  .base {
    -offset-start: 0s;
    -duration: 5s;
    -transition-start: fade-in 1s;
  }

  .override {
    -duration: 10s; /* Overrides .base duration */
  }
</style>

<fragment
  class="base override"
  style="-transition-start: fade-in 2s"
  data-asset="clip1"
/>
```

Result:

- `-offset-start: 0s` (from `.base`)
- `-duration: 10s` (from `.override`, overrides `.base`)
- `-transition-start: fade-in 2s` (from inline style, overrides both classes)

### Calc() Expression Reference

**Syntax:**

```
calc(<expression>)
```

**Available references:**

```
url(#<fragment_id>.time.start)  - Fragment start time
url(#<fragment_id>.time.end)    - Fragment end time
```

**Supported operators:**

- `+` (addition)
- `-` (subtraction)

**Time units:**

- `s` (seconds)
- `ms` (milliseconds)

**Examples:**

```css
/* Start after intro ends */
-offset-start: calc(url(#intro.time.end));

/* Start 500ms after intro ends */
-offset-start: calc(url(#intro.time.end) + 500ms);

/* Start 1s before outro ends */
-offset-start: calc(url(#outro.time.end) - 1s);

/* Chain multiple fragments */
-offset-start: calc(url(#clip1.time.end) + 200ms);
```

**Important:** Expressions are compiled and evaluated at build time, not runtime.

### Asset Naming Conventions

When using `staticstripes add-assets -p .`, assets are automatically named:

**Naming pattern:**

- Videos: `clip_N` (e.g., `clip_1`, `clip_2`, ...)
- Audio: `track_N` (e.g., `track_1`, `track_2`, ...)
- Images: `image_N` (e.g., `image_1`, `image_2`, ...)

**Sorting order:**
Files are sorted alphabetically by name before numbering.

**Example:**

```
Files found:
  input/zebra.mp4
  input/alpha.mp4
  audio/song.mp3

Generated assets:
  <asset data-name="clip_1" data-path="./input/alpha.mp4" />
  <asset data-name="clip_2" data-path="./input/zebra.mp4" />
  <asset data-name="track_1" data-path="./audio/song.mp3" />
```

### Container System Technical Details

**Purpose:** Render arbitrary HTML/CSS as PNG overlays in the video.

**Definition:**

```html
<container id="title_overlay">
  <div style="font-size: 72px; color: white; padding: 50px;">My Title</div>
</container>
```

**Usage in fragments:**

```html
<fragment class="overlay" style="-offset-start: 0s; -offset-end: 3s;">
  <container id="title_overlay">
    <div style="font-size: 72px; color: white; padding: 50px;">My Title</div>
  </container>
</fragment>
```

**Rendering process:**

1. HTML/CSS inside `<container>` is rendered in a headless browser
2. Result is captured as a PNG image
3. PNG is cached in `cache/` directory
4. PNG is overlaid on video using FFmpeg

**When to use:**

- Text overlays
- Graphics/logos
- Complex layouts that would be difficult with video editing

**Limitations:**

- No JavaScript execution (pure HTML/CSS only)
- Rendered at output resolution
- Each container generates a separate PNG file

---

### Application System Technical Details

**Purpose:** Render full-featured web applications (React, Vue, vanilla JS, etc.) as PNG overlays using Puppeteer.

Unlike `<container>` elements which only support static HTML/CSS, `<app>` elements allow you to:
- Execute JavaScript
- Use React/Vue/Svelte components
- Render dynamic content based on video metadata
- Create complex interactive previews during development
- Access video metadata (title, date, tags) automatically

#### App Structure

An app is a standalone web application with this required structure:

```
my-app/
├── src/                  # Source files (React, Vue, etc.)
│   ├── main.tsx         # Entry point
│   └── App.tsx          # Main component
├── dst/                  # Build output (REQUIRED for rendering)
│   ├── index.html       # Built HTML file
│   └── assets/          # Bundled JS/CSS
├── package.json         # Dependencies
├── vite.config.ts       # Build configuration
└── Makefile (optional)  # Build commands
```

**Critical requirement:** The app MUST be built to the `dst/` directory before rendering.

#### Using Apps in Fragments

```html
<fragment class="title_overlay" style="-offset-start: 0s; -duration: 5000ms;">
  <app
    src="../apps/central_text/dst"
    data-parameters='{"extra": "❄️🏔️🌨️"}'
  />
</fragment>
```

**`<app>` Attributes:**

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `src` | `string` | Yes | Path to app's **dst/** directory (relative to project.html or absolute) |
| `data-parameters` | `JSON string` | No | Custom JSON parameters passed to app via URL query string |

#### How Apps Work

**1. Build Phase:**
```bash
cd apps/central_text
npm install
npm run build  # Builds to dst/ directory
```

**2. Rendering Phase:**

When StaticStripes encounters an `<app>` element:

1. **Launches Puppeteer** (headless Chrome)
2. **Constructs URL** with automatic metadata injection:
   ```
   file:///path/to/app/dst/index.html?rendering&title=Video+Title&date=2025-01-15T12:00:00Z&tags=travel,vlog&extra=❄️🏔️🌨️
   ```
3. **Loads the app** in a virtual viewport (output resolution)
4. **Waits for render signal** - App must set `window.__stsRenderComplete = true`
5. **Captures screenshot** with transparent background
6. **Caches result** in `cache/apps/<hash>.png`
7. **Overlays PNG** on video using FFmpeg

**Automatic Parameters Injected:**

All apps automatically receive these URL parameters:

- `rendering` - Flag indicating render mode (no value, just presence)
- `title` - Video title from `<title>` tag
- `date` - Video date from `<date>` tag (ISO 8601 format)
- `tags` - Comma-separated tags from `<tag>` elements

Custom parameters from `data-parameters` are merged and can override defaults.

#### Creating a React App

**Example: Title Card App**

**File: `apps/title-card/src/App.tsx`**

```tsx
import { useEffect } from 'react';
import './App.css';

interface AppParams {
  title?: string;
  date?: string;
  tags?: string;
  extra?: string;
  rendering: boolean;
}

function useAppParams(): AppParams {
  const params = new URLSearchParams(window.location.search);
  return {
    title: params.get('title') ?? undefined,
    date: params.get('date') ?? undefined,
    tags: params.get('tags') ?? undefined,
    extra: params.get('extra') ?? undefined,
    rendering: params.has('rendering'),
  };
}

function RenderingView({ title, date, extra }: {
  title?: string;
  date?: string;
  extra?: string;
}) {
  useEffect(() => {
    // CRITICAL: Set transparent background
    document.body.style.background = 'transparent';

    // CRITICAL: Signal render complete
    (window as any).__stsRenderComplete = true;
  }, []);

  return (
    <div className="container">
      <div className="title">
        {title?.split(' ').map((word, i) => (
          <span key={i} className="word">{word}</span>
        ))}
      </div>
      {date && (
        <div className="date">
          {new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      )}
      {extra && (
        <div className="extra">{extra}</div>
      )}
    </div>
  );
}

function App() {
  const { title, date, extra, rendering } = useAppParams();

  if (rendering) {
    return <RenderingView title={title} date={date} extra={extra} />;
  }

  // Development preview mode
  return (
    <div className="dev-container">
      <h1>Title Card Preview</h1>
      <RenderingView title={title} date={date} extra={extra} />
    </div>
  );
}

export default App;
```

**File: `apps/title-card/src/App.css`**

```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  font-family: 'Arial', sans-serif;
}

.title {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  font-size: 6rem;
  font-weight: bold;
}

.word {
  background: white;
  color: black;
  padding: 0.5rem 1.5rem;
  border-radius: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.date {
  margin-top: 2rem;
  font-size: 3rem;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

.extra {
  margin-top: 1rem;
  font-size: 4rem;
}
```

**File: `apps/title-card/package.json`**

```json
{
  "name": "title-card",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.7.2",
    "vite": "^6.2.0"
  }
}
```

**File: `apps/title-card/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dst',  // CRITICAL: Must output to dst/
  },
});
```

**File: `apps/title-card/Makefile`**

```makefile
run:
	npm run dev

build:
	npm run build
```

#### Using the App in project.html

```html
<project>
  <sequence>
    <!-- Video sequence -->
    <fragment class="intro_clip" />
  </sequence>

  <sequence>
    <!-- Title overlay sequence -->
    <fragment class="title_overlay">
      <app
        src="../apps/title-card/dst"
        data-parameters='{"extra": "🗼 🍜 🌸"}'
      />
    </fragment>
  </sequence>
</project>

<style>
  .intro_clip {
    -asset: intro_video;
    -duration: 8000ms;
  }

  .title_overlay {
    -offset-start: 0s;
    -duration: 8000ms;
    -transition-start: fade-in 1000ms;
    -transition-end: fade-out 1000ms;
  }
</style>
```

#### App Development Workflow

**1. Create app:**
```bash
cd apps
npm create vite@latest title-card -- --template react-ts
cd title-card
npm install
```

**2. Update vite.config.ts to output to `dst/`:**
```ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dst',
  },
});
```

**3. Implement rendering logic:**
- Add `useAppParams` hook to read URL parameters
- Create `RenderingView` component that sets `window.__stsRenderComplete = true`
- Set transparent background: `document.body.style.background = 'transparent'`

**4. Develop with live preview:**
```bash
npm run dev
# Open http://localhost:5173?rendering&title=My+Video&date=2025-01-15T12:00:00Z
```

**5. Build for production:**
```bash
npm run build  # Outputs to dst/
```

**6. Use in project.html:**
```html
<app src="../apps/title-card/dst" data-parameters='{"extra": "🎬"}' />
```

**7. Generate video:**
```bash
staticstripes generate -p . -o youtube -d
```

#### Critical App Requirements

✅ **MUST set render complete flag:**
```ts
(window as any).__stsRenderComplete = true;
```

✅ **MUST set transparent background:**
```ts
document.body.style.background = 'transparent';
```

✅ **MUST build to `dst/` directory**

✅ **MUST complete rendering within 5 seconds** (configurable via `RENDER_TIMEOUT_MS`)

❌ **DO NOT** use `navigator.geolocation`, `navigator.mediaDevices`, or other browser APIs requiring permissions

❌ **DO NOT** make external network requests during rendering (pre-fetch data during build)

#### App vs Container Comparison

| Feature | `<container>` | `<app>` |
|---------|---------------|---------|
| **JavaScript** | ❌ No | ✅ Yes |
| **React/Vue** | ❌ No | ✅ Yes |
| **Setup** | None | Build step required |
| **Rendering** | Static HTML/CSS | Puppeteer (headless browser) |
| **Metadata access** | ❌ No | ✅ Auto-injected |
| **Performance** | Fast | Slower (browser launch) |
| **Caching** | Per-container hash | Per-app + parameters hash |
| **Use case** | Simple text/graphics | Complex dynamic overlays |

#### Advanced App Examples

**Example: Dynamic Tag Cloud**

```tsx
function TagCloud({ tags }: { tags?: string }) {
  const tagList = tags?.split(',') || [];

  return (
    <div className="tag-cloud">
      {tagList.map((tag, i) => (
        <span
          key={i}
          className="tag"
          style={{
            fontSize: `${2 + Math.random() * 2}rem`,
            opacity: 0.7 + Math.random() * 0.3,
          }}
        >
          #{tag.trim()}
        </span>
      ))}
    </div>
  );
}
```

**Example: Conditional Rendering**

```tsx
function AppContent({ outro, title }: { outro?: boolean; title?: string }) {
  if (outro) {
    return (
      <div className="outro">
        <h1>Thanks for watching!</h1>
        <p>Subscribe for more!</p>
        <span className="emoji">🫶</span>
      </div>
    );
  }

  return (
    <div className="intro">
      <h1>{title}</h1>
    </div>
  );
}

// Usage in project.html:
// <app src="../apps/card/dst" data-parameters='{"outro": true}' />
```

**Example: Date Formatting**

```tsx
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function DateDisplay({ date }: { date?: string }) {
  if (!date) return null;

  return (
    <div className="date">
      {formatDate(date)}
    </div>
  );
}
```

#### Troubleshooting Apps

**App not rendering:**
- ✓ Check that `dst/` directory exists and contains built files
- ✓ Verify `dst/index.html` exists
- ✓ Check browser console output for errors (visible with `--debug`)
- ✓ Ensure `window.__stsRenderComplete = true` is set
- ✓ Verify transparent background is set

**Timeout errors:**
- ✓ Reduce rendering complexity
- ✓ Remove network requests
- ✓ Check that render complete flag is set in `useEffect`

**Wrong parameters:**
- ✓ Validate JSON syntax in `data-parameters`
- ✓ Check URL parameters in browser dev mode
- ✓ Verify `useAppParams` hook implementation

**Caching issues:**
- ✓ Delete `cache/apps/` directory to force re-render
- ✓ Check that parameters affecting output are included in cache key
- ✓ Rebuild app after code changes

#### Best Practices

1. **Separate rendering and preview modes:**
   ```tsx
   if (rendering) return <RenderingView />;
   return <DevPreview />;
   ```

2. **Always set render complete in useEffect:**
   ```tsx
   useEffect(() => {
     document.body.style.background = 'transparent';
     (window as any).__stsRenderComplete = true;
   }, []);
   ```

3. **Use transparent backgrounds:**
   ```css
   body { background: transparent; }
   ```

4. **Test in development server first:**
   ```bash
   npm run dev
   # Then visit: http://localhost:5173?rendering&title=Test
   ```

5. **Keep rendering fast:**
   - Avoid heavy computations
   - Pre-process data during build
   - Use simple CSS animations (if any)

6. **Build before generating video:**
   ```bash
   cd apps/my-app
   npm run build
   cd ../..
   staticstripes generate -p . -o youtube
   ```

### Fragment Attributes Reference

**`<fragment>` element attributes:**

| Attribute       | Type     | Required | Description                             |
| --------------- | -------- | -------- | --------------------------------------- |
| `id`            | `string` | No       | Unique identifier for calc() references |
| `data-asset`    | `string` | No\*     | Asset name to use for this fragment     |
| `class`         | `string` | No       | CSS class names (space-separated)       |
| `style`         | `string` | No       | Inline CSS (try to use classes though)  |
| `data-timecode` | `string` | No       | Generates a timecode for this fragment  |

`data-asset` can be specified to reuse a css class, otherwise can also be specified via CSS using `-asset: <name>`.

Example:

```html
<fragment class="clip" data-asset="video_1" data-timecode="Our first dance" />
```

### Output Configuration Reference

**`<output>` element attributes:**

| Attribute         | Type     | Required | Description              | Example                |
| ----------------- | -------- | -------- | ------------------------ | ---------------------- |
| `data-name`       | `string` | Yes      | Unique output identifier | `"youtube"`            |
| `data-path`       | `string` | Yes      | Output file path         | `"./output/video.mp4"` |
| `data-fps`        | `number` | Yes      | Frames per second        | `30`                   |
| `data-resolution` | `string` | Yes      | Video resolution         | `"1920x1080"`          |

**Common resolutions:**

- YouTube: `1920x1080` (16:9)
- Instagram/TikTok: `1080x1920` (9:16)
- Square: `1080x1080` (1:1)

### Asset Configuration Reference

**`<asset>` element attributes:**

| Attribute   | Type     | Required | Description             |
| ----------- | -------- | -------- | ----------------------- |
| `data-name` | `string` | Yes      | Unique asset identifier |
| `data-path` | `string` | Yes      | Path to media file      |

**Child elements:**

**`<ai>` element (optional):**

```html
<ai data-integration-name="music_api">
  <prompt>Music generation prompt</prompt>
  <duration value="30" />
</ai>
```

Attributes:

- `data-integration-name`: References AI provider from `<ai>` section

Child elements:

- `<prompt>`: Text prompt for generation (required)
- `<duration>`: Generation duration with `value` attribute in seconds (optional)

---

## AI Asset Generation

### Configuring AI Providers

Define AI providers in your project file:

```html
<ai>
  <ai-music-api-ai name="music_api">
    <model name="sonic-v4-5" />
  </ai-music-api-ai>
</ai>
```

### Configuring Assets for AI Generation

Assets can be configured to auto-generate content if they don't exist:

```html
<asset data-name="background_music" data-path="./audio/background_music.mp3">
  <ai data-integration-name="music_api">
    <prompt>Generate upbeat electronic music with a positive vibe</prompt>
    <duration value="30" />
  </ai>
</asset>
```

### How It Works

1. If the `data-path` file doesn't exist, it gets generated using the AI integration
2. If the file exists, it's reused (no regeneration)
3. Generation happens automatically before rendering when running `generate` command

### Authentication for AI Providers

Create a credentials file in `.auth/<ai-provider-name>.json`:

```json
{
  "apiKey": "your-api-key-here"
}
```

**Example for AIMusicAPI.ai:**
Create `.auth/music-api.json` in your project directory.

### Supported AI Providers

#### AIMusicAPI.ai (`<ai-music-api-ai>`)

Generates music using AIMusicAPI.ai's API (https://aimusicapi.ai).

**Configuration:**

- `<model name="sonic-v4-5" />` - Optional model selection (default: sonic-v4-5)

**Asset options:**

- `<prompt>` - Description of the music to generate (required)

**Get API key:** https://aimusicapi.ai → Dashboard → API Keys

## Upload Configuration

### YouTube Upload

Define upload channels in your project file:

```html
<uploads>
  <youtube name="yt_primary" data-output-name="youtube" id="">
    <unlisted />
    <made-for-kids />
    <tag name="travel" />
    <tag name="blog" />
    <category name="entertainment" />
    <language name="en" />
    <title>My Awesome Video</title>
    <thumbnail data-timecode="1000ms" />
    <pre>
${title}.

Links:
- Website: https://example.com
- GitHub: https://github.com/user/repo
    </pre>
  </youtube>
</uploads>
```

**Available tags:**

- `<youtube>` - Defines YouTube upload channel with `name` and `data-output-name`
- `<private />` / `<unlisted />` / `<public />` - Privacy setting (default: private)
- `<made-for-kids />` - Mark video as made for kids
- `<tag name="..." />` - Add video tags (multiple allowed)
- `<category name="..." />` - Video category (only one)
- `<language name="..." />` - Video language
- `<title>` - Video title (optional, uses project global title if not specified)
- `<pre>` - Video description (supports EJS templating, processes "${title}", "${tags}", "${timecodes}")
- `<thumbnail data-timecode="..." />` - Extract thumbnail frame from video at specified time

**Workflow:**

1. Configure upload in `project.html`
2. Authenticate: `staticstripes auth --upload-name yt_primary`
3. Upload: `staticstripes upload --upload-name yt_primary`

## Common Workflows

### Workflow 1: Create New Video Project

```bash
# 1. Create project

# there is a boostrapping command, but it would be better if you try generating the project.html file on your own.
staticstripes bootstrap -n holiday-video
cd holiday-video

# 2. Add your media files to input/, audio/, images/

# 3. Scan and add assets

# there is a command to add assets, but it would be better if you read the files and add assets on your own.
staticstripes add-assets -p .

# 4. Edit project.html to arrange clips

# 5. Preview in dev mode (fast)
staticstripes generate -p . -o youtube -d

# 6. Final render (high quality)
staticstripes generate -p . -o youtube
```

### Workflow 2: Using AI-Generated Music

```bash
# 1. Edit project.html to add AI music asset (see AI Asset Generation section)

# 2. Create .auth/music-api.json with your API key

# 3. Generate video (AI assets will be created automatically)
staticstripes generate -p . -o youtube -d
```

### Workflow 3: Upload to YouTube

```bash
# 1. Add upload configuration to project.html

# 2. Authenticate with YouTube
staticstripes auth --upload-name yt_primary

# 3. Generate video
staticstripes generate -p . -o youtube

# 4. Upload to YouTube
staticstripes upload --upload-name yt_primary
```

### Workflow 4: Debug Issues

```bash
# Run with debug flag to see:
# - Full FFmpeg command
# - Stack traces
# - Error details
staticstripes generate -p . -o youtube --debug
```

### Workflow 5: Multiple Output Formats

```html
<outputs>
  <output
    data-name="youtube"
    data-path="./output/youtube.mp4"
    data-fps="30"
    data-resolution="1920x1080"
  />
  <output
    data-name="instagram"
    data-path="./output/instagram.mp4"
    data-fps="30"
    data-resolution="1080x1920"
  />
  <output
    data-name="tiktok"
    data-path="./output/tiktok.mp4"
    data-fps="30"
    data-resolution="1080x1920"
  />
</outputs>
```

```bash
# Render all formats
staticstripes generate -p .

# Or render specific format
staticstripes generate -p . -o instagram
```

## Advanced Features

### Calc() Expressions

Reference other fragments or elements in timing calculations:

```css
.second-clip {
  -offset-start: calc(url(#first_clip.time.end) + 500ms);
  -offset-end: calc(url(#first_clip.time.end) + 5500ms);
}
```

### Container Overlays

Render HTML/CSS as PNG overlays:

```html
<fragment style="-offset-start: 0s; -offset-end: 3s;">
  <container id="title_card">
    <div style="font-size: 72px; color: white;">My Video Title</div>
  </container>
</fragment>
```

### Chromakey (Green Screen)

```css
.greenscreen {
  -chromakey: smooth good #00ff00;
}
```

### Fragment IDs

Fragments can have IDs for reference:

```html
<fragment id="intro_clip" data-asset="intro" />
<fragment
  id="main_clip"
  data-asset="main"
  style="-offset-start: calc(url(#intro_clip.time.end) + 1s)"
/>
```

## Error Handling

StaticStripes provides clear error messages:

**Normal mode:**

```
❌ Video generation failed

Error: Asset file(s) not found:
  - /path/to/missing/video.mp4

Please check that all asset paths in project.html are correct.

💡 Tip: Run with --debug flag for detailed error information
```

**Debug mode:**

```
🐛 Debug mode enabled

❌ Video generation failed

Error: Asset file(s) not found:
  - /path/to/missing/video.mp4

=== Debug Information ===

Full error object: Error: Asset file(s) not found...
Stack trace:
Error: Asset file(s) not found...
    at HTMLProjectParser.validateAssetFiles (...)
    [full stack trace]

=== FFmpeg Command ===
ffmpeg -y -i "/path/to/input.mp4" -filter_complex "..." -map "[outv]" ...
```

## Example: Complete Video Project

```html
<title>Our honeymoon<title>
<tag>sex</tag>
<tag>drugs</tag>
<tag>rock-n-roll</tag>

<project>
  <sequence id="main">
    <fragment id="intro" data-asset="intro_clip" class="clip intro" />
    <fragment id="main" data-asset="main_clip" class="clip main" />
    <fragment id="outro" data-asset="outro_clip" class="clip outro" />
    <fragment data-asset="music" class="background-music" />
  </sequence>
</project>

<style>
  .clip {
    -offset-start: 0s;
    -offset-end: 5s;
    -transition-start: fade-in 1s;
    -transition-end: fade-out 1s;
    -object-fit: cover;
  }

  .intro {
    -duration: 3s;
  }

  .main {
    -offset-start: calc(url(#intro.time.end) + 500ms);
    -duration: 10s;
  }

  .outro {
    -offset-start: calc(url(#main.time.end) + 500ms);
    -duration: 3s;
  }

  .background-music {
    /* Audio track plays throughout */
  }
</style>

<outputs>
  <output
    data-name="youtube"
    data-path="./output/final.mp4"
    data-fps="30"
    data-resolution="1920x1080"
  />
</outputs>

<ai>
  <ai-music-api-ai name="music_api">
    <model name="sonic-v4-5" />
  </ai-music-api-ai>
</ai>

<assets>
  <asset data-name="intro_clip" data-path="./input/intro.mp4" />
  <asset data-name="main_clip" data-path="./input/main.mp4" />
  <asset data-name="outro_clip" data-path="./input/outro.mp4" />

  <!-- AI-generated music -->
  <asset data-name="music" data-path="./audio/background.mp3">
    <ai data-integration-name="music_api">
      <prompt>Upbeat travel vlog music with positive vibes</prompt>
      <duration value="30" />
    </ai>
  </asset>
</assets>

<uploads>
  <youtube name="yt_primary" data-output-name="youtube">
    <public />
    <tag name="travel" />
    <tag name="vlog" />
    <category name="entertainment" />
    <language name="en" />
    <title>My Amazing Travel Video</title>
    <thumbnail data-timecode="5000ms" />
    <pre>
Amazing travel adventure!

Links:
- Website: https://example.com
    </pre>
  </youtube>
</uploads>
```

## Troubleshooting

### FFmpeg Not Found

```
❌ Getting dimensions failed

Error: FFmpeg not found in system PATH.
```

**Solution:** Install FFmpeg:

- **macOS:** `brew install ffmpeg`
- **Ubuntu/Debian:** `sudo apt-get install ffmpeg`
- **Windows:** Download from https://ffmpeg.org/download.html

### Node Version Too Old

```
npm error engine Not compatible with your version of node/npm
npm error notsup Required: {"node":">=22.0.0"}
```

**Solution:** Upgrade to Node.js 22+

### Assets Not Found

```
❌ Video generation failed

Error: Asset file(s) not found:
  - /path/to/video.mp4
```

**Solution:**

1. Check file paths in `project.html`
2. Verify files exist in specified locations
3. Use relative paths from project root

### AI Generation Fails

**Solution:**

1. Check API key in `.auth/<provider-name>.json`
2. Verify internet connection
3. Check API quota/credits
4. Run with `--debug` flag for details

## Best Practices

1. **Use dev mode for iteration**

   ```bash
   staticstripes generate -p . -o youtube -d
   ```

   Much faster, great for testing layouts

2. **Always validate assets first**

   ```bash
   staticstripes add-assets -p .
   ```

3. **Use debug mode for troubleshooting**

   ```bash
   staticstripes generate -p . --debug
   ```

4. **Organize assets by type**
   - Keep videos in `input/`
   - Keep audio in `audio/`
   - Keep images in `images/`

5. **Use calc() for dynamic timing**

   ```css
   -offset-start: calc(url(#prev.time.end) + 500ms);
   ```

6. **Use IDs for fragment references**

   ```html
   <fragment id="my_clip" ... />
   ```

7. **Test AI generation separately**
   - First test with regular assets
   - Then add AI generation once workflow is working

8. **Keep credentials secure**
   - Never commit `.auth/` directory to git
   - Use `.gitignore` to exclude it

## Platform Support

- ✅ **Windows** 10/11 (use npm scripts, not Makefile)
- ✅ **macOS** 10.15+
- ✅ **Linux** (Ubuntu, Debian, Fedora, etc.)

## When to Use StaticStripes

**Good for:**

- Automated video generation from templates
- Batch processing multiple videos
- Programmatic video creation
- CI/CD video generation
- Social media content creation at scale
- AI-powered content creation

**Not ideal for:**

- Complex animations (use motion graphics tools)
- Real-time video editing (use video editors)
- Interactive video (use video players with JS)

## Viewer Tools Package

StaticStripes includes a companion React component library **@gannochenko/viewer-tools** that provides ready-to-use components for building video preview and rendering applications.

### Installation

```bash
npm install @gannochenko/viewer-tools react react-dom
```

### Available Components

#### 1. VideoFrame

A scalable video frame container with interactive format selection and content preview controls. Perfect for development environments where you need to preview content at different aspect ratios.

**Features:**
- Auto-scaling viewport with checkered transparency background
- Format switcher (YouTube 16:9, YT Shorts 9:16, customizable)
- Built-in preview panel for content editing
- LocalStorage persistence of content

**Props:**
- `initialContent` - Partial content to initialize with
- `children` - Render function that receives current content state

#### 2. RenderingView

A wrapper component that signals rendering completion for StaticStripes' Puppeteer screenshot system.

**Features:**
- Automatically sets `window.__stsRenderComplete = true`
- Sets transparent body background
- Minimal wrapper for your rendering content

**Props:**
- `children` - Content to render

#### 3. FormatPanel

Standalone format selector UI component.

**Props:**
- `selected` - Currently selected format object
- `onSelect` - Callback when format is selected

#### 4. PreviewPanel

Editable content preview panel.

**Props:**
- `value` - Current content values
- `onChange` - Callback when content changes

#### 5. useLocalStorage

Hook for persisting state to localStorage.

**Returns:** `[state, setState]` tuple similar to `useState`

### Parameter Schema System

The `@gannochenko/viewer-tools` package includes a powerful parameter schema system that allows apps to define their content fields declaratively.

#### Overview

Applications can define parameters using a schema structure. There are **3 standard parameters** automatically injected by StaticStripes:
- `title` - Video title from `<title>` tag
- `date` - Video date (ISO 8601 format)
- `tags` - Comma-separated tags from `<tag>` elements

Apps can define **additional custom parameters** beyond these standard ones.

#### How It Works

1. **Schema Definition** - Define parameters in a schema structure
2. **Auto-generated UI** - PreviewPanel automatically renders input fields
3. **URL Parameters** - Values come from query strings in rendering mode
4. **LocalStorage** - Values persist during preview development

#### Defining a Schema

**File: `src/schema.ts`**

```typescript
import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "title",
      label: "Title",
      placeholder: "My Video Title",
      defaultValue: "Central Text",
    },
    {
      name: "date",
      label: "Date",
      placeholder: "2025-01-15",
      defaultValue: "",
    },
    {
      name: "tags",
      label: "Tags",
      placeholder: "travel,vlog",
      defaultValue: "",
    },
    {
      name: "extra",
      label: "Extra text",
      placeholder: "Thanks for watching!",
      defaultValue: "",
    },
  ],
};

// Define typed interface matching your schema
export interface AppParams {
  title: string;
  date: string;
  tags: string;
  extra: string;
  [key: string]: string; // Index signature required
}
```

#### Using the Schema

```tsx
import { VideoFrame } from "@gannochenko/viewer-tools";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

function App() {
  const params = useAppParams();

  return (
    <VideoFrame<AppParams>
      storageKey="my-app:content"
      initialContent={params}
      schema={PARAMETER_SCHEMA}
    >
      {(content) => <YourContent {...content} />}
    </VideoFrame>
  );
}
```

#### Custom Parameters in project.html

```html
<fragment class="title_overlay">
  <app
    src="../apps/my-app/dst"
    data-parameters='{"extra": "🎬", "author": "John Doe"}'
  />
</fragment>
```

#### Benefits

✅ **Type-safe** - Define typed interfaces matching your schema
✅ **Auto-generated UI** - No manual input field creation
✅ **Persistent** - Values saved during development
✅ **Flexible** - Unlimited custom parameters
✅ **Consistent** - Standard parameters work across all apps

### Complete Example Application

Here's a full example of a title card application built with `@gannochenko/viewer-tools`:

**File: `apps/title-card/package.json`**

```json
{
  "name": "title-card",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@gannochenko/viewer-tools": "^0.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.7.2",
    "vite": "^6.2.0"
  }
}
```

**File: `apps/title-card/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dst',  // CRITICAL: Must output to dst/
  },
});
```

**File: `apps/title-card/src/schema.ts`**

```typescript
import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "title",
      label: "Title",
      placeholder: "Central Text",
      defaultValue: "Central Text",
    },
    {
      name: "date",
      label: "Date",
      placeholder: "2025-01-15",
      defaultValue: "",
    },
    {
      name: "tags",
      label: "Tags",
      placeholder: "travel,vlog",
      defaultValue: "",
    },
    {
      name: "extra",
      label: "Extra text",
      placeholder: "Thanks for watching!",
      defaultValue: "",
    },
  ],
};

export interface AppParams {
  title: string;
  date: string;
  tags: string;
  extra: string;
  [key: string]: string;
}
```

**File: `apps/title-card/src/App.tsx`**

```tsx
import "./App.css";
import "@gannochenko/viewer-tools/styles.css";
import { VideoFrame, RenderingView } from "@gannochenko/viewer-tools";
import { useAppParams } from "./hooks/useAppParams";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day} ${year}`;
}

function Content({
  title = "Central Text",
  date,
  tags,
  extra,
  outro,
}: {
  title?: string;
  date?: string;
  tags?: string;
  extra?: string;
  outro?: boolean;
}) {
  let formattedDate = date ? formatDate(date) : undefined;

  if (outro) {
    title = "Thanks for watching!";
    formattedDate = "";
    extra = "🫶";
    tags = "";
  }

  return (
    <div className="text_alignment">
      <div className="text_outline">
        {title.split(" ").map((word, i) => (
          <span key={i}>{word}</span>
        ))}
      </div>
      {formattedDate && (
        <div className="text_outline text_outline__small">
          {formattedDate.split(" ").map((part, i) => (
            <span key={i}>{part}</span>
          ))}
        </div>
      )}
      {extra && (
        <div className="text_outline text_outline__small">
          <span>{extra}</span>
        </div>
      )}
      {tags && (
        <div className="text_outline text_outline__small">
          {tags.split(",").map((part, i) => (
            <span key={i}>#{part.trim()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const { title, date, tags, extra, rendering, outro } = useAppParams();

  if (rendering) {
    return (
      <RenderingView>
        <Content
          title={title}
          date={date}
          tags={tags}
          extra={extra}
          outro={outro}
        />
      </RenderingView>
    );
  }

  return (
    <VideoFrame<AppParams>
      storageKey="central_text:content"
      initialContent={{ title, date, tags, extra }}
      schema={PARAMETER_SCHEMA}
    >
      {(content) => <Content {...content} />}
    </VideoFrame>
  );
}

export default App;
```

**File: `apps/title-card/src/hooks/useAppParams.ts`**

```ts
interface AppParams {
  title?: string;
  date?: string;
  tags?: string;
  extra?: string;
  rendering: boolean;
  outro?: boolean;
}

export function useAppParams(): AppParams {
  const params = new URLSearchParams(window.location.search);
  return {
    title: params.get('title') ?? undefined,
    date: params.get('date') ?? undefined,
    tags: params.get('tags') ?? undefined,
    extra: params.get('extra') ?? undefined,
    rendering: params.has('rendering'),
    outro: params.get('outro') === 'true',
  };
}
```

**File: `apps/title-card/src/App.css`**

```css
body {
  margin: 0;
  padding: 0;
}

.text_alignment {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 15rem;
  width: 100%;
  height: 100%;
}

.text_outline {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  color: black;
  font-weight: 700;
  font-size: 6rem;
  font-family: 'Arial', sans-serif;
}

.text_outline span {
  background-color: white;
  padding: 0.5rem 1.5rem;
  margin: 0 -0.5rem;
  border-radius: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.text_outline__small {
  font-size: 3rem;
  padding-top: 2rem;
  font-weight: 400;
}
```

### Development Workflow with Viewer Tools

**1. Create new app:**
```bash
cd apps
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install @gannochenko/viewer-tools react react-dom
```

**2. Update vite.config.ts:**
```ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dst',
  },
});
```

**3. Implement dual-mode app:**
```tsx
import { VideoFrame, RenderingView } from "@gannochenko/viewer-tools";
import "@gannochenko/viewer-tools/styles.css";

function App() {
  const { rendering, ...params } = useAppParams();

  if (rendering) {
    return <RenderingView><YourContent {...params} /></RenderingView>;
  }

  return (
    <VideoFrame initialContent={params}>
      {(content) => <YourContent {...content} />}
    </VideoFrame>
  );
}
```

**4. Develop with live preview:**
```bash
npm run dev
# Visit: http://localhost:5173
# Edit content with interactive panels
# Switch between YouTube and Shorts formats
```

**5. Build for production:**
```bash
npm run build  # Outputs to dst/
```

**6. Use in project.html:**
```html
<fragment class="title_overlay">
  <app
    src="../apps/my-app/dst"
    data-parameters='{"extra": "🎬"}'
  />
</fragment>
```

### Benefits of Using Viewer Tools

✅ **Rapid prototyping** - Interactive preview without rendering
✅ **Format testing** - Instantly switch between aspect ratios
✅ **Content editing** - Built-in UI for tweaking parameters
✅ **State persistence** - LocalStorage keeps your edits
✅ **Zero setup** - Works out of the box with StaticStripes
✅ **Type safety** - Full TypeScript support
✅ **Customizable** - Use components individually or together

### Component Customization

You can use individual components for custom workflows:

```tsx
import { FormatPanel, FORMATS } from "@gannochenko/viewer-tools";

function MyCustomPreview() {
  const [format, setFormat] = useState(FORMATS[0]);

  return (
    <div>
      <div style={{ width: format.width, height: format.height }}>
        {/* Your content */}
      </div>
      <FormatPanel selected={format} onSelect={setFormat} />
    </div>
  );
}
```

## Resources

- GitHub: https://github.com/gannochenko/mkvideo
- NPM Package (CLI): https://www.npmjs.com/package/@gannochenko/staticstripes
- NPM Package (Viewer Tools): https://www.npmjs.com/package/@gannochenko/viewer-tools
- Documentation: See README.md and docs/ folder in project root
- Report issues: GitHub Issues

---

When helping users with StaticStripes:

1. Always check FFmpeg is installed first
2. Verify Node.js version is 22+
3. Use `--debug` flag to diagnose issues
4. Validate project.html syntax
5. Check asset file paths are correct
6. Start with dev mode (`-d`) for faster iteration
7. For AI features, verify credentials are set up correctly
8. For uploads, ensure authentication is completed first

---

## Complete Project Example

Below is a comprehensive example of a `project.html` file demonstrating all major features of StaticStripes:

```html
<!-- ================================================== -->
<!-- METADATA (Optional)                                -->
<!-- ================================================== -->

<title>Travel Vlog: Tokyo Adventure</title>
<date>2025-01-15T12:00:00Z</date>

<!-- Tags for video metadata (used in uploads) -->
<tag name="travel" />
<tag name="vlog" />
<tag name="tokyo" />
<tag name="japan" />
<tag name="adventure" />

<!-- ================================================== -->
<!-- PROJECT STRUCTURE (Timeline Sequences)             -->
<!-- ================================================== -->

<project>
  <!-- Main video sequence (video track) -->
  <sequence id="main">
    <!-- Opening still image with title overlay -->
    <fragment
      id="intro_screen"
      class="intro_image"
      data-timecode="Introduction"
    />

    <!-- First video clip with ambient background -->
    <fragment id="clip1" class="main_clip ambient" data-timecode="Shibuya Crossing" />

    <!-- Transition effect (glitch/static) -->
    <fragment class="glitch_effect" />

    <!-- Second video clip -->
    <fragment id="clip2" class="main_clip pillarbox" data-timecode="Tokyo Tower" />

    <!-- Third video clip with chromakey -->
    <fragment id="clip3" class="main_clip greenscreen" data-timecode="Studio Shot" />

    <!-- Fourth video clip -->
    <fragment id="clip4" class="main_clip ambient" data-timecode="Night Scene" />

    <!-- Closing still image -->
    <fragment id="outro_screen" class="outro_image" data-timecode="Thanks for Watching" />
  </sequence>

  <!-- Background music sequence (audio track) -->
  <sequence>
    <!-- Intro music (8 seconds) -->
    <fragment class="intro_music" />
  </sequence>

  <!-- Main background music (parallel audio) -->
  <sequence>
    <!-- Main soundtrack throughout video -->
    <fragment class="bg_music" />
  </sequence>

  <!-- Title overlay sequence (using React app for dynamic rendering) -->
  <sequence>
    <!-- Title card using custom React app -->
    <fragment class="intro_overlay">
      <app
        src="../apps/title-card/dst"
        data-parameters='{"extra": "🗼 🍜 🌸"}'
      />
    </fragment>
  </sequence>

  <!-- Outro overlay sequence (using same app with different parameters) -->
  <sequence>
    <!-- Outro text synchronized with outro_screen -->
    <fragment class="outro_overlay">
      <app
        src="../apps/title-card/dst"
        data-parameters='{"outro": true}'
      />
    </fragment>
  </sequence>
</project>

<!-- ================================================== -->
<!-- STYLES (CSS with Custom Properties)                -->
<!-- ================================================== -->

<style>
  /* Import Google Fonts for container text */
  @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap");

  /* ============== UTILITY CLASSES ============== */

  .disabled {
    display: none; /* Hide fragments completely */
  }

  /* ============== OBJECT FIT MODES ============== */

  .ambient {
    /* Contain video with blurred ambient background */
    /* Syntax: contain ambient <blur> <brightness> <saturation> */
    -object-fit: contain ambient 25 -0.1 0.7;
  }

  .pillarbox {
    /* Contain video with black bars */
    -object-fit: contain pillarbox #000000;
  }

  .cover {
    /* Fill frame, crop if necessary (default) */
    -object-fit: cover;
  }

  /* ============== TIMING DURATIONS ============== */

  .intro_duration {
    -duration: 8000ms; /* 8 seconds */
  }

  .outro_duration {
    -duration: 6000ms; /* 6 seconds */
  }

  /* ============== INTRO SECTION ============== */

  .intro_image {
    -asset: tokyo_tower_image;
    -duration: 8000ms;
    -transition-start: fade-in 500ms;
    -transition-end: fade-out 1000ms;
    filter: instagram-lark; /* Instagram-style color filter */
  }

  .intro_music {
    -asset: intro_jingle;
    -duration: 8000ms;
    -transition-end: fade-out 1000ms;
  }

  .intro_overlay {
    -duration: 8000ms;
    -transition-start: fade-in 1000ms;
    -transition-end: fade-out 1000ms;
  }

  /* ============== MAIN VIDEO CLIPS ============== */

  .main_clip {
    -transition-start: fade-in 500ms;
    -transition-end: fade-out 500ms;
    -duration: auto; /* Use full asset duration */
  }

  /* Specific clip adjustments */
  #clip1 {
    -asset: shibuya_crossing;
    -trim-start: 2000ms; /* Skip first 2 seconds */
    -duration: 10000ms; /* Use 10 seconds */
  }

  #clip2 {
    -asset: tokyo_tower_video;
    -duration: 8000ms;
  }

  #clip3 {
    -asset: studio_shot;
    -duration: 6000ms;
  }

  #clip4 {
    -asset: night_tokyo;
    -trim-start: 5000ms; /* Skip first 5 seconds */
    -duration: 12000ms;
  }

  /* ============== EFFECTS ============== */

  .glitch_effect {
    -asset: digital_glitch;
    -duration: 300ms; /* Short glitch transition */
    -offset-start: -150ms; /* Overlap with previous clip */
    -offset-end: -150ms; /* Overlap with next clip */
    -overlay-start-z-index: 10; /* Put glitch on top */
    -overlay-end-z-index: 10;
    -chromakey: smooth good #000000; /* Remove black background */
  }

  .greenscreen {
    /* Remove green screen background */
    /* Syntax: -chromakey: <blend> <similarity> <color> */
    /* Blend: hard|smooth|soft (or numeric 0.0-0.2) */
    /* Similarity: strict|good|forgiving|loose (or numeric 0.1-0.7) */
    -chromakey: smooth good #00ff00;
  }

  /* ============== BACKGROUND MUSIC ============== */

  .bg_music {
    -asset: main_soundtrack;
    -offset-start: 8000ms; /* Start after intro */
    -transition-start: fade-in 2000ms;
    -transition-end: fade-out 3000ms;
  }

  /* ============== OUTRO SECTION ============== */

  .outro_image {
    -asset: tokyo_tower_image;
    -duration: 6000ms;
    -transition-start: fade-in 1000ms;
    -transition-end: fade-out 1000ms;
    filter: instagram-valencia;
  }

  .outro_overlay {
    /* Sync outro overlay with outro screen using calc() */
    -offset-start: calc(url(#outro_screen.time.start));
    -duration: 6000ms;
    -transition-start: fade-in 1000ms;
    -transition-end: fade-out 1000ms;
  }

  /* ============== CONTAINER STYLES (HTML Overlays) ============== */

  .main_container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    font-family: "Poppins", sans-serif;
    font-size: 6rem;
    background: transparent;
  }

  .text_alignment {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 15rem;
  }

  .text_outline {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    color: black;
    font-weight: 700;
  }

  .text_outline span {
    background-color: white;
    padding: 0.5rem 1.5rem;
    margin: 0 -0.5rem;
    border-radius: 3rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .text_outline__small {
    font-size: 3rem;
    padding-top: 2rem;
    font-weight: 400;
  }
</style>

<!-- ================================================== -->
<!-- ASSETS (Media Files)                               -->
<!-- ================================================== -->

<assets>
  <!-- Video clips -->
  <asset
    data-name="shibuya_crossing"
    data-path="./input/shibuya_crossing.mp4"
    data-author="TravelFilmer"
  />
  <asset
    data-name="tokyo_tower_video"
    data-path="./input/tokyo_tower.mp4"
    data-author="TravelFilmer"
  />
  <asset
    data-name="studio_shot"
    data-path="./input/studio_greenscreen.mp4"
    data-author="TravelFilmer"
  />
  <asset
    data-name="night_tokyo"
    data-path="./input/night_cityscape.mp4"
    data-author="TravelFilmer"
  />

  <!-- Images -->
  <asset
    data-name="tokyo_tower_image"
    data-path="./images/tokyo_tower.jpg"
    data-author="PhotoPro"
  />

  <!-- Effects -->
  <asset
    data-name="digital_glitch"
    data-path="./effects/glitch_01.mp4"
  />

  <!-- Audio tracks -->
  <asset
    data-name="intro_jingle"
    data-path="./audio/intro.mp3"
    data-author="MusicComposer"
  />

  <!-- AI-Generated Music -->
  <asset
    data-name="main_soundtrack"
    data-path="./audio/main_background.mp3"
  >
    <ai data-integration-name="music_ai">
      <prompt>
        Upbeat travel vlog background music, electronic with acoustic guitar,
        positive and energetic mood, tempo 120-130 BPM, instrumental only,
        smooth transitions, suitable for YouTube content, duration 60 seconds
      </prompt>
      <duration value="60" />
    </ai>
  </asset>
</assets>

<!-- ================================================== -->
<!-- OUTPUTS (Video Export Configurations)              -->
<!-- ================================================== -->

<outputs>
  <!-- YouTube landscape (1920×1080, 16:9) -->
  <output
    name="youtube"
    path="./output/youtube.mp4"
    resolution="1920x1080"
    fps="30"
  />

  <!-- YouTube Shorts (1080×1920, 9:16) -->
  <output
    name="youtube_shorts"
    path="./output/youtube_shorts.mp4"
    resolution="1080x1920"
    fps="30"
  />

  <!-- Instagram Reels (1080×1920, 9:16) -->
  <output
    name="instagram"
    path="./output/instagram.mp4"
    resolution="1080x1920"
    fps="30"
  />

  <!-- Square format for social media (1080×1080, 1:1) -->
  <output
    name="square"
    path="./output/square.mp4"
    resolution="1080x1080"
    fps="30"
  />
</outputs>

<!-- ================================================== -->
<!-- AI PROVIDERS (AI Generation Services)              -->
<!-- ================================================== -->

<ai>
  <!-- AIMusicAPI.ai integration for music generation -->
  <ai-music-api-ai name="music_ai">
    <model name="sonic-v4-5" />
  </ai-music-api-ai>
</ai>

<!-- ================================================== -->
<!-- UPLOADS (Platform Upload Configurations)           -->
<!-- ================================================== -->

<uploads>
  <!-- YouTube upload configuration -->
  <youtube name="yt_main" data-output-name="youtube">
    <!-- Privacy settings: <private />, <unlisted />, or <public /> -->
    <public />

    <!-- Mark as made for kids (required by YouTube API) -->
    <!-- Remove this tag if content is NOT for kids -->
    <!-- <made-for-kids /> -->

    <!-- Video category -->
    <category name="travel" />

    <!-- Video language -->
    <language name="en" />

    <!-- Override global title (optional) -->
    <title>Amazing Tokyo Travel Vlog | Japan Adventure 2025</title>

    <!-- Thumbnail: extract frame at specified time -->
    <thumbnail data-timecode="5000ms" />

    <!-- Video tags -->
    <tag name="travel" />
    <tag name="vlog" />
    <tag name="tokyo" />
    <tag name="japan" />
    <tag name="adventure" />
    <tag name="travel2025" />

    <!-- Video description (supports EJS templating) -->
    <pre>
Join me on an incredible journey through Tokyo! 🗼🍜

In this video, we explore:
${timecodes}

📍 Locations featured:
- Shibuya Crossing
- Tokyo Tower
- Night cityscape views

🎵 Music: AI-generated custom soundtrack

👍 If you enjoyed this video, please like and subscribe!

📱 Follow me:
- Instagram: @travelfilmer
- TikTok: @travelfilmer
- Website: https://travelfilmer.com

${tags}

#TokyoTravel #JapanVlog #TravelVideo #TokyoAdventure
    </pre>
  </youtube>

  <!-- YouTube Shorts upload -->
  <youtube name="yt_shorts" data-output-name="youtube_shorts">
    <public />
    <category name="travel" />
    <language name="en" />
    <title>Tokyo Adventure Highlights 🗼 #Shorts</title>
    <thumbnail data-timecode="3000ms" />
    <tag name="shorts" />
    <tag name="tokyo" />
    <tag name="travel" />
    <pre>
Quick highlights from Tokyo! 🇯🇵✨

#TokyoTravel #JapanTravel #TravelShorts
    </pre>
  </youtube>

  <!-- S3 (DigitalOcean Spaces) backup -->
  <s3 name="s3_backup" data-output-name="youtube">
    <!-- S3-compatible endpoint -->
    <endpoint name="digitaloceanspaces.com" />

    <!-- Region -->
    <region name="ams3" />

    <!-- Bucket name -->
    <bucket name="my-video-archive" />

    <!-- File paths (supports variables: ${slug}, ${output}, ${title}) -->
    <path name="file">videos/${slug}/${output}.mp4</path>
    <path name="metadata">videos/${slug}/metadata.json</path>
    <path name="thumbnail">videos/${slug}/thumbnail.jpeg</path>

    <!-- Access control -->
    <acl name="public-read" />

    <!-- Thumbnail extraction -->
    <thumbnail data-timecode="5000ms" />
  </s3>

  <!-- Instagram Reels upload -->
  <instagram name="ig_main" data-output-name="instagram">
    <!-- Thumbnail extraction -->
    <thumbnail data-timecode="3000ms" />

    <!-- Caption (supports EJS templating) -->
    <pre>
Tokyo adventures! 🗼✨

${title}

${tags}

#TokyoTravel #JapanTravel #TravelReels #TokyoVlog #ExploreJapan
    </pre>
  </instagram>
</uploads>

<!-- ================================================== -->
<!-- FFMPEG OPTIONS (Custom Encoding Presets)           -->
<!-- ================================================== -->

<ffmpeg>
  <!-- Fast preview preset (for development) -->
  <option name="preview">
    -c:v h264_nvenc -preset fast -c:a aac -b:a 192k
  </option>

  <!-- High quality preset (for final export) -->
  <option name="hq">
    -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 320k
  </option>

  <!-- Ultra-fast preset (for testing) -->
  <option name="ultrafast">
    -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 128k
  </option>
</ffmpeg>
```

### Example Project Structure

```
tokyo-vlog/
├── project.html              # Main project file (above)
├── input/                    # Video clips
│   ├── shibuya_crossing.mp4
│   ├── tokyo_tower.mp4
│   ├── studio_greenscreen.mp4
│   └── night_cityscape.mp4
├── audio/                    # Audio files
│   ├── intro.mp3
│   └── main_background.mp3   # (auto-generated by AI if missing)
├── images/                   # Image assets
│   └── tokyo_tower.jpg
├── effects/                  # Effect clips
│   └── glitch_01.mp4
├── apps/                     # Custom React/Vue apps for overlays
│   └── title-card/
│       ├── src/              # App source code
│       │   ├── App.tsx
│       │   ├── App.css
│       │   └── main.tsx
│       ├── dst/              # Built app (REQUIRED for rendering)
│       │   ├── index.html
│       │   └── assets/
│       ├── package.json
│       ├── vite.config.ts
│       └── Makefile
├── output/                   # Generated videos
│   ├── youtube.mp4
│   ├── youtube_shorts.mp4
│   ├── instagram.mp4
│   └── square.mp4
├── cache/                    # Temporary rendering cache
│   ├── containers/           # Cached container PNGs
│   └── apps/                 # Cached app screenshots
└── .auth/                    # Authentication credentials (git-ignored)
    ├── youtube_yt_main.json
    ├── youtube_yt_shorts.json
    ├── music-api.json
    └── instagram_ig_main.json
```

### Generating This Example

```bash
# 1. Create project directory
mkdir tokyo-vlog
cd tokyo-vlog

# 2. Create project.html (copy the example above)

# 3. Add your media files to input/, audio/, images/, effects/

# 4. Create and build the React app
mkdir -p apps
cd apps
npm create vite@latest title-card -- --template react-ts
cd title-card

# Update vite.config.ts to output to 'dst'
# (See App System section for complete app code)

npm install
npm run build  # CRITICAL: Build to dst/ directory
cd ../..

# 5. Set up AI credentials (if using AI generation)
mkdir .auth
echo '{"apiKey": "your-api-key"}' > .auth/music-api.json

# 6. Preview in dev mode (fast)
staticstripes generate -p . -o youtube -d

# 7. Generate final video (high quality)
staticstripes generate -p . -o youtube --option hq

# 8. Generate all outputs
staticstripes generate -p .

# 9. Authenticate with YouTube (first time only)
staticstripes auth --upload-name yt_main

# 10. Upload to YouTube
staticstripes upload --upload-name yt_main

# 11. Upload shorts version
staticstripes upload --upload-name yt_shorts
```

### Key Features Demonstrated

This example showcases:

✅ **Multiple sequences** - Video, audio, and overlay tracks
✅ **Fragment timing** - Duration, trimming, offsets
✅ **Transitions** - Fade in/out effects
✅ **Object fit modes** - Cover, contain with ambient, pillarbox
✅ **Filters** - Instagram-style color filters
✅ **Chromakey** - Green screen removal
✅ **Overlays** - Z-index layering for effects
✅ **Calc() expressions** - Dynamic timing synchronization
✅ **React apps** - Custom interactive overlays with metadata injection
✅ **AI generation** - Auto-generate music if missing
✅ **Multiple outputs** - YouTube, Shorts, Instagram, Square
✅ **Platform uploads** - YouTube, S3, Instagram
✅ **Timecodes** - Auto-generated chapter markers
✅ **FFmpeg presets** - Custom encoding options
✅ **EJS templating** - Dynamic descriptions
✅ **App caching** - Intelligent caching for fast re-renders

This comprehensive example demonstrates the full power and flexibility of StaticStripes for professional video production workflows.
