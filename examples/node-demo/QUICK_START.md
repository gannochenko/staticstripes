# Quick Start Guide

Get up and running with the Node-Based Video Renderer in under 5 minutes!

## Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0
- Make (optional, but recommended)

## 1. Build the CLI

```bash
cd ../../apps/node-renderer
make build

# Or without Make:
npm run build
```

## 2. Run the Demo

```bash
cd ../../examples/complete-demo

# Validate the project
make validate

# Execute the project
make render
```

## 3. Explore the Output

```bash
# View project info
make info

# Run with verbose output
make render-verbose

# Clean and re-run
make clean
make render
```

## What Just Happened?

The demo executed a complete video production pipeline:

```
1. OpenAI generated a dad joke
2. ElevenLabs converted it to speech
3. AI Music API created background music
4. Project node rendered the video
5. Filesystem saved a local preview
6. S3 uploaded to cloud storage
7. YouTube uploaded the video
8. Instagram posted from S3 URL
```

## Next Steps

### Modify the Project

Edit `project.html` to customize:

- **Change the joke topic** (line 13)
- **Change the voice** (line 26)
- **Adjust video settings** (lines 198-201)
- **Modify styling** (lines 110-165)

### Run Custom Projects

```bash
# Validate any project
node ../../apps/node-renderer/dist/cli.js your-project.html --validate-only

# Execute any project
node ../../apps/node-renderer/dist/cli.js your-project.html
```

### Explore the Code

- **HTML Parser**: `apps/node-renderer/src/html-parser.ts`
- **DAG Validator**: `apps/node-renderer/src/dag-validator.ts`
- **DAG Runner**: `apps/node-renderer/src/dag-runner.ts`
- **Node Types**: `apps/node-renderer/src/nodes/`

## Available Commands

### In `apps/node-renderer/`

```bash
make help           # Show all commands
make build          # Build the CLI
make test           # Run tests
make render-demo    # Run this demo
make validate-demo  # Validate this demo
```

### In `examples/complete-demo/`

```bash
make help                      # Show all commands
make validate                  # Validate only
make render                    # Execute with cache
make render-verbose            # Execute with details
make render-no-cache           # Execute without cache
make info                      # Show project info
make clean                     # Clean output
```

## Troubleshooting

### "Command not found: node"

Install Node.js from https://nodejs.org/

### "Command not found: make"

Run npm commands directly:

```bash
cd apps/node-renderer
npm run build

# Then execute manually:
node dist/cli.js ../../examples/complete-demo/project.html
```

### Validation Errors

```bash
# See detailed errors:
make validate-verbose
```

### Execution Fails

```bash
# See detailed logs:
make render-verbose
```

## Learn More

- **Full Demo README**: `README.md` (in this directory)
- **Main README**: `apps/node-renderer/README.md`
- **Node Specification**: `docs/NODES.md`

## Quick Examples

### Validate a Project

```bash
node ../../apps/node-renderer/dist/cli.js project.html --validate-only
```

### Execute with Verbose Output

```bash
node ../../apps/node-renderer/dist/cli.js project.html --verbose
```

### Execute without Cache

```bash
node ../../apps/node-renderer/dist/cli.js project.html --no-cache
```

### Show Help

```bash
node ../../apps/node-renderer/dist/cli.js --help
```

## Common Workflow

```bash
# 1. Edit project.html
vim project.html

# 2. Validate changes
make validate

# 3. Execute
make render

# 4. View output
ls -lh output/

# 5. Rinse and repeat
```

## Performance Tips

- **First run**: ~2ms (stub execution, actual would be longer)
- **With cache**: All cached results restored instantly
- **No cache**: Forces re-execution of all nodes

## What's Next?

1. ✅ Explore the demo project structure
2. ✅ Modify `project.html` and re-run
3. ✅ Create your own project
4. ✅ Add real input videos to `input/`
5. ✅ Implement actual node execution (currently stubs)
6. ✅ Configure API keys for OpenAI, ElevenLabs, etc.

Happy rendering! 🎬
