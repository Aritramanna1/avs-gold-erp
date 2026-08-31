/**
 * Encrypted on-device storage for the offline queue.
 * Uses Web Crypto AES-GCM. Key material in Capacitor Preferences (native)
 * or session-scoped localStorage (web). Never stores secrets / passwords.
 */
import { isNativeApp } from "@/lib/native/platform";
import type { OfflineAsset, OfflineOperation, OfflineQueueSnapshot } from "./types";

const INDEX_KEY = "ornexa.offline.queue.v1";
const CRYPTO_KEY = "ornexa.offline.crypto.v1";

async function nativePreferences(): Promise<typeof import("@capacitor/preferences").Preferences | null> {
  if (!isNativeApp()) return null;
  try {
    const mod = await import(/* @vite-ignore */ "@capacitor/preferences");
    return mod.Preferences;
  } catch {
    return null;
  }
}

async function prefGet(key: string): Promise<string | null> {
  const Preferences = await nativePreferences();
  if (Preferences) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function prefSet(key: string, value: string): Promise<void> {
  const Preferences = await nativePreferences();
  if (Preferences) {
    await Preferences.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

async function prefRemove(key: string): Promise<void> {
  const Preferences = await nativePreferences();
  if (Preferences) {
    await Preferences.remove({ key });
    return;
  }
  localStorage.removeItem(key);
}

function b64FromBuf(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function bufFromB64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  const existing = await prefGet(CRYPTO_KEY);
  if (existing) {
    return crypto.subtle.importKey(
      "raw",
      bufFromB64(existing),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  await prefSet(CRYPTO_KEY, b64FromBuf(raw.buffer));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptBytes(plain: ArrayBuffer): Promise<{ cipherBase64: string; ivBase64: string }> {
  const key = await getOrCreateCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { cipherBase64: b64FromBuf(cipher), ivBase64: b64FromBuf(iv.buffer) };
}

export async function decryptBytes(cipherBase64: string, ivBase64: string): Promise<ArrayBuffer> {
  const key = await getOrCreateCryptoKey();
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(bufFromB64(ivBase64)) },
    key,
    bufFromB64(cipherBase64),
  );
}

const EMPTY: OfflineQueueSnapshot = {
  operations: [],
  assets: [],
  lastSuccessfulSyncAt: null,
  lastAttemptAt: null,
};

export async function loadQueueSnapshot(): Promise<OfflineQueueSnapshot> {
  const raw = await prefGet(INDEX_KEY);
  if (!raw) return { ...EMPTY, operations: [], assets: [] };
  try {
    const parsed = JSON.parse(raw) as OfflineQueueSnapshot;
    return {
      operations: parsed.operations ?? [],
      assets: parsed.assets ?? [],
      lastSuccessfulSyncAt: parsed.lastSuccessfulSyncAt ?? null,
      lastAttemptAt: parsed.lastAttemptAt ?? null,
    };
  } catch {
    return { ...EMPTY, operations: [], assets: [] };
  }
}

export async function saveQueueSnapshot(snap: OfflineQueueSnapshot): Promise<void> {
  await prefSet(INDEX_KEY, JSON.stringify(snap));
}

export async function clearOfflineQueueStorage(): Promise<void> {
  await prefRemove(INDEX_KEY);
  // Keep crypto key so leftover blobs stay unreadable after wipe; rotate on demand.
}

export async function countPendingOps(): Promise<number> {
  const snap = await loadQueueSnapshot();
  return snap.operations.filter((o) =>
    o.status === "pending_sync" || o.status === "syncing" || o.status === "needs_attention",
  ).length;
}

const JSON_WRAP = "ornexa.offline.json.";

/** Encrypted JSON blob in Preferences / localStorage. Not a ledger. */
export async function saveEncryptedJson(key: string, value: unknown): Promise<void> {
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const { cipherBase64, ivBase64 } = await encryptBytes(plain.buffer);
  await prefSet(`${JSON_WRAP}${key}`, JSON.stringify({ cipherBase64, ivBase64 }));
}

export async function loadEncryptedJson<T>(key: string): Promise<T | null> {
  const raw = await prefGet(`${JSON_WRAP}${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { cipherBase64: string; ivBase64: string };
    const plain = await decryptBytes(parsed.cipherBase64, parsed.ivBase64);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

export async function removeEncryptedJson(key: string): Promise<void> {
  await prefRemove(`${JSON_WRAP}${key}`);
}

export type { OfflineOperation, OfflineAsset, OfflineQueueSnapshot };
