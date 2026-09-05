import { type AttachmentEntityType } from "./attachments-store";
import { compressImage, compressOptionsForBucket } from "./image-compression";
import { buildFirmStoragePath, resolveStoragePathContext } from "./storage-paths";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { PortalType } from "@/lib/portal/portal-context-service";

const R2_PROXY_URL = (() => {
  const raw =
    typeof import.meta.env !== "undefined"
      ? (import.meta.env.VITE_R2_PROXY_URL as string | undefined)
      : undefined;
  if (!raw) return "https://mtj-storage-proxy.aritramanna222.workers.dev";
  return raw.trim().replace(/[./]+$/, "").replace(/\/+$/, "") || "https://mtj-storage-proxy.aritramanna222.workers.dev";
})();

async function r2AuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session ? `Bearer ${data.session.access_token}` : "";
}

/** True when URL points at our legacy authenticated R2 proxy. */
export function isR2ProxyUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("mtj-storage-proxy") || url.includes("r2.cloudflarestorage.com")) return true;
  if (R2_PROXY_URL && url.startsWith(R2_PROXY_URL)) return true;
  try {
    return R2_PROXY_URL ? new URL(url).host === new URL(R2_PROXY_URL).host : false;
  } catch {
    return false;
  }
}

/**
 * Fetch image/file bytes for PDF embedding and rendering.
 * Supports native Supabase storage URLs, direct blob URLs, and legacy R2 fallbacks.
 */
export async function fetchAuthorizedObjectBlob(url: string): Promise<Blob> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Empty image URL");

  if (trimmed.startsWith("data:")) {
    const res = await fetch(trimmed);
    if (!res.ok) throw new Error(`data URL fetch failed: ${res.status}`);
    return res.blob();
  }

  if (trimmed.startsWith("blob:")) {
    const res = await fetch(trimmed);
    if (!res.ok) throw new Error(`blob URL fetch failed: ${res.status}`);
    return res.blob();
  }

  let absolute = trimmed;
  if (trimmed.startsWith("/") && typeof window !== "undefined") {
    absolute = `${window.location.origin}${trimmed}`;
  }

  try {
    const res = await fetch(absolute, { mode: "cors" });
    if (res.ok) return res.blob();
  } catch {
    /* proceed to fallback */
  }

  if (isR2ProxyUrl(absolute) || (R2_PROXY_URL && absolute.startsWith(R2_PROXY_URL))) {
    const auth = await r2AuthHeader();
    const res = await fetch(absolute, { headers: auth ? { Authorization: auth } : {} });
    if (!res.ok) throw new Error(`R2 image load failed: ${res.status}`);
    return res.blob();
  }

  const res = await fetch(absolute);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  return res.blob();
}

/** Legacy R2 compatibility no-op. */
export function revokeR2DisplayUrl(bucket: string, path: string): void {
  /* direct URLs require no revocation */
}

/**
 * Resolves a stable browser-displayable URL for an object.
 * Priority: Self-Hosted Supabase Storage $\to$ Legacy URL fallback.
 */
export function getDirectR2ObjectUrl(bucket: string, path: string): string {
  if (!path) return "";
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const cleanPath = path.replace(/^\/+/, "");
  if (R2_PROXY_URL) {
    return `${R2_PROXY_URL}/${bucket}/${cleanPath}`;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  return data?.publicUrl || cleanPath;
}

/** Deletes an object from Supabase Storage and removes matching storage_file_metadata. */
export async function deleteFromSupabaseStorage(namespace: string, path: string): Promise<void> {
  const cleanPath = path.replace(/^\/+/, "");
  const { error: storageError } = await supabase.storage.from(namespace).remove([cleanPath]);
  if (storageError) {
    console.warn(`[storage] Supabase storage delete warning for ${namespace}/${cleanPath}:`, storageError.message);
  }

  const { error: dbError } = await (supabase as any)
    .from("storage_file_metadata")
    .delete()
    .eq("bucket_id", namespace)
    .eq("storage_path", cleanPath);
  if (dbError) {
    console.warn("[storage] metadata delete failed:", dbError.message);
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

/** Resolves a stored object path to an accessible URL. */
export async function resolveR2ObjectUrl(
  bucket: string,
  storagePath: string | null | undefined,
): Promise<string | null> {
  if (!storagePath) return null;
  return getAttachmentSignedUrl(bucket, storagePath);
}

let readyPromise: Promise<void> | null = null;

/** Compatibility no-op: remote storage provisioning is managed in database setup. */
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
  const userId = auth?.user?.id || "00000000-0000-0000-0000-000000000000";
  const { error } = await (supabase as any).from("storage_file_metadata").insert({
    firm_id: input.context.firmId,
    branch_id: input.context.branchId,
    entity_type: input.bucketId,
    entity_id: input.entityId,
    bucket_id: input.bucketId,
    storage_path: input.path,
    uploaded_by: userId,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    visibility: "internal",
  });
  if (error) {
    console.warn(`[storage] Storage metadata record warning: ${error.message}`);
  }
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
 * Stores a base64-encoded file directly in self-hosted Supabase Storage.
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
  const path = buildFirmStoragePath(
    context,
    namespace,
    entityId,
    `${crypto.randomUUID()}-${safeName}`,
  );

  const { error: uploadError } = await supabase.storage
    .from(namespace)
    .upload(path, blob, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

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

/**
 * Platform voice reference upload via Supabase Storage.
 */
export async function uploadCentralOrnexaVoiceAudio(
  file: File | Blob,
  fileName = "ornexa-central-voice.webm",
): Promise<{ path: string; bucket: string; mimeType: string; sizeBytes: number }> {
  const blob = file instanceof Blob ? file : new Blob([file]);
  const mimeType = blob.type || "audio/webm";
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `platform/ornexa_central_voice/ref/${crypto.randomUUID()}-${safeName}`;
  
  const { error } = await supabase.storage.from("firm-assets").upload(path, blob, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Central voice upload failed: ${error.message}`);
  return { path, bucket: "firm-assets", mimeType, sizeBytes: blob.size };
}

/** Download central voice reference bytes via Supabase Storage. */
export async function downloadCentralOrnexaVoiceAudio(
  bucket: string,
  path: string,
): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Could not load central voice audio: ${error?.message}`);
  return data;
}

/** Returns a permanent or signed URL for a stored file. */
export async function getAttachmentSignedUrl(
  namespace: string,
  path: string,
  forceRefresh = false,
): Promise<string> {
  if (!path) return "";
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const cleanPath = path.replace(/^\/+/, "");
  
  if (R2_PROXY_URL) {
    return `${R2_PROXY_URL}/${namespace}/${cleanPath}`;
  }

  // Public buckets
  if (
    namespace === "firm-assets" ||
    namespace === "inventory-images" ||
    namespace === "catalog-designs" ||
    namespace === "persistence-bucket"
  ) {
    const { data } = supabase.storage.from(namespace).getPublicUrl(cleanPath);
    return data?.publicUrl || cleanPath;
  }

  // Private buckets: Generate signed URL
  const { data, error } = await supabase.storage.from(namespace).createSignedUrl(cleanPath, 7200);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  // Fallback to public URL
  const { data: pubData } = supabase.storage.from(namespace).getPublicUrl(cleanPath);
  return pubData?.publicUrl || cleanPath;
}

/** Compresses an image and stores it directly in Self-Hosted Supabase Storage. */
export async function uploadFileToSupabase(
  namespace: string,
  file: File,
  entityId: string,
  docKey: string,
  branchId?: string | null,
  portalType?: PortalType | null,
): Promise<{ filePath: string; signedUrl: string }> {
  const { file: storedFile } = await compressImage(file, compressOptionsForBucket(namespace));
  const context = await resolveStoragePathContext(branchId, portalType);
  const filePath = buildFirmStoragePath(
    context,
    namespace,
    entityId,
    `${crypto.randomUUID()}-${storedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
  );

  const { error: uploadError } = await supabase.storage
    .from(namespace)
    .upload(filePath, storedFile, {
      contentType: storedFile.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  await recordStorageMetadata({
    context,
    bucketId: namespace,
    path: filePath,
    entityId,
    mimeType: storedFile.type || "application/octet-stream",
    sizeBytes: storedFile.size,
  });

  const signedUrl = await getAttachmentSignedUrl(namespace, filePath);
  return { filePath, signedUrl };
}
