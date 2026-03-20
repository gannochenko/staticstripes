import { describe, it, expect } from 'vitest';
import { CSSProcessor } from './css-processor';
import type { Fragment, Sequence } from '../../type';
import { Element } from 'domhandler';

describe('CSSProcessor', () => {
  describe('processSequences', () => {
    it('should process sequences with CSS properties', () => {
      // Create mock elements
      const fragment1Element = new Element('fragment', { class: 'intro' });
      const fragment2Element = new Element('fragment', { class: 'main' });

      const parsedSequences: Sequence[] = [
        {
          fragments: [
            {
              class: 'intro',
              element: fragment1Element,
            },
            {
              class: 'main',
              element: fragment2Element,
            },
          ],
        },
      ];

      const cssMap = new Map([
        [
          fragment1Element,
          {
            '-asset': 'intro_image',
            '-duration': '3000ms',
            '-transition-end': 'fade-out 500ms',
          },
        ],
        [
          fragment2Element,
          {
            '-asset': 'main_clip',
            '-duration': '5000ms',
            '-object-fit': 'contain ambient 20 -0.3 0.8',
            '-transition-start': 'fade-in 500ms',
          },
        ],
      ]);

      const result = CSSProcessor.processSequences(parsedSequences, cssMap);

      expect(result).toHaveLength(1);
      expect(result[0].fragments).toHaveLength(2);

      // Check first fragment
      const frag1 = result[0].fragments[0];
      expect(frag1.assetName).toBe('intro_image');
      expect(frag1.duration).toBe(3000);
      expect(frag1.transitionOut).toBe('fade-out');
      expect(frag1.transitionOutDuration).toBe(500);

      // Check second fragment
      const frag2 = result[0].fragments[1];
      expect(frag2.assetName).toBe('main_clip');
      expect(frag2.duration).toBe(5000);
      expect(frag2.objectFit).toBe('contain');
      expect(frag2.objectFitContain).toBe('ambient');
      expect(frag2.objectFitContainAmbientBlurStrength).toBe(20);
      expect(frag2.objectFitContainAmbientBrightness).toBe(-0.3);
      expect(frag2.objectFitContainAmbientSaturation).toBe(0.8);
      expect(frag2.transitionIn).toBe('fade-in');
      expect(frag2.transitionInDuration).toBe(500);
    });

    it('should skip fragments without -asset property', () => {
      const fragmentElement = new Element('fragment', { class: 'test' });

      const parsedSequences: Sequence[] = [
        {
          fragments: [
            {
              class: 'test',
              element: fragmentElement,
            },
          ],
        },
      ];

      const cssMap = new Map([
        [
          fragmentElement,
          {
            '-duration': '3000ms', // No -asset property
          },
        ],
      ]);

      const result = CSSProcessor.processSequences(parsedSequences, cssMap);

      expect(result).toHaveLength(1);
      expect(result[0].fragments).toHaveLength(0); // Fragment skipped
    });

    it('should parse time values correctly', () => {
      const fragmentElement = new Element('fragment', { class: 'test' });

      const parsedSequences: Sequence[] = [
        {
          fragments: [
            {
              class: 'test',
              element: fragmentElement,
            },
          ],
        },
      ];

      const cssMap = new Map([
        [
          fragmentElement,
          {
            '-asset': 'test_asset',
            '-duration': '5s', // Seconds
            '-trim-start': '1500ms', // Milliseconds
          },
        ],
      ]);

      const result = CSSProcessor.processSequences(parsedSequences, cssMap);

      const frag = result[0].fragments[0];
      expect(frag.duration).toBe(5000); // 5s = 5000ms
      expect(frag.trimLeft).toBe(1500); // 1500ms
    });

    it('should handle object-fit modes', () => {
      const frag1Element = new Element('fragment', { class: 'cover' });
      const frag2Element = new Element('fragment', { class: 'contain' });
      const frag3Element = new Element('fragment', { class: 'ambient' });

      const parsedSequences: Sequence[] = [
        {
          fragments: [
            { class: 'cover', element: frag1Element },
            { class: 'contain', element: frag2Element },
            { class: 'ambient', element: frag3Element },
          ],
        },
      ];

      const cssMap = new Map([
        [frag1Element, { '-asset': 'asset1', '-object-fit': 'cover' }],
        [frag2Element, { '-asset': 'asset2', '-object-fit': 'contain' }],
        [
          frag3Element,
          { '-asset': 'asset3', '-object-fit': 'contain ambient 25 -0.5 0.9' },
        ],
      ]);

      const result = CSSProcessor.processSequences(parsedSequences, cssMap);

      expect(result[0].fragments[0].objectFit).toBe('cover');
      expect(result[0].fragments[1].objectFit).toBe('contain');
      expect(result[0].fragments[1].objectFitContain).toBe('pillarbox'); // default

      const frag3 = result[0].fragments[2];
      expect(frag3.objectFit).toBe('contain');
      expect(frag3.objectFitContain).toBe('ambient');
      expect(frag3.objectFitContainAmbientBlurStrength).toBe(25);
      expect(frag3.objectFitContainAmbientBrightness).toBe(-0.5);
      expect(frag3.objectFitContainAmbientSaturation).toBe(0.9);
    });

    it('should handle visual filters', () => {
      const fragmentElement = new Element('fragment', { class: 'filtered' });

      const parsedSequences: Sequence[] = [
        {
          fragments: [
            {
              class: 'filtered',
              element: fragmentElement,
            },
          ],
        },
      ];

      const cssMap = new Map([
        [
          fragmentElement,
          {
            '-asset': 'image',
            filter: 'instagram-lark',
          },
        ],
      ]);

      const result = CSSProcessor.processSequences(parsedSequences, cssMap);

      expect(result[0].fragments[0].visualFilter).toBe('instagram-lark');
    });

    it('should handle sound property', () => {
      const frag1Element = new Element('fragment', { class: 'silent' });
      const frag2Element = new Element('fragment', { class: 'normal' });

      const parsedSequences: Sequence[] = [
        {
          fragments: [
            { class: 'silent', element: frag1Element },
            { class: 'normal', element: frag2Element },
          ],
        },
      ];

      const cssMap = new Map([
        [frag1Element, { '-asset': 'video1', '-sound': 'off' }],
        [frag2Element, { '-asset': 'video2' }], // No -sound property
      ]);

      const result = CSSProcessor.processSequences(parsedSequences, cssMap);

      expect(result[0].fragments[0].sound).toBe('off');
      expect(result[0].fragments[1].sound).toBe('on'); // default
    });
  });
});
