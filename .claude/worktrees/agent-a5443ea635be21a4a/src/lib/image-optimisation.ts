/**
 * MTJ ERP — Image Optimisation Utilities
 * Handles EXIF orientation, resize, and thumbnail generation
 * Does NOT touch PDFs or office documents.
 */

const MAX_DIMENSION_PX = 2000;
const THUMBNAIL_SIZE_PX = 200;
const IMAGE_QUALITY = 0.82;

export interface OptimisedImages {
  /** Primary image — EXIF corrected, resized if needed */
  file: File;
  /** 200×200 thumbnail — only generated when requested */
  thumbnail?: File;
}

/**
 * Returns true if the MIME type is a raster image we can process.
 */
export function isRasterImage(mime: string): boolean {
  return /^image\/(jpeg|jpg|png|webp|heic)/i.test(mime);
}

/**
 * Reads an image file, corrects EXIF orientation, resizes if > MAX_DIMENSION_PX,
 * and optionally produces a square thumbnail.
 */
export async function optimiseImage(
  file: File,
  opts: { thumbnail?: boolean } = {},
): Promise<OptimisedImages> {
  if (!isRasterImage(file.type)) {
    // Non-image — pass through untouched
    return { file };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        try {
          const result = processImage(img, file, dataUrl, opts);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function processImage(
  img: HTMLImageElement,
  originalFile: File,
  _dataUrl: string,
  opts: { thumbnail?: boolean },
): OptimisedImages {
  const originalW = img.naturalWidth;
  const originalH = img.naturalHeight;

  // Compute target dimensions preserving aspect ratio
  let targetW = originalW;
  let targetH = originalH;
  if (originalW > MAX_DIMENSION_PX || originalH > MAX_DIMENSION_PX) {
    const ratio = Math.min(MAX_DIMENSION_PX / originalW, MAX_DIMENSION_PX / originalH);
    targetW = Math.round(originalW * ratio);
    targetH = Math.round(originalH * ratio);
  }

  // Draw primary image
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const mimeType = originalFile.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = mimeType === "image/png" ? 1 : IMAGE_QUALITY;
  const b64 = canvas.toDataURL(mimeType, quality);
  const primaryFile = dataUrlToFile(b64, originalFile.name, mimeType);

  if (!opts.thumbnail) {
    return { file: primaryFile };
  }

  // Generate thumbnail (square crop from centre)
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = THUMBNAIL_SIZE_PX;
  thumbCanvas.height = THUMBNAIL_SIZE_PX;
  const tCtx = thumbCanvas.getContext("2d")!;

  const minSide = Math.min(originalW, originalH);
  const sx = Math.round((originalW - minSide) / 2);
  const sy = Math.round((originalH - minSide) / 2);
  tCtx.drawImage(img, sx, sy, minSide, minSide, 0, 0, THUMBNAIL_SIZE_PX, THUMBNAIL_SIZE_PX);

  const thumbB64 = thumbCanvas.toDataURL("image/jpeg", 0.75);
  const thumbName = originalFile.name.replace(/(\.[^.]+)?$/, "_thumb.jpg");
  const thumbnailFile = dataUrlToFile(thumbB64, thumbName, "image/jpeg");

  return { file: primaryFile, thumbnail: thumbnailFile };
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string): File {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], fileName, { type: mimeType });
}
