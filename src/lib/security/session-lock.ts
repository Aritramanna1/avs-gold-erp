/**
 * Secure Session Lock / Automatic Logout (Plan 1 Step 8).
 *
 * Tracks user activity (mouse, keyboard, touch) and locks the app after a
 * configurable idle period WITHOUT ending the Supabase session — this is a
 * local screen lock (re-enter your password to resume), not a sign-out. A
 * locked session still allows background sync/comm-queue draining to
 * continue; only the UI is gated behind the re-auth check. Unlocking
 * verifies the password against Supabase (supabase.auth.signInWithPassword
 * with the already-known email) rather than trusting anything client-side.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

interface SessionLockState {
  locked: boolean;
  idleTimeoutMs: number;
  lockedAt: string | null;
  lastActivityAt: number;
  setIdleTimeout: (ms: number) => void;
  lockNow: () => void;
  recordActivity: () => void;
  /** Verifies `password` against the current session's email and unlocks on success. Never trusts a client-side check alone. */
  unlock: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
}

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const useSessionLock = create<SessionLockState>()((set, get) => ({
  locked: false,
  idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  lockedAt: null,
  lastActivityAt: Date.now(),

  setIdleTimeout: (ms) => set({ idleTimeoutMs: ms }),

  lockNow: () => {
    if (get().locked) return;
    set({ locked: true, lockedAt: new Date().toISOString() });
  },

  recordActivity: () => set({ lastActivityAt: Date.now() }),

  unlock: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    set({ locked: false, lockedAt: null, lastActivityAt: Date.now() });
    return { ok: true };
  },
}));

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "mousedown",
  "touchstart",
];
let idleCheckHandle: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;

/**
 * Starts idle-tracking. Call once at app startup (see __root.tsx). Safe to
 * call multiple times — attaches listeners/interval only once per session.
 */
export function startSessionLockMonitor(): () => void {
  if (typeof window === "undefined" || listenersAttached) return () => {};
  listenersAttached = true;

  const onActivity = () => {
    if (!useSessionLock.getState().locked) useSessionLock.getState().recordActivity();
  };
  ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

  idleCheckHandle = setInterval(() => {
    const { locked, lastActivityAt, idleTimeoutMs, lockNow } = useSessionLock.getState();
    if (!locked && Date.now() - lastActivityAt >= idleTimeoutMs) {
      lockNow();
    }
  }, 5_000);

  return () => {
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
    if (idleCheckHandle) clearInterval(idleCheckHandle);
    idleCheckHandle = null;
    listenersAttached = false;
  };
}
