import { describe, it, expect } from 'vitest';
import { makeConcat, makeXFade, makeCopy } from './ffmpeg';

describe('ffmpeg filter factories', () => {
  describe('makeConcat', () => {
    it('should create a concat filter with default options', () => {
      const filter = makeConcat(['0:v', '1:v', '2:v'], 'outv');

      expect(filter.inputs).toEqual(['0:v', '1:v', '2:v']);
      expect(filter.output).toBe('outv');
      expect(filter.render()).toBe('[0:v][1:v][2:v]concat=n=3:v=1:a=0[outv]');
    });

    it('should create a concat filter with custom video streams', () => {
      const filter = makeConcat(['0:v', '1:v'], 'outv', { videoStreams: 2 });

      expect(filter.render()).toBe('[0:v][1:v]concat=n=2:v=2:a=0[outv]');
    });

    it('should create a concat filter with audio streams', () => {
      const filter = makeConcat(['0:v', '1:v'], 'outv', {
        videoStreams: 1,
        audioStreams: 1,
      });

      expect(filter.render()).toBe('[0:v][1:v]concat=n=2:v=1:a=1[outv]');
    });

    it('should handle single input', () => {
      const filter = makeConcat(['0:v'], 'outv');

      expect(filter.render()).toBe('[0:v]concat=n=1:v=1:a=0[outv]');
    });

    it('should wrap labels in brackets', () => {
      const filter = makeConcat(['g0', 'g1'], 'result');

      expect(filter.render()).toBe('[g0][g1]concat=n=2:v=1:a=0[result]');
    });
  });

  describe('makeXFade', () => {
    it('should create an xfade filter with default transition', () => {
      const filter = makeXFade('0:v', '1:v', 'outv', {
        duration: 1.5,
        offset: 10.0,
      });

      expect(filter.inputs).toEqual(['0:v', '1:v']);
      expect(filter.output).toBe('outv');
      expect(filter.render()).toBe(
        '[0:v][1:v]xfade=transition=fade:duration=1.5:offset=10[outv]',
      );
    });

    it('should create an xfade filter with custom transition', () => {
      const filter = makeXFade('0:v', '1:v', 'outv', {
        duration: 2.0,
        offset: 5.5,
        transition: 'wipeleft',
      });

      expect(filter.render()).toBe(
        '[0:v][1:v]xfade=transition=wipeleft:duration=2:offset=5.5[outv]',
      );
    });

    it('should handle zero duration', () => {
      const filter = makeXFade('g0', '1:v', 'v1', {
        duration: 0,
        offset: 22.16,
      });

      expect(filter.render()).toBe(
        '[g0][1:v]xfade=transition=fade:duration=0:offset=22.16[v1]',
      );
    });

    it('should handle negative offset', () => {
      const filter = makeXFade('0:v', '1:v', 'outv', {
        duration: 1.0,
        offset: -0.5,
      });

      expect(filter.render()).toBe(
        '[0:v][1:v]xfade=transition=fade:duration=1:offset=-0.5[outv]',
      );
    });

    it('should wrap labels in brackets', () => {
      const filter = makeXFade('prev', 'next', 'result', {
        duration: 0.5,
        offset: 10.0,
      });

      expect(filter.render()).toBe(
        '[prev][next]xfade=transition=fade:duration=0.5:offset=10[result]',
      );
    });
  });

  describe('makeCopy', () => {
    it('should create a copy filter', () => {
      const filter = makeCopy('0:v', 'outv');

      expect(filter.inputs).toEqual(['0:v']);
      expect(filter.output).toBe('outv');
      expect(filter.render()).toBe('[0:v]copy[outv]');
    });

    it('should wrap labels in brackets', () => {
      const filter = makeCopy('input', 'output');

      expect(filter.render()).toBe('[input]copy[output]');
    });
  });

  describe('Filter type structure', () => {
    it('should have correct filter structure', () => {
      const filter = makeConcat(['0:v', '1:v'], 'outv');

      expect(filter).toHaveProperty('inputs');
      expect(filter).toHaveProperty('output');
      expect(filter).toHaveProperty('render');
      expect(typeof filter.render).toBe('function');
    });

    it('should preserve inputs and output in filter object', () => {
      const filter = makeXFade('a', 'b', 'c', { duration: 1, offset: 0 });

      expect(filter.inputs).toEqual(['a', 'b']);
      expect(filter.output).toBe('c');
    });
  });
});
