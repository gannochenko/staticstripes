# Node Renderer

A node-based video rendering system that parses HTML project files and builds a DAG (Directed Acyclic Graph) of processing nodes.

## Milestone 1: HTML Parser ✅

The HTML parser successfully extracts node definitions and complete project structure from project.html files.

### Node Types

1. **project** - Main project node (runs ffmpeg)
2. **filesystem** - Outputs result file to local filesystem
3. **youtube** - Integration with YouTube
4. **s3** - Integration with S3
5. **instagram** - Integration with Instagram
6. **ai_music_api_ai** - Integration with AI Music API
7. **elevenlabs** - Integration with ElevenLabs
8. **openai** - Integration with OpenAI

### Features

**Node Parsing:**
- Parses custom node tags (e.g., `<node.project>`, `<node.filesystem>`)
- Extracts node attributes and child elements
- Supports all node types from the specification

**Project Content Parsing:**
- ✅ **CSS Styles** - Extracts and parses CSS from `<style>` tags, applies styles to fragments
- ✅ **Assets** - Parses `<assets>` section with both file-based and node-input-based assets
  - File assets: `<asset name="clip_01" path="./input/video.mp4" />`
  - Node assets: `<asset name="audio" input="elevenlabs.joker_talks.audio" />`
- ✅ **Outputs** - Parses `<outputs>` section with resolution and fps configurations
- ✅ **Sequences & Fragments** - Parses `<sequences>` with nested `<fragment>` elements
- ✅ **FFmpeg Options** - Parses `<ffmpeg>` encoding options
- ✅ **Title & Tags** - Extracts project metadata

### Usage

```typescript
import { HTMLParser } from './html-parser';

const parser = new HTMLParser();
const result = await parser.parseFile('project.html');

// Access nodes
console.log('Total nodes:', result.nodes.length);
console.log('Project node:', result.projectNode);

// Access project content
const content = result.projectNode?.projectContent;
console.log('Title:', content?.title);
console.log('Assets:', content?.assets.length);
console.log('Outputs:', content?.outputs.length);
console.log('Sequences:', content?.sequences.length);
console.log('CSS Rules:', content?.cssText);

// Iterate through all nodes
result.nodes.forEach((node) => {
  console.log(`Node type: ${node.type}, name: ${node.name || 'N/A'}`);
});
```

### Test Coverage

All 14 tests passing:
- Basic node parsing (all 8 node types)
- Project content parsing (title, tags, assets, outputs, sequences, ffmpeg, CSS)
- Attribute and child element extraction
- Helper functions
- Complete NODES.md example

## Milestone 2: Node Implementations ✅

All 8 node types have been implemented with proper separation of concerns using the Factory pattern.

### Architecture

- **INode Interface** - Common interface that all nodes implement
- **NodeFactory** - Factory that extracts parameters from ParsedNode and creates node instances
- **Clean Node Constructors** - Nodes accept explicit parameters, not ParsedNode objects
- **Parameter Validation** - Each node validates its own parameters

### Node Implementations

Each node is implemented in its own subfolder under `src/nodes/`:

1. **ProjectNode** (`src/nodes/project/`)
   - Inputs: None (source node)
   - Outputs: Multiple video outputs (from `<outputs>` config)
   - Parameters: title, tags, sequences, assets, outputs, ffmpeg options

2. **FilesystemNode** (`src/nodes/filesystem/`)
   - Inputs: `path` (video source reference)
   - Outputs: `file` (written file path)
   - Parameters: pathRef, destinationPath

3. **YouTubeNode** (`src/nodes/youtube/`)
   - Inputs: `path` (video source)
   - Outputs: `url`, `video_id`
   - Parameters: pathRef, unlisted, madeForKids, category, language, thumbnail, description

4. **S3Node** (`src/nodes/s3/`)
   - Inputs: `path` (video source)
   - Outputs: `url` (S3 URL)
   - Parameters: pathRef, endpoint, region, bucket, paths[], acl, thumbnail

5. **InstagramNode** (`src/nodes/instagram/`)
   - Inputs: `url` (video URL reference)
   - Outputs: `post_id`, `url`
   - Parameters: urlRef, thumbnail, caption

6. **AIMusicAPINode** (`src/nodes/ai_music_api_ai/`)
   - Inputs: None (generates from prompt)
   - Outputs: `audio`
   - Parameters: prompt, model

7. **ElevenLabsNode** (`src/nodes/elevenlabs/`)
   - Inputs: `text` (text source reference)
   - Outputs: `audio`
   - Parameters: textRef, voice, model

8. **OpenAINode** (`src/nodes/openai/`)
   - Inputs: None (generates from prompt)
   - Outputs: `text`
   - Parameters: prompt, model

### Usage

```typescript
import { HTMLParser, NodeFactory } from '@gannochenko/node-renderer';

// Parse HTML file
const parser = new HTMLParser();
const result = await parser.parseFile('project.html');

// Create node instances
const nodes = NodeFactory.createNodes(result.nodes);

// Validate each node
nodes.forEach((node) => {
  console.log(`Node: ${node.getName()} (${node.getType()})`);
  console.log('Inputs:', node.getInputs());
  console.log('Outputs:', node.getOutputs());

  const errors = node.validateParameters();
  if (errors.length > 0) {
    console.error('Validation errors:', errors);
  }
});

// Check parameter schema
const schema = nodes[0].getParameterSchema();
console.log('Parameter schema:', schema);
```

### Test Coverage

All 31 tests passing:
- Node creation for all 8 types
- Parameter extraction from HTML
- Parameter validation
- Inputs/outputs definition
- Parameter schema introspection
- Batch node creation
- Unknown node type handling

## Milestone 3: DAG Validation ✅

Comprehensive validation system for the entire node structure.

### Features

**DAG Structure Validation:**
- ✅ **Cycle Detection** - Detects circular dependencies using DFS algorithm
- ✅ **Topological Sort** - Determines correct execution order using Kahn's algorithm
- ✅ **Dependency Graph** - Builds complete graph of node dependencies

**Node Validation:**
- ✅ **Unique Names** - Ensures all node names are unique
- ✅ **Project Node** - Validates exactly one project node exists
- ✅ **Node References** - Validates all `$nodeName.output.outputName` references
- ✅ **Output References** - Ensures referenced outputs actually exist
- ✅ **Asset References** - Validates node-based assets (e.g., `elevenlabs.tts.audio`)
- ✅ **Parameter Validation** - Checks all required parameters are present

**Reference Parsing:**
- Node references: `$project.output.youtube`
- Asset input references: `elevenlabs.joker_talks.audio`

### Validation Error Types

1. **cycle** - Circular dependency detected
2. **unknown_node_type** - Unsupported node type
3. **duplicate_node_name** - Multiple nodes with same name
4. **unresolved_node_reference** - Reference to non-existent node
5. **unresolved_output_reference** - Reference to non-existent output
6. **unresolved_asset_reference** - Asset references invalid node/output
7. **missing_parameter** - Required parameter not provided
8. **no_project_node** - No project node found
9. **multiple_project_nodes** - More than one project node
10. **invalid_reference_format** - Malformed reference string

### Usage

```typescript
import { HTMLParser, NodeFactory, DAGValidator } from '@gannochenko/node-renderer';

// Parse HTML file
const parser = new HTMLParser();
const result = await parser.parseFile('project.html');

// Create node instances
const nodes = NodeFactory.createNodes(result.nodes);

// Validate DAG structure
const validation = DAGValidator.validate(result.nodes, nodes);

if (validation.valid) {
  console.log('✅ DAG is valid');
  console.log('Execution order:', validation.executionOrder);
  console.log('Dependencies:', validation.dependencies);
} else {
  console.error('❌ Validation failed');
  validation.errors.forEach((error) => {
    console.error(`[${error.type}] ${error.message}`);
    if (error.nodeName) console.error(`  Node: ${error.nodeName}`);
    if (error.field) console.error(`  Field: ${error.field}`);
    if (error.reference) console.error(`  Reference: ${error.reference}`);
  });
}
```

### Example Validation

```typescript
// Valid DAG with dependencies
const html = `
  <node.project>
    <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
    <sequences><sequence><fragment /></sequence></sequences>
    <assets>
      <asset name="clip" path="./video.mp4" />
      <asset name="narration" input="elevenlabs.narrator.audio" />
    </assets>
  </node.project>

  <node.openai name="script">
    <prompt>Write narration</prompt>
  </node.openai>

  <node.elevenlabs name="narrator" text="$script.output.text" />

  <node.filesystem name="fs" path="$project.output.youtube">
    <path>output/video.mp4</path>
  </node.filesystem>
`;

const parser = new HTMLParser();
const result = parser.parse(html);
const nodes = NodeFactory.createNodes(result.nodes);
const validation = DAGValidator.validate(result.nodes, nodes);

// validation.valid === true
// validation.executionOrder === ['script', 'narrator', 'project', 'fs']
```

### Dependency Graph

The validator builds a complete dependency graph showing how nodes connect:

```typescript
// Dependencies from the example above:
// { from: 'narrator', to: 'script', via: '$script.output.text' }
// { from: 'project', to: 'narrator', via: 'elevenlabs.narrator.audio' }
// { from: 'fs', to: 'project', via: '$project.output.youtube' }
```

### Execution Order

The topological sort ensures nodes execute in the correct order:

1. **Source nodes** (no dependencies) execute first
2. **Intermediate nodes** execute after their dependencies
3. **Sink nodes** (outputs) execute last

Example: `script → narrator → project → fs`

### Test Coverage

All 24 tests passing:
- Reference parsing (node and asset references)
- Reference extraction from attributes and elements
- Dependency graph construction
- Cycle detection (direct and indirect cycles)
- Topological sort and execution order
- Complete validation (all error types)
- Complex real-world example validation

## Milestone 4: DAG Runner ✅

Complete execution system for running the DAG with caching, error handling, and output propagation.

### Features

**Execution System:**
- ✅ **Topological Execution** - Executes nodes in correct dependency order
- ✅ **Output Propagation** - Passes outputs from one node to inputs of dependent nodes
- ✅ **Execution Context** - Stores all node outputs during execution
- ✅ **Error Handling** - Stops execution on first error and reports details

**Caching System:**
- ✅ **Parameter-Based Keys** - Cache keys generated from all node parameters
- ✅ **Automatic Caching** - Results cached automatically after successful execution
- ✅ **Cache Retrieval** - Cached results restored to execution context
- ✅ **Cache Invalidation** - Downstream nodes invalidated on cache miss
- ✅ **Enable/Disable** - Cache can be enabled or disabled via options

**Monitoring:**
- ✅ **Callbacks** - `onNodeStart`, `onNodeComplete`, `onNodeError` hooks
- ✅ **Execution Results** - Detailed results for each node (success, duration, from cache)
- ✅ **Total Duration** - Overall execution time tracking

### Core Components

#### ExecutionContext

Stores outputs from executed nodes:

```typescript
const context = new ExecutionContext();

// Store output
context.setOutput('project', 'youtube', videoPath);

// Retrieve output
const path = context.getOutput('project', 'youtube');

// Check execution
if (context.hasNodeExecuted('project')) {
  console.log('Project node completed');
}

// Clear all
context.clear();
```

#### NodeCache

Caches node execution results based on parameters:

```typescript
const cache = new NodeCache();

// Generate cache key
const cacheKey = NodeCache.generateCacheKey('project', params);

// Store cache entry
cache.set({
  nodeName: 'project',
  cacheKey,
  outputs: new Map([['youtube', videoPath]]),
  timestamp: Date.now(),
});

// Retrieve cache entry
const cached = cache.get(cacheKey);

// Invalidate cache
cache.invalidate(cacheKey);
cache.invalidateAll(); // Clear all
```

#### DAGRunner

Main execution engine:

```typescript
import { HTMLParser, NodeFactory, DAGRunner } from '@gannochenko/node-renderer';

// Parse and create nodes
const parser = new HTMLParser();
const result = await parser.parseFile('project.html');
const nodes = NodeFactory.createNodes(result.nodes);

// Create runner with options
const runner = new DAGRunner(result.nodes, nodes, {
  enableCache: true,
  onNodeStart: (nodeName) => {
    console.log(`Starting ${nodeName}...`);
  },
  onNodeComplete: (result) => {
    console.log(`✅ ${result.nodeName} completed in ${result.duration}ms`);
    if (result.fromCache) {
      console.log('   (from cache)');
    }
  },
  onNodeError: (nodeName, error) => {
    console.error(`❌ ${nodeName} failed:`, error);
  },
});

// Execute DAG
const execution = await runner.execute();

if (execution.success) {
  console.log('✅ DAG executed successfully');
  console.log('Execution order:', execution.executedNodes);
  console.log('Total duration:', execution.totalDuration, 'ms');

  // Access outputs
  const context = runner.getContext();
  const videoPath = context.getOutput('project', 'youtube');
} else {
  console.error('❌ Execution failed');
  console.error('Failed at:', execution.error?.nodeName);
  console.error('Error:', execution.error?.error.message);
}

// Reset for next execution
runner.reset();
```

### Execution Flow

1. **Validation** - Validates DAG structure before execution
2. **Topological Sort** - Determines correct execution order
3. **For Each Node:**
   - Check cache (if enabled)
   - If cached: restore outputs to context
   - If not cached:
     - Resolve inputs from context
     - Execute node
     - Store outputs in context
     - Cache results
     - Invalidate downstream cache if cache miss
4. **Error Handling** - Stop on first error

### Example: Complete Pipeline

```typescript
const html = `
  <node.project>
    <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
    <sequences><sequence><fragment /></sequence></sequences>
    <assets>
      <asset name="clip" path="./video.mp4" />
      <asset name="narration" input="elevenlabs.narrator.audio" />
    </assets>
  </node.project>

  <node.openai name="script">
    <prompt>Write a short narration about technology</prompt>
    <model name="gpt-4" />
  </node.openai>

  <node.elevenlabs name="narrator" text="$script.output.text">
    <voice name="adam" />
  </node.elevenlabs>

  <node.filesystem name="fs" path="$project.output.youtube">
    <path>output/final_video.mp4</path>
  </node.filesystem>

  <node.youtube name="yt" path="$project.output.youtube">
    <unlisted />
    <category name="tech" />
  </node.youtube>
`;

const parser = new HTMLParser();
const result = parser.parse(html);
const nodes = NodeFactory.createNodes(result.nodes);

const runner = new DAGRunner(result.nodes, nodes, {
  enableCache: true,
  onNodeStart: (name) => console.log(`🔄 ${name}...`),
  onNodeComplete: (r) => {
    const cached = r.fromCache ? '(cached)' : '';
    console.log(`✅ ${r.nodeName} ${cached} - ${r.duration}ms`);
  },
});

const execution = await runner.execute();

// Expected output:
// 🔄 script...
// ✅ script - 1250ms
// 🔄 narrator...
// ✅ narrator - 2100ms
// 🔄 project...
// ✅ project - 15000ms
// 🔄 fs...
// ✅ fs - 50ms
// 🔄 yt...
// ✅ yt - 3000ms

// Execution order: ['script', 'narrator', 'project', 'fs', 'yt']
// Total duration: ~21400ms
```

### Cache Invalidation

When a node has a cache miss, all downstream nodes are automatically invalidated:

```typescript
// Initial execution - nothing cached
await runner.execute();
// script → narrator → project → fs → yt

// Second execution - all cached
await runner.execute();
// All nodes from cache (0ms execution)

// Modify script prompt (cache miss for 'script')
// This invalidates: narrator, project, fs, yt
await runner.execute();
// script (re-executed)
// narrator (re-executed, depends on script)
// project (re-executed, depends on narrator)
// fs (re-executed, depends on project)
// yt (re-executed, depends on project)
```

### Execution Results

Each node execution returns detailed results:

```typescript
interface NodeExecutionResult {
  nodeName: string;
  success: boolean;
  outputs?: Map<string, any>;
  error?: Error;
  fromCache: boolean;
  duration: number; // milliseconds
}

interface DAGExecutionResult {
  success: boolean;
  executedNodes: string[];
  results: NodeExecutionResult[];
  error?: {
    nodeName: string;
    error: Error;
  };
  totalDuration: number; // milliseconds
}
```

### Test Coverage

All 20 tests passing:
- Execution context (store, retrieve, check, clear)
- Node cache (generate keys, store, retrieve, invalidate)
- Basic DAG execution
- Execution order verification
- Output propagation to context
- Validation failure handling
- Caching behavior (enabled/disabled)
- Downstream cache invalidation
- Error handling and stop on error
- Callbacks (onNodeStart, onNodeComplete, onNodeError)
- Reset functionality
- Complex real-world DAG execution

### Usage in Production

```typescript
import {
  HTMLParser,
  NodeFactory,
  DAGValidator,
  DAGRunner,
} from '@gannochenko/node-renderer';

async function renderVideo(projectPath: string) {
  // Parse project
  const parser = new HTMLParser();
  const result = await parser.parseFile(projectPath);

  // Create nodes
  const nodes = NodeFactory.createNodes(result.nodes);

  // Validate DAG
  const validation = DAGValidator.validate(result.nodes, nodes);
  if (!validation.valid) {
    console.error('Invalid DAG:', validation.errors);
    return;
  }

  console.log('Execution order:', validation.executionOrder);

  // Execute
  const runner = new DAGRunner(result.nodes, nodes, {
    enableCache: true,
    onNodeStart: (name) => console.log(`\n🔄 ${name}`),
    onNodeComplete: (r) => {
      const status = r.fromCache ? '💾' : '✅';
      console.log(`${status} ${r.nodeName} (${r.duration}ms)`);
    },
    onNodeError: (name, error) => {
      console.error(`\n❌ ${name} failed:`, error.message);
    },
  });

  const execution = await runner.execute();

  if (execution.success) {
    console.log(`\n✅ Complete in ${execution.totalDuration}ms`);

    // Access final outputs
    const context = runner.getContext();
    const videoPath = context.getOutput('project', 'youtube');
    console.log('Video:', videoPath);
  } else {
    console.error(`\n❌ Failed at ${execution.error?.nodeName}`);
    throw execution.error?.error;
  }
}

// Usage
await renderVideo('./projects/my-video/project.html');
```

## CLI Tool

A command-line interface is provided for executing projects:

```bash
# Build the CLI
npm run build

# Or use Make
make build

# Run a project
node dist/cli.js path/to/project.html

# With options
node dist/cli.js project.html --verbose
node dist/cli.js project.html --no-cache
node dist/cli.js project.html --validate-only
```

### CLI Options

- `--verbose, -v` - Show detailed output
- `--no-cache` - Disable caching
- `--validate-only` - Only validate, don't execute
- `--help, -h` - Show help

### Makefile Commands

```bash
make help           # Show available commands
make build          # Build TypeScript
make test           # Run tests
make clean          # Clean build artifacts
make rebuild        # Clean and rebuild
make render-demo    # Run complete demo
make validate-demo  # Validate demo
make all            # Install, build, and test
```

## Node Demo Example

A comprehensive example demonstrating all 8 node types is available in `examples/node-demo/`:

```bash
# Navigate to demo
cd examples/node-demo

# View demo commands
make help

# Validate project
make validate

# Execute project
make render

# View project info
make info
```

The demo creates a "Dad Joke of the Day" video using:
- OpenAI for joke generation
- ElevenLabs for text-to-speech
- AI Music API for background music
- Project node for video rendering
- Filesystem, S3, YouTube, Instagram for distribution

See `examples/node-demo/README.md` for detailed documentation.

## Summary

All 4 milestones completed:

1. ✅ **HTML Parser** - Parses project.html files with all node types and project content
2. ✅ **Node Implementations** - 8 node types with Factory pattern and clean parameters
3. ✅ **DAG Validation** - Comprehensive validation with cycle detection and topological sort
4. ✅ **DAG Runner** - Complete execution system with caching and error handling

**Total test coverage: 75 tests, all passing** (14 HTML parser + 31 node factory + 24 DAG validator + 20 DAG runner = 75 tests)

## Project Structure

```
apps/node-renderer/
├── src/
│   ├── cli.ts                  # Command-line interface
│   ├── html-parser.ts          # HTML parser
│   ├── node-factory.ts         # Node factory
│   ├── dag-validator.ts        # DAG validator
│   ├── dag-runner.ts           # DAG runner
│   ├── node-interface.ts       # Node interface
│   ├── type.ts                 # Type definitions
│   ├── index.ts                # Public exports
│   └── nodes/                  # Node implementations
│       ├── project/
│       ├── filesystem/
│       ├── youtube/
│       ├── s3/
│       ├── instagram/
│       ├── ai_music_api_ai/
│       ├── elevenlabs/
│       └── openai/
├── dist/                       # Compiled output
├── Makefile                    # Build commands
├── package.json
├── tsconfig.json
└── README.md

examples/node-demo/
├── project.html               # Node demo example
├── Makefile                   # Demo commands
├── README.md                  # Demo documentation
├── input/                     # Input files
├── output/                    # Generated output
└── images/                    # Image assets
```
