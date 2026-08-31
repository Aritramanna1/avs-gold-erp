/**
 * AVS Voice Service — device/local Web Speech STT + TTS.
 * No cloud speech vendors. Languages: en-IN, hi-IN, mr-IN, bn-IN.
 */

import { isNativeApp } from "@/lib/native/platform";

/** Capacitor 8 compatibility — listener handle shape. */
type PluginListenerHandle = { remove: () => Promise<void> | void };

export type VoiceLocaleCode = "en" | "hi" | "mr" | "bn";

export const VOICE_BCP47: Record<VoiceLocaleCode, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  bn: "bn-IN",
};

export interface VoiceServiceCallbacks {
  onTranscriptChange?: (text: string, isFinal: boolean) => void;
  onListeningStateChange?: (isListening: boolean) => void;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
  onPausedStateChange?: (isPaused: boolean) => void;
  onError?: (error: string) => void;
  onSupportChange?: (support: VoiceSupport) => void;
}

export interface VoiceSupport {
  stt: boolean;
  tts: boolean;
}

function resolveLocaleFromApp(): VoiceLocaleCode {
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

export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private isSpeaking = false;
  private isPaused = false;
  private speakerEnabled = true;
  private locale: VoiceLocaleCode = "en";
  private callbacks: VoiceServiceCallbacks = {};
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lifecycleBound = false;
  private visibilityHandler: (() => void) | null = null;
  private appStateHandle: { remove: () => Promise<void> | void } | null = null;
  private nativeStt = false;
  private nativeListener: PluginListenerHandle | null = null;

  constructor(callbacks: VoiceServiceCallbacks = {}) {
    this.callbacks = callbacks;
    this.locale = resolveLocaleFromApp();
    this.nativeStt = isNativeApp();
    this.initRecognition();
    this.bindLifecycle();
    void this.initNativeStt();
    this.callbacks.onSupportChange?.(this.getSupport());
  }

  public getSupport(): VoiceSupport {
    return {
      stt: this.isSttSupported(),
      tts: this.isTtsSupported(),
    };
  }

  public isSttSupported(): boolean {
    if (this.nativeStt) return true;
    return (
      typeof window !== "undefined" &&
      Boolean(
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
      )
    );
  }

  public isTtsSupported(): boolean {
    return typeof window !== "undefined" && Boolean(window.speechSynthesis);
  }

  /** @deprecated use isSttSupported */
  public isSupported(): boolean {
    return this.isSttSupported();
  }

  public setLocale(code: VoiceLocaleCode): void {
    this.locale = code;
    if (this.recognition) {
      this.recognition.lang = VOICE_BCP47[code];
    }
  }

  public getLocale(): VoiceLocaleCode {
    return this.locale;
  }

  public getBcp47(): string {
    return VOICE_BCP47[this.locale];
  }

  private initRecognition(): void {
    if (typeof window === "undefined") return;
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SR) return;

    try {
      this.recognition = new SR();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = VOICE_BCP47[this.locale];

      this.recognition.onstart = () => {
        this.stopSpeaking();
        this.isListening = true;
        this.callbacks.onListeningStateChange?.(true);
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const piece = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) finalTranscript += piece;
          else interimTranscript += piece;
        }
        const text = finalTranscript || interimTranscript;
        this.callbacks.onTranscriptChange?.(text, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.isListening = false;
        this.callbacks.onListeningStateChange?.(false);
        if (event.error !== "no-speech" && event.error !== "aborted") {
          this.callbacks.onError?.(
            event.error === "not-allowed"
              ? "Microphone permission denied. Enable mic in Android settings."
              : `Speech recognition error: ${event.error}`,
          );
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onListeningStateChange?.(false);
      };
    } catch {
      this.recognition = null;
    }
  }

  private bindLifecycle(): void {
    if (this.lifecycleBound || typeof window === "undefined") return;
    this.lifecycleBound = true;

    this.visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        this.handleAppBackground();
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        this.appStateHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) this.handleAppBackground();
        });
      } catch {
        /* web */
      }
    })();
  }

  public dispose(): void {
    this.stopListening();
    this.stopSpeaking();
    void this.nativeListener?.remove();
    this.nativeListener = null;
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    void this.appStateHandle?.remove();
    this.appStateHandle = null;
    this.lifecycleBound = false;
  }

  private handleAppBackground(): void {
    this.stopListening();
    this.pauseSpeaking();
  }

  private async initNativeStt(): Promise<void> {
    try {
      if (!isNativeApp()) return;
      const { OrnexaStt } = await import("@/lib/native/ornexa-stt-plugin");
      this.nativeStt = true;
      this.nativeListener = await OrnexaStt.addListener("sttEvent", (ev) => {
        if (ev.type === "partial") {
          this.callbacks.onTranscriptChange?.(ev.text ?? "", false);
        } else if (ev.type === "final") {
          this.callbacks.onTranscriptChange?.(ev.text ?? "", true);
        } else if (ev.type === "error" && ev.message) {
          this.callbacks.onError?.(ev.message);
        } else if (ev.type === "end") {
          this.isListening = false;
          this.callbacks.onListeningStateChange?.(false);
        }
      });
      this.callbacks.onSupportChange?.(this.getSupport());
    } catch {
      this.nativeStt = false;
      this.callbacks.onSupportChange?.(this.getSupport());
    }
  }

  public async startListening(): Promise<void> {
    this.stopSpeaking();
    try {
      const { assistantTts } = await import("./assistant-tts");
      await assistantTts.stop();
    } catch {
      /* ignore */
    }

    if (this.nativeStt) {
      if (this.isListening) {
        this.stopListening();
        return;
      }
      try {
        const { OrnexaStt } = await import("@/lib/native/ornexa-stt-plugin");
        this.isListening = true;
        this.callbacks.onListeningStateChange?.(true);
        await OrnexaStt.start({ lang: VOICE_BCP47[this.locale] });
      } catch (err) {
        this.isListening = false;
        this.callbacks.onListeningStateChange?.(false);
        const msg = err instanceof Error ? err.message : "Could not start voice input.";
        this.callbacks.onError?.(msg);
      }
      return;
    }

    if (!this.recognition) this.initRecognition();
    if (!this.recognition) {
      this.callbacks.onError?.("Voice input is not available on this device. Type instead.");
      return;
    }
    if (this.isListening) return;
    try {
      this.recognition.lang = VOICE_BCP47[this.locale];
      this.recognition.start();
    } catch (err) {
      console.warn("Could not start speech recognition", err);
      this.callbacks.onError?.("Could not start voice input. Try again or type.");
    }
  }

  public stopListening(): void {
    if (this.nativeStt) {
      this.isListening = false;
      this.callbacks.onListeningStateChange?.(false);
      void import("@/lib/native/ornexa-stt-plugin")
        .then(({ OrnexaStt }) => OrnexaStt.stop())
        .catch(() => undefined);
      return;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
      this.isListening = false;
      this.callbacks.onListeningStateChange?.(false);
    }
  }

  public toggleListening(): void {
    if (this.isListening) this.stopListening();
    else void this.startListening();
  }

  public setSpeakerEnabled(enabled: boolean): void {
    this.speakerEnabled = enabled;
    if (!enabled) this.stopSpeaking();
  }

  public getSpeakerEnabled(): boolean {
    return this.speakerEnabled;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public stopSpeaking(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.callbacks.onSpeakingStateChange?.(false);
    this.callbacks.onPausedStateChange?.(false);
  }

  public pauseSpeaking(): void {
    if (typeof window === "undefined" || !window.speechSynthesis || !this.isSpeaking) return;
    try {
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.callbacks.onPausedStateChange?.(true);
    } catch {
      this.stopSpeaking();
    }
  }

  public resumeSpeaking(): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.callbacks.onPausedStateChange?.(false);
    } catch {
      /* ignore */
    }
  }

  public speak(text: string, langOverride?: VoiceLocaleCode): void {
    if (!this.speakerEnabled || !this.isTtsSupported()) {
      if (!this.isTtsSupported()) {
        this.callbacks.onError?.("Read-aloud is not available on this device.");
      }
      return;
    }

    this.stopSpeaking();

    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_`]/g, "")
      .replace(/Rs\.\s*/g, "Rupees ")
      .slice(0, 500);

    if (!cleanText.trim()) return;

    const lang = VOICE_BCP47[langOverride ?? this.locale];

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = lang;

      // Prefer a matching installed voice when available
      const voices = window.speechSynthesis.getVoices?.() ?? [];
      const match =
        voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
        voices.find((v) => v.lang.toLowerCase().startsWith((langOverride ?? this.locale) + "-"));
      if (match) utterance.voice = match;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this.callbacks.onSpeakingStateChange?.(true);
        this.callbacks.onPausedStateChange?.(false);
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.callbacks.onSpeakingStateChange?.(false);
        this.callbacks.onPausedStateChange?.(false);
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.callbacks.onSpeakingStateChange?.(false);
        this.callbacks.onPausedStateChange?.(false);
      };

      this.currentUtterance = utterance;
      // Chrome often needs getVoices warmed
      if (voices.length === 0 && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          window.speechSynthesis.speak(utterance);
        };
        // Fallback if event never fires
        window.setTimeout(() => {
          if (this.currentUtterance === utterance && !this.isSpeaking) {
            window.speechSynthesis.speak(utterance);
          }
        }, 250);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      this.isSpeaking = false;
      this.callbacks.onSpeakingStateChange?.(false);
      this.callbacks.onError?.("Could not start read-aloud.");
    }
  }
}

/** Minimal DOM SpeechRecognition typings for TS (browsers vary). */
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
