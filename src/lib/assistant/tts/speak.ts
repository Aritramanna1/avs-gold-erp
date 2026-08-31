/**
 * High-level speak path: AVS ERP Qwen3-TTS + central product voice when ready,
 * otherwise returns null so caller uses device TTS (explicit fallback).
 */

import { applyJewelleryPronunciation } from "./pronunciation-lexicon";
import { ensureQwen3TtsRuntimeRegistered } from "./qwen3-tts-runtime";
import { getReadyTtsRuntime } from "./runtime";
import { StreamingAudioPlayer } from "./streaming-player";
import { getActiveCentralVoice, markCentralVoiceTest } from "./central-voice-store";
import { formatTtsStatusLine, loadTtsBenchmarkReport } from "./benchmark";
import type { TtsEmotion } from "./runtime";

let player: StreamingAudioPlayer | null = null;
let preferCustom = true;

export function preferOrnexaVoice(enabled: boolean): void {
  preferCustom = enabled;
}

export async function getOrnexaVoiceStatus(): Promise<{
  preferCustom: boolean;
  engineReady: boolean;
  hasActiveProfile: boolean;
  statusLine: string;
}> {
  ensureQwen3TtsRuntimeRegistered();
  try {
    const { loadInstalledTtsEngine } = await import("./pack");
    await loadInstalledTtsEngine();
  } catch {
    /* no pack installed */
  }
  const runtime = getReadyTtsRuntime();
  const profile = await getActiveCentralVoice();
  const report = await loadTtsBenchmarkReport();
  const engineReady = Boolean(runtime?.isReady());
  return {
    preferCustom,
    engineReady,
    hasActiveProfile: Boolean(profile),
    statusLine: formatTtsStatusLine(report, engineReady && Boolean(profile?.authorizedAt)),
  };
}

export async function speakWithOrnexaVoice(options: {
  text: string;
  language: string;
  utteranceId: string;
  speakingRate?: number;
  emotion?: TtsEmotion;
  onState?: (s: string) => void;
}): Promise<{ usedOrnexaVoice: boolean; error?: string }> {
  if (!preferCustom) return { usedOrnexaVoice: false };

  ensureQwen3TtsRuntimeRegistered();
  try {
    const { loadInstalledTtsEngine } = await import("./pack");
    await loadInstalledTtsEngine();
  } catch {
    /* ignore */
  }
  const runtime = getReadyTtsRuntime();
  if (!runtime?.isReady()) return { usedOrnexaVoice: false };

  const profile = await getActiveCentralVoice();
  if (!profile?.authorizedAt) return { usedOrnexaVoice: false };

  const bound = await runtime.bindVoiceProfile({
    id: profile.id,
    refAudioPath: profile.refAudioStoragePath ?? undefined,
    refTranscript: profile.refTranscript ?? undefined,
    speakerEmbeddingPath: profile.speakerEmbeddingPath ?? undefined,
    authorizedAt: profile.authorizedAt,
  });
  if (!bound.ok) return { usedOrnexaVoice: false, error: bound.error };

  const text = applyJewelleryPronunciation(options.text);
  const stream = await runtime.synthesizeStream({
    text,
    language: options.language,
    speakingRate: options.speakingRate ?? profile.speakingRate ?? 1,
    emotion: (options.emotion as TtsEmotion) ?? (profile.emotionDefault as TtsEmotion) ?? "clear",
    voiceProfileId: profile.id,
    utteranceId: options.utteranceId,
  });

  if (!stream) {
    await markCentralVoiceTest(false, "synthesizeStream returned null");
    return { usedOrnexaVoice: false, error: "Qwen3-TTS synthesize unavailable" };
  }

  if (player) await player.stop();
  player = new StreamingAudioPlayer({
    onState: (s) => options.onState?.(s),
  });
  player.setRate(options.speakingRate ?? profile.speakingRate ?? 1);

  try {
    for await (const chunk of stream.chunks) {
      await player.enqueue(chunk);
    }
    await markCentralVoiceTest(true);
    return { usedOrnexaVoice: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "playback failed";
    await markCentralVoiceTest(false, msg);
    return { usedOrnexaVoice: false, error: msg };
  }
}

export async function stopOrnexaVoicePlayback(): Promise<void> {
  if (player) {
    await player.stop();
    player = null;
  }
}

export async function pauseOrnexaVoicePlayback(): Promise<void> {
  await player?.pause();
}

export async function resumeOrnexaVoicePlayback(): Promise<void> {
  await player?.resume();
}
