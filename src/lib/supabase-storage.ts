import { type AttachmentEntityType } from "./attachments-store";
import { compressImage } from "./image-compression";
import { buildFirmStoragePath, resolveStoragePathContext } from "./storage-paths";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

const R2_PROXY_URL =
  typeof import.meta.env !== "undefined"
    ? (import.meta.env.VITE_R2_PROXY_URL as string | undefined)
    : undefined;

async function r2AuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session ? `Bearer ${data.session.access_token}` : "";
}

async function r2Upload(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType: string,
): Promise<void> {
  const res = await fetch(`${R2_PROXY_URL}/${bucket}/${path}`, {
    method: "PUT",
    headers: { Authorization: await r2AuthHeader(), "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`);
}

async function r2SignedUrl(bucket: string, path: string): Promise<string> {
  // Worker streams the object directly — URL itself is the "signed URL" gated by JWT.
  // Cache the URL client-side; it stays valid as long as the session is valid.
  return `${R2_PROXY_URL}/${bucket}/${path}`;
}

async function r2Delete(bucket: string, path: string): Promise<void> {
  const res = await fetch(`${R2_PROXY_URL}/${bucket}/${path}`, {
    method: "DELETE",
    headers: { Authorization: await r2AuthHeader() },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status} ${await res.text()}`);
  }
}

/** Deletes an object from R2 and removes matching storage_file_metadata when present. */
export async function deleteFromSupabaseStorage(namespace: string, path: string): Promise<void> {
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  await r2Delete(namespace, path);
  const { error } = await (supabase as any)
    .from("storage_file_metadata")
    .delete()
    .eq("bucket_id", namespace)
    .eq("storage_path", path);
  if (error) {
    console.warn("[storage] metadata delete failed:", error.message);
  }
}

/** Maps attachment entity types to the configured remote storage namespace. */
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
    case "stock":
      return "stock-assets";
    default:
      return "order-attachments";
  }
}

/** Resolves a stored object path to an authenticated R2 proxy URL. */
export async function resolveR2ObjectUrl(
  bucket: string,
  storagePath: string | null | undefined,
): Promise<string | null> {
  if (!storagePath) return null;
  return getAttachmentSignedUrl(bucket, storagePath);
}

let readyPromise: Promise<void> | null = null;

/** Compatibility no-op: remote storage provisioning is managed outside the browser. */
export function ensureStorageBucketsReady(): Promise<void> {
  if (!readyPromise) readyPromise = Promise.resolve();
  return readyPromise;
}

async function recordStorageMetadata(input: {
  context: { firmId: string; branchId: string };
  bucketId: string;
  path: string;
  entityId: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("You must be logged in to upload files.");
  const { error } = await (supabase as any).from("storage_file_metadata").insert({
    firm_id: input.context.firmId,
    branch_id: input.context.branchId,
    entity_type: input.bucketId,
    entity_id: input.entityId,
    bucket_id: input.bucketId,
    storage_path: input.path,
    uploaded_by: auth.user.id,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    visibility: "internal",
  });
  if (error) throw new Error(`Storage metadata failed: ${error.message}`);
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
 * Stores a file in Cloudflare R2 through the authenticated storage proxy.
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
  const context = await resolveStoragePathContext();
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  const path = buildFirmStoragePath(
    context,
    namespace,
    entityId,
    `${crypto.randomUUID()}-${safeName}`,
  );
  await r2Upload(namespace, path, blob, mimeType);
  await recordStorageMetadata({
    context,
    bucketId: namespace,
    path,
    entityId,
    mimeType,
    sizeBytes: blob.size,
  });
  return path;
}

/** Returns a URL for downloading a stored file. */
export async function getAttachmentSignedUrl(
  namespace: string,
  path: string,
  _forceRefresh = false,
): Promise<string> {
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  return r2SignedUrl(namespace, path);
}

/** Compresses an image and stores it in Cloudflare R2. */
export async function uploadFileToSupabase(
  namespace: string,
  file: File,
  entityId: string,
  docKey: string,
  branchId?: string | null,
): Promise<{ filePath: string; signedUrl: string }> {
  const { file: storedFile } = await compressImage(file);
  const context = await resolveStoragePathContext(branchId);
  const filePath = buildFirmStoragePath(
    context,
    namespace,
    entityId,
    `${crypto.randomUUID()}-${storedFile.name}`,
  );
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  await r2Upload(namespace, filePath, storedFile, storedFile.type || "application/octet-stream");
  await recordStorageMetadata({
    context,
    bucketId: namespace,
    path: filePath,
    entityId,
    mimeType: storedFile.type || "application/octet-stream",
    sizeBytes: storedFile.size,
  });
  return { filePath, signedUrl: await getAttachmentSignedUrl(namespace, filePath) };
}
