import { useEffect, useState } from "react";
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import {
  getAttachmentSignedUrl,
  getBucketForEntityType,
  uploadFileToSupabase,
} from "./supabase-storage";

const attachmentsRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "attachments",
);

export type AttachmentEntityType =
  | "person"
  | "order"
  | "catalog"
  | "repair"
  | "stock"
  | "worker"
  | "jobcard"
  | "outside"
  | "expense"
  | "supplier";

export type AttachmentRecord = {
  filed: boolean;
  note: string;
  filedAt?: number;
  updatedAt: number;
  fileName?: string;
  /** Legacy checksum from the retired browser-local file vault. New uploads use bucket/storagePath. */
  checksum?: string;
  mimeType?: string;
  /**
   * @deprecated Legacy: base64 of the whole file, inlined into the row's JSON
   * `data` column. Still READ (so pre-existing records keep rendering) but never
   * written any more — it bloated every row and made the DB the file store.
   */
  fileDataUrl?: string;
  thumbnailDataUrl?: string;
  bucket?: string;
  storagePath?: string;
  uploadedBy?: string;
};

export type AttachmentKey = string; // `${entityType}:${entityId}:${docKey}`

function makeKey(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): AttachmentKey {
  return `${entityType}:${entityId}:${docKey}`;
}

type State = {
  items: Record<AttachmentKey, AttachmentRecord>;
  get: (
    entityType: AttachmentEntityType,
    entityId: string,
    docKey: string,
  ) => AttachmentRecord | undefined;
  save: (
    entityType: AttachmentEntityType,
    entityId: string,
    docKey: string,
    patch: {
      filed?: boolean;
      note?: string;
      fileName?: string;
      checksum?: string;
      mimeType?: string;
      fileDataUrl?: string;
      thumbnailDataUrl?: string;
      bucket?: string;
      storagePath?: string;
      uploadedBy?: string;
    },
  ) => void;
  /**
   * The only correct way to attach an actual file. Writes bytes to the
   * Supabase-backed storage adapter first, then records attachment metadata
   * that points at the stored object.
   */
  saveWithFile: (
    entityType: AttachmentEntityType,
    entityId: string,
    docKey: string,
    file: File,
    patch?: { filed?: boolean; note?: string; uploadedBy?: string },
  ) => Promise<AttachmentRecord>;
  clear: (entityType: AttachmentEntityType, entityId: string, docKey: string) => void;
  listForEntity: (
    entityType: AttachmentEntityType,
    entityId: string,
  ) => Array<{ docKey: string; rec: AttachmentRecord }>;
};

export const useAttachments = create<State>()((set, getStore) => ({
  items: {},
  get: (t, id, k) => getStore().items[makeKey(t, id, k)],
  save: (t, id, k, patch) => {
    let saved: any;
    set((s) => {
      const key = makeKey(t, id, k);
      const prev = s.items[key] ?? { filed: false, note: "", updatedAt: 0 };
      const next: AttachmentRecord = {
        ...prev,
        ...patch,
        filedAt:
          patch.filed === true && !prev.filed
            ? Date.now()
            : patch.filed === false
              ? undefined
              : prev.filedAt,
        updatedAt: Date.now(),
      };
      saved = { key, next };
      return { items: { ...s.items, [key]: next } };
    });
    if (saved)
      void attachmentsRepository.save({
        id: saved.key,
        file_name: saved.next.fileName ?? null,
        kind: k,
        linked_id: id,
        linked_table: t,
        storage_path: saved.next.storagePath ?? null,
        mime_type: saved.next.mimeType ?? null,
        data: saved.next,
      });
  },
  saveWithFile: async (t, id, k, file, patch = {}) => {
    const key = makeKey(t, id, k);
    const mimeType = file.type || "application/octet-stream";
    const bucket = getBucketForEntityType(t);
    const { filePath } = await uploadFileToSupabase(bucket, file, id, k);

    let thumbnailDataUrl: string | undefined;
    if (mimeType.startsWith("image/")) {
      try {
        thumbnailDataUrl = await generateImageThumbnail(file, 240);
      } catch (err) {
        console.warn("[attachments] thumbnail generation failed:", err);
      }
    }

    // Replacing a file: the previous bytes' object URL is now stale.
    invalidateAttachmentUrl(t, id, k);

    getStore().save(t, id, k, {
      filed: patch.filed ?? true,
      note: patch.note ?? "",
      fileName: file.name,
      checksum: undefined,
      mimeType,
      thumbnailDataUrl,
      bucket,
      storagePath: filePath,
      uploadedBy: patch.uploadedBy,
      // A fresh file supersedes any legacy inlined base64 on this key.
      fileDataUrl: undefined,
    });

    return getStore().items[key];
  },
  clear: (t, id, k) => {
    const key = makeKey(t, id, k);
    invalidateAttachmentUrl(t, id, k);
    set((s) => {
      const next = { ...s.items };
      delete next[key];
      return { items: next };
    });
    void attachmentsRepository.delete(key);
  },
  listForEntity: (t, id) => {
    const prefix = `${t}:${id}:`;
    const items = getStore().items;
    return Object.entries(items)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, rec]) => ({ docKey: k.slice(prefix.length), rec }));
  },
}));

export function isAttachmentFiled(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): boolean {
  const rec = useAttachments.getState().items[makeKey(entityType, entityId, docKey)];
  return !!rec?.filed;
}

/**
 * Compatibility no-op. Supabase `attachments` rows are hydrated by data-loader.
 *
 * This compatibility export remains for old imports; Supabase is authoritative,
 * and data-loader's pullAttachments hydrates from the remote attachments table.
 */
export async function hydrateAttachmentsFromLocal(): Promise<void> {
  // Supabase is authoritative. data-loader.pullAttachments hydrates from the
  // remote `attachments` table; this compatibility export intentionally does
  // not read any browser-local vault.
}
const objectUrlCache = new Map<AttachmentKey, string>();

/**
 * Resolves a displayable URL for an attachment's bytes from Supabase storage.
 * Returns null when the record carries no file.
 *
 * Legacy rows (base64 inlined in `fileDataUrl`) are still served directly, so
 * records created before the vault existed keep rendering.
 */
export async function getAttachmentUrl(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): Promise<string | null> {
  const key = makeKey(entityType, entityId, docKey);
  const cached = objectUrlCache.get(key);
  if (cached) return cached;

  const rec = useAttachments.getState().items[key];
  if (!rec) return null;
  if (!rec.storagePath || !rec.bucket) return rec.fileDataUrl ?? null;

  const url = await getAttachmentSignedUrl(rec.bucket, rec.storagePath);
  objectUrlCache.set(key, url);
  return url;
}

/**
 * Copies an attachment's file from one entity to another — e.g. an order line's
 * reference photo into the Catalog design saved from it.
 *
 * A real copy, not a shared reference: the Catalog design must keep its photo
 * even if the order it came from is later deleted. The vault is content-
 * addressed and ref-counted, so the bytes are stored once on disk and the second
 * attachment just references the same blob — a copy costs a row, not a file.
 *
 * Returns false when the source carries no file (nothing to copy), rather than
 * throwing — callers treat this as best-effort.
 */
export async function copyAttachment(
  from: { entityType: AttachmentEntityType; entityId: string; docKey: string },
  to: { entityType: AttachmentEntityType; entityId: string; docKey: string },
): Promise<boolean> {
  const srcKey = makeKey(from.entityType, from.entityId, from.docKey);
  const src = useAttachments.getState().items[srcKey];
  if (!src) return false;

  if (!src.storagePath && !src.fileDataUrl) return false;

  invalidateAttachmentUrl(to.entityType, to.entityId, to.docKey);
  useAttachments.getState().save(to.entityType, to.entityId, to.docKey, {
    filed: true,
    note: src.note,
    fileName: src.fileName,
    checksum: undefined,
    mimeType: src.mimeType,
    thumbnailDataUrl: src.thumbnailDataUrl,
    bucket: src.bucket,
    storagePath: src.storagePath,
    fileDataUrl: src.fileDataUrl,
  });
  return true;
}

/** Drops a cached object URL so the next read re-fetches (call after replace/clear). */
export function invalidateAttachmentUrl(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): void {
  const key = makeKey(entityType, entityId, docKey);
  const url = objectUrlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrlCache.delete(key);
  }
}

/**
 * React binding for `getAttachmentUrl`. Returns the thumbnail immediately (it's
 * inlined on the row, so it paints on first frame) and swaps in the full-size
 * bytes from the vault once they've been read back and decrypted.
 */
export function useAttachmentUrl(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): string | null {
  const rec = useAttachments((s) => s.items[makeKey(entityType, entityId, docKey)]);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!rec) return;
    void getAttachmentUrl(entityType, entityId, docKey)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((err) => console.warn("[attachments] failed to resolve file URL:", err));
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, docKey, rec?.checksum, rec?.fileDataUrl]);

  return url ?? rec?.thumbnailDataUrl ?? rec?.fileDataUrl ?? null;
}

/**
 * Generates a lightweight compressed base64 thumbnail of an image file.
 * Max dimension: 320px, Format: image/jpeg, Quality: 0.6
 */
export async function generateImageThumbnail(
  fileOrUrl: File | string,
  maxDimension = 320,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2d canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.6);
        resolve(thumbnailDataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (fileOrUrl instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => {
        reject(err);
      };
      reader.readAsDataURL(fileOrUrl);
    } else {
      img.src = fileOrUrl;
    }
  });
}
