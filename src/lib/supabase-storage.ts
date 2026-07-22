import { type AttachmentEntityType } from "./attachments-store";
import { compressImage } from "./image-compression";
import { getCloudDataClient } from "./providers/data-provider";

export function getBucketForEntityType(
  entityType: AttachmentEntityType | "firm-logo" | "expense",
): string {
  if (entityType === "firm-logo") return "firm-assets";
  switch (entityType) {
    case "catalog":
      return "catalog-designs";
    case "expense":
      return "expense-receipts";
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
    default:
      return "order-attachments";
  }
}

export function ensureStorageBucketsReady(): Promise<void> {
  return Promise.resolve();
}

export function base64ToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const [header, encoded] = dataUrl.split(",", 2);
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

export async function uploadToSupabaseStorage(
  namespace: string,
  fileName: string,
  dataUrl: string,
  entityId: string,
  docKey: string,
): Promise<string> {
  const { blob } = base64ToBlob(dataUrl);
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${entityId}/${docKey}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;
  const { error } = await getCloudDataClient().storage.from(namespace).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });
  if (error) throw new Error(`Cloud file upload failed: ${error.message}`);
  return path;
}

export async function getAttachmentSignedUrl(
  namespace: string,
  path: string,
  forceRefresh = false,
): Promise<string> {
  const { data, error } = await getCloudDataClient().storage
    .from(namespace)
    .createSignedUrl(path, 3600, forceRefresh ? { download: true } : undefined);
  if (error) throw new Error(`Cloud file URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function uploadFileToSupabase(
  namespace: string,
  file: File,
  entityId: string,
  docKey: string,
): Promise<{ filePath: string; signedUrl: string }> {
  const { file: compressed } = await compressImage(file);
  const path = `${entityId}/${docKey}_${Date.now()}_${compressed.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { error } = await getCloudDataClient().storage.from(namespace).upload(path, compressed, {
    contentType: compressed.type,
    upsert: true,
  });
  if (error) throw new Error(`Cloud file upload failed: ${error.message}`);
  return { filePath: path, signedUrl: await getAttachmentSignedUrl(namespace, path) };
}
