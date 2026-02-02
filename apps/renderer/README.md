<p align="center">
  <img src="./logo.svg" alt="StaticStripes Logo" width="200"/>
</p>

<h1 align="center">StaticStripes</h1>

<p align="center">
  <strong>A declarative HTML-based video renderer powered by FFmpeg</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a>
</p>

---

## Features

- **Declarative HTML syntax** - Define video projects using familiar HTML structure
- **CSS styling** - Style your video elements with standard CSS
- **Multiple outputs** - Generate videos in different formats and aspect ratios from a single project
- **Asset management** - Automatic scanning and cataloging of media files
- **FFmpeg integration** - Leverages FFmpeg's powerful video processing capabilities
- **Development mode** - Fast preview rendering with ultrafast encoding preset
- **TypeScript** - Fully typed codebase for better developer experience

## Installation

### Global Installation

```bash
npm install -g @gannochenko/staticstripes
```

### Local Installation

```bash
npm install @gannochenko/staticstripes
```

## Quick Start

### 1. Create a New Project

```bash
staticstripes bootstrap -n my-video-project
cd my-video-project
```

### 2. Add Your Media Files

Place your video clips, audio tracks, and images in the project directory, then scan them:

```bash
staticstripes add-assets -p .
```

### 3. Edit Your Project

Edit `project.html` to define your video composition using HTML and CSS.

### 4. Generate Video

```bash
# Development mode (fast encoding)
staticstripes generate -p . -o youtube -d

# Production mode (high quality)
staticstripes generate -p . -o youtube
```

## Usage

### Commands

#### `bootstrap`

Create a new video project from template.

```bash
staticstripes bootstrap -n <project-name>
```

**Options:**
- `-n, --name <name>` - Name of the new project (required)

**Example:**
```bash
staticstripes bootstrap -n my-awesome-video
```

---

#### `add-assets`

Scan for media files and automatically add them as assets to project.html.

```bash
staticstripes add-assets [options]
```

**Options:**
- `-p, --project <path>` - Path to project directory (default: current directory)

**Example:**
```bash
staticstripes add-assets -p ./my-project
```

Supported media formats:
- **Video:** `.mp4`
- **Audio:** `.mp3`
- **Images:** `.jpg`, `.png`

---

#### `generate`

Generate video output from a project.

```bash
staticstripes generate [options]
```

**Options:**
- `-p, --project <path>` - Path to project directory (default: current directory)
- `-o, --output <name>` - Output name to render (renders all outputs if not specified)
- `-d, --dev` - Use fast encoding preset for development (ultrafast)

**Examples:**
```bash
# Render specific output in development mode
staticstripes generate -p . -o youtube_shorts -d

# Render all outputs in production mode
staticstripes generate -p ./my-project

# Render with high quality
staticstripes generate -p . -o youtube
```

---

#### `upload`

Upload video to platforms _(not yet implemented)_.

```bash
staticstripes upload [options]
```

**Options:**
- `-p, --project <path>` - Path to project directory (default: current directory)
- `-u, --upload <platform>` - Platform to upload to (e.g., youtube)

---

### Project Structure

```
my-video-project/
├── project.html          # Main project file (HTML-based video definition)
├── input/                # Video clips
├── audio/                # Audio tracks
├── images/               # Image assets
├── effects/              # Effect clips
├── output/               # Generated videos
└── .cache/               # Temporary rendering cache
```

### Project File Format

The `project.html` file uses a custom HTML-based syntax:

```html
<style>
  /* Define styles for your video elements */
  .container {
    width: 1920px;
    height: 1080px;
  }
</style>

<outputs>
  <output data-name="youtube" data-path="./output/youtube.mp4" data-fps="30" />
  <output data-name="youtube_shorts" data-path="./output/youtube_shorts.mp4" data-fps="30" />
</outputs>

<assets>
  <asset data-name="clip_1" data-path="./input/video1.mp4" />
  <asset data-name="track_1" data-path="./audio/music.mp3" />
  <asset data-name="image_1" data-path="./images/cover.jpg" />
</assets>

<!-- Define your video composition -->
<container class="container">
  <!-- Your video elements here -->
</container>
```

## Development

### Prerequisites

- Node.js 18+
- FFmpeg installed and available in PATH
- TypeScript 5.7+

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd staticstripes

# Install dependencies
npm install

# Build the project
npm run build

# Link globally for development
npm link
```

### Available Scripts

```bash
# Build TypeScript
npm run build

# Development mode
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Makefile Commands

```bash
# Install dependencies
make install

# Build project
make build

# Link globally
make link

# Unlink globally
make unlink

# Run linter
make lint

# Run linter with auto-fix
make lint-fix

# Format code
make format

# Run tests
make test

# Generate demo video (development)
make demo

# Generate demo video (production)
make demo-prod

# Clean build artifacts
make clean
```

## License

MIT

## Author

Created by @gannochenko

---

<p align="center">
  Made with ❤️ using FFmpeg and TypeScript
</p>
