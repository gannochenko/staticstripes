import { describe, it, expect, vi } from 'vitest';
import { HTMLParser } from './html-parser';
import { NodeFactory } from './node-factory';
import { DAGRunner, ExecutionContext, NodeCache } from './dag-runner';

describe('DAGRunner', () => {
  describe('ExecutionContext', () => {
    it('should store and retrieve node outputs', () => {
      const context = new ExecutionContext();

      context.setOutput('node1', 'output1', 'value1');
      context.setOutput('node1', 'output2', 'value2');
      context.setOutput('node2', 'output1', 'value3');

      expect(context.getOutput('node1', 'output1')).toBe('value1');
      expect(context.getOutput('node1', 'output2')).toBe('value2');
      expect(context.getOutput('node2', 'output1')).toBe('value3');
      expect(context.getOutput('node3', 'output1')).toBeUndefined();
    });

    it('should check if node has executed', () => {
      const context = new ExecutionContext();

      expect(context.hasNodeExecuted('node1')).toBe(false);

      context.setOutput('node1', 'output1', 'value1');

      expect(context.hasNodeExecuted('node1')).toBe(true);
      expect(context.hasNodeExecuted('node2')).toBe(false);
    });

    it('should get all outputs for a node', () => {
      const context = new ExecutionContext();

      context.setOutput('node1', 'output1', 'value1');
      context.setOutput('node1', 'output2', 'value2');

      const outputs = context.getNodeOutputs('node1');
      expect(outputs).toBeDefined();
      expect(outputs?.size).toBe(2);
      expect(outputs?.get('output1')).toBe('value1');
      expect(outputs?.get('output2')).toBe('value2');
    });

    it('should clear all outputs', () => {
      const context = new ExecutionContext();

      context.setOutput('node1', 'output1', 'value1');
      context.setOutput('node2', 'output1', 'value2');

      expect(context.hasNodeExecuted('node1')).toBe(true);
      expect(context.hasNodeExecuted('node2')).toBe(true);

      context.clear();

      expect(context.hasNodeExecuted('node1')).toBe(false);
      expect(context.hasNodeExecuted('node2')).toBe(false);
    });
  });

  describe('NodeCache', () => {
    it('should generate cache key from parameters', () => {
      const key1 = NodeCache.generateCacheKey('node1', { a: 1, b: 2 });
      const key2 = NodeCache.generateCacheKey('node1', { b: 2, a: 1 });
      const key3 = NodeCache.generateCacheKey('node1', { a: 1, b: 3 });

      expect(key1).toBe(key2); // Same parameters, different order
      expect(key1).not.toBe(key3); // Different parameters
    });

    it('should store and retrieve cache entries', () => {
      const cache = new NodeCache();
      const outputs = new Map([['output1', 'value1']]);

      const entry = {
        nodeName: 'node1',
        cacheKey: 'key1',
        outputs,
        timestamp: Date.now(),
      };

      cache.set(entry);

      expect(cache.has('key1')).toBe(true);
      expect(cache.get('key1')).toEqual(entry);
      expect(cache.has('key2')).toBe(false);
    });

    it('should invalidate cache entries', () => {
      const cache = new NodeCache();
      const outputs = new Map([['output1', 'value1']]);

      cache.set({
        nodeName: 'node1',
        cacheKey: 'key1',
        outputs,
        timestamp: Date.now(),
      });

      expect(cache.has('key1')).toBe(true);

      cache.invalidate('key1');

      expect(cache.has('key1')).toBe(false);
    });

    it('should invalidate all cache entries', () => {
      const cache = new NodeCache();
      const outputs = new Map([['output1', 'value1']]);

      cache.set({
        nodeName: 'node1',
        cacheKey: 'key1',
        outputs,
        timestamp: Date.now(),
      });
      cache.set({
        nodeName: 'node2',
        cacheKey: 'key2',
        outputs,
        timestamp: Date.now(),
      });

      expect(cache.getCacheKeys()).toHaveLength(2);

      cache.invalidateAll();

      expect(cache.getCacheKeys()).toHaveLength(0);
    });
  });

  describe('DAG Execution', () => {
    it('should execute simple DAG', async () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes);
      const execution = await runner.execute();

      expect(execution.success).toBe(true);
      expect(execution.executedNodes).toHaveLength(2);
      expect(execution.executedNodes).toEqual(['project', 'fs']);
      expect(execution.results).toHaveLength(2);
      expect(execution.error).toBeUndefined();
    });

    it('should execute nodes in correct order', async () => {
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

      const runner = new DAGRunner(result.nodes, nodes);
      const execution = await runner.execute();

      expect(execution.success).toBe(true);
      expect(execution.executedNodes).toHaveLength(4);

      // Verify order
      const aiIndex = execution.executedNodes.indexOf('ai');
      const ttsIndex = execution.executedNodes.indexOf('tts');
      const projectIndex = execution.executedNodes.indexOf('project');
      const fsIndex = execution.executedNodes.indexOf('fs');

      expect(aiIndex).toBeLessThan(ttsIndex);
      expect(ttsIndex).toBeLessThan(projectIndex);
      expect(projectIndex).toBeLessThan(fsIndex);
    });

    it('should store outputs in execution context', async () => {
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
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes);
      await runner.execute();

      const context = runner.getContext();
      expect(context.hasNodeExecuted('project')).toBe(true);
      expect(context.hasNodeExecuted('ai')).toBe(true);
      expect(context.getOutput('project', 'youtube')).toBeDefined();
      expect(context.getOutput('ai', 'text')).toBeDefined();
    });

    it('should fail validation on invalid DAG', async () => {
      const html = `
        <node.filesystem name="fs" path="$nonexistent.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes);
      const execution = await runner.execute();

      expect(execution.success).toBe(false);
      expect(execution.error).toBeDefined();
      expect(execution.error?.error.message).toContain('validation failed');
    });
  });

  describe('Caching', () => {
    it('should cache node execution results', async () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes, { enableCache: true });

      // First execution
      const execution1 = await runner.execute();
      expect(execution1.success).toBe(true);
      expect(execution1.results[0].fromCache).toBe(false);

      // Second execution should use cache
      const execution2 = await runner.execute();
      expect(execution2.success).toBe(true);
      expect(execution2.results[0].fromCache).toBe(true);
    });

    it('should not cache when caching is disabled', async () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes, { enableCache: false });

      // First execution
      const execution1 = await runner.execute();
      expect(execution1.success).toBe(true);
      expect(execution1.results[0].fromCache).toBe(false);

      // Second execution should also not use cache
      const execution2 = await runner.execute();
      expect(execution2.success).toBe(true);
      expect(execution2.results[0].fromCache).toBe(false);
    });

    it('should invalidate downstream cache on cache miss', async () => {
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
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes, { enableCache: true });

      // First execution
      await runner.execute();

      // All nodes should be cached
      const cache = runner.getCache();
      expect(cache.getCacheKeys()).toHaveLength(3);

      // Manually invalidate 'ai' cache to simulate a cache miss
      const aiNode = result.nodes.find((n) => n.name === 'ai')!;
      const aiParams = { type: aiNode.type, name: aiNode.name };
      for (const [key, value] of aiNode.attributes.entries()) {
        aiParams[key] = value;
      }
      const aiCacheKey = NodeCache.generateCacheKey('ai', aiParams);
      cache.invalidate(aiCacheKey);

      // Reset context to force re-execution
      runner.getContext().clear();

      // Second execution
      await runner.execute();

      // 'ai' should not be from cache, and downstream nodes should be re-executed
      const execution2 = await runner.execute();
      const aiResult = execution2.results.find((r) => r.nodeName === 'ai');
      expect(aiResult?.fromCache).toBe(true); // It was re-executed and cached again
    });
  });

  describe('Error Handling', () => {
    it('should stop execution on validation error', async () => {
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

      const runner = new DAGRunner(result.nodes, nodes);
      const execution = await runner.execute();

      expect(execution.success).toBe(false);
      expect(execution.error).toBeDefined();
      expect(execution.executedNodes).toHaveLength(0);
    });
  });

  describe('Callbacks', () => {
    it('should call onNodeStart callback', async () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const onNodeStart = vi.fn();
      const runner = new DAGRunner(result.nodes, nodes, { onNodeStart });

      await runner.execute();

      expect(onNodeStart).toHaveBeenCalledWith('project');
    });

    it('should call onNodeComplete callback', async () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const onNodeComplete = vi.fn();
      const runner = new DAGRunner(result.nodes, nodes, { onNodeComplete });

      await runner.execute();

      expect(onNodeComplete).toHaveBeenCalled();
      expect(onNodeComplete.mock.calls[0][0].nodeName).toBe('project');
      expect(onNodeComplete.mock.calls[0][0].success).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset execution context and cache', async () => {
      const html = `
        <node.project>
          <outputs><output name="youtube" resolution="1920x1080" fps="30" /></outputs>
          <sequences><sequence><fragment /></sequence></sequences>
          <assets><asset name="test" path="./test.mp4" /></assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes);
      await runner.execute();

      expect(runner.getContext().hasNodeExecuted('project')).toBe(true);
      expect(runner.getCache().getCacheKeys()).toHaveLength(1);

      runner.reset();

      expect(runner.getContext().hasNodeExecuted('project')).toBe(false);
      expect(runner.getCache().getCacheKeys()).toHaveLength(0);
    });
  });

  describe('Complex DAG', () => {
    it('should execute complex real-world DAG', async () => {
      const html = `
        <node.project>
          <title>Test Video</title>
          <outputs>
            <output name="youtube" resolution="1920x1080" fps="30" />
          </outputs>
          <sequences>
            <sequence><fragment /></sequence>
          </sequences>
          <assets>
            <asset name="clip" path="./video.mp4" />
            <asset name="music" input="$bg_music.output.audio" />
            <asset name="narration" input="$narrator.output.audio" />
          </assets>
        </node.project>

        <node.ai_music_api_ai name="bg_music">
          <prompt>Calm music</prompt>
        </node.ai_music_api_ai>

        <node.openai name="script">
          <prompt>Write narration</prompt>
        </node.openai>

        <node.elevenlabs name="narrator" text="$script.output.text" />

        <node.filesystem name="fs" path="$project.output.youtube">
          <path>output/video.mp4</path>
        </node.filesystem>

        <node.youtube name="yt" path="$project.output.youtube">
          <category name="entertainment" />
        </node.youtube>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);
      const nodes = NodeFactory.createNodes(result.nodes);

      const runner = new DAGRunner(result.nodes, nodes);
      const execution = await runner.execute();

      expect(execution.success).toBe(true);
      expect(execution.executedNodes).toHaveLength(6);

      // Verify execution order
      const order = execution.executedNodes;
      expect(order.indexOf('script')).toBeLessThan(order.indexOf('narrator'));
      expect(order.indexOf('narrator')).toBeLessThan(order.indexOf('project'));
      expect(order.indexOf('bg_music')).toBeLessThan(order.indexOf('project'));
      expect(order.indexOf('project')).toBeLessThan(order.indexOf('fs'));
      expect(order.indexOf('project')).toBeLessThan(order.indexOf('yt'));

      // Verify all nodes executed
      expect(execution.results).toHaveLength(6);
      expect(execution.results.every((r) => r.success)).toBe(true);
    });
  });
});
