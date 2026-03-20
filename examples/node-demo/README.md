# Node Renderer Demo

A simple demonstration of the node-based video rendering system.

## What This Demo Does

This project demonstrates:
- **Project Node**: Renders video with sequences, fragments, and effects
- **Filesystem Node**: Saves rendered output to local filesystem

## Project Structure

```
node-demo/
├── project.html          # Node definitions
├── assets/
│   ├── images/          # Image assets
│   ├── video/           # Video clips
│   └── audio/           # Audio tracks
└── output/              # Rendered videos
```

## Video Timeline

Total duration: **10 seconds**

1. **Intro (0-3s)**: Static image with fade-out
2. **Main Clip (3-8s)**: Video with ambient background effect, fade in/out
3. **Outro (8-10s)**: Static image with Instagram Lark filter, fade-in

**Audio**: Background music throughout with fade-out at end

## Quick Start

```bash
# Build the CLI tool
make setup

# Validate the project
make validate

# Render the video
make render

# Or render with verbose output
make render-verbose
```

## Output

The rendered video will be saved to:
- `output/youtube.mp4` (from project node)
- `output/test_video.mp4` (from filesystem node - copy of youtube.mp4)

## Make Commands

- `make setup` - Build the node-renderer CLI
- `make validate` - Validate project without rendering
- `make render` - Execute the DAG and render video
- `make render-verbose` - Render with detailed logs
- `make render-no-cache` - Render without using cache
- `make clean` - Remove output files
- `make help` - Show all commands
