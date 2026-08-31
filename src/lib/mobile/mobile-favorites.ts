/**
 * User-scoped mobile favorite action pins (Preferences / localStorage).
 * Never elevates permissions — callers must still filter by hasRoutePermission.
 */
import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/native/platform";

const STORAGE_KEY = "ornexa.mobile.favorites.v1";

function scopedKey(userId: string | null | undefined): string {
  const uid = (userId ?? "anon").trim() || "anon";
  return `${STORAGE_KEY}:${uid}`;
}

async function readRaw(userId: string | null | undefined): Promise<string[]> {
  const key = scopedKey(userId);
  try {
    if (isNativeApp()) {
      const { value } = await Preferences.get({ key });
      if (!value) return [];
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    }
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function writeRaw(userId: string | null | undefined, ids: string[]): Promise<void> {
  const key = scopedKey(userId);
  const unique = [...new Set(ids)].slice(0, 24);
  const value = JSON.stringify(unique);
  if (isNativeApp()) {
    await Preferences.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

export async function loadMobileFavorites(userId: string | null | undefined): Promise<string[]> {
  return readRaw(userId);
}

export async function saveMobileFavorites(
  userId: string | null | undefined,
  ids: string[],
): Promise<void> {
  await writeRaw(userId, ids);
}

export async function toggleMobileFavorite(
  userId: string | null | undefined,
  actionId: string,
): Promise<string[]> {
  const current = await readRaw(userId);
  const next = current.includes(actionId)
    ? current.filter((id) => id !== actionId)
    : [...current, actionId];
  await writeRaw(userId, next);
  return next;
}

export async function isMobileFavorite(
  userId: string | null | undefined,
  actionId: string,
): Promise<boolean> {
  const current = await readRaw(userId);
  return current.includes(actionId);
}
