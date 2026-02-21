import { describe, it, expect } from 'vitest';
import { HTMLParser } from './html-parser';

describe('Duration and Trim Properties - CSS Parsing and Logic', () => {
  // Helper to extract computed CSS styles for a fragment
  const parseFragmentStyles = (html: string) => {
    const fullHtml = html.includes('<title>') ? html : `<title>Test</title>${html}`;
    const htmlParser = new HTMLParser();
    const parsed = htmlParser.parse(fullHtml);

    // Find the fragment element
    const findFragment = (node: any): any => {
      if (node.type === 'tag' && node.name === 'fragment') return node;
      if (node.children) {
        for (const child of node.children) {
          const result = findFragment(child);
          if (result) return result;
        }
      }
      return null;
    };

    const fragment = findFragment(parsed.ast);
    if (!fragment) {
      throw new Error('No fragment found in HTML');
    }

    return parsed.css.get(fragment) || {};
  };

  // Helper to parse time value from CSS
  const parseTime = (value: string | undefined): number => {
    if (!value) return 0;
    const trimmed = value.trim();

    if (trimmed.endsWith('ms')) {
      const ms = parseFloat(trimmed);
      return isNaN(ms) ? 0 : Math.round(ms);
    }

    if (trimmed.endsWith('s')) {
      const seconds = parseFloat(trimmed);
      return isNaN(seconds) ? 0 : Math.round(seconds * 1000);
    }

    return 0;
  };

  // Helper to test duration calculation (replicates parseDurationProperty logic)
  const calculateDuration = (
    trimStart: number,
    trimEnd: number,
    durationValue: string | undefined,
    assetDuration: number,
  ): number => {
    if (!durationValue || durationValue.trim() === 'auto') {
      return Math.max(0, assetDuration - trimStart - trimEnd);
    }

    // Handle percentage
    if (durationValue.endsWith('%')) {
      const percentage = parseFloat(durationValue);
      return Math.round((assetDuration * percentage) / 100);
    }

    // Parse explicit time value
    return parseTime(durationValue);
  };

  describe('CSS Property Parsing', () => {
    it('should parse -duration property', () => {
      const html = `
        <project><sequence><fragment class="test" /></sequence></project>
        <style>.test { -duration: 5000ms; }</style>
      `;
      const styles = parseFragmentStyles(html);
      expect(styles['-duration']).toBe('5000ms');
    });

    it('should parse -trim-start property', () => {
      const html = `
        <project><sequence><fragment class="test" /></sequence></project>
        <style>.test { -trim-start: 2000ms; }</style>
      `;
      const styles = parseFragmentStyles(html);
      expect(styles['-trim-start']).toBe('2000ms');
    });

    it('should parse -trim-end property', () => {
      const html = `
        <project><sequence><fragment class="test" /></sequence></project>
        <style>.test { -trim-end: 3000ms; }</style>
      `;
      const styles = parseFragmentStyles(html);
      expect(styles['-trim-end']).toBe('3000ms');
    });

    it('should parse all three properties together', () => {
      const html = `
        <project><sequence><fragment class="test" /></sequence></project>
        <style>.test { -trim-start: 2s; -trim-end: 3s; -duration: auto; }</style>
      `;
      const styles = parseFragmentStyles(html);
      expect(styles['-trim-start']).toBe('2s');
      expect(styles['-trim-end']).toBe('3s');
      expect(styles['-duration']).toBe('auto');
    });

    it('should allow inline styles to override class styles', () => {
      const html = `
        <project><sequence>
          <fragment class="test" style="-duration: 2000ms; -trim-start: 500ms;" />
        </sequence></project>
        <style>.test { -duration: 5000ms; -trim-start: 3000ms; }</style>
      `;
      const styles = parseFragmentStyles(html);
      expect(styles['-duration']).toBe('2000ms'); // Inline overrides
      expect(styles['-trim-start']).toBe('500ms'); // Inline overrides
    });
  });

  describe('Duration Calculation - No Trim', () => {
    it('should use explicit duration', () => {
      const result = calculateDuration(0, 0, '5000ms', 10000);
      expect(result).toBe(5000);
    });

    it('should use auto duration (full asset)', () => {
      const result = calculateDuration(0, 0, 'auto', 10000);
      expect(result).toBe(10000);
    });

    it('should handle percentage duration', () => {
      const result = calculateDuration(0, 0, '50%', 10000);
      expect(result).toBe(5000);
    });

    it('should handle undefined duration (auto)', () => {
      const result = calculateDuration(0, 0, undefined, 8000);
      expect(result).toBe(8000);
    });
  });

  describe('Duration Calculation - With trim-start Only', () => {
    it('should use explicit duration with trim-start', () => {
      const result = calculateDuration(2000, 0, '3000ms', 10000);
      expect(result).toBe(3000);
      // FFmpeg: start=2000, end=5000 (2000+3000)
    });

    it('should calculate auto duration with trim-start', () => {
      const result = calculateDuration(2000, 0, 'auto', 10000);
      expect(result).toBe(8000); // 10000 - 2000
    });

    it('should handle undefined duration with trim-start', () => {
      const result = calculateDuration(3000, 0, undefined, 10000);
      expect(result).toBe(7000); // 10000 - 3000
    });
  });

  describe('Duration Calculation - With trim-end Only', () => {
    it('should use explicit duration (trim-end ignored)', () => {
      const result = calculateDuration(0, 3000, '5000ms', 10000);
      expect(result).toBe(5000); // Explicit, trim-end doesn't apply
    });

    it('should calculate auto duration with trim-end', () => {
      const result = calculateDuration(0, 3000, 'auto', 10000);
      expect(result).toBe(7000); // 10000 - 3000
    });

    it('should handle undefined duration with trim-end', () => {
      const result = calculateDuration(0, 4000, undefined, 10000);
      expect(result).toBe(6000); // 10000 - 4000
    });
  });

  describe('Duration Calculation - With Both Trims', () => {
    it('should use explicit duration (both trims ignored)', () => {
      const result = calculateDuration(2000, 3000, '4000ms', 10000);
      expect(result).toBe(4000);
      // FFmpeg: start=2000, end=6000 (2000+4000)
    });

    it('should calculate auto duration with both trims', () => {
      const result = calculateDuration(2000, 3000, 'auto', 10000);
      expect(result).toBe(5000); // 10000 - 2000 - 3000
      // FFmpeg: start=2000, end=7000 (2000+5000)
      // Shows content from 2s to 7s
    });

    it('should handle undefined duration with both trims', () => {
      const result = calculateDuration(1000, 2000, undefined, 8000);
      expect(result).toBe(5000); // 8000 - 1000 - 2000
    });

    it('should handle trims exceeding asset duration', () => {
      const result = calculateDuration(6000, 5000, 'auto', 10000);
      expect(result).toBe(0); // Math.max(0, 10000 - 6000 - 5000)
    });

    it('should handle very large trim-start', () => {
      const result = calculateDuration(15000, 0, 'auto', 10000);
      expect(result).toBe(0); // Math.max(0, 10000 - 15000)
    });
  });

  describe('Time Parsing', () => {
    it('should parse milliseconds', () => {
      expect(parseTime('5000ms')).toBe(5000);
      expect(parseTime('1500ms')).toBe(1500);
      expect(parseTime('0ms')).toBe(0);
    });

    it('should parse seconds', () => {
      expect(parseTime('5s')).toBe(5000);
      expect(parseTime('1.5s')).toBe(1500);
      expect(parseTime('0s')).toBe(0);
    });

    it('should handle undefined', () => {
      expect(parseTime(undefined)).toBe(0);
    });

    it('should handle whitespace', () => {
      expect(parseTime('  5000ms  ')).toBe(5000);
      expect(parseTime('  2s  ')).toBe(2000);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical trim scenario: skip intro and outro', () => {
      // 60-second GoPro clip, skip 5s intro and 3s outro
      const result = calculateDuration(5000, 3000, 'auto', 60000);
      expect(result).toBe(52000); // 60s - 5s - 3s = 52s
      // Shows content from 5s to 57s
    });

    it('should handle user-specified exact duration with trim', () => {
      // 5-minute interview, start at 10s, use 30s
      const result = calculateDuration(10000, 0, '30000ms', 300000);
      expect(result).toBe(30000);
      // Shows content from 10s to 40s
    });

    it('should handle percentage with trims', () => {
      // Use middle 50% of a 10s clip
      const result = calculateDuration(0, 0, '50%', 10000);
      expect(result).toBe(5000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', () => {
      const result = calculateDuration(0, 0, '0ms', 10000);
      expect(result).toBe(0);
    });

    it('should handle zero trim values', () => {
      const result = calculateDuration(0, 0, 'auto', 10000);
      expect(result).toBe(10000);
    });

    it('should handle 100% percentage', () => {
      const result = calculateDuration(0, 0, '100%', 10000);
      expect(result).toBe(10000);
    });

    it('should handle negative percentage', () => {
      const result = calculateDuration(0, 0, '-10%', 10000);
      // parseFloat('-10%') = -10, so Math.round((10000 * -10) / 100) = -1000
      expect(result).toBe(-1000);
    });
  });
});
