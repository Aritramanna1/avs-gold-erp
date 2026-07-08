/**
 * MTJ ERP — Automatic Image Compression
 * Runs entirely in the browser using Canvas API.
 * Called before ANY image upload — no manual compression needed.
 *
 * Usage:
 *   const compressed = await compressImage(file, { maxWidth: 800, quality: 0.82 });
 *   // Then upload `compressed` instead of the original `file`
 */

export interface CompressOptions {
  /** Max width in pixels. Height is scaled proportionally. Default: 1200 */
  maxWidth?: number;
  /** Max height in pixels. Default: 1200 */
  maxHeight?: number;
  /** JPEG/WebP quality 0–1. Default: 0.82 */
  quality?: number;
  /** Output format. Default: "image/webp" with JPEG fallback */
  format?: "image/webp" | "image/jpeg" | "image/png";
  /** Also generate a thumbnail at this size. Default: 200 */
  thumbnailSize?: number;
}

export interface CompressResult {
  /** Compressed image as a File */
  file: File;
  /** Compressed image as base64 data URL */
  dataUrl: string;
  /** Thumbnail base64 data URL */
  thumbnailDataUrl: string;
  /** Compressed size in bytes */
  sizeBytes: number;
  /** Original size in bytes */
  originalSizeBytes: number;
  /** Compression ratio (0–1, lower = more compressed) */
  compressionRatio: number;
  width: number;
  height: number;
}

/**
 * Checks if WebP is supported in this browser.
 */
function supportsWebP(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

/**
 * Compress an image File before upload.
 * Returns compressed file + thumbnails.
 */
export async function compressImage(
  source: File | Blob | string, // File, Blob, or data URL
  opts: CompressOptions = {},
): Promise<CompressResult> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.82, thumbnailSize = 200 } = opts;

  // Determine output format
  const format = opts.format ?? (supportsWebP() ? "image/webp" : "image/jpeg");
  const originalSize = source instanceof Blob ? source.size : 0;

  // Load image
  const img = await loadImage(source);

  // Calculate scaled dimensions
  let { width, height } = img;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  // Draw to canvas at scaled size
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // Export compressed
  const dataUrl = canvas.toDataURL(format, quality);

  // Generate thumbnail
  const thumbCanvas = document.createElement("canvas");
  const thumbScale = Math.min(1, thumbnailSize / width, thumbnailSize / height);
  thumbCanvas.width = Math.round(width * thumbScale);
  thumbCanvas.height = Math.round(height * thumbScale);
  const tCtx = thumbCanvas.getContext("2d")!;
  tCtx.imageSmoothingEnabled = true;
  tCtx.imageSmoothingQuality = "high";
  tCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumbnailDataUrl = thumbCanvas.toDataURL(format, 0.7);

  // Convert data URL to File
  const blob = dataUrlToBlob(dataUrl);
  const ext = format === "image/webp" ? "webp" : format === "image/png" ? "png" : "jpg";
  const fileName =
    source instanceof File ? source.name.replace(/\.[^.]+$/, `.${ext}`) : `image.${ext}`;
  const file = new File([blob], fileName, { type: format });

  return {
    file,
    dataUrl,
    thumbnailDataUrl,
    sizeBytes: blob.size,
    originalSizeBytes: originalSize,
    compressionRatio: originalSize > 0 ? blob.size / originalSize : 1,
    width,
    height,
  };
}

/**
 * Convenience: compress + return just the data URLs (for attachment stores).
 */
export async function compressToDataUrls(
  source: File | Blob,
  opts: CompressOptions = {},
): Promise<{ dataUrl: string; thumbnailDataUrl: string }> {
  const result = await compressImage(source, opts);
  return { dataUrl: result.dataUrl, thumbnailDataUrl: result.thumbnailDataUrl };
}

/**
 * Compress an image and return a Supabase-uploadable Blob.
 * Use for stock photos, customer photos, order images, etc.
 */
export async function compressForUpload(
  source: File,
  opts: CompressOptions = {},
): Promise<{ file: File; thumbnailDataUrl: string; compressionRatio: number }> {
  const result = await compressImage(source, opts);
  return {
    file: result.file,
    thumbnailDataUrl: result.thumbnailDataUrl,
    compressionRatio: result.compressionRatio,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (typeof source === "string") {
      img.src = source;
    } else {
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.src = url;
    }
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
