/**
 * Capacitor bridge for OrnexaTts (Android TextToSpeech).
 * Web fallback implemented in assistant-tts.ts via speechSynthesis.
 */
import { registerPlugin } from "@capacitor/core";

/** Capacitor 8 no longer exports PluginListenerHandle — keep local shape. */
type PluginListenerHandle = { remove: () => Promise<void> | void };

export interface OrnexaTtsSpeakOptions {
  text: string;
  lang: string;
  utteranceId?: string;
}

export interface OrnexaTtsPlugin {
  speak(options: OrnexaTtsSpeakOptions): Promise<{ utteranceId: string; ok: boolean }>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  isLanguageAvailable(options: { lang: string }): Promise<{ available: boolean; reason?: string; code?: number }>;
  getVoices(): Promise<{ voices: Array<{ name: string; locale: string }> }>;
  openInstall(): Promise<void>;
  getStatus(): Promise<{
    ready: boolean;
    speaking: boolean;
    paused: boolean;
    utteranceId: string;
    offset: number;
  }>;
  addListener(
    eventName: "ttsEvent" | "onRangeStart",
    listenerFunc: (event: Record<string, unknown>) => void,
  ): Promise<PluginListenerHandle>;
}

export const OrnexaTts = registerPlugin<OrnexaTtsPlugin>("OrnexaTts", {
  web: () => ({
    async speak() {
      throw new Error("Use web SpeechSynthesis path");
    },
    async pause() {},
    async resume() {},
    async stop() {},
    async isLanguageAvailable() {
      return { available: false, reason: "web" };
    },
    async getVoices() {
      return { voices: [] };
    },
    async openInstall() {},
    async getStatus() {
      return { ready: false, speaking: false, paused: false, utteranceId: "", offset: 0 };
    },
    async addListener() {
      return { remove: async () => undefined };
    },
  }),
});
