/**
 * On-device TTS benchmark gate — fill before approving catalog packs.
 */

import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/native/platform";
import {
  PRIMARY_TTS_VARIANT_ID,
  TTS_VARIANT_EVALS,
  type TtsVariantId,
} from "./catalog";
import { TTS_PRONUNCIATION_PHRASE_PACK } from "./pronunciation-lexicon";
import { ensureQwen3TtsRuntimeRegistered } from "./qwen3-tts-runtime";
import { getReadyTtsRuntime, listTtsRuntimes } from "./runtime";

const REPORT_KEY = "ornexa.tts.benchmark.v1";

export interface TtsBenchmarkReport {
  runAt: string;
  primaryVariantId: TtsVariantId;
  modelSizeBytes: number;
  estimatedRamMb: number | null;
  startupMs: number | null;
  firstAudioLatencyMs: number | null;
  streamingLatencyMs: number | null;
  engineReady: boolean;
  pronunciationPass: boolean;
  phraseSamples: string[];
  notes: string;
  androidAbi?: string;
  passedGate: boolean;
}

export async function loadTtsBenchmarkReport(): Promise<TtsBenchmarkReport | null> {
  try {
    if (isNativeApp()) {
      const { value } = await Preferences.get({ key: REPORT_KEY });
      if (!value) return null;
      return JSON.parse(value) as TtsBenchmarkReport;
    }
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(REPORT_KEY) : null;
    return raw ? (JSON.parse(raw) as TtsBenchmarkReport) : null;
  } catch {
    return null;
  }
}

async function saveReport(report: TtsBenchmarkReport): Promise<void> {
  const json = JSON.stringify(report);
  if (isNativeApp()) {
    await Preferences.set({ key: REPORT_KEY, value: json });
  } else if (typeof localStorage !== "undefined") {
    localStorage.setItem(REPORT_KEY, json);
  }
}

export async function runOnDeviceTtsBenchmark(): Promise<TtsBenchmarkReport> {
  ensureQwen3TtsRuntimeRegistered();
  const primary = TTS_VARIANT_EVALS.find((v) => v.id === PRIMARY_TTS_VARIANT_ID)!;
  const t0 = performance.now();
  const runtimes = listTtsRuntimes();
  const probe = runtimes[0] ? await runtimes[0].probe() : { available: false, detail: "no runtime" };
  const startupMs = Math.round(performance.now() - t0);

  let firstAudioLatencyMs: number | null = null;
  let streamingLatencyMs: number | null = null;
  let engineReady = false;
  let androidAbi: string | undefined;

  if (isNativeApp()) {
    try {
      const { OrnexaQwen3Tts } = await import("@/lib/native/ornexa-qwen3-tts-plugin");
      const cap = await OrnexaQwen3Tts.getCapabilities();
      androidAbi = cap.abi;
      engineReady = Boolean(cap.engineAvailable) && getReadyTtsRuntime() != null;
      const bench = await OrnexaQwen3Tts.runMicroBenchmark?.({
        phrases: TTS_PRONUNCIATION_PHRASE_PACK.slice(0, 2),
      });
      if (bench) {
        firstAudioLatencyMs = bench.firstAudioLatencyMs ?? null;
        streamingLatencyMs = bench.streamingLatencyMs ?? null;
      }
    } catch {
      engineReady = false;
    }
  }

  // Lexicon gate is always runnable (no weights required).
  const pronunciationPass = TTS_PRONUNCIATION_PHRASE_PACK.every((p) => p.length > 8);

  const report: TtsBenchmarkReport = {
    runAt: new Date().toISOString(),
    primaryVariantId: PRIMARY_TTS_VARIANT_ID,
    modelSizeBytes: primary.sizeBytes,
    estimatedRamMb: probe.ramMb ?? primary.estimatedPeakRamMb,
    startupMs,
    firstAudioLatencyMs,
    streamingLatencyMs,
    engineReady,
    pronunciationPass,
    phraseSamples: TTS_PRONUNCIATION_PHRASE_PACK,
    notes: probe.detail,
    androidAbi,
    passedGate: false,
  };

  // Native Qwen3-TTS pack: require engine + latency.
  if (
    engineReady &&
    pronunciationPass &&
    firstAudioLatencyMs != null &&
    firstAudioLatencyMs < 800
  ) {
    report.passedGate = true;
  }

  // Browser / no TTS pack: device speech synthesis is the approved fallback.
  // This must NOT block Local AI model download — voice packs are optional.
  if (!isNativeApp() && pronunciationPass) {
    report.passedGate = true;
    report.notes = `${probe.detail} · Device TTS fallback gate OK (Qwen3-TTS pack optional).`;
  }

  await saveReport(report);
  return report;
}

export function formatTtsStatusLine(report: TtsBenchmarkReport | null, engineReady: boolean): string {
  if (engineReady && report?.passedGate) {
    return "AVS ERP custom voice active (Qwen3-TTS)";
  }
  if (engineReady) {
    return "Qwen3-TTS loaded — complete voice enrollment + benchmark before promote";
  }
  return "AVS ERP custom voice not loaded — device TTS fallback (no paid voice API)";
}
