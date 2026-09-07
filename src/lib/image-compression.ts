/**
 * Compresses photographs for Cloudflare R2.
 * Default preset suits KYC / receipts. Catalog designs use a near-original
 * preset so product photos stay sharp.
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  optimized: boolean;
}

export type CompressImageOptions = {
  /** Long-edge cap in px. */
  maxEdge?: number;
  webpQuality?: number;
  jpegQuality?: number;
  /**
   * If the original is at/under this byte size and within maxEdge, keep the
   * original bytes (no re-encode). Catalog uses a high threshold.
   */
  preferOriginalUnderBytes?: number;
};

export const IMAGE_COMPRESS_PRESETS = {
  /** KYC, receipts, general attachments */
  default: {
    maxEdge: 1080,
    webpQuality: 0.72,
    jpegQuality: 0.75,
    preferOriginalUnderBytes: 80 * 1024,
  } satisfies CompressImageOptions,
  /** Catalogue / design photos — crisp high-definition without multi-megabyte bloat */
  catalog: {
    maxEdge: 1600,
    webpQuality: 0.85,
    jpegQuality: 0.88,
    preferOriginalUnderBytes: 300 * 1024,
  } satisfies CompressImageOptions,
  /** Stock item photos */
  stock: {
    maxEdge: 1200,
    webpQuality: 0.8,
    jpegQuality: 0.82,
    preferOriginalUnderBytes: 150 * 1024,
  } satisfies CompressImageOptions,
  /** Thumbnail variant for fast grid/list rendering */
  thumbnail: {
    maxEdge: 320,
    webpQuality: 0.7,
    jpegQuality: 0.7,
    preferOriginalUnderBytes: 40 * 1024,
  } satisfies CompressImageOptions,
} as const;

const MAX_BYTES = 15 * 1024 * 1024;

function encodeBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

export async function compressImage(
  file: File,
  options?: CompressImageOptions,
): Promise<CompressionResult> {
  const opts = { ...IMAGE_COMPRESS_PRESETS.default, ...options };
  const maxEdge = opts.maxEdge ?? 1080;
  const webpQuality = opts.webpQuality ?? 0.72;
  const jpegQuality = opts.jpegQuality ?? 0.75;
  const preferOriginalUnderBytes = opts.preferOriginalUnderBytes ?? 80 * 1024;

  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds the maximum limit of 15MB.");
  }

  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      optimized: false,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const needsResize = img.width > maxEdge || img.height > maxEdge;
          if (!needsResize && file.size <= preferOriginalUnderBytes) {
            resolve({
              file,
              originalSize: file.size,
              compressedSize: file.size,
              optimized: false,
            });
            return;
          }

          let width = img.width;
          let height = img.height;
          if (needsResize) {
            if (width > height) {
              height = Math.round((height * maxEdge) / width);
              width = maxEdge;
            } else {
              width = Math.round((width * maxEdge) / height);
              height = maxEdge;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not create canvas 2D context.");
          ctx.drawImage(img, 0, 0, width, height);

          // Prefer JPEG for catalog-quality photos (broader print/PDF support).
          // WebP only when it clearly wins size without a big quality drop.
          let blob = await encodeBlob(canvas, "image/jpeg", jpegQuality);
          let mime = "image/jpeg";
          const webp = await encodeBlob(canvas, "image/webp", webpQuality);
          if (webp && webp.size > 0 && webp.size < (blob?.size ?? Infinity) * 0.85) {
            blob = webp;
            mime = "image/webp";
          }
          if (!blob) {
            reject(new Error("Image compression failed."));
            return;
          }

          if (blob.size >= file.size && !needsResize) {
            resolve({
              file,
              originalSize: file.size,
              compressedSize: file.size,
              optimized: false,
            });
            return;
          }

          const ext = mime === "image/webp" ? "webp" : "jpg";
          const base = file.name.includes(".")
            ? file.name.slice(0, file.name.lastIndexOf("."))
            : file.name;
          const compressedFile = new File([blob], `${base}.${ext}`, {
            type: mime,
            lastModified: Date.now(),
          });
          resolve({
            file: compressedFile,
            originalSize: file.size,
            compressedSize: blob.size,
            optimized: true,
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for optimization."));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image for optimization."));
    reader.readAsDataURL(file);
  });
}

/** Pick compression preset from R2 namespace / attachment bucket. */
export function compressOptionsForBucket(bucket: string): CompressImageOptions {
  if (bucket === "catalog-designs") return IMAGE_COMPRESS_PRESETS.catalog;
  if (bucket === "stock-assets") return IMAGE_COMPRESS_PRESETS.stock;
  return IMAGE_COMPRESS_PRESETS.default;
}
