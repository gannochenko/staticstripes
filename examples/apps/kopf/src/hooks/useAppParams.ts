import { useMemo } from "react";

export interface AppParams {
  text?: string;
  subtext?: string;
  rendering: boolean;
}

export function useAppParams(): AppParams {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      text: p.get("text") ?? undefined,
      subtext: p.get("subtext") ?? undefined,
      rendering: p.has("rendering"),
    };
  }, []);
}
