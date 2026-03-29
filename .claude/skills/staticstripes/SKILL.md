---
name: staticstripes
description: You are an expert at using staticstripes, a declarative HTML-based video rendering tool powered by FFmpeg.
license: MIT
---

## What is StaticStripes?

StaticStripes is a CLI tool that generates videos from HTML/CSS project definitions using a **node-based architecture**. It allows you to:

- Define video sequences using HTML syntax with a composable node system
- Style video elements with CSS (including custom CSS properties)
- Apply filters, transitions, and effects
- Generate multiple output formats from a single project
- Use AI to generate text, speech, and other assets
- Upload videos to platforms like YouTube, Instagram, and S3
- Use hardware acceleration for faster rendering
- Chain nodes together to create automated content pipelines

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
- `--debug` - Show debug information (FFmpeg command, stack traces, timeline details)
- `--app-build` - Force rebuild apps even if build output already exists

**Examples:**

```bash
# Render all outputs in production quality
staticstripes generate -p .

# Render specific output in dev mode (fast)
staticstripes generate -p . -o youtube -d

# Debug mode with full details and timeline
staticstripes generate -p . -o youtube --debug

# Force rebuild all apps before rendering
staticstripes generate -p . -o youtube --app-build
```

### 3b. Filters - List Instagram Filters

```bash
staticstripes filters
```

Lists all 22 available Instagram-style filters with usage examples.

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
├── apps/                 # Custom HTML/CSS apps
├── output/               # Generated videos
├── cache/                # Temporary rendering cache
│   ├── apps/            # Cached app renders
│   └── containers/      # Cached container renders
└── .auth/                # Authentication credentials (excluded from git)
    ├── youtube_<name>.json
    └── <ai-provider-name>.json
```

## Node-Based Architecture

StaticStripes uses a **node-based architecture** where different nodes handle specific tasks in your video production pipeline. Nodes can reference each other's outputs, creating a composable and powerful workflow.

### Available Node Types

#### 1. `<node.project>` - Main Video Renderer

The core node that defines your video composition with sequences, assets, and outputs.

**Basic Structure:**

```html
<node.project>
  <title>My Video Title</title>
  <tag>mytag</tag>

  <sequences>
    <sequence>
      <fragment class="clip1" />
    </sequence>
  </sequences>

  <style>
    .clip1 {
      -asset: video1;
      -duration: 5000ms;
    }
  </style>

  <assets>
    <asset name="video1" path="./input/video.mp4" />
  </assets>

  <outputs>
    <output name="youtube" resolution="1920x1080" fps="30" />
  </outputs>
</node.project>
```

**Outputs:**
- `$project.output.<output-name>` - Reference to rendered video file

#### 2. `<node.filesystem>` - Save to Local File

Saves a rendered video to a specific local path.

```html
<node.filesystem name="local_output" path="$project.output.youtube">
  <path>output/my_video.mp4</path>
</node.filesystem>
```

**Attributes:**
- `name` - Unique identifier for this node
- `path` - Source file reference (e.g., `$project.output.youtube`)

**Children:**
- `<path>` - Destination file path

#### 3. `<node.openai>` - Text Generation

Generates text content using OpenAI's GPT models.

```html
<node.openai name="joke_generator">
  <prompt>Generate a funny dad joke about technology.</prompt>
  <model name="gpt-4o-mini" />
</node.openai>
```

**Children:**
- `<prompt>` - Text prompt for generation
- `<model>` - Model to use (e.g., `gpt-4o-mini`, `gpt-4`)

**Outputs:**
- `$joke_generator.text` - Generated text content

#### 4. `<node.elevenlabs>` - Text-to-Speech

Converts text to speech with word-level timing data.

```html
<node.elevenlabs
  name="narrator"
  text="$joke_generator.text"
  stability="0.7"
  similarityBoost="0.8"
  style="0.3">
  <voice name="IKne3meq5aSn9XLyUdCD" />
  <model name="eleven_multilingual_v2" />
</node.elevenlabs>
```

**Attributes:**
- `name` - Unique identifier
- `text` - Text to convert (can reference other nodes)
- `stability` - Voice stability (0-1)
- `similarityBoost` - Similarity boost (0-1)
- `style` - Style exaggeration (0-1)

**Children:**
- `<voice>` - Voice ID to use
- `<model>` - TTS model name

**Outputs:**
- `$narrator.audio` - Generated audio file path
- `$narrator.wordTiming` - Array of word timing data

#### 5. `<node.app>` - Render HTML/CSS App

Renders a custom HTML/CSS application to video with optional parameters.

```html
<node.app
  name="karaoke_text"
  src="../apps/karaoke_text/dst"
  words="$narrator.wordTiming"
  windowSize="5"
  fontSize="70"
  textColor="#ffffff"
  highlightColor="#ffff00" />
```

**Attributes:**
- `name` - Unique identifier
- `src` - Path to app's built output directory
- Any other attributes are passed as parameters to the app

**Outputs:**
- `$karaoke_text.output.video` - Rendered video file with alpha channel

#### 6. `<node.s3>` - Upload to S3

Uploads rendered video to S3-compatible storage (AWS S3, DigitalOcean Spaces, etc.).

```html
<node.s3 name="s3_upload" path="$project.output.youtube">
  <endpoint name="digitaloceanspaces.com" />
  <region name="ams3" />
  <bucket name="my-bucket" />
  <path name="file">videos/${slug}/${output}.mp4</path>
  <path name="metadata">videos/${slug}/metadata.json</path>
  <path name="thumbnail">videos/${slug}/thumbnail.jpeg</path>
  <acl name="public-read" />
  <thumbnail timecode="1000ms" />
</node.s3>
```

**Attributes:**
- `name` - Unique identifier
- `path` - Source file reference

**Children:**
- `<endpoint>` - S3 endpoint (optional, defaults to AWS)
- `<region>` - Storage region
- `<bucket>` - Bucket name
- `<path name="file">` - Video file path pattern
- `<path name="metadata">` - Metadata file path pattern
- `<path name="thumbnail">` - Thumbnail path pattern
- `<acl>` - Access control (e.g., `public-read`)
- `<thumbnail>` - Thumbnail extraction settings

**Path Variables:**
- `${slug}` - URL-friendly project name
- `${output}` - Output name

**Outputs:**
- `$s3_upload.output.url` - Public URL of uploaded video

#### 7. `<node.instagram>` - Upload to Instagram

Publishes video to Instagram Reels.

```html
<node.instagram name="instagram_upload" url="$s3_upload.output.url">
  <thumbnail timecode="1000ms" />
  <location city="Berlin" country="Germany" />
  <caption>
    Your video description with #hashtags
  </caption>
</node.instagram>
```

**Attributes:**
- `name` - Unique identifier
- `url` - Public URL to video file

**Children:**
- `<thumbnail>` - Thumbnail extraction settings
- `<location>` - Geolocation (city and country)
- `<caption>` - Post caption with hashtags

### Node Reference Syntax

Nodes can reference outputs from other nodes using the `$nodename.output.property` syntax:

- `$project.output.youtube` - Reference a project output
- `$generator.text` - Reference generated text
- `$speech.audio` - Reference audio file
- `$speech.wordTiming` - Reference word timing data
- `$s3.output.url` - Reference uploaded file URL

## Project File Format (project.html)

### Minimal Node-Based Example

```html
<node.project>
  <title>My Video</title>

  <sequences>
    <sequence>
      <fragment class="intro" />
      <fragment class="main" />
    </sequence>
  </sequences>

  <style>
    .intro {
      -asset: intro_img;
      -duration: 3000ms;
      -transition-end: fade-out 500ms;
    }

    .main {
      -asset: main_clip;
      -duration: 5000ms;
      -transition-start: fade-in 500ms;
    }
  </style>

  <assets>
    <asset name="intro_img" path="./images/intro.jpg" />
    <asset name="main_clip" path="./input/video.mp4" />
  </assets>

  <outputs>
    <output name="youtube" resolution="1920x1080" fps="30" />
  </outputs>
</node.project>

<node.filesystem name="local" path="$project.output.youtube">
  <path>output/video.mp4</path>
</node.filesystem>
```

### Key CSS Properties

**Timing:**

- `-offset-start: <time>` - Start time (e.g., `0s`, `1500ms`)
- `-offset-end: <time>` - End time (controls `-offset-start` of next fragment)
- `-duration: <time|percentage|auto|calc()>` - Fragment duration (e.g., `5s`, `50%`, `auto`, `calc(url(#id.time.duration))`)
- `-trim-start: <time>` - Trim from beginning of asset (skip first N seconds)
- `-trim-end: <time>` - Trim from end of asset (cut last N seconds)
- Can use `calc()` expressions: `calc(url(#main.time.end) + 500ms)` - this will find the fragment with id="main", and get the absolute time.end of the fragment. Also `#<ID>.time.start` and `#<ID>.time.duration` are available. This can be used to sync two unrelated fragments in parallel sequences. Important: since there is no "pre compilation" of durations, the referred fragment must already be processed before, otherwise it won't be resolved.

**Short Syntax (data-timing attribute):**

Alternative to CSS properties, use `data-timing` attribute with short syntax:

```html
<fragment
  data-asset="clip"
  data-timing="ts=3000,te=5000,d=2000,os=1000,oe=7000" />
```

Where:
- `ts` = `-trim-start` (milliseconds by default)
- `te` = `-trim-end` (milliseconds by default)
- `d` = `-duration` (milliseconds by default)
- `os` = `-offset-start` (milliseconds by default)
- `oe` = `-offset-end` (milliseconds by default)

Values without units default to milliseconds. Units can be specified: `ts=3s,d=5000ms`

Supports `calc()` expressions: `d=calc(url(#id.time.duration)),os=1000`

**Display:**

- `display: none` - Disable fragment (enabled by default)

**Asset:**

- `-asset: <asset-name>` - Reference asset by name (can also use `data-asset` attribute)

**Audio:**

- `-sound: on` - Use asset's audio track (default)
- `-sound: off` - Replace audio with silence (mute the fragment)

**Object Fit:**

- `-object-fit: cover` - Fill frame (crop to fit) - **default**
- `-object-fit: contain pillarbox <color>` - Fit inside frame with colored bars of specified color
- `-object-fit: contain ambient <blur> <brightness> <saturation>` - Ambient background with parameters:
  - `blur`: integer (blur strength)
  - `brightness`: float (e.g., `-0.1` for darker)
  - `saturation`: float (e.g., `0.7` for less saturated)
- `-object-fit: ken-burns` - Apply Ken Burns zoom/pan effects (see Ken Burns Effects section below)

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

**Ken Burns Effects:**

Apply cinematic zoom and pan effects to static images or videos. The Ken Burns effect creates dynamic motion by zooming and/or panning across an image over time.

**Basic Setup:**
```css
-object-fit: ken-burns;
-object-fit-ken-burns: <effect-type> <parameters>;
```

**Zoom Effects:**

Zoom effects allow you to zoom in or out on a specific focal point with customizable animation duration.

*Syntax:* `<effect> <focal-x%> <focal-y%> <zoom%> <duration> [easing]`

- `zoom-in` - Zoom into the image from normal size to magnified
- `zoom-out` - Zoom out from magnified to normal size
- `<focal-x%>` - Horizontal focal point (0-100, where 50 is center)
- `<focal-y%>` - Vertical focal point (0-100, where 50 is center)
- `<zoom%>` - Zoom amount (e.g., 30 = 30% zoom)
- `<duration>` - Animation duration in milliseconds
- `[easing]` - Optional: `linear`, `ease-in`, `ease-out`, `ease-in-out` (default: `ease-in-out`)

**Examples:**

```css
/* Zoom in on center point with 20% zoom over 3 seconds */
-object-fit-ken-burns: zoom-in 50 50 20 3000 ease-in-out;

/* Zoom in on top-right corner with 40% zoom over 5 seconds */
-object-fit-ken-burns: zoom-in 80 20 40 5000 ease-in;

/* Zoom out from face (custom focal point) with 25% zoom */
-object-fit-ken-burns: zoom-out 60 30 25 4000 ease-out;
```

**Pan Effects:**

Pan effects create smooth camera movements across the image.

*Syntax:* `<effect> <start-x%> <start-y%> <end-x%> <end-y%> <zoom%> <duration> [easing]`

- `pan-left` - Pan from right to left
- `pan-right` - Pan from left to right
- `pan-top` - Pan from bottom to top
- `pan-bottom` - Pan from top to bottom
- `<start-x%>`, `<start-y%>` - Starting position (0-100)
- `<end-x%>`, `<end-y%>` - Ending position (0-100)
- `<zoom%>` - Zoom level during pan
- `<duration>` - Animation duration in milliseconds
- `[easing]` - Optional easing function

**Examples:**

```css
/* Pan from left to right with 15% zoom */
-object-fit-ken-burns: pan-right 0 50 100 50 15 4000 linear;

/* Pan from top to bottom with 20% zoom */
-object-fit-ken-burns: pan-bottom 50 0 50 100 20 5000 ease-in-out;

/* Diagonal pan with custom positions */
-object-fit-ken-burns: pan-right 10 20 90 80 10 6000 ease-out;
```

## Complete XML Schema

```html
<node.project>
  <title>Project Title</title>
  <date>2024-01-01T12:00:00Z</date>
  <tag>tag1</tag>
  <tag>tag2</tag>

  <sequences>
    <sequence>
      <fragment
        class="css-class"
        id="unique-id"
        data-timecode="Label">
        <container>
          <div>HTML content</div>
        </container>
        <app
          src="path/to/app/dst"
          data-parameters='{"key": "value"}' />
      </fragment>
    </sequence>
  </sequences>

  <style>
    /* CSS styling */
    .css-class {
      -asset: asset_name;
      -duration: 5000ms;
      -trim-start: 1000ms;
      -transition-start: fade-in 500ms;
      -transition-end: fade-out 500ms;
      -object-fit: cover;
      filter: instagram-nashville;
    }
  </style>

  <assets>
    <asset name="asset_name" path="./path/to/file.mp4" />
  </assets>

  <outputs>
    <output
      name="youtube"
      resolution="1920x1080"
      fps="30" />
  </outputs>

  <ffmpeg>
    <option name="preview">
      -c:v libx264 -preset fast -crf 23
    </option>
  </ffmpeg>

  <ai>
    <provider name="music_gen" tag="music-api-ai">
      <model>sonic-v3-5</model>
    </provider>
  </ai>

  <upload name="yt_main" tag="youtube" output="youtube">
    <privacy>public</privacy>
    <madeForKids>false</madeForKids>
    <category>22</category>
    <language>en</language>
    <description>Video description</description>
  </upload>
</node.project>
```

## CSS Property Parsing Rules

### Duration Property

**Syntax:** `-duration: <value>`

**Supported values:**

1. **Time values:**
   - Milliseconds: `5000ms` or `5000`
   - Seconds: `5s` or `5.5s`

2. **Percentage:**
   - `50%` - Use 50% of asset's duration
   - `100%` - Use full asset duration

3. **Auto:**
   - `auto` - Use remaining asset duration after trim-start

4. **Calc expressions:**
   - `calc(url(#fragment_id.time.duration))` - Reference another fragment's duration
   - `calc(url(#fragment_id.time.end) + 500ms)` - Add offset to fragment's end time

**Examples:**

```css
.clip {
  -duration: 5000ms;        /* 5 seconds */
  -duration: 3.5s;          /* 3.5 seconds */
  -duration: 50%;           /* Half of asset duration */
  -duration: auto;          /* Remaining duration */
  -duration: calc(url(#intro.time.duration)); /* Match intro's duration */
}
```

### Offset Properties

**Syntax:**
- `-offset-start: <time>`
- `-offset-end: <time>`

Controls absolute timing in the sequence. `-offset-start` sets when a fragment begins. `-offset-end` sets when it should end (which becomes the next fragment's `-offset-start`).

**Examples:**

```css
.fragment1 {
  -offset-start: 0s;
  -offset-end: 5s;          /* Fragment lasts 5 seconds */
}

.fragment2 {
  -offset-start: 5s;        /* Starts after fragment1 */
  -offset-end: calc(url(#ending.time.start)); /* Sync with another fragment */
}
```

### Object Fit Property

**Syntax:** `-object-fit: <mode> [parameters]`

**Modes:**

1. **cover** (default)
   ```css
   -object-fit: cover;
   ```

2. **contain with pillarbox**
   ```css
   -object-fit: contain pillarbox #000000;
   ```

3. **contain with ambient**
   ```css
   -object-fit: contain ambient <blur> <brightness> <saturation>;
   ```
   Example:
   ```css
   -object-fit: contain ambient 20 -0.3 0.8;
   /* blur: 20, brightness: -30%, saturation: 80% */
   ```

4. **ken-burns**
   ```css
   -object-fit: ken-burns;
   -object-fit-ken-burns: zoom-in 50 50 20 3000 ease-in-out;
   ```

### Chromakey Property

**Syntax:** `-chromakey: <blend> <similarity> <color>`

Remove green screen or any color background.

**Parameters:**

- **blend** - Edge blending (0.0-1.0)
  - `hard` = 0.0
  - `smooth` = 0.1
  - `soft` = 0.2

- **similarity** - Color matching tolerance (0.0-1.0)
  - `strict` = 0.1
  - `good` = 0.3
  - `forgiving` = 0.5
  - `loose` = 0.7

- **color** - Color to remove (hex format)
  - `#00ff00` - Green
  - `#0000ff` - Blue

**Examples:**

```css
.greenscreen {
  -chromakey: smooth good #00ff00;  /* Remove green */
}

.bluescreen {
  -chromakey: 0.1 0.3 #0000ff;     /* Remove blue */
}
```

### Transition Properties

**Syntax:**
- `-transition-start: <name> <duration>`
- `-transition-end: <name> <duration>`

**Available transitions:**
- `fade-in` - Fade from black
- `fade-out` - Fade to black

**Examples:**

```css
.fragment {
  -transition-start: fade-in 1000ms;    /* 1 second fade in */
  -transition-end: fade-out 500ms;      /* 0.5 second fade out */
}
```

### Overlay/Z-Index Properties

**Syntax:**
- `-overlay-start-z-index: <number>`
- `-overlay-end-z-index: <number>`

Controls fragment layering. Positive values place fragment on top, negative values place it below.

**Examples:**

```css
.background {
  -overlay-start-z-index: 0;
}

.overlay_text {
  -overlay-start-z-index: 1;  /* Appears on top */
}
```

### Trim Properties

**Syntax:**
- `-trim-start: <time>` - Skip first N milliseconds of asset
- `-trim-end: <time>` - Skip last N milliseconds of asset

**Examples:**

```css
.clip {
  -trim-start: 3000ms;  /* Skip first 3 seconds */
  -trim-end: 2000ms;    /* Skip last 2 seconds */
  -duration: auto;      /* Use remaining duration */
}
```

## CSS Class Merging Rules

When a fragment has multiple CSS classes, properties are merged with later classes taking precedence.

**Example:**

```css
.base {
  -duration: 5000ms;
  -transition-start: fade-in 500ms;
}

.custom {
  -duration: 3000ms;  /* Overrides .base duration */
}
```

```html
<fragment class="base custom" />
<!-- Result: duration=3000ms, transition-start=fade-in 500ms -->
```

## Calc() Expression Reference

The `calc()` function allows referencing other fragments' timing properties.

**Syntax:** `calc(url(#fragment_id.time.property))`

**Available properties:**
- `start` - Fragment's absolute start time in milliseconds
- `end` - Fragment's absolute end time in milliseconds
- `duration` - Fragment's duration in milliseconds

**Examples:**

```css
.intro {
  -duration: 5000ms;
}

.background_music {
  /* Start music when intro starts */
  -offset-start: calc(url(#intro.time.start));

  /* End music when intro ends */
  -duration: calc(url(#intro.time.duration));
}

.delayed {
  /* Start 2 seconds after intro ends */
  -offset-start: calc(url(#intro.time.end) + 2000);
}
```

**Important:** The referenced fragment must be processed before the fragment using `calc()`. Fragments are processed in order within sequences.

## Asset Naming Conventions

**Best practices:**

- Use lowercase with underscores: `my_video_clip`
- Be descriptive: `intro_music`, `sunset_timelapse`
- Avoid spaces and special characters
- Use consistent prefixes for organization:
  - `clip_01`, `clip_02` - Video clips
  - `img_intro`, `img_outro` - Images
  - `music_background`, `sfx_explosion` - Audio

**Asset attributes:**

```html
<asset name="clip_01" path="./input/video.mp4" author="John Doe" />
```

- `name` (required) - Unique identifier
- `path` (required) - Relative path from project.html
- `author` (optional) - Attribution

**Alternative syntax (inside node.project):**

```html
<assets>
  <asset name="generated_text" input="$node_name.output.video" />
</assets>
```

Use `input` attribute to reference outputs from other nodes instead of `path` for file paths.

## Container System

Containers allow you to embed HTML/CSS content directly into fragments using Puppeteer rendering.

**How it works:**
1. HTML content inside `<container>` tags is extracted
2. Content is rendered to PNG using Puppeteer
3. PNG is cached based on content hash
4. Image is overlaid on the fragment

**Example:**

```html
<sequence>
  <fragment class="video_clip">
    <container>
      <div class="text-overlay">
        <h1>Welcome</h1>
        <p>This text appears on top of the video</p>
      </div>
    </container>
  </fragment>
</sequence>

<style>
  .video_clip {
    -asset: main_clip;
    -duration: 5000ms;
  }

  .text-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 48px;
    text-align: center;
    font-family: Arial, sans-serif;
  }
</style>
```

**Key points:**
- Containers are rendered with transparent backgrounds
- Use absolute positioning for layout control
- All CSS from `<style>` tags applies to containers
- Containers are cached (re-rendering only when content changes)

## Application System

Apps are standalone HTML/CSS/JS applications that can be rendered with parameters and attached to fragments or used via `<node.app>`.

### App Structure

```
apps/my_app/
├── index.html          # Main HTML file
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── vite.config.ts      # Vite build config
└── dst/                # Built output (created by staticstripes)
    ├── index.html
    └── assets/
```

### Using Apps in project.html (Inline)

```html
<sequence>
  <fragment class="title_card">
    <app
      src="../apps/central_text/dst"
      data-parameters='{"text": "Welcome!", "fontSize": "72"}' />
  </fragment>
</sequence>
```

**Attributes:**
- `src` - Path to app's `dst` directory (relative to project.html)
- `data-parameters` - JSON object passed to app

### Using Apps as Nodes

```html
<node.app
  name="karaoke"
  src="../apps/karaoke_text/dst"
  words="$speech.wordTiming"
  windowSize="5"
  fontSize="70" />

<node.project>
  <assets>
    <asset name="lyrics_video" input="$karaoke.output.video" />
  </assets>

  <sequences>
    <sequence>
      <fragment class="lyrics" />
    </sequence>
  </sequences>

  <style>
    .lyrics {
      -asset: lyrics_video;
      -duration: auto;
    }
  </style>
</node.project>
```

### App Rendering Modes

Apps can render in two modes:

1. **Static** - Single PNG image
   - Used when app has no animations
   - Faster rendering

2. **Animated** - APNG (Animated PNG)
   - Used when app includes animations
   - Preserves alpha channel
   - Frame-by-frame capture

### App Parameters

Apps receive parameters through the `parameters` global variable:

```javascript
// In your app's JavaScript
const params = window.parameters || {};
const text = params.text || 'Default Text';
const fontSize = params.fontSize || 48;
```

### App Building

StaticStripes automatically builds apps before rendering:

```bash
# Automatic build during generation
staticstripes generate -p .

# Force rebuild all apps
staticstripes generate -p . --app-build
```

## AI Asset Generation

Generate assets using AI services before video rendering.

### Supported AI Providers

#### AIMusicAPI.ai

Generate background music using AI.

**Configuration:**

```html
<node.project>
  <ai>
    <provider name="music_gen" tag="music-api-ai">
      <model>sonic-v3-5</model>
    </provider>
  </ai>

  <assets>
    <asset
      name="bg_music"
      path="./audio/generated_music.mp3"
      data-ai-integration="music_gen"
      data-ai-prompt="Upbeat electronic music with a positive vibe"
      data-ai-duration="30" />
  </assets>
</node.project>
```

**Asset attributes for AI generation:**
- `data-ai-integration` - References provider name from `<ai>` section
- `data-ai-prompt` - Generation prompt
- `data-ai-duration` - Duration in seconds (optional)

**Authentication:**

```bash
# Set up API key
export MUSIC_API_AI_KEY=your_api_key_here

# Or use .auth file
# Create .auth/music-api-ai.json with: {"apiKey": "your_key"}
```

**Workflow:**

1. Define AI provider in `<ai>` section
2. Add asset with `data-ai-*` attributes
3. Run `staticstripes generate -p .`
4. If asset file doesn't exist, StaticStripes generates it
5. Generated file is cached and reused

### OpenAI Text Generation

Generate text content dynamically:

```html
<node.openai name="joke_generator">
  <prompt>Generate a funny dad joke about science.</prompt>
  <model name="gpt-4o-mini" />
</node.openai>

<!-- Use generated text elsewhere -->
<node.elevenlabs
  name="speech"
  text="$joke_generator.text"
  stability="0.7"
  similarityBoost="0.8">
  <voice name="IKne3meq5aSn9XLyUdCD" />
  <model name="eleven_multilingual_v2" />
</node.elevenlabs>
```

### ElevenLabs Text-to-Speech

Convert text to speech with word timing:

```html
<node.elevenlabs
  name="narrator"
  text="Your narration text here"
  stability="0.7"
  similarityBoost="0.8"
  style="0.3">
  <voice name="IKne3meq5aSn9XLyUdCD" />
  <model name="eleven_multilingual_v2" />
</node.elevenlabs>
```

**Outputs:**
- `$narrator.audio` - Generated MP3 file path
- `$narrator.wordTiming` - Array of word timing data for karaoke/subtitles

## Upload Configuration

### YouTube Upload

Upload rendered videos to YouTube with metadata.

**Configuration:**

```html
<node.project>
  <upload name="yt_primary" tag="youtube" output="youtube">
    <title>My Video Title</title>
    <privacy>public</privacy>
    <madeForKids>false</madeForKids>
    <category>22</category>
    <language>en</language>
    <tag>travel</tag>
    <tag>vlog</tag>
    <description>
      Video description here.
      Can be multiple lines.
    </description>
  </upload>
</node.project>
```

**Upload configuration:**
- `name` - Unique upload identifier
- `tag` - Platform type (`youtube`)
- `output` - References output name

**Children elements:**
- `<title>` - Video title (uses project title if omitted)
- `<privacy>` - `public`, `unlisted`, or `private`
- `<madeForKids>` - `true` or `false`
- `<category>` - YouTube category ID (22 = People & Blogs)
- `<language>` - Language code (e.g., `en`)
- `<tag>` - Video tags (multiple allowed)
- `<description>` - Video description

**Authentication:**

```bash
# Start auth flow
staticstripes auth --upload-name yt_primary

# Follow browser prompts to authenticate
# Credentials saved to .auth/youtube_yt_primary.json
```

**Upload workflow:**

```bash
# 1. Generate video
staticstripes generate -p . -o youtube

# 2. Authenticate (first time only)
staticstripes auth --upload-name yt_primary

# 3. Upload
staticstripes upload --upload-name yt_primary
```

### Instagram Upload

Upload to Instagram Reels:

```html
<node.instagram name="insta" url="$s3_upload.output.url">
  <thumbnail timecode="1000ms" />
  <location city="New York" country="USA" />
  <caption>
    Your caption here with #hashtags
  </caption>
</node.instagram>
```

### S3 Upload

Upload to S3-compatible storage:

```html
<node.s3 name="s3" path="$project.output.youtube">
  <endpoint name="digitaloceanspaces.com" />
  <region name="ams3" />
  <bucket name="my-bucket" />
  <path name="file">videos/${slug}/${output}.mp4</path>
  <acl name="public-read" />
</node.s3>
```

## Common Workflows

### Workflow 1: Create a Simple Video Project

```bash
# 1. Create project
staticstripes bootstrap -n my-video
cd my-video

# 2. Add your media files to input/, audio/, images/ folders

# 3. Scan and catalog assets
staticstripes add-assets -p .

# 4. Edit project.html to define your video

# 5. Generate video (dev mode for fast preview)
staticstripes generate -p . -o youtube -d

# 6. Generate final video (production quality)
staticstripes generate -p . -o youtube
```

### Workflow 2: Using AI-Generated Music

```bash
# 1. Set up API key
export MUSIC_API_AI_KEY=your_api_key

# 2. Configure in project.html
```

```html
<node.project>
  <ai>
    <provider name="music_gen" tag="music-api-ai">
      <model>sonic-v3-5</model>
    </provider>
  </ai>

  <assets>
    <asset
      name="bg_music"
      path="./audio/music.mp3"
      data-ai-integration="music_gen"
      data-ai-prompt="Upbeat electronic music"
      data-ai-duration="30" />
  </assets>

  <sequences>
    <sequence>
      <fragment class="music" />
    </sequence>
  </sequences>

  <style>
    .music {
      -asset: bg_music;
      -duration: 30000ms;
    }
  </style>
</node.project>
```

```bash
# 3. Generate (will auto-generate music if not exists)
staticstripes generate -p . -o youtube
```

### Workflow 3: Upload to YouTube

```bash
# 1. Add upload config to project.html
```

```html
<upload name="yt_main" tag="youtube" output="youtube">
  <title>My Video</title>
  <privacy>public</privacy>
  <madeForKids>false</madeForKids>
  <description>Video description</description>
</upload>
```

```bash
# 2. Generate video
staticstripes generate -p . -o youtube

# 3. Authenticate (first time only)
staticstripes auth --upload-name yt_main

# 4. Upload
staticstripes upload --upload-name yt_main
```

### Workflow 4: Debug Rendering Issues

```bash
# Enable debug mode for detailed output
staticstripes generate -p . -o youtube --debug

# This shows:
# - Full FFmpeg command
# - Stack traces for errors
# - Timeline details for each fragment
# - Asset information
```

### Workflow 5: Multiple Output Formats

```html
<outputs>
  <!-- YouTube landscape -->
  <output name="youtube" resolution="1920x1080" fps="30" />

  <!-- YouTube Shorts -->
  <output name="shorts" resolution="1080x1920" fps="30" />

  <!-- Instagram Reels -->
  <output name="reels" resolution="1080x1920" fps="30" />
</outputs>
```

```bash
# Render all outputs
staticstripes generate -p .

# Render specific output
staticstripes generate -p . -o shorts
```

## Advanced Features

### Feature 1: Calc() Expressions for Synchronization

Synchronize fragments across different sequences:

```html
<node.project>
  <sequences>
    <!-- Video sequence -->
    <sequence>
      <fragment class="intro" id="intro_video" />
      <fragment class="main" />
    </sequence>

    <!-- Audio sequence -->
    <sequence>
      <fragment class="intro_music" />
    </sequence>
  </sequences>

  <style>
    .intro {
      -asset: intro_clip;
      -duration: 5000ms;
    }

    .intro_music {
      -asset: music;
      /* Start and end with intro video */
      -offset-start: calc(url(#intro_video.time.start));
      -duration: calc(url(#intro_video.time.duration));
      -transition-end: fade-out 500ms;
    }
  </style>
</node.project>
```

### Feature 2: Container Overlays

Add HTML overlays to video fragments:

```html
<fragment class="video_with_title">
  <container>
    <div class="title-card">
      <h1>Chapter 1: The Beginning</h1>
      <p>An adventure starts here</p>
    </div>
  </container>
</fragment>

<style>
  .video_with_title {
    -asset: main_clip;
    -duration: 5000ms;
  }

  .title-card {
    position: absolute;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    padding: 20px 40px;
    border-radius: 10px;
    color: white;
    text-align: center;
  }

  .title-card h1 {
    font-size: 48px;
    margin: 0 0 10px 0;
    font-family: 'Arial Black', sans-serif;
  }

  .title-card p {
    font-size: 24px;
    margin: 0;
    opacity: 0.8;
  }
</style>
```

### Feature 3: Chromakey (Green Screen)

Remove green screen backgrounds:

```html
<style>
  .greenscreen_clip {
    -asset: person_greenscreen;
    -duration: 5000ms;
    -chromakey: smooth good #00ff00;
  }
</style>
```

### Feature 4: Fragment IDs and Timecode Labels

Add labels for debugging and reference:

```html
<fragment
  class="intro"
  id="intro_scene"
  data-timecode="Introduction" />

<style>
  .intro {
    -asset: intro_clip;
    -duration: 5000ms;
  }
</style>
```

When rendering with `--debug`, timecode labels appear in the output.

## Error Handling

### Normal Mode

In normal mode, errors show user-friendly messages:

```
Error: Asset file not found: ./input/video.mp4
Please check that the file exists and the path is correct.
```

### Debug Mode

Enable debug mode for detailed information:

```bash
staticstripes generate -p . -o youtube --debug
```

**Debug output includes:**
- Full FFmpeg command
- Stack traces
- Timeline details
- Asset metadata
- Fragment timing calculations

**Example debug output:**

```
=== DEBUG: Timeline ===
Sequence 0:
  Fragment 0 (intro_image):
    Asset: intro
    Start: 0.000s
    End: 3.000s
    Duration: 3.000s
    Trim: 0.000s
    Overlay: 0.000s

=== DEBUG: FFmpeg Command ===
ffmpeg -i ./images/intro.jpg -i ./input/video.mp4 ...
```

## Comprehensive Example: AI-Generated Video

This example demonstrates the full power of the node-based system by creating an AI-generated dad joke video with automated speech, karaoke text, and Instagram upload.

**Project structure:**

```
dad-joke-video/
├── project.html
├── apps/
│   └── karaoke_text/
│       └── dst/
└── output/
```

**project.html:**

```html
<!-- STEP 1: Define output format -->
<outputs>
  <output name="instagram" resolution="1080x1920" fps="30" />
</outputs>

<!-- STEP 2: Generate joke text using OpenAI -->
<node.openai name="joke_generator">
  <prompt>
    You are a hilarious comedian. Generate a funny dad joke about science or
    technology. The joke should be short (2-3 sentences max), family-friendly,
    and include a pun. Format it as a Question and Answer, or as a short story
    with a punchline.
  </prompt>
  <model name="gpt-4o-mini" />
</node.openai>

<!-- STEP 3: Convert joke to speech with word timing -->
<node.elevenlabs
  name="joke_speech"
  text="$joke_generator.text"
  stability="0.7"
  similarityBoost="0.8"
  style="0.3">
  <voice name="IKne3meq5aSn9XLyUdCD" />
  <model name="eleven_multilingual_v2" />
</node.elevenlabs>

<!-- STEP 4: Render joke as animated karaoke text -->
<node.app
  name="joke_text_app"
  src="../apps/karaoke_text/dst"
  words="$joke_speech.wordTiming"
  windowSize="5"
  fontSize="70"
  textColor="#ffffff"
  highlightColor="#ffff00" />

<!-- STEP 5: Compose video with text and audio -->
<node.project>
  <title>AI-Generated Dad Joke</title>
  <tag>comedy</tag>
  <tag>ai</tag>
  <tag>dad-joke</tag>

  <assets>
    <!-- Use outputs from previous nodes as assets -->
    <asset name="text_video" input="$joke_text_app.output.video" />
    <asset name="joke_audio" input="$joke_speech.audio" />

    <!-- Background music (optional) -->
    <asset name="bg_music" path="./audio/background.mp3" />
  </assets>

  <outputs>
    <output name="instagram" resolution="1080x1920" fps="30" />
  </outputs>

  <sequences>
    <!-- Text overlay sequence -->
    <sequence>
      <fragment class="karaoke_text" />
    </sequence>

    <!-- Audio sequence -->
    <sequence>
      <fragment class="speech" />
    </sequence>

    <!-- Background music sequence (quiet) -->
    <sequence>
      <fragment class="music" />
    </sequence>
  </sequences>

  <style>
    .karaoke_text {
      -asset: text_video;
      -duration: auto;
    }

    .speech {
      -asset: joke_audio;
      -duration: auto;
    }

    .music {
      -asset: bg_music;
      -duration: auto;
      -sound: off;  /* Will be mixed at lower volume */
    }
  </style>
</node.project>

<!-- STEP 6: Upload to S3 -->
<node.s3 name="s3_upload" path="$project.output.instagram">
  <endpoint name="digitaloceanspaces.com" />
  <region name="ams3" />
  <bucket name="my-videos" />
  <path name="file">jokes/${slug}/${output}.mp4</path>
  <path name="metadata">jokes/${slug}/metadata.json</path>
  <path name="thumbnail">jokes/${slug}/thumbnail.jpeg</path>
  <acl name="public-read" />
  <thumbnail timecode="500ms" />
</node.s3>

<!-- STEP 7: Publish to Instagram -->
<node.instagram name="instagram_post" url="$s3_upload.output.url">
  <thumbnail timecode="500ms" />
  <caption>
    🤣 Today's AI-generated dad joke!

    #dadjokes #comedy #ai #funny #humor #jokes #puns #laugh
  </caption>
</node.instagram>
```

**Generate and publish:**

```bash
# Set up API keys
export OPENAI_API_KEY=your_openai_key
export ELEVENLABS_API_KEY=your_elevenlabs_key

# Generate video (will run all nodes in sequence)
staticstripes generate -p . -o instagram

# Video is automatically:
# 1. Generated with AI text
# 2. Converted to speech
# 3. Rendered with karaoke text
# 4. Composed into final video
# 5. Uploaded to S3
# 6. Published to Instagram
```

**This example demonstrates:**
- ✅ Node-based pipeline composition
- ✅ AI text generation (OpenAI)
- ✅ Text-to-speech with timing (ElevenLabs)
- ✅ Dynamic app rendering (karaoke text)
- ✅ Multi-sequence video composition
- ✅ Cloud storage (S3)
- ✅ Social media publishing (Instagram)

## Complete Project Example: Travel Vlog

```html
<node.project>
  <title>Christmas Morning in Liberec</title>
  <date>2024-12-24T18:00:00Z</date>
  <tag>travel</tag>
  <tag>vlog</tag>
  <tag>czechrepublic</tag>

  <sequences>
    <!-- Main video sequence -->
    <sequence>
      <fragment class="intro" id="intro" data-timecode="Introduction" />
      <fragment class="main_clip ambient" data-timecode="Main Scene" />
      <fragment class="transition_effect" />
      <fragment class="outro" id="outro" data-timecode="Conclusion">
        <app
          src="../apps/central_text/dst"
          data-parameters='{"text": "Thanks for watching!", "fontSize": "64"}' />
      </fragment>
    </sequence>

    <!-- Audio/music sequence -->
    <sequence>
      <fragment class="intro_music" />
      <fragment class="outro_music" />
    </sequence>

    <!-- Overlay text sequence -->
    <sequence>
      <fragment class="title_overlay">
        <container>
          <div class="title-card">
            <h1>Christmas in Liberec</h1>
            <p>Czech Republic • December 2024</p>
          </div>
        </container>
      </fragment>
    </sequence>
  </sequences>

  <style>
    /* Common styles */
    .ambient {
      -object-fit: contain ambient 25 -0.1 0.7;
    }

    /* Intro section */
    .intro {
      -asset: intro_image;
      -duration: 5000ms;
      -transition-end: fade-out 1000ms;
      filter: instagram-lark;
    }

    .intro_music {
      -asset: background_music;
      -duration: 5000ms;
      -transition-end: fade-out 500ms;
    }

    /* Main content */
    .main_clip {
      -asset: main_video;
      -trim-start: 2000ms;
      -duration: 15000ms;
      -transition-start: fade-in 1000ms;
    }

    .transition_effect {
      -asset: static_effect;
      -duration: 500ms;
    }

    /* Outro section */
    .outro {
      -asset: intro_image;
      -duration: 5000ms;
      -transition-start: fade-in 1000ms;
      -transition-end: fade-out 500ms;
    }

    .outro_music {
      -asset: background_music;
      -offset-start: calc(url(#outro.time.start));
      -duration: calc(url(#outro.time.duration));
      -transition-end: fade-out 1000ms;
    }

    /* Title overlay */
    .title_overlay {
      -offset-start: calc(url(#intro.time.start));
      -duration: 5000ms;
      -overlay-start-z-index: 1;
    }

    .title-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: white;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.8);
    }

    .title-card h1 {
      font-size: 72px;
      margin: 0 0 20px 0;
      font-family: 'Arial Black', sans-serif;
      letter-spacing: 2px;
    }

    .title-card p {
      font-size: 36px;
      margin: 0;
      font-family: Arial, sans-serif;
      opacity: 0.9;
    }
  </style>

  <assets>
    <asset name="intro_image" path="./images/intro.jpg" />
    <asset name="main_video" path="./input/liberec_morning.mp4" />
    <asset name="static_effect" path="./effects/analog_static.mp4" />
    <asset name="background_music" path="./audio/acoustic_guitar.mp3" />
  </assets>

  <outputs>
    <output name="youtube" resolution="1920x1080" fps="30" />
    <output name="instagram" resolution="1080x1920" fps="30" />
  </outputs>

  <ffmpeg>
    <option name="preview">
      -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k
    </option>
    <option name="production">
      -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 320k
    </option>
  </ffmpeg>

  <upload name="yt_main" tag="youtube" output="youtube">
    <title>Christmas Morning in Liberec | Czech Republic Travel Vlog</title>
    <privacy>public</privacy>
    <madeForKids>false</madeForKids>
    <category>22</category>
    <language>en</language>
    <tag>travel</tag>
    <tag>vlog</tag>
    <tag>czechrepublic</tag>
    <tag>liberec</tag>
    <tag>christmas</tag>
    <description>
      Join me for a magical Christmas morning in Liberec, Czech Republic!

      Walking through snowy streets and experiencing the holiday atmosphere
      in this beautiful city nestled in the mountains.

      📍 Location: Liberec, Czech Republic
      📅 Date: December 24, 2024
      🎵 Music: Acoustic Guitar Background

      #travel #czechrepublic #liberec #christmas #travelvlog
    </description>
  </upload>
</node.project>

<!-- Save to local filesystem -->
<node.filesystem name="local_youtube" path="$project.output.youtube">
  <path>output/youtube.mp4</path>
</node.filesystem>

<node.filesystem name="local_instagram" path="$project.output.instagram">
  <path>output/instagram.mp4</path>
</node.filesystem>
```

**Generate the video:**

```bash
# Preview mode (fast)
staticstripes generate -p . -o youtube -d

# Production mode (high quality)
staticstripes generate -p . -o youtube

# Generate both outputs
staticstripes generate -p .

# Debug mode
staticstripes generate -p . -o youtube --debug
```

**Upload to YouTube:**

```bash
# Authenticate (first time only)
staticstripes auth --upload-name yt_main

# Upload
staticstripes upload --upload-name yt_main
```

## Troubleshooting

### FFmpeg not found

**Error:**
```
FFmpeg is not installed or not in PATH
```

**Solution:**

1. **macOS:**
   ```bash
   brew install ffmpeg
   ```

2. **Ubuntu/Debian:**
   ```bash
   sudo apt-get install ffmpeg
   ```

3. **Windows:**
   - Download from [ffmpeg.org](https://ffmpeg.org/download.html)
   - Add to system PATH

4. **Verify:**
   ```bash
   ffmpeg -version
   ```

### Node.js version too old

**Error:**
```
Node.js 22+ is required
```

**Solution:**

Update Node.js to version 22 or higher:

```bash
# Using nvm (recommended)
nvm install 22
nvm use 22

# Or download from nodejs.org
# https://nodejs.org/
```

### Asset file not found

**Error:**
```
Asset file not found: ./input/video.mp4
```

**Solutions:**

1. Check file path is correct relative to project.html
2. Verify file exists:
   ```bash
   ls -la input/
   ```
3. Re-scan assets:
   ```bash
   staticstripes add-assets -p .
   ```

### AI generation fails

**Error:**
```
AI generation failed: API key not found
```

**Solutions:**

1. **Set environment variable:**
   ```bash
   export MUSIC_API_AI_KEY=your_api_key
   export OPENAI_API_KEY=your_openai_key
   export ELEVENLABS_API_KEY=your_elevenlabs_key
   ```

2. **Or create .auth file:**
   ```bash
   mkdir -p .auth
   echo '{"apiKey": "your_key"}' > .auth/music-api-ai.json
   ```

3. **Verify API key is valid**

### App build fails

**Error:**
```
App build failed: npm install error
```

**Solutions:**

1. Check app has package.json
2. Manually install dependencies:
   ```bash
   cd apps/my_app
   npm install
   npm run build
   ```
3. Force rebuild:
   ```bash
   staticstripes generate -p . --app-build
   ```

### Rendering is slow

**Solutions:**

1. **Use dev mode for previews:**
   ```bash
   staticstripes generate -p . -o youtube -d
   ```

2. **Enable hardware acceleration:**
   ```html
   <ffmpeg>
     <option name="preview">
       -c:v h264_videotoolbox -preset fast -crf 23
     </option>
   </ffmpeg>
   ```

   Available hardware encoders:
   - macOS: `h264_videotoolbox`
   - NVIDIA: `h264_nvenc`
   - AMD: `h264_amf`
   - Intel: `h264_qsv`

3. **Reduce output resolution temporarily**

4. **Clear cache:**
   ```bash
   rm -rf cache/
   ```

## Best Practices

### 1. Use Dev Mode for Iterations

Always use `-d` flag when testing:

```bash
staticstripes generate -p . -o youtube -d
```

Only render in production mode for final output.

### 2. Organize Assets with Prefixes

```
input/
├── clip_01_intro.mp4
├── clip_02_main.mp4
└── clip_03_outro.mp4

audio/
├── music_background.mp3
└── sfx_transition.mp3

images/
├── img_title.jpg
└── img_logo.png
```

### 3. Use CSS Classes for Reusability

```css
/* Define reusable styles */
.standard_duration {
  -duration: 5000ms;
}

.fade_both {
  -transition-start: fade-in 500ms;
  -transition-end: fade-out 500ms;
}

.ambient_bg {
  -object-fit: contain ambient 20 -0.2 0.8;
}
```

```html
<fragment class="intro standard_duration fade_both" />
<fragment class="main standard_duration fade_both ambient_bg" />
```

### 4. Add IDs and Timecode Labels

```html
<fragment
  class="intro"
  id="intro_scene"
  data-timecode="Introduction" />

<fragment
  class="main"
  id="main_scene"
  data-timecode="Main Content" />
```

Makes debugging easier and enables calc() references.

### 5. Use calc() for Synchronization

```css
.background_music {
  -asset: music;
  -offset-start: calc(url(#intro_scene.time.start));
  -duration: calc(url(#intro_scene.time.duration));
}
```

### 6. Cache AI-Generated Assets

AI-generated assets are cached automatically. Don't delete them unless regeneration is needed.

### 7. Version Control Best Practices

**Add to .gitignore:**

```
output/
cache/
.auth/
*.mp4
*.mp3
*.jpg
*.png
apps/*/dst/
node_modules/
```

**Commit to git:**

```
project.html
apps/*/index.html
apps/*/package.json
apps/*/tsconfig.json
apps/*/vite.config.ts
```

### 8. Use Debug Mode for Troubleshooting

```bash
staticstripes generate -p . -o youtube --debug
```

Shows complete FFmpeg command, timeline, and error details.

## Recent Improvements

### Filters Command

List all available Instagram-style filters:

```bash
staticstripes filters
```

Shows all 22 filters with usage examples.

### Automatic App Building

Apps are automatically built before rendering:

```bash
# Automatic build
staticstripes generate -p .

# Force rebuild
staticstripes generate -p . --app-build
```

### Debug Timeline Output

View detailed fragment timeline:

```bash
staticstripes generate -p . -o youtube --debug
```

### calc() Expression Support

Reference other fragments' timing properties:

```css
.fragment {
  -offset-start: calc(url(#intro.time.end) + 500ms);
  -duration: calc(url(#intro.time.duration));
}
```

### data-timing Short Syntax

Compact timing syntax:

```html
<fragment
  data-asset="clip"
  data-timing="ts=3000,d=5000,os=1000" />
```

### Sound Control

Control audio per fragment:

```css
.fragment {
  -sound: off;  /* Mute this fragment */
}
```

### Node-Based Architecture

Composable pipeline with specialized nodes:

```html
<node.openai name="generator">...</node.openai>
<node.elevenlabs name="speech">...</node.elevenlabs>
<node.app name="renderer">...</node.app>
<node.project>...</node.project>
<node.s3 name="uploader">...</node.s3>
<node.instagram name="publisher">...</node.instagram>
```

## Resources

- **GitHub:** [github.com/gannochenko/staticstripes](https://github.com/gannochenko/staticstripes)
- **NPM:** [@gannochenko/staticstripes](https://www.npmjs.com/package/@gannochenko/staticstripes)
- **Issues:** [github.com/gannochenko/staticstripes/issues](https://github.com/gannochenko/staticstripes/issues)

## Summary

StaticStripes is a powerful video rendering tool that uses:

1. **Node-based architecture** for composable pipelines
2. **HTML/CSS syntax** for familiar, declarative video definitions
3. **FFmpeg** for high-quality video processing
4. **AI integrations** for automated content generation
5. **Platform integrations** for automated publishing

**Key capabilities:**

- ✅ Declare videos using HTML/CSS
- ✅ Multiple sequences for complex compositions
- ✅ Transitions, filters, and effects
- ✅ Ken Burns zoom/pan effects
- ✅ Chromakey (green screen) support
- ✅ Custom HTML/CSS overlays and apps
- ✅ AI text generation (OpenAI)
- ✅ AI text-to-speech (ElevenLabs)
- ✅ AI music generation (AIMusicAPI.ai)
- ✅ Multi-format output (16:9, 9:16, custom)
- ✅ YouTube upload with metadata
- ✅ Instagram Reels publishing
- ✅ S3 cloud storage
- ✅ Hardware acceleration support
- ✅ Development and production modes
- ✅ Comprehensive debugging tools

**Perfect for:**

- 🎬 Video content creators
- 📱 Social media managers
- 🎨 Motion graphics designers
- 🤖 AI-powered content automation
- 📊 Data visualization videos
- 🎓 Educational content
- 🎮 Gaming montages
- ✈️ Travel vlogs

Start creating professional videos with just HTML and CSS!
