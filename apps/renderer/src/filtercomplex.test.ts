import { describe, it, expect } from 'vitest';
import {
  makeConcat,
  makeXFade,
  makeCopy,
  makeFps,
  makeFormat,
  makeScale,
  makeSplit,
  makeCrop,
  makeGblur,
  makeEq,
  makeOverlay,
  makeDrawtext,
  makeFade,
  makeColorkey,
  makeSetpts,
  makeAtrim,
  makeAfade,
} from './filtercomplex';

describe('filter_complex factories', () => {
  describe('makeConcat', () => {
    it('should create a concat filter with default options', () => {
      const filter = makeConcat(['0:v', '1:v', '2:v'], 'outv');

      expect(filter.inputs).toEqual(['0:v', '1:v', '2:v']);
      expect(filter.outputs).toEqual(['outv']);
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
      expect(filter.outputs).toEqual(['outv']);
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
      expect(filter.outputs).toEqual(['outv']);
      expect(filter.render()).toBe('[0:v]copy[outv]');
    });

    it('should wrap labels in brackets', () => {
      const filter = makeCopy('input', 'output');

      expect(filter.render()).toBe('[input]copy[output]');
    });
  });

  describe('makeFps', () => {
    it('should create an fps filter', () => {
      const filter = makeFps('0:v', 'outv', 30);

      expect(filter.inputs).toEqual(['0:v']);
      expect(filter.outputs).toEqual(['outv']);
      expect(filter.render()).toBe('[0:v]fps=30[outv]');
    });

    it('should handle different frame rates', () => {
      const filter = makeFps('input', 'output', 60);
      expect(filter.render()).toBe('[input]fps=60[output]');
    });
  });

  describe('makeFormat', () => {
    it('should create a format filter', () => {
      const filter = makeFormat('0:v', 'outv', 'yuv420p');

      expect(filter.inputs).toEqual(['0:v']);
      expect(filter.outputs).toEqual(['outv']);
      expect(filter.render()).toBe('[0:v]format=yuv420p[outv]');
    });

    it('should handle different pixel formats', () => {
      const filter = makeFormat('input', 'output', 'rgb24');
      expect(filter.render()).toBe('[input]format=rgb24[output]');
    });
  });

  describe('makeScale', () => {
    it('should create a scale filter with both dimensions', () => {
      const filter = makeScale('0:v', 'outv', { width: 1920, height: 1080 });

      expect(filter.inputs).toEqual(['0:v']);
      expect(filter.outputs).toEqual(['outv']);
      expect(filter.render()).toBe('[0:v]scale=1920:1080[outv]');
    });

    it('should handle aspect ratio preservation with -1', () => {
      const filter = makeScale('input', 'output', { width: -1, height: 1920 });
      expect(filter.render()).toBe('[input]scale=-1:1920[output]');
    });

    it('should handle string dimensions', () => {
      const filter = makeScale('input', 'output', {
        width: 'iw/2',
        height: 'ih/2',
      });
      expect(filter.render()).toBe('[input]scale=iw/2:ih/2[output]');
    });
  });

  describe('makeSplit', () => {
    it('should create a split filter with multiple outputs', () => {
      const filter = makeSplit('input', ['fg', 'bg']);

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['fg', 'bg']); // All outputs!
      expect(filter.render()).toBe('[input]split[fg][bg]');
    });

    it('should handle more than 2 outputs', () => {
      const filter = makeSplit('0:v', ['out1', 'out2', 'out3']);
      expect(filter.render()).toBe('[0:v]split[out1][out2][out3]');
    });
  });

  describe('makeCrop', () => {
    it('should create a crop filter', () => {
      const filter = makeCrop('input', 'output', {
        width: 1920,
        height: 1080,
      });

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe('[input]crop=1920:1080[output]');
    });

    it('should handle string dimensions', () => {
      const filter = makeCrop('input', 'output', { width: 'iw', height: 'ih' });
      expect(filter.render()).toBe('[input]crop=iw:ih[output]');
    });
  });

  describe('makeGblur', () => {
    it('should create a gblur filter', () => {
      const filter = makeGblur('input', 'output', 30);

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe('[input]gblur=sigma=30[output]');
    });

    it('should handle different sigma values', () => {
      const filter = makeGblur('0:v', 'blurred', 5.5);
      expect(filter.render()).toBe('[0:v]gblur=sigma=5.5[blurred]');
    });
  });

  describe('makeEq', () => {
    it('should create an eq filter with contrast and brightness', () => {
      const filter = makeEq('input', 'output', {
        contrast: 0.7,
        brightness: -0.3,
      });

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe(
        '[input]eq=contrast=0.7:brightness=-0.3[output]',
      );
    });

    it('should handle only contrast', () => {
      const filter = makeEq('input', 'output', { contrast: 1.5 });
      expect(filter.render()).toBe('[input]eq=contrast=1.5[output]');
    });

    it('should handle only brightness', () => {
      const filter = makeEq('input', 'output', { brightness: 0.2 });
      expect(filter.render()).toBe('[input]eq=brightness=0.2[output]');
    });
  });

  describe('makeOverlay', () => {
    it('should create an overlay filter with default options', () => {
      const filter = makeOverlay('bg', 'fg', 'output');

      expect(filter.inputs).toEqual(['bg', 'fg']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe('[bg][fg]overlay[output]');
    });

    it('should handle position options', () => {
      const filter = makeOverlay('bg', 'fg', 'output', {
        x: '(W-w)/2',
        y: '0',
      });
      expect(filter.render()).toBe('[bg][fg]overlay=x=(W-w)/2:y=0[output]');
    });

    it('should handle enable expression', () => {
      const filter = makeOverlay('bg', 'fg', 'output', {
        x: '0',
        y: '0',
        enable: 'between(t,10,15)',
      });
      expect(filter.render()).toBe(
        '[bg][fg]overlay=x=0:y=0:enable=between(t,10,15)[output]',
      );
    });
  });

  describe('makeDrawtext', () => {
    it('should create a drawtext filter with minimal options', () => {
      const filter = makeDrawtext('input', 'output', { text: 'Hello' });

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe("[input]drawtext=text='Hello'[output]");
    });

    it('should handle all options', () => {
      const filter = makeDrawtext('input', 'output', {
        text: 'Snowy Morning',
        font: 'Arial',
        fontsize: 72,
        fontcolor: 'white',
        x: '(w-text_w)/2',
        y: '(h-text_h)/2',
        alpha: 'if(lt(t,4),1,0)',
      });

      expect(filter.render()).toBe(
        "[input]drawtext=text='Snowy Morning':font='Arial':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,4),1,0)'[output]",
      );
    });
  });

  describe('makeFade', () => {
    it('should create a fade out filter', () => {
      const filter = makeFade('input', 'output', {
        type: 'out',
        start: 4,
        duration: 1,
      });

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe('[input]fade=t=out:st=4:d=1[output]');
    });

    it('should create a fade in filter', () => {
      const filter = makeFade('input', 'output', {
        type: 'in',
        duration: 2,
      });
      expect(filter.render()).toBe('[input]fade=t=in:d=2[output]');
    });
  });

  describe('makeColorkey', () => {
    it('should create a colorkey filter', () => {
      const filter = makeColorkey('input', 'output', {
        color: '0x000000',
        similarity: 0.3,
        blend: 0.2,
      });

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe(
        '[input]colorkey=0x000000:0.3:0.2[output]',
      );
    });

    it('should handle different color formats', () => {
      const filter = makeColorkey('input', 'output', {
        color: '#00FF00',
        similarity: 0.5,
        blend: 0.1,
      });
      expect(filter.render()).toBe('[input]colorkey=#00FF00:0.5:0.1[output]');
    });
  });

  describe('makeSetpts', () => {
    it('should create a setpts filter', () => {
      const filter = makeSetpts('input', 'output', 'PTS+10/TB');

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe('[input]setpts=PTS+10/TB[output]');
    });

    it('should handle complex expressions', () => {
      const filter = makeSetpts('input', 'output', 'PTS-STARTPTS');
      expect(filter.render()).toBe('[input]setpts=PTS-STARTPTS[output]');
    });
  });

  describe('makeAtrim', () => {
    it('should create an atrim filter with start and end', () => {
      const filter = makeAtrim('0:a', 'output', { start: 0, end: 5 });

      expect(filter.inputs).toEqual(['0:a']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe('[0:a]atrim=0:5[output]');
    });

    it('should handle only start', () => {
      const filter = makeAtrim('input', 'output', { start: 10 });
      expect(filter.render()).toBe('[input]atrim=10[output]');
    });

    it('should handle only end', () => {
      const filter = makeAtrim('input', 'output', { end: 20 });
      expect(filter.render()).toBe('[input]atrim=20[output]');
    });
  });

  describe('makeAfade', () => {
    it('should create an afade out filter', () => {
      const filter = makeAfade('input', 'output', {
        type: 'out',
        start: 4,
        duration: 1,
      });

      expect(filter.inputs).toEqual(['input']);
      expect(filter.outputs).toEqual(['output']);
      expect(filter.render()).toBe('[input]afade=t=out:st=4:d=1[output]');
    });

    it('should create an afade in filter', () => {
      const filter = makeAfade('input', 'output', {
        type: 'in',
        duration: 2,
      });
      expect(filter.render()).toBe('[input]afade=t=in:d=2[output]');
    });
  });

  describe('Filter type structure', () => {
    it('should have correct filter structure', () => {
      const filter = makeConcat(['0:v', '1:v'], 'outv');

      expect(filter).toHaveProperty('inputs');
      expect(filter).toHaveProperty('outputs');
      expect(filter).toHaveProperty('render');
      expect(typeof filter.render).toBe('function');
    });

    it('should preserve inputs and outputs in filter object', () => {
      const filter = makeXFade('a', 'b', 'c', { duration: 1, offset: 0 });

      expect(filter.inputs).toEqual(['a', 'b']);
      expect(filter.outputs).toEqual(['c']);
    });
  });
});
