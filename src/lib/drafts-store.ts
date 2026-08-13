import { create } from "zustand";
import { useEffect, useState, useRef } from "react";

interface DraftsState {
  drafts: Record<string, any>;
  setDraft: (key: string, data: any) => void;
  clearDraft: (key: string) => void;
}

export const useDraftStore = create<DraftsState>()((set) => ({
  drafts: {},
  setDraft: (key, data) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [key]: data,
      },
    })),
  clearDraft: (key) =>
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[key];
      return { drafts };
    }),
}));

/**
 * A hook that mirrors useState but keeps the value under the specified draft key
 * only in the current running tab. Submitted business records save to Supabase;
 * durable drafts need a Supabase-backed draft table/RPC, not browser storage.
 */
export function useDraft<T>(
  key: string,
  initialValue: T | (() => T),
  debounceMs = 300,
): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const storeValue = useDraftStore((s) => s.drafts[key]);
  const setStoreDraft = useDraftStore((s) => s.setDraft);
  const clearStoreDraft = useDraftStore((s) => s.clearDraft);

  // Initialize from store if exists, otherwise initialValue
  const [state, setState] = useState<T>(() => {
    if (storeValue !== undefined) {
      return storeValue;
    }
    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
  });

  // Keep ref of latest state
  const stateRef = useRef(state);
  stateRef.current = state;

  // If the store value changes externally (e.g. storage event), sync local state
  useEffect(() => {
    if (
      storeValue !== undefined &&
      JSON.stringify(storeValue) !== JSON.stringify(stateRef.current)
    ) {
      setState(storeValue);
    }
  }, [storeValue]);

  // Debounced write of local state back to the store
  useEffect(() => {
    if (JSON.stringify(state) === JSON.stringify(storeValue)) {
      return;
    }
    const timer = setTimeout(() => {
      setStoreDraft(key, stateRef.current);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [state, key, setStoreDraft, storeValue, debounceMs]);

  const updateState = (newValue: T | ((prev: T) => T)) => {
    setState((prev) => {
      const resolved =
        typeof newValue === "function" ? (newValue as (prev: T) => T)(prev) : newValue;
      return resolved;
    });
  };

  const clear = () => {
    clearStoreDraft(key);
    const resolvedInitial =
      typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    setState(resolvedInitial);
  };

  return [state, updateState, clear];
}
