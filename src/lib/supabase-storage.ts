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
  if (!raw) return undefined;
  // Tolerate trailing slash / typo dots from env files.
  return raw.trim().replace(/[./]+$/, "").replace(/\/+$/, "") || undefined;
})();

async function r2AuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session ? `Bearer ${data.session.access_token}` : "";
}

/** True when URL points at our authenticated R2 proxy (needs Bearer fetch). */
export function isR2ProxyUrl(url: string): boolean {
  if (!R2_PROXY_URL || !url) return false;
  if (url.startsWith(R2_PROXY_URL)) return true;
  try {
    return new URL(url).host === new URL(R2_PROXY_URL).host;
  } catch {
    return false;
  }
}

/**
 * Fetch image/file bytes for PDF embedding.
 * - blob:/data: → plain fetch (already authorized in-memory)
 * - R2 proxy HTTPS → Authorization: Bearer session (never public)
 * - same-origin /assets → plain fetch
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

  if (isR2ProxyUrl(absolute) || (R2_PROXY_URL && absolute.startsWith(R2_PROXY_URL))) {
    const auth = await r2AuthHeader();
    if (!auth) throw new Error("Sign in again to load stored images for PDF.");
    const res = await fetch(absolute, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`R2 image load failed: ${res.status}`);
    return res.blob();
  }

  const res = await fetch(absolute, { credentials: "include" });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  return res.blob();
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

async function r2ProxyObjectUrl(bucket: string, path: string): Promise<string> {
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  return `${R2_PROXY_URL}/${bucket}/${path}`;
}

/** In-memory blob: URLs for <img src> — proxy URLs need Authorization and cannot be used directly. */
const r2BlobUrlCache = new Map<string, string>();
const r2BlobUrlInflight = new Map<string, Promise<string>>();

function r2CacheKey(bucket: string, path: string): string {
  return `${bucket}::${path}`;
}

/** Drop a cached display URL (call after replace/delete). */
export function revokeR2DisplayUrl(bucket: string, path: string): void {
  const key = r2CacheKey(bucket, path);
  const existing = r2BlobUrlCache.get(key);
  if (existing?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(existing);
    } catch {
      /* ignore */
    }
  }
  r2BlobUrlCache.delete(key);
  r2BlobUrlInflight.delete(key);
}

/**
 * Fetch an R2 object with the session JWT and return a blob: URL safe for <img>/<a>.
 * The raw proxy URL cannot be used in img tags — browsers do not send Authorization.
 */
async function r2DisplayBlobUrl(bucket: string, path: string): Promise<string> {
  if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("/")) {
    return path;
  }
  if (/^https?:\/\//i.test(path) && !R2_PROXY_URL?.length) {
    return path;
  }
  // Absolute URL that is already our proxy → still needs auth fetch
  const key = r2CacheKey(bucket, path);
  const cached = r2BlobUrlCache.get(key);
  if (cached) return cached;

  let inflight = r2BlobUrlInflight.get(key);
  if (!inflight) {
    inflight = (async () => {
      const auth = await r2AuthHeader();
      if (!auth) throw new Error("Sign in again to load stored images.");
      const objectUrl = path.startsWith("http")
        ? path
        : await r2ProxyObjectUrl(bucket, path);
      const res = await fetch(objectUrl, { headers: { Authorization: auth } });
      if (!res.ok) {
        throw new Error(`R2 image load failed: ${res.status}`);
      }
      const blob = await res.blob();
      const displayUrl = URL.createObjectURL(blob);
      r2BlobUrlCache.set(key, displayUrl);
      return displayUrl;
    })().finally(() => {
      r2BlobUrlInflight.delete(key);
    });
    r2BlobUrlInflight.set(key, inflight);
  }
  return inflight;
}

async function r2Delete(bucket: string, path: string): Promise<void> {
  const res = await fetch(`${R2_PROXY_URL}/${bucket}/${path}`, {
    method: "DELETE",
    headers: { Authorization: await r2AuthHeader() },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status} ${await res.text()}`);
  }
  revokeR2DisplayUrl(bucket, path);
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

/**
 * Platform Owner only — product-wide AVS central voice reference.
 * Path: platform/ornexa_central_voice/ref/{uuid}-{file}
 * All authenticated firms may download via the storage proxy.
 */
export async function uploadCentralOrnexaVoiceAudio(
  file: File | Blob,
  fileName = "ornexa-central-voice.webm",
): Promise<{ path: string; bucket: string; mimeType: string; sizeBytes: number }> {
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  const blob = file instanceof Blob ? file : new Blob([file]);
  const mimeType = blob.type || "audio/webm";
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `platform/ornexa_central_voice/ref/${crypto.randomUUID()}-${safeName}`;
  await r2Upload("firm-assets", path, blob, mimeType);
  return { path, bucket: "firm-assets", mimeType, sizeBytes: blob.size };
}

/** Download central voice reference bytes (authenticated). */
export async function downloadCentralOrnexaVoiceAudio(
  bucket: string,
  path: string,
): Promise<Blob> {
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  if (!path.startsWith("platform/ornexa_central_voice/")) {
    throw new Error("Not a central AVS ERP voice path.");
  }
  const auth = await r2AuthHeader();
  if (!auth) throw new Error("Sign in again to load the AVS ERP voice.");
  const res = await fetch(`${R2_PROXY_URL}/${bucket}/${path}`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) throw new Error(`Could not load central voice audio: ${res.status}`);
  return res.blob();
}

/** Returns a browser-displayable URL for a stored file (authenticated blob: URL). */
export async function getAttachmentSignedUrl(
  namespace: string,
  path: string,
  forceRefresh = false,
): Promise<string> {
  if (!R2_PROXY_URL) throw new Error("Cloudflare R2 storage is not configured for this build.");
  if (forceRefresh) revokeR2DisplayUrl(namespace, path);
  return r2DisplayBlobUrl(namespace, path);
}

/** Compresses an image and stores it in Cloudflare R2. */
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
