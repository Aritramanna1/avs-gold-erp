/**
 * Image Compression and Optimization Utility
 * Resizes images to max 1200px, encodes at 0.8 quality JPEG/WebP,
 * and strips EXIF metadata.
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  optimized: boolean;
}

export async function compressImage(file: File): Promise<CompressionResult> {
  // Reject files over 15MB
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("File exceeds the maximum limit of 15MB.");
  }

  // If not an image, pass-through (e.g., PDF KYC documents)
  if (!file.type.startsWith("image/")) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      optimized: false,
    };
  }

  // If already smaller than 150KB, upload as-is
  if (file.size <= 150 * 1024) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      optimized: false,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          const maxDimension = 1200;

          // Resize long edge to max 1200px
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Could not create canvas 2D context.");
          }

          // Drawing onto canvas strips EXIF/location metadata
          ctx.drawImage(img, 0, 0, width, height);

          // Determine format and quality (default to image/jpeg)
          const format = file.type === "image/png" ? "image/jpeg" : file.type;

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Image compression failed."));
                return;
              }

              // If compressed size is larger than original, return original
              if (blob.size >= file.size) {
                resolve({
                  file,
                  originalSize: file.size,
                  compressedSize: file.size,
                  optimized: false,
                });
                return;
              }

              // Generate name keeping same name/extension structure but changing type to jpeg/webp
              const extension = format.split("/")[1] || "jpg";
              let newName = file.name;
              if (file.name.includes(".")) {
                newName = file.name.substring(0, file.name.lastIndexOf(".")) + "." + extension;
              } else {
                newName = file.name + "." + extension;
              }

              const compressedFile = new File([blob], newName, {
                type: format,
                lastModified: Date.now(),
              });

              resolve({
                file: compressedFile,
                originalSize: file.size,
                compressedSize: blob.size,
                optimized: true,
              });
            },
            format,
            0.8,
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for optimization."));
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
