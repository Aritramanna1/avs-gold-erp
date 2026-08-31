/**
 * Private on-device storage for authorized AVS ERP voice reference clips.
 * Never stores public HTTPS URLs. Web: IndexedDB. Native: app Data directory.
 */

import { isNativeApp } from "@/lib/native/platform";

const IDB_NAME = "ornexa-voice-refs-v1";
const IDB_STORE = "clips";
const MIN_MS = 2500;
const MAX_MS = 16000;

export function isPublicHttpUrl(path: string): boolean {
  return /^https?:\/\//i.test(path.trim());
}

async function measureDurationMs(blob: Blob): Promise<number | null> {
  try {
    const url = URL.createObjectURL(blob);
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        resolve(audio.duration * 1000);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read audio duration"));
      };
      audio.src = url;
    });
    return Number.isFinite(duration) ? Math.round(duration) : null;
  } catch {
    return null;
  }
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

/**
 * Persist a reference recording and return a private path (not a public URL).
 */
export async function storePrivateVoiceRef(file: File | Blob): Promise<{
  ok: boolean;
  path?: string;
  durationMs?: number;
  error?: string;
}> {
  const blob = file instanceof Blob ? file : new Blob([file]);
  if (blob.size < 800) {
    return { ok: false, error: "Reference recording is too small. Use a clean 3–15 second clip." };
  }
  const durationMs = await measureDurationMs(blob);
  if (durationMs != null && (durationMs < MIN_MS || durationMs > MAX_MS)) {
    return {
      ok: false,
      error: `Reference should be about 3–15 seconds (got ${(durationMs / 1000).toFixed(1)}s).`,
    };
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ref_${Date.now()}`;
  const ext = blob.type.includes("mpeg") || blob.type.includes("mp3") ? "mp3" : "wav";
  const relative = `private/voice-refs/${id}.${ext}`;

  if (isNativeApp()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = String(reader.result ?? "");
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error("encode failed"));
        reader.readAsDataURL(blob);
      });
      await Filesystem.writeFile({
        path: relative,
        data: base64,
        directory: Directory.Data,
        recursive: true,
      });
      const { uri } = await Filesystem.getUri({ path: relative, directory: Directory.Data });
      return { ok: true, path: uri || relative, durationMs: durationMs ?? undefined };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Could not save reference audio on device.",
      };
    }
  }

  if (typeof indexedDB === "undefined") {
    return { ok: false, error: "This browser cannot store a private voice reference." };
  }
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(blob, relative);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not store clip"));
    });
    db.close();
    return { ok: true, path: relative, durationMs: durationMs ?? undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not store private reference audio.",
    };
  }
}

export async function loadPrivateVoiceRef(path: string): Promise<Blob | null> {
  if (!path || isPublicHttpUrl(path)) return null;
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openIdb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(path);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}
