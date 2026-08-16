import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveStagedPhase,
  STAGED_LOAD_THRESHOLDS_MS,
  type StagedLoadPhase,
} from "@/lib/performance/resilient-async";

export interface UseStagedLoadOptions {
  /** When true, timers run and phase advances. */
  active: boolean;
  /** External failure (e.g. fetch rejected). */
  failed?: boolean;
  /** External success — stops timers. */
  done?: boolean;
}

export interface StagedLoadState {
  phase: StagedLoadPhase;
  elapsedMs: number;
  retryCount: number;
  bumpRetry: () => void;
  reset: () => void;
}

export function useStagedLoad({
  active,
  failed = false,
  done = false,
}: UseStagedLoadOptions): StagedLoadState {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const startedAt = useRef<number | null>(null);

  const reset = useCallback(() => {
    startedAt.current = active ? Date.now() : null;
    setElapsedMs(0);
    setRetryCount(0);
  }, [active]);

  useEffect(() => {
    if (!active || done) {
      startedAt.current = null;
      return;
    }
    if (startedAt.current === null) startedAt.current = Date.now();
    const tick = () => {
      if (startedAt.current === null) return;
      setElapsedMs(Date.now() - startedAt.current);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [active, done, retryCount]);

  const phase = !active ? "idle" : resolveStagedPhase(elapsedMs, failed, done);

  const bumpRetry = useCallback(() => {
    setRetryCount((n) => n + 1);
    startedAt.current = Date.now();
    setElapsedMs(0);
  }, []);

  return { phase, elapsedMs, retryCount, bumpRetry, reset };
}

export { STAGED_LOAD_THRESHOLDS_MS };
