/**
 * Firm-scoped Ornexa voice profiles — metadata in Supabase, audio private.
 * Unauthorized cloning is refused at bind + enrollment time.
 */

import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { TtsVariantId } from "./catalog";
import type { TtsEmotion } from "./runtime";

export interface OrnexaVoiceProfile {
  id: string;
  firmId: string;
  name: string;
  engineVariantId: TtsVariantId | string;
  status: "draft" | "active" | "revoked";
  languageCodes: string[];
  speakingRate: number;
  emotionDefault: TtsEmotion | string;
  refAudioStoragePath: string | null;
  refTranscript: string | null;
  speakerEmbeddingPath: string | null;
  authorizedBy: string | null;
  authorizedAt: string | null;
  consentAttestation: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): OrnexaVoiceProfile {
  return {
    id: String(row.id),
    firmId: String(row.firm_id),
    name: String(row.name ?? "AVS Voice"),
    engineVariantId: String(row.engine_variant_id ?? "qwen3-tts-12hz-0.6b-base"),
    status: (row.status as OrnexaVoiceProfile["status"]) ?? "draft",
    languageCodes: Array.isArray(row.language_codes)
      ? (row.language_codes as string[])
      : ["en", "hi"],
    speakingRate: Number(row.speaking_rate ?? 1),
    emotionDefault: String(row.emotion_default ?? "clear"),
    refAudioStoragePath: row.ref_audio_storage_path ? String(row.ref_audio_storage_path) : null,
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
    updatedAt: String(row.updated_at ?? row.created_at ?? ""),
  };
}

export async function listVoiceProfiles(): Promise<OrnexaVoiceProfile[]> {
  const { data, error } = await supabase
    .from("ornexa_voice_profiles" as never)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function getActiveVoiceProfile(): Promise<OrnexaVoiceProfile | null> {
  const { data, error } = await supabase
    .from("ornexa_voice_profiles" as never)
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function enrollVoiceProfile(input: {
  name: string;
  refTranscript: string;
  /** Private relative path or local file URI — never a public CDN URL */
  refAudioStoragePath: string;
  speakingRate?: number;
  emotionDefault?: string;
  languageCodes?: string[];
  engineVariantId?: string;
  consentAttestation: string;
}): Promise<{ ok: boolean; profile?: OrnexaVoiceProfile; error?: string }> {
  if (!input.consentAttestation.trim()) {
    return { ok: false, error: "Authorization attestation is required. Do not clone without permission." };
  }
  if (!input.refTranscript.trim()) {
    return { ok: false, error: "Reference transcript is required and must match the recording." };
  }
  if (!input.refAudioStoragePath.trim() || /^https?:\/\//i.test(input.refAudioStoragePath)) {
    return {
      ok: false,
      error: "Reference audio must be a private firm/device path — not a public URL.",
    };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return { ok: false, error: "Sign in required." };

  const { data, error } = await supabase
    .from("ornexa_voice_profiles" as never)
    .insert({
      name: input.name.trim() || "AVS Voice",
      ref_transcript: input.refTranscript.trim(),
      ref_audio_storage_path: input.refAudioStoragePath.trim(),
      speaking_rate: input.speakingRate ?? 1,
      emotion_default: input.emotionDefault ?? "clear",
      language_codes: input.languageCodes ?? ["en", "hi"],
      engine_variant_id: input.engineVariantId ?? "qwen3-tts-12hz-0.6b-base",
      consent_attestation: input.consentAttestation.trim(),
      authorized_by: user.id,
      authorized_at: new Date().toISOString(),
      status: "draft",
    } as never)
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not save voice profile." };
  return { ok: true, profile: mapRow(data as Record<string, unknown>) };
}

export async function activateVoiceProfile(profileId: string): Promise<boolean> {
  const { data: firmId } = await supabase.rpc("my_firm_id");
  if (!firmId) return false;
  await supabase
    .from("ornexa_voice_profiles" as never)
    .update({ status: "draft", updated_at: new Date().toISOString() } as never)
    .eq("firm_id", firmId as never)
    .eq("status", "active");
  const { error } = await supabase
    .from("ornexa_voice_profiles" as never)
    .update({ status: "active", updated_at: new Date().toISOString() } as never)
    .eq("id", profileId);
  return !error;
}

export async function revokeVoiceProfile(profileId: string): Promise<boolean> {
  const { error } = await supabase
    .from("ornexa_voice_profiles" as never)
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", profileId);
  return !error;
}

export async function updateVoicePlaybackPrefs(
  profileId: string,
  patch: { speakingRate?: number; emotionDefault?: string },
): Promise<boolean> {
  const { error } = await supabase
    .from("ornexa_voice_profiles" as never)
    .update({
      ...(patch.speakingRate != null ? { speaking_rate: patch.speakingRate } : {}),
      ...(patch.emotionDefault != null ? { emotion_default: patch.emotionDefault } : {}),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", profileId);
  return !error;
}

export async function markVoiceTest(
  profileId: string,
  ok: boolean,
  error?: string,
): Promise<void> {
  await supabase
    .from("ornexa_voice_profiles" as never)
    .update({
      last_test_at: new Date().toISOString(),
      last_test_ok: ok,
      last_error: error?.slice(0, 500) ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", profileId);
}
