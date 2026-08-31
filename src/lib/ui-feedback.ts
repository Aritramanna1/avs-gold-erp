/**
 * Workstation sound-feedback events.
 *
 * Play only after a confirmed backend write, or when an operation actually
 * fails. Never bind to raw button taps. Same API on web, tablet, and native.
 */
import { isSoundEffectsEnabled } from "@/lib/ui-sound-preference-store";
import {
  playFeedbackSound,
  type FeedbackTone,
} from "@/lib/native/feedback-sounds";

export type UiFeedbackEvent =
  | "save"
  | "payment"
  | "invoice"
  | "gold"
  | "manufacturing"
  | "sync"
  | "scan"
  | "error"
  | "warning";

const EVENT_TONE: Record<UiFeedbackEvent, FeedbackTone> = {
  save: "success",
  payment: "success",
  invoice: "complete",
  gold: "success",
  manufacturing: "complete",
  sync: "success",
  scan: "validate",
  error: "error",
  warning: "warning",
};

const PRIORITY: Record<UiFeedbackEvent, number> = {
  error: 90,
  warning: 80,
  manufacturing: 70,
  invoice: 65,
  payment: 60,
  gold: 50,
  save: 40,
  scan: 35,
  sync: 20,
};

const IMMEDIATE = new Set<UiFeedbackEvent>(["scan", "error", "warning"]);

const COALESCE_MS = 120;
const MIN_GAP_MS = 450;

let lastPlayedAt = 0;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
let pending: UiFeedbackEvent | null = null;

function canPlayNow(): boolean {
  if (!isSoundEffectsEnabled()) return false;
  if (typeof document !== "undefined" && document.hidden) return false;
  return Date.now() - lastPlayedAt >= MIN_GAP_MS;
}

function playNow(event: UiFeedbackEvent): void {
  if (!canPlayNow() && !IMMEDIATE.has(event)) return;
  if (!isSoundEffectsEnabled()) return;
  if (typeof document !== "undefined" && document.hidden) return;
  lastPlayedAt = Date.now();
  void playFeedbackSound(EVENT_TONE[event]);
}

/**
 * Emit a workstation sound for a confirmed operation.
 * Rapid gold+payment+invoice posts in one flow collapse to the highest-priority event.
 */
export function emitUiFeedback(event: UiFeedbackEvent): void {
  if (!isSoundEffectsEnabled()) return;
  if (typeof document !== "undefined" && document.hidden) return;

  if (IMMEDIATE.has(event)) {
    if (coalesceTimer) {
      clearTimeout(coalesceTimer);
      coalesceTimer = null;
      pending = null;
    }
    playNow(event);
    return;
  }

  if (!pending || PRIORITY[event] >= PRIORITY[pending]) {
    pending = event;
  }
  if (coalesceTimer) return;
  coalesceTimer = setTimeout(() => {
    const next = pending;
    pending = null;
    coalesceTimer = null;
    if (next) playNow(next);
  }, COALESCE_MS);
}

/** Test helper — not for product code. */
export function resetUiFeedbackForTests(): void {
  lastPlayedAt = 0;
  pending = null;
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
}

export function installUiFeedback(): void {
  if (typeof window === "undefined") return;

  const unlock = () => {
    void import("@/lib/native/feedback-sounds").then((m) => m.unlockFeedbackAudio());
  };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });

  void import("sonner").then(({ toast }) => {
    const originalError = toast.error.bind(toast);
    toast.error = ((message, data) => {
      emitUiFeedback("error");
      return originalError(message, data);
    }) as typeof toast.error;
  });
}
