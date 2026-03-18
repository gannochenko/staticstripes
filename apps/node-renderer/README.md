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

## Next Steps (Milestone 2)

- Validate the parsed result for correctness
- Ensure the DAG is valid (no cycles)
- Verify all node types are resolvable
- Check that all required parameters are present
- Validate asset references (file paths and node inputs)
