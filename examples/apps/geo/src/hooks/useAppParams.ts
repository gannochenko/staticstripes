import { useMemo } from "react";

export interface AppParams {
  text?: string;
  rendering: boolean;
}

export function useAppParams(): AppParams {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      text: p.get("text") ?? undefined,
      rendering: p.has("rendering"),
    };
  }, []);
}
