/**
 * Qwen3-TTS runtime (primary).
 * Native/WebGPU inference links when an approved pack is installed.
 * Until then: probe-only — Assistant falls back to device TTS with explicit status.
 */

import { isNativeApp } from "@/lib/native/platform";
import { PRIMARY_TTS_VARIANT_ID, type TtsVariantId } from "./catalog";
import {
  registerTtsRuntime,
  type OrnexaTtsRuntime,
  type TtsSynthesizeRequest,
  type TtsSynthesizeStream,
} from "./runtime";

type BoundVoice = {
  id: string;
  refAudioPath?: string;
  refTranscript?: string;
  speakerEmbeddingPath?: string;
  authorizedAt?: string | null;
};

class Qwen3TtsRuntime implements OrnexaTtsRuntime {
  readonly engineId = "qwen3-tts";
  readonly variantId: TtsVariantId = PRIMARY_TTS_VARIANT_ID;
  private loadedVariant: TtsVariantId | null = null;
  private weightsPath: string | null = null;
  private voice: BoundVoice | null = null;
  private nativeEngine = false;

  isReady(): boolean {
    return Boolean(this.loadedVariant && this.nativeEngine && this.voice?.authorizedAt);
  }

  async probe(): Promise<{ available: boolean; detail: string; ramMb?: number }> {
    if (isNativeApp()) {
      try {
        const { OrnexaQwen3Tts } = await import("@/lib/native/ornexa-qwen3-tts-plugin");
        const cap = await OrnexaQwen3Tts.getCapabilities();
        this.nativeEngine = Boolean(cap.engineAvailable);
        return {
          available: this.nativeEngine,
          detail: cap.message,
          ramMb: cap.ramMb,
        };
      } catch {
        return {
          available: false,
          detail: "OrnexaQwen3Tts plugin unavailable. Device TTS remains the fallback.",
        };
      }
    }
    return {
      available: false,
      detail:
        "Web: Qwen3-TTS WebGPU pack not linked. Hostinger serves SPA only — no paid TTS server. Device/browser speech is fallback until an on-device pack is approved.",
    };
  }

  async load(options: {
    weightsPath?: string;
    variantId: TtsVariantId;
  }): Promise<{ ok: boolean; error?: string }> {
    if (isNativeApp()) {
      try {
        const { OrnexaQwen3Tts } = await import("@/lib/native/ornexa-qwen3-tts-plugin");
        const res = await OrnexaQwen3Tts.loadModel({
          path: options.weightsPath ?? "",
          modelId: options.variantId,
        });
        if (!res.ok) {
          this.loadedVariant = null;
          this.nativeEngine = false;
          return { ok: false, error: res.error };
        }
        this.loadedVariant = options.variantId;
        this.weightsPath = options.weightsPath ?? null;
        this.nativeEngine = true;
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Native Qwen3-TTS load failed",
        };
      }
    }
    this.loadedVariant = null;
    this.nativeEngine = false;
    return {
      ok: false,
      error:
        "Qwen3-TTS weights are not loaded in this browser build. Download an approved pack after device benchmark.",
    };
  }

  async unload(): Promise<void> {
    this.loadedVariant = null;
    this.weightsPath = null;
    this.nativeEngine = false;
    if (isNativeApp()) {
      try {
        const { OrnexaQwen3Tts } = await import("@/lib/native/ornexa-qwen3-tts-plugin");
        await OrnexaQwen3Tts.unloadModel();
      } catch {
        /* ignore */
      }
    }
  }

  async bindVoiceProfile(profile: BoundVoice): Promise<{ ok: boolean; error?: string }> {
    if (!profile.authorizedAt) {
      return {
        ok: false,
        error: "Voice clone refused: missing administrator authorization attestation.",
      };
    }
    if (!profile.refAudioPath && !profile.speakerEmbeddingPath) {
      return {
        ok: false,
        error: "Voice profile needs a private reference recording or speaker embedding.",
      };
    }
    this.voice = profile;
    if (isNativeApp() && this.nativeEngine) {
      try {
        const { OrnexaQwen3Tts } = await import("@/lib/native/ornexa-qwen3-tts-plugin");
        await OrnexaQwen3Tts.bindVoice({
          profileId: profile.id,
          refAudioPath: profile.refAudioPath,
          refTranscript: profile.refTranscript,
          speakerEmbeddingPath: profile.speakerEmbeddingPath,
        });
      } catch {
        /* bind deferred until native engine ships */
      }
    }
    return { ok: true };
  }

  async synthesizeStream(req: TtsSynthesizeRequest): Promise<TtsSynthesizeStream | null> {
    if (!this.isReady() || !this.voice) return null;
    if (req.voiceProfileId !== this.voice.id) return null;

    if (isNativeApp()) {
      try {
        const { OrnexaQwen3Tts } = await import("@/lib/native/ornexa-qwen3-tts-plugin");
        const start = await OrnexaQwen3Tts.synthesize({
          text: req.text,
          language: req.language,
          speakingRate: req.speakingRate,
          emotion: req.emotion ?? "clear",
          voiceProfileId: req.voiceProfileId,
          utteranceId: req.utteranceId,
        });
        if (!start.ok) return null;
        return {
          utteranceId: req.utteranceId,
          chunks: nativePcmChunkIterator(req.utteranceId),
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function* nativePcmChunkIterator(utteranceId: string): AsyncIterableIterator<import("./streaming-player").PcmChunk> {
  const { OrnexaQwen3Tts } = await import("@/lib/native/ornexa-qwen3-tts-plugin");
  // Pull chunks until native signals end (plugin returns empty when done).
  for (;;) {
    const chunk = await OrnexaQwen3Tts.pullChunk({ utteranceId });
    if (!chunk || chunk.done || !chunk.pcmBase64) break;
    const raw = Uint8Array.from(atob(chunk.pcmBase64), (c) => c.charCodeAt(0));
    const samples = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
    yield { samples, sampleRate: chunk.sampleRate ?? 24000 };
    if (chunk.done) break;
  }
}

let registered = false;

export function ensureQwen3TtsRuntimeRegistered(): void {
  if (registered) return;
  registerTtsRuntime(new Qwen3TtsRuntime());
  registered = true;
}

export function createQwen3TtsRuntimeForTests(): OrnexaTtsRuntime {
  return new Qwen3TtsRuntime();
}
