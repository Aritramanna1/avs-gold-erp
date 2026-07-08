import { supabase } from "@/integrations/supabase/client";
import { type AttachmentEntityType } from "./attachments-store";
import { compressImage } from "./image-compression";

const BUCKETS = [
  "firm-assets",
  "catalog-designs",
  "customer-documents",
  "worker-kyc",
  "supplier-documents",
  "order-attachments",
  "repair-attachments",
  "expense-receipts",
];

// Map our entity types to the requested Supabase Storage buckets
export function getBucketForEntityType(
  entityType: AttachmentEntityType | "firm-logo" | "expense",
): string {
  if (entityType === "firm-logo") {
    return "firm-assets";
  }
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
      return "order-attachments"; // Safe fallback
  }
}

let _bucketsInitPromise: Promise<void> | null = null;

/**
 * Ensures storage bucket names are recorded for upload routing.
 * Bucket creation requires service-role access and is handled by Supabase migrations/dashboard.
 * The anon/publishable key cannot create buckets — this function is a no-op safety guard
 * that runs only once per process lifetime to avoid spamming the Supabase API.
 */
export function ensureStorageBucketsReady(): Promise<void> {
  if (_bucketsInitPromise) return _bucketsInitPromise;
  _bucketsInitPromise = Promise.resolve();
  return _bucketsInitPromise;
}

/**
 * Converts a Base64 Data URL to a native binary Blob.
 */
export function base64ToBlob(base64DataUrl: string): { blob: Blob; mimeType: string } {
  const parts = base64DataUrl.split(";base64,");
  const mimeType = parts[0].split(":")[1] || "application/octet-stream";
  const b64Data = parts[1];

  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: mimeType });
  return { blob, mimeType };
}

/**
 * Uploads a local file / Base64 image to Supabase Storage.
 * Returns the final storage path inside the bucket.
 */
export async function uploadToSupabaseStorage(
  bucket: string,
  fileName: string,
  base64DataUrl: string,
  entityId: string,
  docKey: string,
): Promise<string> {
  const { blob, mimeType } = base64ToBlob(base64DataUrl);

  // Clean special characters from file names and generate a unique file key
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileExt = sanitizedName.split(".").pop() || mimeType.split("/")[1] || "bin";
  const uniqueId = Math.random().toString(36).substring(2, 10);
  const filePath = `${entityId}/${docKey}_${Date.now()}_${uniqueId}.${fileExt}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, blob, {
    contentType: mimeType,
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return filePath;
}

// Global cache for signed URLs to minimize Supabase API calls
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Generates a signed access URL for private files with short TTL (e.g., 1 hour).
 * Caches in-memory to prevent rapid re-signing.
 */
export async function getAttachmentSignedUrl(
  bucket: string,
  path: string,
  forceRefresh = false,
): Promise<string> {
  const cacheKey = `${bucket}:${path}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = signedUrlCache.get(cacheKey);
    // Cache remains valid for 45 minutes of the signed 1 hour
    if (cached && cached.expiresAt > now) {
      return cached.url;
    }
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600); // 1 hour validity

    if (error || !data?.signedUrl) {
      console.error(
        `[Storage] Failed to generate signed URL for path '${path}' in bucket '${bucket}':`,
        error,
      );
      return "";
    }

    signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: now + 45 * 60 * 1000, // 45 minutes TTL
    });

    return data.signedUrl;
  } catch (err) {
    console.error("[Storage] Error fetching signed URL:", err);
    return "";
  }
}

/**
 * High-level helper to compress an image file, convert it to Base64,
 * upload it to Supabase Storage, and return the storage path and a signed URL.
 */
export async function uploadFileToSupabase(
  bucket: string,
  file: File,
  entityId: string,
  docKey: string,
): Promise<{ filePath: string; signedUrl: string }> {
  // 1. Pre-compress image if applicable
  const compResult = await compressImage(file);
  const fileToUpload = compResult.file;

  // 2. Convert to Base64
  const base64DataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(fileToUpload);
  });

  // 3. Upload to Supabase Storage
  const filePath = await uploadToSupabaseStorage(
    bucket,
    fileToUpload.name,
    base64DataUrl,
    entityId,
    docKey,
  );

  // 4. Pre-sign the URL for direct presentation
  const signedUrl = await getAttachmentSignedUrl(bucket, filePath);

  return { filePath, signedUrl };
}
