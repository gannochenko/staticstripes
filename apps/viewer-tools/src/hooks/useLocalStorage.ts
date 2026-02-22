import { useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    setState(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable — still update in-memory state
    }
  };

  return [state, setValue];
}
