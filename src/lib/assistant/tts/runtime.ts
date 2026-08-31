/**
 * Replaceable AVS ERP TTS runtime — Qwen3-TTS primary, alternatives pluggable.
 * Weights are never bundled; engine reports ready only after load + voice profile.
 */

import type { TtsVariantId } from "./catalog";
import type { PcmChunk } from "./streaming-player";

export type TtsEmotion = "clear" | "calm" | "warm" | "urgent" | "neutral";

export interface TtsSynthesizeRequest {
  text: string;
  language: string;
  speakingRate: number;
  emotion?: TtsEmotion;
  /** Firm voice profile id (speaker embedding / ref path resolved by runtime) */
  voiceProfileId: string;
  utteranceId: string;
}

export interface TtsSynthesizeStream {
  utteranceId: string;
  /** Async iterator of PCM chunks for StreamingAudioPlayer */
  chunks: AsyncIterable<PcmChunk>;
}

export interface OrnexaTtsRuntime {
  readonly engineId: string;
  readonly variantId: TtsVariantId;
  isReady(): boolean;
  probe(): Promise<{ available: boolean; detail: string; ramMb?: number }>;
  load(options: {
    weightsPath?: string;
    variantId: TtsVariantId;
  }): Promise<{ ok: boolean; error?: string }>;
  unload(): Promise<void>;
  /**
   * Bind an authorized firm voice profile (ref audio / embedding on device).
   * Refuses when consent metadata is missing.
   */
  bindVoiceProfile(profile: {
    id: string;
    refAudioPath?: string;
    refTranscript?: string;
    speakerEmbeddingPath?: string;
    authorizedAt?: string | null;
  }): Promise<{ ok: boolean; error?: string }>;
  synthesizeStream(req: TtsSynthesizeRequest): Promise<TtsSynthesizeStream | null>;
}

const registry: OrnexaTtsRuntime[] = [];

export function registerTtsRuntime(engine: OrnexaTtsRuntime): void {
  const i = registry.findIndex((e) => e.engineId === engine.engineId);
  if (i >= 0) registry[i] = engine;
  else registry.push(engine);
}

export function listTtsRuntimes(): OrnexaTtsRuntime[] {
  return [...registry];
}

export function getReadyTtsRuntime(): OrnexaTtsRuntime | null {
  return registry.find((e) => e.isReady()) ?? null;
}

export function getTtsRuntimeById(engineId: string): OrnexaTtsRuntime | undefined {
  return registry.find((e) => e.engineId === engineId);
}

export function resetTtsRuntimeRegistryForTests(): void {
  registry.length = 0;
}
