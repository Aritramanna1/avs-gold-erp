import { type AttachmentEntityType } from "./attachments-store";
import { compressImage } from "./image-compression";
import { saveFile as saveFileLocally, loadFile as loadFileLocally } from "./local-file-store";
import { initLocalDb } from "./local-db";

const localUrlCache = new Map<string, string>();

function localFileId(namespace: string, path: string): string {
  return `storage:${namespace}:${path}`;
}

async function storeLocal(
  namespace: string,
  path: string,
  blob: Blob,
  fileName: string,
  mimeType: string,
  entityId: string,
): Promise<void> {
  await initLocalDb();
  await saveFileLocally(localFileId(namespace, path), new Uint8Array(await blob.arrayBuffer()), {
    fileName,
    mimeType,
    entityType: namespace,
    entityId,
  });
}

async function localUrl(namespace: string, path: string): Promise<string> {
  const id = localFileId(namespace, path);
  const cached = localUrlCache.get(id);
  if (cached) return cached;
  await initLocalDb();
  const bytes = await loadFileLocally(id);
  if (!bytes) return "";
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  localUrlCache.set(id, url);
  return url;
}

/** Local-vault namespace mapper. The returned value is never a cloud bucket. */
export function getBucketForEntityType(
  entityType: AttachmentEntityType | "firm-logo" | "expense",
): string {
  if (entityType === "firm-logo") return "firm-assets";
  switch (entityType) {
    case "catalog":
      return "catalog-designs";
    case "person":
      return "customer-documents";
    case "worker":
      return "worker-kyc";
    case "supplier":
      return "supplier-documents";
    case "order":
    case "jobcard":
      return "order-attachments";
    case "repair":
      return "repair-attachments";
    case "expense":
      return "expense-receipts";
    default:
      return "order-attachments";
  }
}

let readyPromise: Promise<void> | null = null;

/** Compatibility no-op: local storage requires no bucket provisioning. */
export function ensureStorageBucketsReady(): Promise<void> {
  if (!readyPromise) readyPromise = Promise.resolve();
  return readyPromise;
}

export function base64ToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const parts = dataUrl.split(";base64,");
  const mimeType = parts[0].split(":")[1] || "application/octet-stream";
  const characters = atob(parts[1]);
  const bytes = new Uint8Array(characters.length);
  for (let index = 0; index < characters.length; index += 1) {
    bytes[index] = characters.charCodeAt(index);
  }
  return { blob: new Blob([bytes.buffer], { type: mimeType }), mimeType };
}

/**
 * Stores a file in the local application vault in every deployment mode.
 * The historical export name is retained to avoid rewriting completed callers.
 */
export async function uploadToSupabaseStorage(
  namespace: string,
  fileName: string,
  dataUrl: string,
  entityId: string,
  docKey: string,
): Promise<string> {
  const { blob, mimeType } = base64ToBlob(dataUrl);
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const ext = safeName.split(".").pop() || mimeType.split("/")[1] || "bin";
  const path = `${entityId}/${docKey}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  await storeLocal(namespace, path, blob, safeName, mimeType, entityId);
  return path;
}

/** Resolves a local object URL; no cloud signed URL is generated. */
export async function getAttachmentSignedUrl(
  namespace: string,
  path: string,
  _forceRefresh = false,
): Promise<string> {
  return localUrl(namespace, path);
}

/** Compresses an image and stores it in the local application vault. */
export async function uploadFileToSupabase(
  namespace: string,
  file: File,
  entityId: string,
  docKey: string,
): Promise<{ filePath: string; signedUrl: string }> {
  const { file: storedFile } = await compressImage(file);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(storedFile);
  });
  const filePath = await uploadToSupabaseStorage(
    namespace,
    storedFile.name,
    dataUrl,
    entityId,
    docKey,
  );
  return { filePath, signedUrl: await getAttachmentSignedUrl(namespace, filePath) };
}
