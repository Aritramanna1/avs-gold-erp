import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";

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
      fileDataUrl?: string;
      thumbnailDataUrl?: string;
      bucket?: string;
      storagePath?: string;
      uploadedBy?: string;
    },
  ) => void;
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
        data: saved.next,
      });
  },
  clear: (t, id, k) => {
    const key = makeKey(t, id, k);
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
