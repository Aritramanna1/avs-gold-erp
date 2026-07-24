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
  checksum?: string;
  mimeType?: string;
  fileDataUrl?: string;
  thumbnailDataUrl?: string;
  bucket?: string;
  storagePath?: string;
  uploadedBy?: string;
};

export type AttachmentKey = string;
const makeKey = (entityType: AttachmentEntityType, entityId: string, docKey: string) =>
  `${entityType}:${entityId}:${docKey}`;

export function generateImageThumbnail(file: File | string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => reject(new Error("Unable to generate image thumbnail"));
    if (typeof file === "string") image.src = file;
    else image.src = URL.createObjectURL(file);
  });
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
    patch: Partial<AttachmentRecord>,
  ) => void;
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
  get: (entityType, entityId, docKey) => getStore().items[makeKey(entityType, entityId, docKey)],
  save: (entityType, entityId, docKey, patch) => {
    const key = makeKey(entityType, entityId, docKey);
    const previous = getStore().items[key] ?? { filed: false, note: "", updatedAt: 0 };
    const next = {
      ...previous,
      ...patch,
      filedAt: patch.filed === true && !previous.filed ? Date.now() : previous.filedAt,
      updatedAt: Date.now(),
    };
    set((state) => ({ items: { ...state.items, [key]: next } }));
    void attachmentsRepository.save({
      id: key,
      file_name: next.fileName ?? null,
      kind: docKey,
      linked_id: entityId,
      linked_table: entityType,
      storage_path: next.storagePath ?? null,
      mime_type: next.mimeType ?? null,
      data: next,
    });
  },
  saveWithFile: async (entityType, entityId, docKey, file, patch = {}) => {
    const bucket = getBucketForEntityType(entityType);
    const { filePath } = await uploadFileToSupabase(bucket, file, entityId, docKey);
    const key = makeKey(entityType, entityId, docKey);
    getStore().save(entityType, entityId, docKey, {
      ...patch,
      filed: patch.filed ?? true,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bucket,
      storagePath: filePath,
      uploadedBy: patch.uploadedBy,
    });
    return getStore().items[key];
  },
  clear: (entityType, entityId, docKey) => {
    const key = makeKey(entityType, entityId, docKey);
    set((state) => {
      const items = { ...state.items };
      delete items[key];
      return { items };
    });
    void attachmentsRepository.delete(key);
  },
  listForEntity: (entityType, entityId) => {
    const prefix = `${entityType}:${entityId}:`;
    return Object.entries(getStore().items)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, rec]) => ({ docKey: key.slice(prefix.length), rec }));
  },
}));

export function isAttachmentFiled(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): boolean {
  return !!useAttachments.getState().items[makeKey(entityType, entityId, docKey)]?.filed;
}

export async function getAttachmentUrl(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): Promise<string | null> {
  const record = useAttachments.getState().items[makeKey(entityType, entityId, docKey)];
  if (!record) return null;
  if (record.bucket && record.storagePath)
    return getAttachmentSignedUrl(record.bucket, record.storagePath);
  return record.fileDataUrl ?? null;
}

export async function copyAttachment(
  from: { entityType: AttachmentEntityType; entityId: string; docKey: string },
  to: { entityType: AttachmentEntityType; entityId: string; docKey: string },
): Promise<boolean> {
  const source =
    useAttachments.getState().items[makeKey(from.entityType, from.entityId, from.docKey)];
  if (!source?.storagePath || !source.bucket) return false;
  useAttachments.getState().save(to.entityType, to.entityId, to.docKey, {
    filed: true,
    note: source.note,
    fileName: source.fileName,
    mimeType: source.mimeType,
    bucket: source.bucket,
    storagePath: source.storagePath,
  });
  return true;
}

export function invalidateAttachmentUrl(
  _entityType: AttachmentEntityType,
  _entityId: string,
  _docKey: string,
): void {}

export function useAttachmentUrl(
  entityType: AttachmentEntityType,
  entityId: string,
  docKey: string,
): string | null {
  const record = useAttachments((state) => state.items[makeKey(entityType, entityId, docKey)]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!record) {
      setUrl(null);
      return;
    }
    void getAttachmentUrl(entityType, entityId, docKey).then((next) => {
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, docKey, record]);
  return url ?? record?.thumbnailDataUrl ?? record?.fileDataUrl ?? null;
}
