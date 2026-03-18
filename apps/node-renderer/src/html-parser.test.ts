import { describe, it, expect } from 'vitest';
import { HTMLParser, getTextContent, findChildElementsByTagName } from './html-parser';

describe('HTMLParser', () => {
  describe('basic parsing', () => {
    it('should parse a simple project node', () => {
      const html = `
        <node.project>
          <title>Test Project</title>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      expect(result.nodes).toHaveLength(1);
      expect(result.projectNode).toBeDefined();
      expect(result.projectNode?.type).toBe('project');
    });

    it('should parse multiple node types', () => {
      const html = `
        <node.project>
          <title>Test Project</title>
        </node.project>

        <node.filesystem name="preview_youtube" path="$project.output.youtube">
          <path> output/preview_youtube.mp4 </path>
        </node.filesystem>

        <node.youtube name="yt_primary" path="$project.output.youtube">
          <unlisted />
          <made-for-kids />
        </node.youtube>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      expect(result.nodes).toHaveLength(3);
      expect(result.projectNode?.type).toBe('project');

      const filesystemNode = result.nodes.find((n) => n.type === 'filesystem');
      expect(filesystemNode).toBeDefined();
      expect(filesystemNode?.name).toBe('preview_youtube');

      const youtubeNode = result.nodes.find((n) => n.type === 'youtube');
      expect(youtubeNode).toBeDefined();
      expect(youtubeNode?.name).toBe('yt_primary');
    });

    it('should parse AI integration nodes', () => {
      const html = `
        <node.ai_music_api_ai name="intro_song">
          <prompt>
            10-second instrumental acoustic guitar piece
          </prompt>
          <model name="sonic-v4-5" />
        </node.ai_music_api_ai>

        <node.elevenlabs name="joker_talks" text="$joker.output.text" />

        <node.openai name="joker">
          <prompt> make a dad joke! </prompt>
        </node.openai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      expect(result.nodes).toHaveLength(3);

      const musicNode = result.nodes.find((n) => n.type === 'ai_music_api_ai');
      expect(musicNode).toBeDefined();
      expect(musicNode?.name).toBe('intro_song');

      const elevenlabsNode = result.nodes.find((n) => n.type === 'elevenlabs');
      expect(elevenlabsNode).toBeDefined();
      expect(elevenlabsNode?.name).toBe('joker_talks');

      const openaiNode = result.nodes.find((n) => n.type === 'openai');
      expect(openaiNode).toBeDefined();
      expect(openaiNode?.name).toBe('joker');
    });
  });

  describe('project content parsing', () => {
    it('should parse title and tags', () => {
      const html = `
        <node.project>
          <title>Christmas Morning in Liberec</title>
          <tag>Winter</tag>
          <tag>Christmas</tag>
          <tag>Czech Republic</tag>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      expect(result.projectNode?.projectContent).toBeDefined();
      expect(result.projectNode?.projectContent?.title).toBe(
        'Christmas Morning in Liberec',
      );
      expect(result.projectNode?.projectContent?.tags).toHaveLength(3);
      expect(result.projectNode?.projectContent?.tags).toEqual([
        'Winter',
        'Christmas',
        'Czech Republic',
      ]);
    });

    it('should parse assets', () => {
      const html = `
        <node.project>
          <assets>
            <asset name="clip_01" path="./input/20251224_110901.mp4" author="John Doe" />
            <asset name="clip_02" path="./input/20251224_111721.mp4" author="Jane Doe" />
            <asset name="mysterious_music" input="ai_music_api_ai.intro_song.audio" />
            <asset name="audio_joke" input="elevenlabs.joker_talks.audio" />
          </assets>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      const assets = result.projectNode?.projectContent?.assets;
      expect(assets).toBeDefined();
      expect(assets).toHaveLength(4);

      // Check file-based assets
      const clip01 = assets?.find((a) => a.name === 'clip_01');
      expect(clip01).toBeDefined();
      expect(clip01?.path).toBe('./input/20251224_110901.mp4');
      expect(clip01?.author).toBe('John Doe');

      // Check node-input-based assets
      const mysteriousMusic = assets?.find((a) => a.name === 'mysterious_music');
      expect(mysteriousMusic).toBeDefined();
      expect(mysteriousMusic?.input).toBe('ai_music_api_ai.intro_song.audio');
      expect(mysteriousMusic?.path).toBeUndefined();
    });

    it('should parse outputs', () => {
      const html = `
        <node.project>
          <outputs>
            <output name="youtube" resolution="1920x1080" fps="30" />
            <output name="youtube_shorts" resolution="1080x1920" fps="30" />
            <output name="instagram_shorts" resolution="1080x1920" fps="30" />
          </outputs>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      const outputs = result.projectNode?.projectContent?.outputs;
      expect(outputs).toBeDefined();
      expect(outputs).toHaveLength(3);

      const youtubeOutput = outputs?.find((o) => o.name === 'youtube');
      expect(youtubeOutput).toBeDefined();
      expect(youtubeOutput?.resolution).toBe('1920x1080');
      expect(youtubeOutput?.fps).toBe(30);

      const shortsOutput = outputs?.find((o) => o.name === 'youtube_shorts');
      expect(shortsOutput).toBeDefined();
      expect(shortsOutput?.resolution).toBe('1080x1920');
    });

    it('should parse sequences with fragments', () => {
      const html = `
        <node.project>
          <sequences>
            <sequence>
              <fragment class="intro_image intro_duration" />
              <fragment class="clip_1 ambient" timecode="Clip 1" />
              <fragment class="clip_2 ambient" timecode="Clip 2" id="clip2_frag" />
            </sequence>
            <sequence>
              <fragment class="intro_sound intro_duration" />
            </sequence>
          </sequences>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      const sequences = result.projectNode?.projectContent?.sequences;
      expect(sequences).toBeDefined();
      expect(sequences).toHaveLength(2);

      // Check first sequence
      const firstSeq = sequences?.[0];
      expect(firstSeq?.fragments).toHaveLength(3);

      const frag1 = firstSeq?.fragments[0];
      expect(frag1?.class).toBe('intro_image intro_duration');

      const frag2 = firstSeq?.fragments[1];
      expect(frag2?.class).toBe('clip_1 ambient');
      expect(frag2?.timecode).toBe('Clip 1');

      const frag3 = firstSeq?.fragments[2];
      expect(frag3?.id).toBe('clip2_frag');

      // Check second sequence
      const secondSeq = sequences?.[1];
      expect(secondSeq?.fragments).toHaveLength(1);
    });

    it('should parse FFmpeg options', () => {
      const html = `
        <node.project>
          <ffmpeg>
            <option name="preview">
              -c:v h264_nvenc -preset fast -c:a aac -b:a 192k
            </option>
            <option name="meh">
              -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 192k
            </option>
          </ffmpeg>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      const ffmpegOptions = result.projectNode?.projectContent?.ffmpegOptions;
      expect(ffmpegOptions).toBeDefined();
      expect(ffmpegOptions).toHaveLength(2);

      const previewOption = ffmpegOptions?.find((o) => o.name === 'preview');
      expect(previewOption).toBeDefined();
      expect(previewOption?.args).toContain('-c:v h264_nvenc');

      const mehOption = ffmpegOptions?.find((o) => o.name === 'meh');
      expect(mehOption).toBeDefined();
      expect(mehOption?.args).toContain('-pix_fmt yuv420p');
    });

    it('should parse CSS styles', () => {
      const html = `
        <node.project>
          <style>
            .disabled {
              display: none;
            }
            .ambient {
              -object-fit: contain ambient 25 -0.1 0.7;
            }
            .intro_duration {
              -duration: 8000ms;
            }
          </style>
          <sequences>
            <sequence>
              <fragment class="intro_duration" />
              <fragment class="ambient disabled" />
            </sequence>
          </sequences>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      // Check that CSS was extracted
      const cssText = result.projectNode?.projectContent?.cssText;
      expect(cssText).toBeDefined();
      expect(cssText).toContain('.disabled');
      expect(cssText).toContain('.ambient');

      // Check that CSS was parsed and applied
      const css = result.projectNode?.projectContent?.css;
      expect(css).toBeDefined();
      expect(css?.size).toBeGreaterThan(0);
    });
  });

  describe('attribute parsing', () => {
    it('should extract attributes correctly', () => {
      const html = `
        <node.s3 name="s3_primary" path="$project.output.youtube">
          <endpoint name="digitaloceanspaces.com" />
          <region name="ams3" />
          <bucket name="my-bucket" />
        </node.s3>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      const s3Node = result.nodes.find((n) => n.type === 's3');
      expect(s3Node).toBeDefined();
      expect(s3Node?.attributes.get('name')).toBe('s3_primary');
      expect(s3Node?.attributes.get('path')).toBe('$project.output.youtube');
    });
  });

  describe('child element parsing', () => {
    it('should extract child elements', () => {
      const html = `
        <node.project>
          <title>Test Project</title>
          <tag>Winter</tag>
          <tag>Christmas</tag>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      expect(result.projectNode).toBeDefined();
      expect(result.projectNode?.children).toHaveLength(3);

      const titleElements = result.projectNode?.children.filter(
        (child) => child.name === 'title',
      );
      expect(titleElements).toHaveLength(1);

      const tagElements = result.projectNode?.children.filter(
        (child) => child.name === 'tag',
      );
      expect(tagElements).toHaveLength(2);
    });
  });

  describe('helper functions', () => {
    it('getTextContent should extract text from nodes', () => {
      const html = `
        <node.project>
          <title>Test Project Title</title>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      const titleElement = result.projectNode?.children.find(
        (child) => child.name === 'title',
      );
      expect(titleElement).toBeDefined();

      const text = getTextContent(titleElement!);
      expect(text.trim()).toBe('Test Project Title');
    });

    it('findChildElementsByTagName should find child elements by tag name', () => {
      const html = `
        <node.project>
          <title>Test</title>
          <tag>Winter</tag>
          <tag>Christmas</tag>
          <outputs>
            <output name="youtube" />
          </outputs>
        </node.project>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      const projectElement = result.projectNode?.element;
      expect(projectElement).toBeDefined();

      const tags = findChildElementsByTagName(projectElement!, 'tag');
      expect(tags).toHaveLength(2);

      const outputs = findChildElementsByTagName(projectElement!, 'outputs');
      expect(outputs).toHaveLength(1);
    });
  });

  describe('complete example from NODES.md', () => {
    it('should parse the full example', () => {
      const html = `
        <node.project>
          <title>Christmas Morning in Liberec</title>
          <tag>Winter</tag>
          <tag>Christmas</tag>
          <tag>Czech Republic</tag>

          <sequences>
            <sequence>
              <fragment class="intro_image intro_duration" />
              <fragment class="clip_1 ambient" timecode="Clip 1" />
              <fragment class="analog_static_03" />
              <fragment class="clip_2 ambient" timecode="Clip 2" />
              <fragment
                class="outro_image outro_duration"
                id="ending_screen"
                timecode="Conclusion"
              />
            </sequence>
            <sequence>
              <fragment class="intro_sound intro_duration" />
            </sequence>
          </sequences>

          <style>
            .disabled {
              display: none;
            }
            .ambient {
              -object-fit: contain ambient 25 -0.1 0.7;
            }
            .outro_duration {
              -duration: 5000ms;
            }
            .intro_duration {
              -duration: 8000ms;
            }
          </style>

          <assets>
            <asset
              name="clip_01"
              path="./input/20251224_110901.mp4"
              author="John Doe"
            />
            <asset
              name="clip_02"
              path="./input/20251224_111721.mp4"
              author="Jane Doe"
            />
            <asset name="mysterious_music" input="ai_music_api_ai.intro_song.audio" />
            <asset name="audio_joke" input="elevenlabs.joker_talks.audio" />
          </assets>

          <outputs>
            <output name="youtube" resolution="1920x1080" fps="30" />
            <output name="youtube_shorts" resolution="1080x1920" fps="30" />
            <output name="instagram_shorts" resolution="1080x1920" fps="30" />
          </outputs>

          <ffmpeg>
            <option name="preview">
              -c:v h264_nvenc -preset fast -c:a aac -b:a 192k
            </option>
            <option name="meh">
              -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 192k
            </option>
          </ffmpeg>
        </node.project>

        <node.filesystem name="preview_youtube" path="$project.output.youtube">
          <path> output/preview_youtube.mp4 </path>
        </node.filesystem>

        <node.youtube name="yt_primary" path="$project.output.youtube">
          <unlisted />
          <made-for-kids />
          <category name="entertainment" />
        </node.youtube>

        <node.s3 name="s3_primary" path="$project.output.youtube">
          <endpoint name="digitaloceanspaces.com" />
          <region name="ams3" />
          <bucket name="photoframe-photos-content-ams3-production" />
        </node.s3>

        <node.ai_music_api_ai name="intro_song">
          <prompt>
            10-second instrumental acoustic guitar piece
          </prompt>
          <model name="sonic-v4-5" />
        </node.ai_music_api_ai>

        <node.elevenlabs name="joker_talks" text="$joker.output.text" />

        <node.openai name="joker">
          <prompt> make a dad joke! </prompt>
        </node.openai>
      `;

      const parser = new HTMLParser();
      const result = parser.parse(html);

      // Should have 7 nodes total
      expect(result.nodes).toHaveLength(7);

      // Check project node exists and has content
      expect(result.projectNode).toBeDefined();
      expect(result.projectNode?.type).toBe('project');
      expect(result.projectNode?.projectContent).toBeDefined();

      // Check project content
      const content = result.projectNode?.projectContent;
      expect(content?.title).toBe('Christmas Morning in Liberec');
      expect(content?.tags).toHaveLength(3);
      expect(content?.assets).toHaveLength(4);
      expect(content?.outputs).toHaveLength(3);
      expect(content?.sequences).toHaveLength(2);
      expect(content?.ffmpegOptions).toHaveLength(2);

      // Check sequences
      expect(content?.sequences[0].fragments).toHaveLength(5);
      expect(content?.sequences[1].fragments).toHaveLength(1);

      // Check each node type
      const nodeTypes = result.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('project');
      expect(nodeTypes).toContain('filesystem');
      expect(nodeTypes).toContain('youtube');
      expect(nodeTypes).toContain('s3');
      expect(nodeTypes).toContain('ai_music_api_ai');
      expect(nodeTypes).toContain('elevenlabs');
      expect(nodeTypes).toContain('openai');

      // Check node names
      const nodeNames = result.nodes
        .map((n) => n.name)
        .filter((name) => name !== undefined);
      expect(nodeNames).toContain('preview_youtube');
      expect(nodeNames).toContain('yt_primary');
      expect(nodeNames).toContain('s3_primary');
      expect(nodeNames).toContain('intro_song');
      expect(nodeNames).toContain('joker_talks');
      expect(nodeNames).toContain('joker');
    });
  });
});
