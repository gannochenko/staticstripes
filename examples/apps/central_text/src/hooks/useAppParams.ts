import { useMemo } from "react";

export interface AppParams {
  title?: string;
  date?: string;
  tags?: string;
  extra?: string;
  rendering: boolean;
}

export function useAppParams(): AppParams {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      title: p.get("title") ?? undefined,
      date: p.get("date") ?? undefined,
      tags: p.get("tags") ?? undefined,
      extra: p.get("extra") ?? undefined,
      rendering: p.has("rendering"),
    };
  }, []);
}
