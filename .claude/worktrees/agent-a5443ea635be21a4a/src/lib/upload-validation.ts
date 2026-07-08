// src/lib/upload-validation.ts
// Validation utilities for file uploads

export interface ValidationOptions {
  // Maximum size in bytes for images
  maxSizeImages?: number;
  // Maximum size in bytes for PDFs and office documents
  maxSizeDocs?: number;
  mimeWhitelistImages?: string[];
  mimeWhitelistDocs?: string[];
  mimeWhitelistOffice?: string[];
}

export const defaultValidationOptions: ValidationOptions = {
  maxSizeImages: 10 * 1024 * 1024, // 10 MB
  maxSizeDocs: 20 * 1024 * 1024, // 20 MB
  mimeWhitelistImages: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"],
  mimeWhitelistDocs: ["application/pdf"],
  mimeWhitelistOffice: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ],
};

/**
 * Checks whether the provided MIME type is allowed according to the whitelist.
 */
export function isValidMime(
  mime: string,
  options: ValidationOptions = defaultValidationOptions,
): boolean {
  const lower = mime.toLowerCase();
  if (options.mimeWhitelistImages?.includes(lower)) return true;
  if (options.mimeWhitelistDocs?.includes(lower)) return true;
  if (options.mimeWhitelistOffice?.includes(lower)) return true;
  return false;
}

/**
 * Returns the maximum allowed size for the given MIME type.
 */
export function getMaxSize(
  mime: string,
  options: ValidationOptions = defaultValidationOptions,
): number {
  const lower = mime.toLowerCase();
  if (options.mimeWhitelistImages?.includes(lower)) return options.maxSizeImages ?? 0;
  if (options.mimeWhitelistDocs?.includes(lower) || options.mimeWhitelistOffice?.includes(lower))
    return options.maxSizeDocs ?? 0;
  return 0;
}

/**
 * Computes a SHA‑256 hash of the file content.
 */
export async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
