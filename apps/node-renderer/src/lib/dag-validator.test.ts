import { describe, it, expect } from 'vitest';
import { HTMLParser } from './html-parser';
import { NodeFactory } from './node-factory';
import { DAGValidator } from './dag-validator';

describe('DAGValidator', () => {
  describe('Node reference parsing', () => {
    it('should parse valid node reference (explicit format)', () => {
      const ref = DAGValidator.parseNodeReference('$project.output.youtube');

      expect(ref).not.toBeNull();
      expect(ref?.nodeName).toBe('project');
      expect(ref?.outputName).toBe('youtube');
      expect(ref?.originalString).toBe('$project.output.youtube');
    });

    it('should parse valid node reference (shorthand format)', () => {
      const ref = DAGValidator.parseNodeReference('$joke_speech.wordTiming');

      expect(ref).not.toBeNull();
      expect(ref?.nodeName).toBe('joke_speech');
      expect(ref?.outputName).toBe('wordTiming');
      expect(ref?.originalString).toBe('$joke_speech.wordTiming');
    });

    it('should parse node reference with underscores', () => {
      const ref = DAGValidator.parseNodeReference(
        '$s3_primary.output.url',
      );

      expect(ref).not.toBeNull();
      expect(ref?.nodeName).toBe('s3_primary');
      expect(ref?.outputName).toBe('url');
    });

    it('should return null for invalid reference format', () => {
      expect(DAGValidator.parseNodeReference('invalid')).toBeNull();
      expect(DAGValidator.parseNodeReference('$project')).toBeNull();
      expect(DAGValidator.parseNodeReference('project.output.youtube')).toBeNull();
      expect(DAGValidator.parseNodeReference('')).toBeNull();
    });

    it('should parse asset input reference', () => {
      const ref = DAGValidator.parseAssetInputReference(
        '$joker_talks.output.audio',
      );

      expect(ref).not.toBeNull();
      expect(ref?.nodeName).toBe('joker_talks');
      expect(ref?.outputName).toBe('audio');
    });

    it('should return null for invalid asset reference', () => {
      expect(DAGValidator.parseAssetInputReference('invalid')).toBeNull();
      expect(DAGValidator.parseAssetInputReference('too.many.parts')).toBeNull();
      expect(DAGValidator.parseAssetInputReference('')).toBeNull();
    });
  });

  describe('Reference extraction', () => {
    it('should extract node references from attributes', () => {
      const html = `
        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const refs = DAGValidator.extractNodeReferences(result.nodes[0]);

      expect(refs).toHaveLength(1);
      expect(refs[0].nodeName).toBe('project');
      expect(refs[0].outputName).toBe('youtube');
    });

    it('should extract multiple references from node', () => {
      const html = `
        <node.youtube name="yt" path="$project.output.youtube" url="$s3.output.url">
        </node.youtube>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const refs = DAGValidator.extractNodeReferences(result.nodes[0]);

      expect(refs).toHaveLength(2); // Both path and url attributes contain references
      expect(refs[0].nodeName).toBe('project');
      expect(refs[1].nodeName).toBe('s3');
    });

    it('should extract asset references from project node', () => {
      const html = `
        <node.project>
          <assets>
            <asset name="audio" input="$joker_talks.output.audio" />
            <asset name="music" input="$intro_song.output.audio" />
          </assets>
          <outputs>
            <output name="youtube" resolution="1920x1080" fps="30" />
          </outputs>
          <sequences>
            <sequence><fragment /></sequence>
          </sequences>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const projectNode = result.nodes[0];
      const refs = DAGValidator.extractAssetReferences(
        projectNode.projectContent!.assets,
      );

      expect(refs).toHaveLength(2);
      expect(refs[0].nodeName).toBe('joker_talks');
      expect(refs[0].outputName).toBe('audio');
      expect(refs[1].nodeName).toBe('intro_song');
      expect(refs[1].outputName).toBe('audio');
    });
  });

  describe('Dependency graph', () => {
    it('should build dependency graph from nodes', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets>
            <asset name="test" path="./test.mp4" />
            <asset name="audio" input="$tts.output.audio" />
          </assets>
        </node.project>
        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
        <node.elevenlabs name="tts" text="$openai.output.text" />
        <node.openai name="openai">
          <prompt>Test</prompt>
        </node.openai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const deps = DAGValidator.buildDependencyGraph(result.nodes);

      expect(deps).toHaveLength(3);

      // fs depends on project
      expect(deps.find((d) => d.from === 'fs' && d.to === 'project')).toBeDefined();

      // tts depends on openai
      expect(deps.find((d) => d.from === 'tts' && d.to === 'openai')).toBeDefined();

      // project depends on tts (via asset)
      expect(deps.find((d) => d.from === 'project' && d.to === 'tts')).toBeDefined();
    });

    it('should handle nodes with no dependencies', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.openai name="ai">
          <prompt>Test</prompt>
        </node.openai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const deps = DAGValidator.buildDependencyGraph(result.nodes);

      expect(deps).toHaveLength(0);
    });
  });

  describe('Cycle detection', () => {
    it('should detect no cycles in valid DAG', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.openai name="ai">
          <prompt>Test</prompt>
        </node.openai>
        <node.elevenlabs name="tts" text="$ai.output.text" />
        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const deps = DAGValidator.buildDependencyGraph(result.nodes);
      const nodeNames = result.nodes.map((n) => n.name || n.type);
      const cycles = DAGValidator.detectCycles(deps, nodeNames);

      expect(cycles).toHaveLength(0);
    });

    it('should detect direct cycle', () => {
      const deps = [
        { from: 'a', to: 'b', via: '$b.output.test' },
        { from: 'b', to: 'a', via: '$a.output.test' },
      ];
      const nodeNames = ['a', 'b'];
      const cycles = DAGValidator.detectCycles(deps, nodeNames);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect indirect cycle', () => {
      const deps = [
        { from: 'a', to: 'b', via: '$b.output.test' },
        { from: 'b', to: 'c', via: '$c.output.test' },
        { from: 'c', to: 'a', via: '$a.output.test' },
      ];
      const nodeNames = ['a', 'b', 'c'];
      const cycles = DAGValidator.detectCycles(deps, nodeNames);

      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('Topological sort', () => {
    it('should sort nodes in execution order', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets>
            <asset name="test" path="./test.mp4" />
            <asset name="audio" input="$tts.output.audio" />
          </assets>
        </node.project>
        <node.openai name="ai">
          <prompt>Test</prompt>
        </node.openai>
        <node.elevenlabs name="tts" text="$ai.output.text" />
        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const deps = DAGValidator.buildDependencyGraph(result.nodes);
      const nodeNames = result.nodes.map((n) => n.name || n.type);
      const order = DAGValidator.topologicalSort(deps, nodeNames);

      expect(order).not.toBeNull();
      expect(order).toHaveLength(4);

      // ai should come before tts
      expect(order!.indexOf('ai')).toBeLessThan(order!.indexOf('tts'));

      // tts should come before project (project depends on tts via asset)
      expect(order!.indexOf('tts')).toBeLessThan(order!.indexOf('project'));

      // project should come before fs
      expect(order!.indexOf('project')).toBeLessThan(order!.indexOf('fs'));
    });

    it('should return null for cyclic graph', () => {
      const deps = [
        { from: 'a', to: 'b', via: '$b.output.test' },
        { from: 'b', to: 'a', via: '$a.output.test' },
      ];
      const nodeNames = ['a', 'b'];
      const order = DAGValidator.topologicalSort(deps, nodeNames);

      expect(order).toBeNull();
    });
  });

  describe('Complete validation', () => {
    it('should validate correct DAG', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets>
            <asset name="test" path="./test.mp4" />
            <asset name="audio" input="$tts.output.audio" />
          </assets>
        </node.project>
        <node.openai name="ai">
          <prompt>Test</prompt>
        </node.openai>
        <node.elevenlabs name="tts" text="$ai.output.text" />
        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.executionOrder).toBeDefined();
      expect(validation.executionOrder).toHaveLength(4);
    });

    it('should detect missing project node', () => {
      const html = `
        <node.openai name="ai">
          <prompt>Test</prompt>
        </node.openai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === 'no_project_node')).toBe(true);
    });

    it('should detect multiple project nodes', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.project name="project2">
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === 'multiple_project_nodes')).toBe(true);
    });

    it('should detect duplicate node names', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.openai name="ai">
          <prompt>Test 1</prompt>
        </node.openai>
        <node.openai name="ai">
          <prompt>Test 2</prompt>
        </node.openai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === 'duplicate_node_name')).toBe(true);
    });

    it('should detect unresolved node reference', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.filesystem name="fs" path="$nonexistent.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === 'unresolved_node_reference')).toBe(true);
    });

    it('should detect unresolved output reference', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.filesystem name="fs" path="$project.output.nonexistent">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === 'unresolved_output_reference')).toBe(true);
    });

    it('should detect unresolved asset reference', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets>
            <asset name="test" path="./test.mp4" />
            <asset name="audio" input="$nonexistent.output.audio" />
          </assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === 'unresolved_asset_reference')).toBe(true);
    });

    it('should detect missing parameters', () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.openai name="ai" />
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === 'missing_parameter')).toBe(true);
    });

    it('should validate complex real-world example', () => {
      const html = `
        <node.project>
          <title>Test Video</title>
          <tag>test</tag>
          <outputs>
            <output name="youtube" resolution="1920x1080" fps="30" />
            <output name="instagram" resolution="1080x1920" fps="30" />
          </outputs>
          <sequences>
            <sequence>
              <fragment class="intro" />
            </sequence>
          </sequences>
          <assets>
            <asset name="clip" path="./input/video.mp4" />
            <asset name="music" input="$bg_music.output.audio" />
            <asset name="narration" input="$narrator.output.audio" />
          </assets>
        </node.project>

        <node.ai_music_api_ai name="bg_music">
          <prompt>Calm background music</prompt>
          <model name="sonic-v4-5" />
        </node.ai_music_api_ai>

        <node.openai name="script">
          <prompt>Write a short narration</prompt>
        </node.openai>

        <node.elevenlabs name="narrator" text="$script.output.text" />

        <node.filesystem name="fs_youtube" path="$project.output.youtube">
          <path>output/youtube.mp4</path>
        </node.filesystem>

        <node.youtube name="yt" path="$project.output.youtube">
          <unlisted />
          <category name="entertainment" />
        </node.youtube>

        <node.s3 name="s3_ig" path="$project.output.instagram">
          <endpoint name="digitaloceanspaces.com" />
          <region name="ams3" />
          <bucket name="test-bucket" />
          <path name="file">videos/test.mp4</path>
          <acl name="public-read" />
        </node.s3>

        <node.instagram name="ig" url="$s3_ig.output.url">
          <pre>Test video</pre>
        </node.instagram>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);
      const validation = DAGValidator.validate(result.nodes, nodes);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.executionOrder).toBeDefined();
      expect(validation.executionOrder).toHaveLength(8);

      // Verify execution order makes sense
      const order = validation.executionOrder!;
      expect(order.indexOf('bg_music')).toBeLessThan(order.indexOf('project'));
      expect(order.indexOf('script')).toBeLessThan(order.indexOf('narrator'));
      expect(order.indexOf('narrator')).toBeLessThan(order.indexOf('project'));
      expect(order.indexOf('project')).toBeLessThan(order.indexOf('fs_youtube'));
      expect(order.indexOf('project')).toBeLessThan(order.indexOf('yt'));
      expect(order.indexOf('project')).toBeLessThan(order.indexOf('s3_ig'));
      expect(order.indexOf('s3_ig')).toBeLessThan(order.indexOf('ig'));
    });
  });
});
