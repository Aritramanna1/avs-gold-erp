/**
 * Qwen3-TTS pack download + load gate.
 * Same policy as Local AI: approved catalog + SHA256 + URL required.
 * Weights never live in the APK. No paid TTS download endpoint.
 */

import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/native/platform";
import { PRIMARY_TTS_VARIANT_ID, TTS_VARIANT_EVALS, type TtsVariantId } from "./catalog";
import { loadTtsBenchmarkReport } from "./benchmark";
import { ensureQwen3TtsRuntimeRegistered } from "./qwen3-tts-runtime";
import { getTtsRuntimeById } from "./runtime";

export interface TtsPackEntry {
  id: string;
  variantId: TtsVariantId;
  displayName: string;
  sizeBytes: number;
  sha256: string;
  downloadUrl?: string;
  approved: boolean;
  minRamMb: number;
}

export const TTS_PACK_CATALOG: TtsPackEntry[] = [
  {
    id: "ornexa-qwen3-tts-0.6b-v1",
    variantId: "qwen3-tts-12hz-0.6b-base",
    displayName: "AVS Voice Standard (Qwen3-TTS 0.6B)",
    sizeBytes: TTS_VARIANT_EVALS.find((v) => v.id === "qwen3-tts-12hz-0.6b-base")?.sizeBytes ?? 1_800_000_000,
    sha256: "pending-benchmark-gate",
    approved: false,
    minRamMb: 4096,
  },
  {
    id: "ornexa-qwen3-tts-1.7b-v1",
    variantId: "qwen3-tts-12hz-1.7b-base",
    displayName: "AVS Voice Enhanced (Qwen3-TTS 1.7B)",
    sizeBytes: TTS_VARIANT_EVALS.find((v) => v.id === "qwen3-tts-12hz-1.7b-base")?.sizeBytes ?? 3_800_000_000,
    sha256: "pending-benchmark-gate",
    approved: false,
    minRamMb: 6144,
  },
];

const INSTALLED_KEY = "ornexa.tts.installed.v1";

export interface InstalledTtsPack {
  id: string;
  variantId: TtsVariantId;
  path: string;
  installedAt: string;
  sha256: string;
}

export async function listInstalledTtsPacks(): Promise<InstalledTtsPack[]> {
  try {
    if (isNativeApp()) {
      const { value } = await Preferences.get({ key: INSTALLED_KEY });
      if (!value) return [];
      return JSON.parse(value) as InstalledTtsPack[];
    }
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(INSTALLED_KEY) : null;
    if (!raw) return [];
    return JSON.parse(raw) as InstalledTtsPack[];
  } catch {
    return [];
  }
}

async function saveInstalled(list: InstalledTtsPack[]): Promise<void> {
  const value = JSON.stringify(list);
  if (isNativeApp()) {
    await Preferences.set({ key: INSTALLED_KEY, value });
    return;
  }
  if (typeof localStorage !== "undefined") localStorage.setItem(INSTALLED_KEY, value);
}

export async function canDownloadTtsPack(entry: TtsPackEntry): Promise<{ ok: boolean; reason: string }> {
  const report = await loadTtsBenchmarkReport();
  if (!entry.approved || entry.sha256 === "pending-benchmark-gate" || !entry.downloadUrl) {
    return {
      ok: false,
      reason:
        "Qwen3-TTS pack download is locked until on-device benchmark passes and Product Owner sets approved:true with SHA256 + URL. Device TTS remains the fallback.",
    };
  }
  if (entry.variantId === PRIMARY_TTS_VARIANT_ID && report && !report.passedGate) {
    return { ok: false, reason: "Run TTS benchmark on this device before enabling the 0.6B pack." };
  }
  return { ok: true, reason: "" };
}

export async function downloadTtsPack(
  packId: string,
): Promise<{ ok: boolean; error?: string; record?: InstalledTtsPack }> {
  const entry = TTS_PACK_CATALOG.find((p) => p.id === packId);
  if (!entry) return { ok: false, error: "Unknown TTS pack." };
  const gate = await canDownloadTtsPack(entry);
  if (!gate.ok) return { ok: false, error: gate.reason };
  return { ok: false, error: "Download endpoint not configured for this build." };
}

export async function loadInstalledTtsEngine(): Promise<{ ok: boolean; error?: string }> {
  ensureQwen3TtsRuntimeRegistered();
  const installed = await listInstalledTtsPacks();
  const pack = installed.find((p) => p.variantId === PRIMARY_TTS_VARIANT_ID) ?? installed[0];
  if (!pack) {
    return { ok: false, error: "No Qwen3-TTS pack installed on this device." };
  }
  const runtime = getTtsRuntimeById("qwen3-tts");
  if (!runtime) return { ok: false, error: "Qwen3-TTS runtime not registered." };
  return runtime.load({ weightsPath: pack.path, variantId: pack.variantId });
}

export function describeTtsPack(entry: TtsPackEntry): string {
  const mb = Math.round(entry.sizeBytes / (1024 * 1024));
  return `${entry.displayName} · ~${mb} MB${entry.approved ? "" : " · pending approval"}`;
}
