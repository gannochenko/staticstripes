import { describe, it, expect } from 'vitest';
import { StreamDAG } from './dag';
import { makeConcat, makeXFade, makeCopy } from './filtercomplex';

describe('StreamDAG', () => {
  describe('basic operations', () => {
    it('should create empty DAG', () => {
      const dag = new StreamDAG();

      expect(dag.getNodes().size).toBe(0);
      expect(dag.getEdges().length).toBe(0);
      expect(dag.render()).toBe('');
    });

    it('should add single filter and create nodes', () => {
      const dag = new StreamDAG();
      const output = dag.add(makeConcat(['0:v', '1:v'], 'outv'));

      expect(output).toBe('outv');
      expect(dag.getNodes().size).toBe(3); // 0:v, 1:v, outv
      expect(dag.getEdges().length).toBe(1);
    });

    it('should generate random labels', () => {
      const dag = new StreamDAG();
      const label1 = dag.makeLabel();
      const label2 = dag.makeLabel();

      expect(label1).toMatch(/^[a-z]\d+$/);
      expect(label2).toMatch(/^[a-z]\d+$/);
      // Labels should be different (statistically)
      expect(label1).not.toBe(label2);
    });
  });

  describe('node management', () => {
    it('should automatically create nodes for all streams', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v', '2:v'], 'g0'));

      const nodes = dag.getNodes();
      expect(nodes.has('0:v')).toBe(true);
      expect(nodes.has('1:v')).toBe(true);
      expect(nodes.has('2:v')).toBe(true);
      expect(nodes.has('g0')).toBe(true);
    });

    it('should not duplicate nodes', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'g0'));
      dag.add(makeXFade('g0', '2:v', 'outv', { duration: 1, offset: 10 }));

      const nodes = dag.getNodes();
      expect(nodes.size).toBe(5); // 0:v, 1:v, g0, 2:v, outv
      expect(nodes.has('g0')).toBe(true); // g0 appears in both filters, should exist once
    });
  });

  describe('getInputs', () => {
    it('should identify input nodes (not produced by any filter)', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'g0'));
      dag.add(makeXFade('g0', '2:v', 'outv', { duration: 1, offset: 10 }));

      const inputs = dag.getInputs();
      expect(inputs.size).toBe(3);
      expect(inputs.has('0:v')).toBe(true);
      expect(inputs.has('1:v')).toBe(true);
      expect(inputs.has('2:v')).toBe(true);
      expect(inputs.has('g0')).toBe(false); // produced by concat
      expect(inputs.has('outv')).toBe(false); // produced by xfade
    });

    it('should return empty set for DAG with no inputs', () => {
      const dag = new StreamDAG();
      const inputs = dag.getInputs();
      expect(inputs.size).toBe(0);
    });
  });

  describe('getOutputs', () => {
    it('should identify output nodes (not consumed by any filter)', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'g0'));
      dag.add(makeXFade('g0', '2:v', 'outv', { duration: 1, offset: 10 }));

      const outputs = dag.getOutputs();
      expect(outputs.size).toBe(1);
      expect(outputs.has('outv')).toBe(true);
      expect(outputs.has('g0')).toBe(false); // consumed by xfade
      expect(outputs.has('0:v')).toBe(false); // consumed by concat
    });

    it('should identify multiple outputs', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'outv'));
      dag.add(makeConcat(['0:a', '1:a'], 'outa'));

      const outputs = dag.getOutputs();
      expect(outputs.size).toBe(2);
      expect(outputs.has('outv')).toBe(true);
      expect(outputs.has('outa')).toBe(true);
    });
  });

  describe('edge management', () => {
    it('should store edges with correct from/to', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'outv'));

      const edges = dag.getEdges();
      expect(edges.length).toBe(1);
      expect(edges[0].from).toEqual(['0:v', '1:v']);
      expect(edges[0].to).toEqual(['outv']);
    });

    it('should store multiple edges', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'g0'));
      dag.add(makeXFade('g0', '2:v', 'outv', { duration: 1, offset: 10 }));

      const edges = dag.getEdges();
      expect(edges.length).toBe(2);
      expect(edges[0].from).toEqual(['0:v', '1:v']);
      expect(edges[0].to).toEqual(['g0']);
      expect(edges[1].from).toEqual(['g0', '2:v']);
      expect(edges[1].to).toEqual(['outv']);
    });
  });

  describe('rendering', () => {
    it('should render single filter', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'outv'));

      expect(dag.render()).toBe('[0:v][1:v]concat=n=2:v=1:a=0[outv]');
    });

    it('should render multiple filters with semicolons', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'g0'));
      dag.add(makeXFade('g0', '2:v', 'outv', { duration: 0.5, offset: 10 }));

      expect(dag.render()).toBe(
        '[0:v][1:v]concat=n=2:v=1:a=0[g0];[g0][2:v]xfade=transition=fade:duration=0.5:offset=10[outv]',
      );
    });

    it('should render complex graph', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'g0'));
      dag.add(makeXFade('g0', '2:v', 'x1', { duration: 0.5, offset: 22.16 }));
      dag.add(makeXFade('x1', '3:v', 'outv', { duration: 0.5, offset: 23.66 }));

      expect(dag.render()).toBe(
        '[0:v][1:v]concat=n=2:v=1:a=0[g0];' +
          '[g0][2:v]xfade=transition=fade:duration=0.5:offset=22.16[x1];' +
          '[x1][3:v]xfade=transition=fade:duration=0.5:offset=23.66[outv]',
      );
    });
  });

  describe('complex graphs', () => {
    it('should handle single input to output (copy)', () => {
      const dag = new StreamDAG();
      dag.add(makeCopy('0:v', 'outv'));

      expect(dag.getNodes().size).toBe(2);
      expect(dag.getInputs().size).toBe(1);
      expect(dag.getOutputs().size).toBe(1);
      expect(Array.from(dag.getInputs())[0]).toBe('0:v');
      expect(Array.from(dag.getOutputs())[0]).toBe('outv');
    });

    it('should handle parallel chains (video + audio)', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'outv'));
      dag.add(makeConcat(['0:a', '1:a'], 'outa'));

      expect(dag.getNodes().size).toBe(6); // 0:v, 1:v, outv, 0:a, 1:a, outa
      expect(dag.getEdges().length).toBe(2);
      expect(dag.getInputs().size).toBe(4); // 0:v, 1:v, 0:a, 1:a
      expect(dag.getOutputs().size).toBe(2); // outv, outa
    });

    it('should handle multiple sequences connected', () => {
      const dag = new StreamDAG();
      // Sequence 1
      dag.add(makeConcat(['0:v', '1:v'], 'seq1'));
      // Sequence 2
      dag.add(makeCopy('2:v', 'seq2'));
      // Connect sequences
      dag.add(makeConcat(['seq1', 'seq2'], 'outv'));

      expect(dag.getInputs().size).toBe(3); // 0:v, 1:v, 2:v
      expect(dag.getOutputs().size).toBe(1); // outv
      expect(dag.getEdges().length).toBe(3);
    });
  });

  describe('DAG properties', () => {
    it('should return copies of nodes and edges (immutability)', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'outv'));

      const nodes1 = dag.getNodes();
      const nodes2 = dag.getNodes();
      expect(nodes1).not.toBe(nodes2); // Different instances

      const edges1 = dag.getEdges();
      const edges2 = dag.getEdges();
      expect(edges1).not.toBe(edges2); // Different instances
    });

    it('should maintain edge order', () => {
      const dag = new StreamDAG();
      dag.add(makeConcat(['0:v', '1:v'], 'g0'));
      dag.add(makeXFade('g0', '2:v', 'x1', { duration: 1, offset: 10 }));
      dag.add(makeXFade('x1', '3:v', 'outv', { duration: 1, offset: 20 }));

      const edges = dag.getEdges();
      expect(edges[0].to).toEqual(['g0']);
      expect(edges[1].to).toEqual(['x1']);
      expect(edges[2].to).toEqual(['outv']);
    });
  });
});
