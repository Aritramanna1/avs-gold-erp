/**
 * Qwen3-TTS / open-weight voice catalog.
 * Primary: smallest practical model (0.6B). Alternatives for benchmark only.
 * Product Owner sets approved:true after on-device gate — never ship unpaid cloud TTS.
 */

export type TtsVariantId =
  | "qwen3-tts-12hz-0.6b-base"
  | "qwen3-tts-12hz-1.7b-base"
  | "chatterbox-turbo";

export type TtsVariantRole =
  | "primary_candidate"
  | "quality_optional"
  | "benchmark_alternative"
  | "rejected_default";

export interface TtsVariantEval {
  id: TtsVariantId;
  displayName: string;
  family: "qwen3-tts" | "chatterbox";
  license: string;
  hfId?: string;
  sizeBytes: number;
  estimatedPeakRamMb: number;
  minDeviceRamMb: number;
  firstAudioLatencyClassMs: number;
  streaming: boolean;
  voiceClone: boolean;
  emotionControl: boolean;
  languages: string[];
  androidStabilityRisk: "low" | "medium" | "high";
  batteryImpact: "low" | "medium" | "high";
  webBrowserPractical: boolean;
  role: TtsVariantRole;
  notes: string;
}

export const TTS_VARIANT_EVALS: TtsVariantEval[] = [
  {
    id: "qwen3-tts-12hz-0.6b-base",
    displayName: "Qwen3-TTS 12Hz 0.6B Base",
    family: "qwen3-tts",
    license: "Apache-2.0",
    hfId: "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    sizeBytes: 1_800_000_000,
    estimatedPeakRamMb: 2500,
    minDeviceRamMb: 4096,
    firstAudioLatencyClassMs: 97,
    streaming: true,
    voiceClone: true,
    emotionControl: true,
    languages: ["en", "zh", "ja", "ko", "de", "fr", "ru", "pt", "es", "it", "hi"],
    androidStabilityRisk: "medium",
    batteryImpact: "medium",
    webBrowserPractical: false,
    role: "primary_candidate",
    notes:
      "Primary AVS ERP custom-voice candidate. 3s clone + streaming. Not in base APK. Hindi+English Assistant replies are the shop target.",
  },
  {
    id: "qwen3-tts-12hz-1.7b-base",
    displayName: "Qwen3-TTS 12Hz 1.7B Base",
    family: "qwen3-tts",
    license: "Apache-2.0",
    hfId: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    sizeBytes: 3_800_000_000,
    estimatedPeakRamMb: 5000,
    minDeviceRamMb: 6144,
    firstAudioLatencyClassMs: 101,
    streaming: true,
    voiceClone: true,
    emotionControl: true,
    languages: ["en", "zh", "ja", "ko", "de", "fr", "ru", "pt", "es", "it", "hi"],
    androidStabilityRisk: "high",
    batteryImpact: "high",
    webBrowserPractical: false,
    role: "quality_optional",
    notes:
      "Use only if 0.6B fails voice-similarity / long-form quality on jeweller phones.",
  },
  {
    id: "chatterbox-turbo",
    displayName: "Chatterbox Turbo",
    family: "chatterbox",
    license: "check-upstream",
    sizeBytes: 0,
    estimatedPeakRamMb: 2000,
    minDeviceRamMb: 4096,
    firstAudioLatencyClassMs: 150,
    streaming: true,
    voiceClone: true,
    emotionControl: false,
    languages: ["en"],
    androidStabilityRisk: "medium",
    batteryImpact: "medium",
    webBrowserPractical: false,
    role: "benchmark_alternative",
    notes: "Benchmark alternative only. Not the default AVS ERP voice engine.",
  },
];

export const PRIMARY_TTS_VARIANT_ID: TtsVariantId = "qwen3-tts-12hz-0.6b-base";

export function getPrimaryTtsVariant(): TtsVariantEval {
  const row = TTS_VARIANT_EVALS.find((v) => v.id === PRIMARY_TTS_VARIANT_ID);
  if (!row) throw new Error("Primary TTS variant missing");
  return row;
}

export function getDownloadableTtsVariants(): TtsVariantEval[] {
  return TTS_VARIANT_EVALS.filter(
    (v) => v.role === "primary_candidate" || v.role === "quality_optional",
  );
}
