# Complete Node-Based Video Renderer Demo

This example demonstrates all 8 node types working together in a complete video production pipeline.

## What This Demo Does

This project creates a "Dad Joke of the Day" video using AI-generated content:

1. **OpenAI** generates a programming-themed dad joke
2. **ElevenLabs** converts the joke to speech
3. **AI Music API** generates cheerful background music
4. **Project** node renders the final video with all assets
5. **Filesystem** saves a local preview
6. **S3** uploads the video to cloud storage
7. **YouTube** uploads the main video
8. **Instagram** posts using the S3 URL

## Node Types Demonstrated

### 1. OpenAI Node (`joke_writer`)
- **Type**: `openai`
- **Inputs**: None
- **Outputs**: `text`
- **Purpose**: Generates the joke script using GPT-4

### 2. ElevenLabs Node (`narrator`)
- **Type**: `elevenlabs`
- **Inputs**: `text` (from `$joke_writer.output.text`)
- **Outputs**: `audio`
- **Purpose**: Converts script to speech using Adam voice

### 3. AI Music API Node (`background_music`)
- **Type**: `ai_music_api_ai`
- **Inputs**: None
- **Outputs**: `audio`
- **Purpose**: Generates upbeat background music

### 4. Project Node (main)
- **Type**: `project`
- **Inputs**: Assets (narration, music via `input` references)
- **Outputs**: `youtube`, `youtube_shorts`, `instagram`
- **Purpose**: Main video rendering with FFmpeg
- **Features**:
  - Multiple output resolutions
  - CSS-based styling
  - Sequences and fragments
  - Asset management
  - FFmpeg options

### 5. Filesystem Node (`local_preview`)
- **Type**: `filesystem`
- **Inputs**: `path` (from `$project.output.youtube`)
- **Outputs**: `file`
- **Purpose**: Saves preview to `output/dad_joke_preview.mp4`

### 6. S3 Node (`s3_storage`)
- **Type**: `s3`
- **Inputs**: `path` (from `$project.output.youtube_shorts`)
- **Outputs**: `url`
- **Purpose**: Uploads to DigitalOcean Spaces (S3-compatible)
- **Features**:
  - Multiple file paths (video, metadata, thumbnail)
  - Public ACL
  - Thumbnail extraction

### 7. YouTube Node (`youtube_upload`)
- **Type**: `youtube`
- **Inputs**: `path` (from `$project.output.youtube`)
- **Outputs**: `url`, `video_id`
- **Purpose**: Uploads to YouTube with metadata
- **Features**:
  - Unlisted, made-for-kids settings
  - Category and language
  - Custom description with timecodes
  - Thumbnail extraction

### 8. Instagram Node (`instagram_post`)
- **Type**: `instagram`
- **Inputs**: `url` (from `$s3_storage.output.url`)
- **Outputs**: `post_id`, `url`
- **Purpose**: Posts video to Instagram
- **Features**:
  - Caption with hashtags
  - Thumbnail extraction

## Execution Flow

```
joke_writer (openai)
    ↓ text
narrator (elevenlabs)
    ↓ audio
    ├─────────────┐
                  ↓
background_music → project (renders video)
(ai_music_api_ai)     ↓
                  ├───┼───┐
                  ↓   ↓   ↓
          local_preview │ s3_storage
          (filesystem)  │     ↓
                        ↓  instagram_post
                  youtube_upload
```

## Directory Structure

```
complete-demo/
├── project.html          # Main project definition
├── Makefile             # Build and execution commands
├── README.md            # This file
├── input/               # Input video files (if any)
├── output/              # Rendered output files
├── images/              # Static image assets
├── audio/               # Static audio assets
└── effects/             # Visual effects assets
```

## Prerequisites

1. **Node.js** >= 22.0.0
2. **npm** >= 10.0.0
3. **Built CLI**: Run `make setup` first

## Usage

### Quick Start

```bash
# Build the CLI tool
make setup

# View available commands
make help

# Validate project
make validate

# Execute project (with cache)
make render

# Execute with verbose output
make render-verbose

# Execute without cache
make render-no-cache
```

### Available Commands

- `make help` - Show all available commands
- `make setup` - Build the node-renderer CLI
- `make validate` - Validate project without executing
- `make validate-verbose` - Validate with detailed output
- `make render` - Execute the complete DAG (cached)
- `make render-verbose` - Execute with verbose output
- `make render-no-cache` - Execute without caching
- `make render-no-cache-verbose` - No cache + verbose
- `make clean` - Clean output directory
- `make info` - Show project information
- `make test` - Validate and render

### Manual CLI Usage

```bash
# Direct CLI usage
node ../../apps/node-renderer/dist/cli.js project.html

# With options
node ../../apps/node-renderer/dist/cli.js project.html --verbose
node ../../apps/node-renderer/dist/cli.js project.html --no-cache
node ../../apps/node-renderer/dist/cli.js project.html --validate-only
```

## Expected Output

When you run `make render`, you'll see:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              Node-Based Video Renderer                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

============================================================
  📋 Validating Project
============================================================

📄 Project: project.html
📁 Location: /path/to/examples/complete-demo

🔍 Parsing HTML...
✅ Found 8 node(s)

🏗️  Creating node instances...
✅ Created 8 node instance(s)

🔍 Validating DAG structure...
✅ DAG structure is valid

📊 Execution order:
   1. joke_writer
   2. background_music
   3. narrator
   4. project
   5. local_preview
   6. s3_storage
   7. youtube_upload
   8. instagram_post

============================================================
  ✅ Validation Passed
============================================================

============================================================
  🚀 Executing Project
============================================================

Cache: enabled

🔄 Executing: joke_writer
✅ Completed: joke_writer [1250ms]

🔄 Executing: background_music
✅ Completed: background_music [2100ms]

🔄 Executing: narrator
✅ Completed: narrator [1800ms]

🔄 Executing: project
✅ Completed: project [15000ms]

🔄 Executing: local_preview
✅ Completed: local_preview [50ms]

🔄 Executing: s3_storage
✅ Completed: s3_storage [250ms]

🔄 Executing: youtube_upload
✅ Completed: youtube_upload [3200ms]

🔄 Executing: instagram_post
✅ Completed: instagram_post [1500ms]

------------------------------------------------------------
✅ Execution completed successfully!

📊 Summary:
   Nodes executed: 8
   Total duration: 25150ms
   Wall clock time: 25160ms
   Cache hits: 0/8

============================================================
✨ Done!
```

## Caching

The runner includes intelligent caching:

- **First run**: All nodes execute, results cached
- **Second run**: All results from cache (~0ms)
- **Changed parameters**: Affected nodes re-execute
- **Downstream invalidation**: Dependent nodes automatically invalidated

### Cache Example

```bash
# First run - no cache
make render
# Total: ~25s

# Second run - all cached
make render
# Total: ~50ms (cache retrieval only)

# Run without cache
make render-no-cache
# Total: ~25s (forces re-execution)
```

## Customization

### Modify the Joke Prompt

Edit `project.html` line 13:

```html
<prompt>
  Write a funny dad joke about [YOUR TOPIC].
  Keep it short and punchy, around 2-3 sentences.
</prompt>
```

### Change Voice

Edit line 26:

```html
<voice name="bella" />  <!-- Try: adam, bella, rachel, etc. -->
```

### Adjust Video Settings

Edit lines 198-201:

```html
<output name="youtube" resolution="3840x2160" fps="60" />  <!-- 4K60 -->
```

### Change FFmpeg Quality

Edit lines 205-207:

```html
<option name="ultra_high">
  -c:v h264_nvenc -preset slow -b:v 50M -c:a aac -b:a 512k
</option>
```

## Troubleshooting

### CLI Not Found

```bash
make setup  # Rebuild the CLI
```

### Validation Errors

```bash
make validate-verbose  # See detailed error messages
```

### Execution Fails

```bash
make render-verbose  # See detailed execution logs
```

## Learn More

- **HTML Parser**: See `apps/node-renderer/src/html-parser.ts`
- **Node Implementations**: See `apps/node-renderer/src/nodes/`
- **DAG Validator**: See `apps/node-renderer/src/dag-validator.ts`
- **DAG Runner**: See `apps/node-renderer/src/dag-runner.ts`

## Next Steps

1. Add your own input files to `input/`
2. Modify the project to use real videos
3. Configure API keys for OpenAI, ElevenLabs, etc.
4. Implement actual node execution (currently stubs)
5. Add more sequences and effects
6. Create your own custom nodes

## License

MIT
