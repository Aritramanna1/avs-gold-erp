import { useEffect, useState } from "react";
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { saveFile as saveFileLocally, loadFile as loadFileLocally } from "./local-file-store";
import { initLocalDb, selectAllLive } from "./local-db";

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
  /**
   * Reference to the bytes in local-file-store's content-addressed vault
   * (`file_blobs`, encrypted at rest). This — not the file itself — is what the
   * `attachments` DB row carries. Present on everything saved via
   * `saveWithFile()`; absent only on legacy rows (see `fileDataUrl`).
   */
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
   * The only correct way to attach an actual file. Writes the bytes to the local
   * encrypted vault FIRST, then records a row referencing them — so the document
   * is durable on disk before any cloud call is attempted, and survives restart,
   * logout, and restore with no network involved.
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
    const attachmentPatch = patch ?? {};
    throw new Error(
      "Workshop Edition does not store uploaded files. Keep identification details as text instead.",
    );
    const key = makeKey(t, id, k);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    // Bytes to disk first. If this throws (unsupported type, too large), we
    // deliberately do NOT write the attachment row — a row pointing at nothing
    // is exactly the "document is filed but the image is gone" state we're fixing.
    const { checksum } = await saveFileLocally(key, bytes, {
      fileName: file.name,
      mimeType,
      entityType: t,
      entityId: id,
      createdBy: attachmentPatch.uploadedBy,
    });

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
      filed: attachmentPatch.filed ?? true,
      note: attachmentPatch.note ?? "",
      fileName: file.name,
      checksum,
      mimeType,
      thumbnailDataUrl,
      uploadedBy: attachmentPatch.uploadedBy,
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
 * Rehydrates the store from the local SQLite `attachments` table.
 *
 * This is the boot-time read that was missing: writes always landed locally, but
 * the only reader (data-loader's pullAttachments) went to Supabase, so an Offline
 * or disconnected install came up with an empty store and every uploaded photo
 * appeared to have vanished. Runs in every deployment mode — local is the source
 * of truth, and the cloud pull merges on top of this, not instead of it.
 */
export async function hydrateAttachmentsFromLocal(): Promise<void> {
  await initLocalDb();
  const dict: Record<AttachmentKey, AttachmentRecord> = {};
  for (const row of selectAllLive("attachments")) {
    const d = (row.data as Partial<AttachmentRecord>) ?? {};
    dict[row.id as AttachmentKey] = {
      filed: d.filed ?? true,
      note: d.note ?? "",
      filedAt: d.filedAt,
      updatedAt: d.updatedAt ?? 0,
      fileName: (row.file_name as string) || d.fileName || undefined,
      checksum: d.checksum,
      mimeType: (row.mime_type as string) || d.mimeType || undefined,
      fileDataUrl: d.fileDataUrl,
      thumbnailDataUrl: d.thumbnailDataUrl,
      bucket: d.bucket,
      storagePath: (row.storage_path as string) || d.storagePath || undefined,
      uploadedBy: d.uploadedBy,
    };
  }
  // Local rows lose to nothing — but don't clobber an in-flight in-memory save
  // whose repository write hasn't round-tripped yet.
  useAttachments.setState((s) => ({ items: { ...dict, ...s.items } }));
}

const objectUrlCache = new Map<AttachmentKey, string>();

/**
 * Resolves a displayable URL for an attachment's bytes, reading them back out of
 * the local encrypted vault. Returns null when the record carries no file.
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
  if (!rec.checksum) return rec.fileDataUrl ?? null;

  const bytes = await loadFileLocally(key);
  if (!bytes) return rec.fileDataUrl ?? null;

  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: rec.mimeType || "application/octet-stream" }),
  );
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

  const destKey = makeKey(to.entityType, to.entityId, to.docKey);

  // Prefer the vaulted bytes. Legacy rows only have base64 inlined on the row;
  // those are carried across as-is so a pre-vault design photo still copies.
  let bytes: Uint8Array | null = null;
  if (src.checksum) {
    bytes = await loadFileLocally(srcKey);
  }

  if (!bytes) {
    if (!src.fileDataUrl) return false;
    useAttachments.getState().save(to.entityType, to.entityId, to.docKey, {
      filed: true,
      note: src.note,
      fileName: src.fileName,
      mimeType: src.mimeType,
      fileDataUrl: src.fileDataUrl,
      thumbnailDataUrl: src.thumbnailDataUrl,
    });
    return true;
  }

  const { checksum } = await saveFileLocally(destKey, bytes, {
    fileName: src.fileName,
    mimeType: src.mimeType,
    entityType: to.entityType,
    entityId: to.entityId,
  });

  invalidateAttachmentUrl(to.entityType, to.entityId, to.docKey);
  useAttachments.getState().save(to.entityType, to.entityId, to.docKey, {
    filed: true,
    note: src.note,
    fileName: src.fileName,
    checksum,
    mimeType: src.mimeType,
    thumbnailDataUrl: src.thumbnailDataUrl,
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
