/**
 * Central AVS product voice — Platform Owner only to write.
 * All firms read the same singleton. Not a per-firm profile.
 *
 * Upload → cloud private path → activate = deployed everywhere.
 * Local IndexedDB alone is never enough (other firms would not see it).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { isPublicHttpUrl, storePrivateVoiceRef } from "./voice-ref-audio";
import { PRIMARY_TTS_VARIANT_ID } from "./catalog";
import type { TtsEmotion } from "./runtime";

export interface OrnexaCentralVoice {
  id: "central";
  name: string;
  engineVariantId: string;
  status: "draft" | "active" | "revoked";
  languageCodes: string[];
  speakingRate: number;
  emotionDefault: TtsEmotion | string;
  refAudioStoragePath: string | null;
  refAudioBucket: string | null;
  refTranscript: string | null;
  speakerEmbeddingPath: string | null;
  authorizedBy: string | null;
  authorizedAt: string | null;
  consentAttestation: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  durationMs: number | null;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): OrnexaCentralVoice {
  return {
    id: "central",
    name: String(row.name ?? "AVS Voice"),
    engineVariantId: String(row.engine_variant_id ?? PRIMARY_TTS_VARIANT_ID),
    status: (row.status as OrnexaCentralVoice["status"]) ?? "draft",
    languageCodes: Array.isArray(row.language_codes)
      ? (row.language_codes as string[])
      : ["en", "hi"],
    speakingRate: Number(row.speaking_rate ?? 1),
    emotionDefault: String(row.emotion_default ?? "clear"),
    refAudioStoragePath: row.ref_audio_storage_path ? String(row.ref_audio_storage_path) : null,
    refAudioBucket: row.ref_audio_bucket ? String(row.ref_audio_bucket) : null,
    refTranscript: row.ref_transcript ? String(row.ref_transcript) : null,
    speakerEmbeddingPath: row.speaker_embedding_path
      ? String(row.speaker_embedding_path)
      : null,
    authorizedBy: row.authorized_by ? String(row.authorized_by) : null,
    authorizedAt: row.authorized_at ? String(row.authorized_at) : null,
    consentAttestation: row.consent_attestation ? String(row.consent_attestation) : null,
    lastTestAt: row.last_test_at ? String(row.last_test_at) : null,
    lastTestOk: typeof row.last_test_ok === "boolean" ? row.last_test_ok : null,
    lastError: row.last_error ? String(row.last_error) : null,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getCentralVoice(): Promise<OrnexaCentralVoice | null> {
  const { data, error } = await supabase
    .from("ornexa_central_voice" as never)
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Active central voice for Read Aloud (all firms). */
export async function getActiveCentralVoice(): Promise<OrnexaCentralVoice | null> {
  const row = await getCentralVoice();
  if (!row || row.status !== "active" || !row.authorizedAt) return null;
  if (!row.refAudioStoragePath && !row.speakerEmbeddingPath) return null;
  return row;
}

async function persistCloudAudio(
  file: File | Blob,
): Promise<{ path: string; bucket: string; durationMs?: number }> {
  const local = await storePrivateVoiceRef(file);
  if (!local.ok) {
    throw new Error(local.error ?? "Could not validate reference audio.");
  }

  const { uploadCentralOrnexaVoiceAudio } = await import("@/lib/supabase-storage");
  const fileName = file instanceof File ? file.name : "ornexa-central-voice.webm";
  const uploaded = await uploadCentralOrnexaVoiceAudio(file, fileName);
  if (isPublicHttpUrl(uploaded.path)) {
    throw new Error("Public URL rejected — central voice must use a private path.");
  }
  if (!uploaded.path.startsWith("platform/ornexa_central_voice/")) {
    throw new Error("Central voice must be stored under platform/ornexa_central_voice/.");
  }
  return {
    path: uploaded.path,
    bucket: uploaded.bucket,
    durationMs: local.durationMs,
  };
}

/**
 * Upload reference audio, bind as the AVS ERP product voice profile, and
 * optionally activate for every firm immediately.
 */
export async function enrollCentralVoice(input: {
  name: string;
  refTranscript: string;
  audio: File | Blob;
  speakingRate?: number;
  consentAttestation: string;
  /** Default true — save + activate so all firms get this voice. */
  activateForEveryone?: boolean;
}): Promise<{ ok: boolean; voice?: OrnexaCentralVoice; error?: string }> {
  if (!input.consentAttestation.trim()) {
    return { ok: false, error: "Authorization attestation is required." };
  }
  if (!input.refTranscript.trim()) {
    return { ok: false, error: "Reference transcript is required." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in as Platform Owner." };

  let audioMeta: { path: string; bucket: string; durationMs?: number };
  try {
    audioMeta = await persistCloudAudio(input.audio);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Cloud upload failed. Central voice must be stored for all firms.",
    };
  }

  const activate = input.activateForEveryone !== false;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ornexa_central_voice" as never)
    .upsert(
      {
        id: true,
        name: input.name.trim() || "AVS Voice",
        ref_transcript: input.refTranscript.trim(),
        ref_audio_storage_path: audioMeta.path,
        ref_audio_bucket: audioMeta.bucket,
        duration_ms:
          audioMeta.durationMs != null ? Math.round(audioMeta.durationMs) : null,
        speaking_rate: input.speakingRate ?? 1,
        consent_attestation: input.consentAttestation.trim(),
        authorized_by: user.id,
        authorized_at: now,
        status: activate ? "active" : "draft",
        engine_variant_id: PRIMARY_TTS_VARIANT_ID,
        last_error: null,
        updated_at: now,
      } as never,
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not save central voice." };
  return { ok: true, voice: mapRow(data as Record<string, unknown>) };
}

export async function activateCentralVoice(): Promise<boolean> {
  const row = await getCentralVoice();
  if (!row?.refAudioStoragePath || !row.authorizedAt) return false;
  const { error } = await supabase
    .from("ornexa_central_voice" as never)
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", true);
  return !error;
}

export async function revokeCentralVoice(): Promise<boolean> {
  const { error } = await supabase
    .from("ornexa_central_voice" as never)
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", true);
  return !error;
}

export async function markCentralVoiceTest(ok: boolean, error?: string): Promise<void> {
  await supabase.rpc("mark_ornexa_central_voice_test" as never, {
    p_ok: ok,
    p_error: error ?? null,
  } as never);
}
