import { useMemo } from "react";

export interface AppParams {
  title?: string;
  verticalOffset?: string;
  fontSize?: string;
  rendering: boolean;
}

export function useAppParams(): AppParams {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      title: p.get("title") ?? undefined,
      verticalOffset: p.get("verticalOffset") ?? undefined,
      fontSize: p.get("fontSize") ?? undefined,
      rendering: p.has("rendering"),
    };
  }, []);
}
