/**
 * Completion feedback — short Web Audio chimes (no bundled samples).
 * Browsers block audio until a user gesture: call unlockFeedbackAudio() on first tap.
 * iOS/Android silent switch and OS mute are respected (we never force-unmute).
 */
import { hapticError, hapticSuccess } from "@/lib/native/haptics";
import { isSoundEffectsEnabled } from "@/lib/ui-sound-preference-store";

export type FeedbackTone = "validate" | "success" | "complete" | "error" | "warning";

let audioCtx: AudioContext | null = null;
let voicesReady = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Call on first user tap so later confirmed operations can play. */
export async function unlockFeedbackAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* silent mode / autoplay policy */
    }
  }
  primeSpeechVoices();
}

function primeSpeechVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const load = () => {
    voicesReady = window.speechSynthesis.getVoices().length > 0;
  };
  load();
  window.speechSynthesis.onvoiceschanged = load;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  durationSec: number,
  opts?: { peakGain?: number; type?: OscillatorType; detune?: number },
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts?.type ?? "sine";
  osc.frequency.setValueAtTime(frequency, startAt);
  if (opts?.detune) osc.detune.setValueAtTime(opts.detune, startAt);
  const peak = opts?.peakGain ?? 0.045;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

/** Subtle professional chimes — short, low gain, not generic beeps. */
export async function playFeedbackSound(tone: FeedbackTone): Promise<void> {
  if (!isSoundEffectsEnabled()) return;
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (ctx.state !== "running") return;
    const t = ctx.currentTime;

    if (tone === "validate") {
      playTone(ctx, 880, t, 0.07, { peakGain: 0.04, type: "sine" });
      playTone(ctx, 1174.66, t + 0.055, 0.1, { peakGain: 0.045, type: "triangle" });
      return;
    }

    if (tone === "warning") {
      playTone(ctx, 392, t, 0.12, { peakGain: 0.035, type: "sine" });
      return;
    }

    if (tone === "error") {
      playTone(ctx, 246.94, t, 0.14, { peakGain: 0.038, type: "sine" });
      playTone(ctx, 196, t + 0.1, 0.16, { peakGain: 0.032, type: "triangle" });
      return;
    }

    if (tone === "complete") {
      playTone(ctx, 523.25, t, 0.1, { peakGain: 0.04, type: "sine" });
      playTone(ctx, 659.25, t + 0.07, 0.11, { peakGain: 0.042, type: "triangle" });
      playTone(ctx, 783.99, t + 0.14, 0.16, { peakGain: 0.04, type: "sine" });
      return;
    }

    playTone(ctx, 523.25, t, 0.09, { peakGain: 0.038, type: "sine" });
    playTone(ctx, 659.25, t + 0.065, 0.12, { peakGain: 0.04, type: "triangle" });
  } catch {
    /* optional UX — never block the operation */
  }
}

function speakBrief(message: string): void {
  if (!isSoundEffectsEnabled()) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const speak = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.98;
      utterance.pitch = 1.05;
      utterance.volume = 0.7;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang.startsWith("en") && /google|natural|premium|samantha/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith("en-IN")) ??
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;
      window.speechSynthesis.speak(utterance);
    };
    if (!voicesReady && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voicesReady = true;
        speak();
      };
      return;
    }
    speak();
  } catch {
    /* optional */
  }
}

export async function feedbackInviteValidated(): Promise<void> {
  await unlockFeedbackAudio();
  await playFeedbackSound("validate");
}

export async function celebrateCompletion(opts?: {
  voiceMessage?: string;
  sound?: FeedbackTone;
}): Promise<void> {
  await unlockFeedbackAudio();
  await hapticSuccess();
  await playFeedbackSound(opts?.sound ?? "complete");
  if (opts?.voiceMessage && isSoundEffectsEnabled()) {
    window.setTimeout(() => speakBrief(opts.voiceMessage!), 180);
  }
}

export async function feedbackFailure(): Promise<void> {
  await unlockFeedbackAudio();
  await hapticError();
  await playFeedbackSound("error");
}
