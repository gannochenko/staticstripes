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

## Next Steps (Milestone 3)

- Validate the parsed result for correctness
- Ensure the DAG is valid (no cycles)
- Verify all node types are resolvable
- Check that all required parameters are present
- Validate asset references (file paths and node inputs)
- Build dependency graph from node input/output references
