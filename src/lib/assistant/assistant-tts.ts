/**
 * AVS Assistant Read Aloud — device-local TTS singleton.
 * Prefers firm AVS ERP custom voice (Qwen3-TTS) when engine + profile are ready.
 * Explicit fallback: Native OrnexaTts / web speechSynthesis.
 * No paid cloud TTS (ElevenLabs / OpenAI / Google / Azure).
 */

import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/native/platform";
import { OrnexaTts } from "@/lib/native/ornexa-tts-plugin";
import { VOICE_BCP47, type VoiceLocaleCode } from "@/lib/assistant/voice-service";
import { applyJewelleryPronunciation } from "@/lib/assistant/tts/pronunciation-lexicon";
import {
  pauseOrnexaVoicePlayback,
  resumeOrnexaVoicePlayback,
  speakWithOrnexaVoice,
  stopOrnexaVoicePlayback,
} from "@/lib/assistant/tts/speak";
import { ensureQwen3TtsRuntimeRegistered } from "@/lib/assistant/tts/qwen3-tts-runtime";

const AUTO_READ_KEY = "ornexa.assistant.autoReadAloud.v1";
const RATE_KEY = "ornexa.assistant.ttsRate.v1";

export type TtsSessionState = "idle" | "speaking" | "paused" | "setup_required";
export type TtsEngineUsed = "ornexa_qwen3" | "device" | "none";

export interface AssistantTtsSession {
  messageId: string | null;
  text: string;
  lang: VoiceLocaleCode;
  state: TtsSessionState;
  setupLang: string | null;
  error: string | null;
  engine: TtsEngineUsed;
  speakingRate: number;
}

type Listener = (session: AssistantTtsSession) => void;

const INITIAL: AssistantTtsSession = {
  messageId: null,
  text: "",
  lang: "en",
  state: "idle",
  setupLang: null,
  error: null,
  engine: "none",
  speakingRate: 1,
};

function resolveAppLocale(): VoiceLocaleCode {
  try {
    const raw =
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem("mtj-app-language")) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("mtj-app-language")) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("i18nextLng")) ||
      (typeof navigator !== "undefined" ? navigator.language : "en") ||
      "en";
    const base = raw.toLowerCase().slice(0, 2);
    if (base === "hi" || base === "mr" || base === "bn") return base;
  } catch {
    /* ignore */
  }
  return "en";
}

/** Detect reply language from script + app locale (for Devanagari hi vs mr). */
export function detectReplyLanguage(text: string): VoiceLocaleCode {
  const t = text || "";
  if (/[\u0980-\u09FF]/.test(t)) return "bn"; // Bengali
  if (/[\u0900-\u097F]/.test(t)) {
    // Devanagari — Marathi markers vs Hindi; fall back to UI locale
    if (/\u0933|\u0915\u094D\u0937|(आहे|करा|सोनं|कारागीर)/.test(t)) return "mr";
    const ui = resolveAppLocale();
    return ui === "mr" ? "mr" : "hi";
  }
  // Roman / Latin — use UI locale if Indic, else English
  const lower = t.toLowerCase();
  if (/\b(karigar|sona|hisab|kharcha|bhav)\b/.test(lower) && resolveAppLocale() !== "en") {
    return resolveAppLocale();
  }
  return "en";
}

function cleanForSpeech(text: string): string {
  const base = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
  return applyJewelleryPronunciation(base);
}

class AssistantTtsController {
  private session: AssistantTtsSession = { ...INITIAL };
  private listeners = new Set<Listener>();
  private autoRead = false;
  private nativeListener: { remove: () => Promise<void> | void } | null = null;
  private webUtterance: SpeechSynthesisUtterance | null = null;
  private lastFullText = "";
  private lastLang: VoiceLocaleCode = "en";
  private lastMessageId: string | null = null;
  private webPauseOffset = 0;
  private disposed = false;
  private speakingRate = 1;
  private usingOrnexaEngine = false;

  async init(): Promise<void> {
    if (this.disposed) return;
    this.autoRead = await this.loadAutoReadPref();
    this.speakingRate = await this.loadRatePref();
    this.patch({ speakingRate: this.speakingRate });
    ensureQwen3TtsRuntimeRegistered();
    if (isNativeApp()) {
      try {
        this.nativeListener = await OrnexaTts.addListener("ttsEvent", (ev) => {
          const type = String(ev.type ?? "");
          const utteranceId = String(ev.utteranceId ?? "");
          if (type === "setup_required") {
            this.patch({
              state: "setup_required",
              setupLang: String(ev.lang ?? this.session.lang),
              error: "Speech voice needs to be installed",
            });
            return;
          }
          if (utteranceId && this.session.messageId && utteranceId !== this.session.messageId) {
            return;
          }
          if (type === "start") this.patch({ state: "speaking", error: null, setupLang: null });
          if (type === "paused") this.patch({ state: "paused" });
          if (type === "end") {
            this.patch({ state: "idle", messageId: this.session.messageId });
          }
          if (type === "error") {
            this.patch({
              state: "setup_required",
              error: "Speech voice needs to be installed",
              setupLang: VOICE_BCP47[this.session.lang],
            });
          }
        });
      } catch {
        /* plugin missing in web preview */
      }
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.getSession());
    return () => this.listeners.delete(fn);
  }

  getSession(): AssistantTtsSession {
    return { ...this.session };
  }

  getAutoReadEnabled(): boolean {
    return this.autoRead;
  }

  async setAutoReadEnabled(enabled: boolean): Promise<void> {
    this.autoRead = enabled;
    try {
      if (isNativeApp()) {
        await Preferences.set({ key: AUTO_READ_KEY, value: enabled ? "1" : "0" });
      } else if (typeof localStorage !== "undefined") {
        localStorage.setItem(AUTO_READ_KEY, enabled ? "1" : "0");
      }
    } catch {
      /* ignore */
    }
    this.emit();
  }

  getSpeakingRate(): number {
    return this.speakingRate;
  }

  async setSpeakingRate(rate: number): Promise<void> {
    this.speakingRate = Math.min(1.35, Math.max(0.75, rate));
    this.patch({ speakingRate: this.speakingRate });
    try {
      if (isNativeApp()) {
        await Preferences.set({ key: RATE_KEY, value: String(this.speakingRate) });
      } else if (typeof localStorage !== "undefined") {
        localStorage.setItem(RATE_KEY, String(this.speakingRate));
      }
    } catch {
      /* ignore */
    }
  }

  private async loadRatePref(): Promise<number> {
    try {
      if (isNativeApp()) {
        const { value } = await Preferences.get({ key: RATE_KEY });
        const n = value ? Number(value) : 1;
        return Number.isFinite(n) ? Math.min(1.35, Math.max(0.75, n)) : 1;
      }
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(RATE_KEY) : null;
      const n = raw ? Number(raw) : 1;
      return Number.isFinite(n) ? Math.min(1.35, Math.max(0.75, n)) : 1;
    } catch {
      return 1;
    }
  }

  private async loadAutoReadPref(): Promise<boolean> {
    try {
      if (isNativeApp()) {
        const { value } = await Preferences.get({ key: AUTO_READ_KEY });
        return value === "1";
      }
      return typeof localStorage !== "undefined" && localStorage.getItem(AUTO_READ_KEY) === "1";
    } catch {
      return false;
    }
  }

  private patch(partial: Partial<AssistantTtsSession>): void {
    this.session = { ...this.session, ...partial };
    this.emit();
  }

  private emit(): void {
    const snap = this.getSession();
    this.listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch {
        /* ignore listener errors */
      }
    });
  }

  async ensureLanguageAvailable(lang: VoiceLocaleCode): Promise<boolean> {
    const bcp = VOICE_BCP47[lang];
    if (isNativeApp()) {
      try {
        const r = await OrnexaTts.isLanguageAvailable({ lang: bcp });
        return r.available;
      } catch {
        return false;
      }
    }
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    if (voices.length === 0) {
      // Voices may load async — allow attempt; speak will fail soft
      return true;
    }
    const tag = bcp.toLowerCase();
    const prefix = lang + "-";
    return voices.some(
      (v) => v.lang.toLowerCase() === tag || v.lang.toLowerCase().startsWith(prefix),
    );
  }

  /**
   * Manual Read Aloud — always allowed regardless of auto-read preference.
   * Prefers AVS ERP Qwen3-TTS custom voice when engine + authorized profile are ready.
   */
  async readAloud(messageId: string, text: string, langOverride?: VoiceLocaleCode): Promise<void> {
    const cleaned = cleanForSpeech(text);
    if (!cleaned) return;

    const lang = langOverride ?? detectReplyLanguage(cleaned);
    await this.stopInternal(false);

    this.lastMessageId = messageId;
    this.lastFullText = cleaned;
    this.lastLang = lang;
    this.webPauseOffset = 0;
    this.usingOrnexaEngine = false;

    const ornexa = await speakWithOrnexaVoice({
      text: cleaned,
      language: VOICE_BCP47[lang],
      utteranceId: messageId,
      speakingRate: this.speakingRate,
      onState: (s) => {
        if (s === "playing") this.patch({ state: "speaking", engine: "ornexa_qwen3", error: null });
        if (s === "paused") this.patch({ state: "paused", engine: "ornexa_qwen3" });
        if (s === "ended" || s === "idle") this.patch({ state: "idle" });
      },
    });

    if (ornexa.usedOrnexaVoice) {
      this.usingOrnexaEngine = true;
      this.patch({
        messageId,
        text: cleaned,
        lang,
        state: "speaking",
        setupLang: null,
        error: null,
        engine: "ornexa_qwen3",
        speakingRate: this.speakingRate,
      });
      return;
    }

    const available = await this.ensureLanguageAvailable(lang);
    if (!available) {
      this.patch({
        messageId,
        text: cleaned,
        lang,
        state: "setup_required",
        setupLang: VOICE_BCP47[lang],
        error: "Speech voice needs to be installed",
        engine: "none",
      });
      return;
    }

    this.patch({
      messageId,
      text: cleaned,
      lang,
      state: "speaking",
      setupLang: null,
      error: null,
      engine: "device",
      speakingRate: this.speakingRate,
    });

    if (isNativeApp()) {
      try {
        await OrnexaTts.speak({
          text: cleaned,
          lang: VOICE_BCP47[lang],
          utteranceId: messageId,
        });
      } catch (e) {
        this.patch({
          state: "setup_required",
          error: e instanceof Error ? e.message : "Speech voice needs to be installed",
          setupLang: VOICE_BCP47[lang],
          engine: "none",
        });
      }
      return;
    }

    this.speakWeb(cleaned, lang, messageId, 0);
  }

  /** Auto-read after a new reply — only when preference is ON. */
  async maybeAutoRead(messageId: string, text: string): Promise<void> {
    if (!this.autoRead) return;
    void this.readAloud(messageId, text);
  }

  async pause(): Promise<void> {
    if (this.session.state !== "speaking") return;
    if (this.usingOrnexaEngine) {
      await pauseOrnexaVoicePlayback();
      this.patch({ state: "paused" });
      return;
    }
    if (isNativeApp()) {
      try {
        await OrnexaTts.pause();
      } catch {
        /* ignore */
      }
      this.patch({ state: "paused" });
      return;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
      this.patch({ state: "paused" });
    }
  }

  async resume(): Promise<void> {
    if (this.session.state !== "paused") return;
    if (this.usingOrnexaEngine) {
      await resumeOrnexaVoicePlayback();
      this.patch({ state: "speaking" });
      return;
    }
    if (isNativeApp()) {
      try {
        await OrnexaTts.resume();
      } catch {
        /* ignore */
      }
      this.patch({ state: "speaking" });
      return;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else if (this.lastFullText) {
        this.speakWeb(this.lastFullText, this.lastLang, this.lastMessageId ?? "resume", this.webPauseOffset);
      }
      this.patch({ state: "speaking" });
    }
  }

  async stop(): Promise<void> {
    await this.stopInternal(true);
  }

  async replay(): Promise<void> {
    if (!this.lastMessageId || !this.lastFullText) return;
    await this.readAloud(this.lastMessageId, this.lastFullText, this.lastLang);
  }

  async openInstall(): Promise<void> {
    if (isNativeApp()) {
      try {
        await OrnexaTts.openInstall();
      } catch {
        /* ignore */
      }
    }
  }

  /** Pause/stop for background — keep paused state so user can resume. */
  async onAppBackground(): Promise<void> {
    if (this.session.state === "speaking") {
      await this.pause();
    }
  }

  async dispose(): Promise<void> {
    await this.stopInternal(true);
    if (this.nativeListener) {
      await this.nativeListener.remove();
      this.nativeListener = null;
    }
    this.listeners.clear();
    this.disposed = true;
  }

  private async stopInternal(clearSession: boolean): Promise<void> {
    if (this.usingOrnexaEngine) {
      await stopOrnexaVoicePlayback();
      this.usingOrnexaEngine = false;
    }
    if (isNativeApp()) {
      try {
        await OrnexaTts.stop();
      } catch {
        /* ignore */
      }
    } else if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.webUtterance = null;
    }
    if (clearSession) {
      this.patch({ ...INITIAL, speakingRate: this.speakingRate });
    } else {
      this.patch({ state: "idle", error: null, setupLang: null, engine: "none" });
    }
  }

  private speakWeb(text: string, lang: VoiceLocaleCode, messageId: string, fromOffset: number): void {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this.patch({
        state: "setup_required",
        error: "Speech voice needs to be installed",
        setupLang: VOICE_BCP47[lang],
        engine: "none",
      });
      return;
    }
    window.speechSynthesis.cancel();
    const slice = fromOffset > 0 && fromOffset < text.length ? text.slice(fromOffset) : text;
    const utterance = new SpeechSynthesisUtterance(slice);
    utterance.lang = VOICE_BCP47[lang];
    utterance.rate = this.speakingRate;
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const match =
      voices.find((v) => v.lang.toLowerCase() === VOICE_BCP47[lang].toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(lang + "-"));
    if (match) utterance.voice = match;

    utterance.onstart = () =>
      this.patch({ state: "speaking", messageId, error: null, engine: "device" });
    utterance.onend = () => {
      this.webPauseOffset = 0;
      this.patch({ state: "idle" });
    };
    utterance.onerror = () => {
      this.patch({
        state: "setup_required",
        error: "Speech voice needs to be installed",
        setupLang: VOICE_BCP47[lang],
        engine: "none",
      });
    };
    utterance.onboundary = (ev) => {
      if (typeof ev.charIndex === "number") {
        this.webPauseOffset = fromOffset + ev.charIndex;
      }
    };
    this.webUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
}

export const assistantTts = new AssistantTtsController();

/** Call once after native shell / app boot. */
export async function initAssistantTts(): Promise<void> {
  await assistantTts.init();
}
