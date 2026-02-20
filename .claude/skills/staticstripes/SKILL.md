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
- `-trim-start: <time>` - Trim from beginning of asset
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

#### 7. `-trim-start` Property

Trims the beginning of the asset:

```css
-trim-start: 2s; /* Skip first 2 seconds of asset */
-trim-start: 1500ms; /* Skip first 1.5 seconds */
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

- No JavaScript execution (pure HTML/CSS only), YET
- Rendered at output resolution
- Each container generates a separate PNG file

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

## Resources

- GitHub: https://github.com/gannochenko/mkvideo
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
