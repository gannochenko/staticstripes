import { describe, it, expect } from 'vitest';
import { HTMLParser } from './html-parser';
import { NodeFactory } from './node-factory';
import { ProjectNode } from '../nodes/project';
import { FilesystemNode } from '../nodes/filesystem';
import { YouTubeNode } from '../nodes/youtube';
import { S3Node } from '../nodes/s3';
import { InstagramNode } from '../nodes/instagram';
import { AIMusicAPINode } from '../nodes/ai_music_api_ai';
import { ElevenLabsNode } from '../nodes/elevenlabs';
import { OpenAINode } from '../nodes/openai';

describe('NodeFactory', () => {
  describe('Node creation', () => {
    it('should create ProjectNode with correct parameters', () => {
      const html = `
        <node.project name="main">
          <title>Test Project</title>
          <tag>tag1</tag>
          <tag>tag2</tag>
          <outputs>
            <output name="youtube" resolution="1920x1080" fps="30" />
          </outputs>
          <sequences>
            <sequence>
              <fragment />
            </sequence>
          </sequences>
          <assets>
            <asset name="test" path="./test.mp4" />
          </assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);

      expect(node).toBeInstanceOf(ProjectNode);
      expect(node.getType()).toBe('project');
      expect(node.getName()).toBe('main');
      expect(node.getOutputs()).toHaveLength(1);
      expect(node.getOutputs()[0].name).toBe('youtube');
      expect(node.validateParameters()).toHaveLength(0);
    });

    it('should create FilesystemNode with correct parameters', () => {
      const html = `
        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]) as FilesystemNode;

      expect(node).toBeInstanceOf(FilesystemNode);
      expect(node.getName()).toBe('fs');
      expect(node.getPathRef()).toBe('$project.output.youtube');
      expect(node.getDestinationPath()).toBe('output/video.mp4');
      expect(node.validateParameters()).toHaveLength(0);
    });

    it('should create YouTubeNode with all parameters', () => {
      const html = `
        <node.youtube name="yt" path="$project.output.youtube">
          <unlisted />
          <made-for-kids />
          <category name="entertainment" />
          <language name="en" />
          <thumbnail timecode="1000ms" />
          <pre>Test description</pre>
        </node.youtube>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);

      expect(node).toBeInstanceOf(YouTubeNode);
      expect(node.getOutputs()).toHaveLength(2);
      expect(node.getOutputs()[0].name).toBe('url');
      expect(node.getOutputs()[1].name).toBe('video_id');
      expect(node.validateParameters()).toHaveLength(0);
    });

    it('should create S3Node with multiple paths', () => {
      const html = `
        <node.s3 name="s3" path="$project.output.youtube">
          <endpoint name="digitaloceanspaces.com" />
          <region name="ams3" />
          <bucket name="test-bucket" />
          <path name="file">videos/test.mp4</path>
          <path name="metadata">videos/metadata.json</path>
          <acl name="public-read" />
        </node.s3>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);

      expect(node).toBeInstanceOf(S3Node);
      expect(node.validateParameters()).toHaveLength(0);
    });

    it('should create InstagramNode with correct parameters', () => {
      const html = `
        <node.instagram name="ig" url="$s3.output.url">
          <thumbnail timecode="1000ms" />
          <pre>Test caption</pre>
        </node.instagram>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);

      expect(node).toBeInstanceOf(InstagramNode);
      expect(node.getInputs()).toHaveLength(1);
      expect(node.getInputs()[0].name).toBe('url');
      expect(node.getOutputs()).toHaveLength(2);
      expect(node.validateParameters()).toHaveLength(0);
    });

    it('should create AIMusicAPINode with model', () => {
      const html = `
        <node.ai_music_api_ai name="music">
          <prompt>Calm acoustic guitar music</prompt>
          <model name="sonic-v4-5" />
        </node.ai_music_api_ai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);

      expect(node).toBeInstanceOf(AIMusicAPINode);
      expect(node.getInputs()).toHaveLength(0);
      expect(node.getOutputs()).toHaveLength(1);
      expect(node.getOutputs()[0].name).toBe('audio');
      expect(node.validateParameters()).toHaveLength(0);
    });

    it('should create ElevenLabsNode with text reference', () => {
      const html = `
        <node.elevenlabs name="tts" text="$openai.output.text" />
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);

      expect(node).toBeInstanceOf(ElevenLabsNode);
      expect(node.getInputs()).toHaveLength(1);
      expect(node.getInputs()[0].name).toBe('text');
      expect(node.getOutputs()).toHaveLength(1);
      expect(node.getOutputs()[0].name).toBe('audio');
      expect(node.validateParameters()).toHaveLength(0);
    });

    it('should create OpenAINode with prompt', () => {
      const html = `
        <node.openai name="ai">
          <prompt>Make a dad joke!</prompt>
        </node.openai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);

      expect(node).toBeInstanceOf(OpenAINode);
      expect(node.getInputs()).toHaveLength(0);
      expect(node.getOutputs()).toHaveLength(1);
      expect(node.getOutputs()[0].name).toBe('text');
      expect(node.validateParameters()).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('should detect missing ProjectNode outputs', () => {
      const html = `
        <node.project>
          <sequences>
            <sequence><fragment /></sequence>
          </sequences>
          <assets>
            <asset name="test" path="./test.mp4" />
          </assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);
      const errors = node.validateParameters();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'outputs')).toBe(true);
    });

    it('should detect missing FilesystemNode path reference', () => {
      const html = `
        <node.filesystem name="fs">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);
      const errors = node.validateParameters();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'pathRef')).toBe(true);
    });

    it('should detect missing FilesystemNode destination path', () => {
      const html = `
        <node.filesystem name="fs" path="$project.output.youtube" />
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);
      const errors = node.validateParameters();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'destinationPath')).toBe(true);
    });

    it('should detect missing OpenAI prompt', () => {
      const html = `<node.openai name="ai" />`;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);
      const errors = node.validateParameters();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'prompt')).toBe(true);
    });

    it('should detect missing S3 required parameters', () => {
      const html = `
        <node.s3 name="s3" path="$project.output.youtube">
          <endpoint name="digitaloceanspaces.com" />
        </node.s3>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const node = NodeFactory.createNode(result.nodes[0]);
      const errors = node.validateParameters();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'region')).toBe(true);
      expect(errors.some((e) => e.field === 'bucket')).toBe(true);
    });
  });

  describe('Batch operations', () => {
    it('should create multiple nodes at once', () => {
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
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      expect(nodes).toHaveLength(3);
      expect(nodes[0]).toBeInstanceOf(ProjectNode);
      expect(nodes[1]).toBeInstanceOf(OpenAINode);
      expect(nodes[2]).toBeInstanceOf(ElevenLabsNode);
    });
  });

  describe('Node type support', () => {
    it('should check supported node types', () => {
      expect(NodeFactory.isSupportedNodeType('project')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('filesystem')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('youtube')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('s3')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('instagram')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('ai_music_api_ai')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('elevenlabs')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('openai')).toBe(true);
      expect(NodeFactory.isSupportedNodeType('unknown')).toBe(false);
    });

    it('should throw error for unknown node type', () => {
      const html = `<node.unknown />`;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      expect(() => NodeFactory.createNode(result.nodes[0])).toThrow(
        'Unknown node type: unknown',
      );
    });
  });

  describe('Parameter schema', () => {
    it('should provide parameter schema for each node type', () => {
      const types = [
        'project',
        'filesystem',
        'youtube',
        's3',
        'instagram',
        'ai_music_api_ai',
        'elevenlabs',
        'openai',
      ];

      for (const type of types) {
        const html = `<node.${type}>
          ${type === 'project' ? '<outputs><output name="test" resolution="1920x1080" fps="30" /></outputs><sequences><sequence><fragment /></sequence></sequences><assets><asset name="test" path="./test.mp4" /></assets>' : ''}
          ${type === 'filesystem' ? '<path>test.mp4</path>' : ''}
          ${['openai', 'ai_music_api_ai'].includes(type) ? '<prompt>test</prompt>' : ''}
        </node.${type}>`;

        const parser = new HTMLParser();
        const result = parser.parse(html);
        const node = NodeFactory.createNode(result.nodes[0]);
        const schema = node.getParameterSchema();

        expect(schema.length).toBeGreaterThan(0);
        expect(schema[0]).toHaveProperty('name');
        expect(schema[0]).toHaveProperty('required');
      }
    });
  });
});
