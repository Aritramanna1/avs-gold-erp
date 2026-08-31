/**
 * Capacitor OrnexaQwen3Tts — on-device Qwen3-TTS bridge.
 * Probe-only until native ONNX/runtime + approved weights are linked.
 * Never stores Meta/cloud TTS keys. Never uses paid voice APIs.
 */
import { registerPlugin } from "@capacitor/core";

export interface Qwen3TtsCapabilities {
  ramMb: number;
  availRamMb: number;
  abi: string;
  engineAvailable: boolean;
  family: string;
  message: string;
}

export interface OrnexaQwen3TtsPlugin {
  getCapabilities(): Promise<Qwen3TtsCapabilities>;
  loadModel(options: { path: string; modelId: string }): Promise<{ ok: boolean; error?: string }>;
  unloadModel(): Promise<void>;
  bindVoice(options: {
    profileId: string;
    refAudioPath?: string;
    refTranscript?: string;
    speakerEmbeddingPath?: string;
  }): Promise<{ ok: boolean; error?: string }>;
  synthesize(options: {
    text: string;
    language: string;
    speakingRate: number;
    emotion: string;
    voiceProfileId: string;
    utteranceId: string;
  }): Promise<{ ok: boolean; error?: string }>;
  pullChunk(options: {
    utteranceId: string;
  }): Promise<{ pcmBase64?: string; sampleRate?: number; done?: boolean }>;
  runMicroBenchmark?(options: {
    phrases: string[];
  }): Promise<{ firstAudioLatencyMs?: number; streamingLatencyMs?: number }>;
}

export const OrnexaQwen3Tts = registerPlugin<OrnexaQwen3TtsPlugin>("OrnexaQwen3Tts", {
  web: () => ({
    async getCapabilities() {
      return {
        ramMb: 0,
        availRamMb: 0,
        abi: "web",
        engineAvailable: false,
        family: "qwen3-tts",
        message:
          "Web build: Qwen3-TTS native engine not linked. No paid TTS server on Hostinger SPA.",
      };
    },
    async loadModel() {
      return {
        ok: false,
        error: "Qwen3-TTS pack not available in browser until approved WebGPU export ships.",
      };
    },
    async unloadModel() {},
    async bindVoice() {
      return { ok: false, error: "Native engine required for AVS voice bind." };
    },
    async synthesize() {
      return { ok: false, error: "Native engine required." };
    },
    async pullChunk() {
      return { done: true };
    },
    async runMicroBenchmark() {
      return {};
    },
  }),
});
