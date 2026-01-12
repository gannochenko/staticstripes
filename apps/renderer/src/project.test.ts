import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prepareProject } from './project';
import { parseHTML } from './parser';
import type { ParsedHtml } from './type';
import { execFile } from 'child_process';

// Mock execFile to avoid actual ffprobe calls
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

describe('prepareProject', () => {
  beforeEach(() => {
    // Mock ffprobe to return a duration
    vi.mocked(execFile).mockImplementation((cmd, args, callback: any) => {
      // Return 5 seconds duration for all assets
      callback(null, { stdout: '5.0', stderr: '' });
      return {} as any;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('asset parsing', () => {
    it('should parse basic asset with all attributes', async () => {
      const html = `
        <project>
          <sequence></sequence>
        </project>
        <assets>
          <asset
            data-name="clip1"
            data-path="./video.mp4"
            data-author="John Doe"
          />
        </assets>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.assets.size).toBe(1);
      expect(project.assets.get('clip1')).toEqual({
        name: 'clip1',
        path: '/test/video.mp4',
        type: 'video',
        duration: 5000,
        author: 'John Doe',
      });
    });

    it('should infer asset type from file extension', async () => {
      const html = `
        <project>
          <sequence></sequence>
        </project>
        <assets>
          <asset data-name="img1" data-path="./image.jpg" />
          <asset data-name="aud1" data-path="./audio.mp3" />
        </assets>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.assets.get('img1')?.type).toBe('image');
      expect(project.assets.get('aud1')?.type).toBe('audio');
    });

    it('should not call ffprobe for images', async () => {
      const html = `
        <project>
          <sequence></sequence>
        </project>
        <assets>
          <asset data-name="img1" data-path="./image.jpg" />
        </assets>
      `;

      vi.clearAllMocks();
      const parsed = parseHTML(html);
      await prepareProject(parsed, '/test/project.html');

      expect(execFile).not.toHaveBeenCalled();
    });

    it('should resolve asset paths to absolute', async () => {
      const html = `
        <project>
          <sequence></sequence>
        </project>
        <assets>
          <asset data-name="clip1" data-path="./input/video.mp4" />
        </assets>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.assets.get('clip1')?.path).toBe('/test/input/video.mp4');
    });
  });

  describe('output parsing', () => {
    it('should parse output configuration', async () => {
      const html = `
        <project>
          <sequence></sequence>
        </project>
        <outputs>
          <output
            name="for_youtube"
            path="./output/video.mp4"
            resolution="1920x1080"
            fps="30"
          />
        </outputs>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.output).toEqual({
        name: 'for_youtube',
        path: '/test/output/video.mp4',
        resolution: { width: 1920, height: 1080 },
        fps: 30,
      });
    });

    it('should use default output if none specified', async () => {
      const html = `
        <project>
          <sequence></sequence>
        </project>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.output).toEqual({
        name: 'output',
        path: '/test/output/video.mp4',
        resolution: { width: 1920, height: 1080 },
        fps: 30,
      });
    });
  });

  describe('fragment parsing', () => {
    it('should parse fragment with asset from CSS', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="test" />
          </sequence>
        </project>
        <style>
          .test {
            -asset: clip1;
            width: 10s;
            z-index: 5;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragment = project.sequences[0].fragments[0];
      expect(fragment.assetName).toBe('clip1');
      expect(fragment.duration).toBe(10000);
      expect(fragment.zIndex).toBe(5);
    });

    it('should parse fragment with data-asset attribute', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="test" data-asset="clip2" />
          </sequence>
        </project>
        <style>
          .test {
            width: 5s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragment = project.sequences[0].fragments[0];
      expect(fragment.assetName).toBe('clip2');
    });

    it('should parse blend modes', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="test" />
          </sequence>
        </project>
        <style>
          .test {
            -asset: clip1;
            -blend-mode-left: screen;
            -blend-mode-right: screen;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragment = project.sequences[0].fragments[0];
      expect(fragment.blendModeLeft).toBe('screen');
      expect(fragment.blendModeRight).toBe('screen');
    });

    it('should parse transitions', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="test" />
          </sequence>
        </project>
        <style>
          .test {
            -asset: clip1;
            -transition-in: fade-in 1s;
            -transition-out: fade-to-black 2s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragment = project.sequences[0].fragments[0];
      expect(fragment.transitionIn).toBe('fade-in');
      expect(fragment.transitionInDuration).toBe(1000);
      expect(fragment.transitionOut).toBe('fade-to-black');
      expect(fragment.transitionOutDuration).toBe(2000);
    });

    it('should parse objectFit', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="cover" />
            <fragment class="contain" />
          </sequence>
        </project>
        <style>
          .cover {
            -asset: clip1;
            object-fit: cover;
          }
          .contain {
            -asset: clip2;
            object-fit: contain;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.sequences[0].fragments[0].objectFit).toBe('cover');
      expect(project.sequences[0].fragments[1].objectFit).toBe('contain');
    });

    it('should allow fragments without assets', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="container" />
          </sequence>
        </project>
        <style>
          .container {
            width: 3s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragment = project.sequences[0].fragments[0];
      expect(fragment.assetName).toBe('');
      expect(fragment.duration).toBe(3000);
    });
  });

  describe('duration parsing', () => {
    it('should parse duration in seconds', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="test" />
          </sequence>
        </project>
        <style>
          .test {
            -asset: clip1;
            width: 5.5s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.sequences[0].fragments[0].duration).toBe(5500);
    });

    it('should parse duration as percentage', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="test" />
          </sequence>
        </project>
        <assets>
          <asset data-name="clip1" data-path="./video.mp4" />
        </assets>
        <style>
          .test {
            -asset: clip1;
            width: 50%;
          }
        </style>
      `;

      // Mock ffprobe to return 10 seconds
      vi.mocked(execFile).mockImplementation((cmd, args, callback: any) => {
        callback(null, { stdout: '10.0', stderr: '' });
        return {} as any;
      });

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.sequences[0].fragments[0].duration).toBe(5000); // 50% of 10s
    });

    it('should cap percentage at 100%', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="test" />
          </sequence>
        </project>
        <assets>
          <asset data-name="clip1" data-path="./video.mp4" />
        </assets>
        <style>
          .test {
            -asset: clip1;
            width: 150%;
          }
        </style>
      `;

      // Mock ffprobe to return 10 seconds
      vi.mocked(execFile).mockImplementation((cmd, args, callback: any) => {
        callback(null, { stdout: '10.0', stderr: '' });
        return {} as any;
      });

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.sequences[0].fragments[0].duration).toBe(10000); // capped at 100%
    });
  });

  describe('overlay normalization', () => {
    it('should normalize overlays: combine margin-left and prev margin-right', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="a" />
            <fragment class="b" />
            <fragment class="c" />
          </sequence>
        </project>
        <style>
          .a {
            -asset: clip1;
            width: 5s;
            margin-right: 0.5s;
          }
          .b {
            -asset: clip2;
            width: 5s;
            margin-left: -0.3s;
            margin-right: 0.2s;
          }
          .c {
            -asset: clip3;
            width: 5s;
            margin-left: -0.1s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragments = project.sequences[0].fragments;

      // Fragment 0: margin-right ignored (no previous fragment)
      expect(fragments[0].overlayLeft).toBe(0);

      // Fragment 1: -0.3s (margin-left) + 0.5s (prev margin-right) = 0.2s
      expect(fragments[1].overlayLeft).toBe(200);

      // Fragment 2: -0.1s (margin-left) + 0.2s (prev margin-right) = 0.1s
      expect(fragments[2].overlayLeft).toBe(100);
    });

    it('should handle only margin-left', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="a" />
            <fragment class="b" />
          </sequence>
        </project>
        <style>
          .a {
            -asset: clip1;
            width: 5s;
          }
          .b {
            -asset: clip2;
            width: 5s;
            margin-left: -0.5s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragments = project.sequences[0].fragments;

      expect(fragments[0].overlayLeft).toBe(0);
      expect(fragments[1].overlayLeft).toBe(-500); // -0.5s + 0 (no prev margin-right)
    });

    it('should handle only margin-right', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="a" />
            <fragment class="b" />
          </sequence>
        </project>
        <style>
          .a {
            -asset: clip1;
            width: 5s;
            margin-right: 0.5s;
          }
          .b {
            -asset: clip2;
            width: 5s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragments = project.sequences[0].fragments;

      expect(fragments[0].overlayLeft).toBe(0);
      expect(fragments[1].overlayLeft).toBe(500); // 0 (margin-left) + 0.5s (prev margin-right)
    });

    it('should handle negative values correctly', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="a" />
            <fragment class="b" />
          </sequence>
        </project>
        <style>
          .a {
            -asset: clip1;
            width: 5s;
            margin-right: -0.3s;
          }
          .b {
            -asset: clip2;
            width: 5s;
            margin-left: -0.2s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragments = project.sequences[0].fragments;

      expect(fragments[0].overlayLeft).toBe(0);
      expect(fragments[1].overlayLeft).toBe(-500); // -0.2s + (-0.3s) = -0.5s
    });

    it('should not have overlayRight in final fragments', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="a" />
            <fragment class="b" />
          </sequence>
        </project>
        <style>
          .a {
            -asset: clip1;
            width: 5s;
            margin-right: 0.5s;
          }
          .b {
            -asset: clip2;
            width: 5s;
            margin-left: -0.5s;
          }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      const fragments = project.sequences[0].fragments;

      // Fragments should not have overlayRight property
      expect(fragments[0]).not.toHaveProperty('overlayRight');
      expect(fragments[1]).not.toHaveProperty('overlayRight');
    });
  });

  describe('multiple sequences', () => {
    it('should process multiple sequences in order', async () => {
      const html = `
        <project>
          <sequence>
            <fragment class="a" />
          </sequence>
          <sequence>
            <fragment class="b" />
          </sequence>
          <sequence>
            <fragment class="c" />
          </sequence>
        </project>
        <style>
          .a { -asset: clip1; }
          .b { -asset: clip2; }
          .c { -asset: clip3; }
        </style>
      `;

      const parsed = parseHTML(html);
      const project = await prepareProject(parsed, '/test/project.html');

      expect(project.sequences).toHaveLength(3);
      expect(project.sequences[0].fragments[0].assetName).toBe('clip1');
      expect(project.sequences[1].fragments[0].assetName).toBe('clip2');
      expect(project.sequences[2].fragments[0].assetName).toBe('clip3');
    });
  });
});
