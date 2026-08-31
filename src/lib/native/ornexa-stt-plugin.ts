/**
 * Capacitor bridge for OrnexaStt (Android SpeechRecognizer).
 * Web: unavailable — VoiceService falls back to Web Speech if present.
 */
import { registerPlugin } from "@capacitor/core";

type PluginListenerHandle = { remove: () => Promise<void> | void };

export interface OrnexaSttPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(options: { lang: string }): Promise<{ ok: boolean }>;
  stop(): Promise<void>;
  addListener(
    eventName: "sttEvent",
    listenerFunc: (event: {
      type: "partial" | "final" | "error" | "end";
      text?: string;
      message?: string;
    }) => void,
  ): Promise<PluginListenerHandle>;
}

export const OrnexaStt = registerPlugin<OrnexaSttPlugin>("OrnexaStt", {
  web: () => ({
    async isAvailable() {
      return { available: false };
    },
    async start() {
      return { ok: false };
    },
    async stop() {},
    async addListener() {
      return { remove: async () => undefined };
    },
  }),
});
