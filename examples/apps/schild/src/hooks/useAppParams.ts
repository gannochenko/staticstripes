import { useMemo } from "react";

export interface AppParams {
  title?: string;
  narration?: string;
  rendering: boolean;
}

export function useAppParams(): AppParams {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      title: p.get("title") ?? undefined,
      narration: p.get("narration") ?? undefined,
      rendering: p.has("rendering"),
    };
  }, []);
}
