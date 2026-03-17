import { useMemo } from 'react';
import { getAnimationParams } from '../animation';

/**
 * Generic hook to extract all app parameters from URL query string.
 * Automatically includes animation parameters (fps, duration, rendering).
 *
 * Excludes internal animation parameters (fps, duration) from the returned object,
 * but includes all other parameters like title, date, tags, and custom parameters.
 *
 * @example
 * interface MyParams {
 *   title?: string;
 *   text?: string;
 *   color?: string;
 * }
 *
 * const { title, text, color, rendering } = useAppParams<MyParams>();
 */
export function useAppParams<T extends Record<string, string | undefined>>(): T & { rendering: boolean } {
  return useMemo(() => {
    const animParams = getAnimationParams();
    const urlParams = new URLSearchParams(window.location.search);

    const result: any = { rendering: animParams.rendering };

    // Extract all URL parameters except internal animation ones
    const internalParams = new Set(['rendering', 'fps', 'duration']);

    for (const [key, value] of urlParams.entries()) {
      if (!internalParams.has(key)) {
        result[key] = value || undefined;
      }
    }

    return result;
  }, []);
}
