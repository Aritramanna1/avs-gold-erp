/**
 * Native camera capture — Capacitor Camera on device, file input fallback on web.
 * Uploads through the same fileUpload pipeline as desktop (R2 / approved storage).
 */
import { isNativeApp } from "@/lib/native/platform";

export type CapturedPhoto = {
  /** Base64 data URL or blob URL for immediate preview */
  previewUrl: string;
  /** Raw base64 without data: prefix when from native camera */
  base64?: string;
  /** MIME type */
  mimeType: string;
  /** Suggested filename */
  fileName: string;
};

export interface CapturePhotoOptions {
  /** Prefer rear camera on phones */
  rear?: boolean;
  /** Allow picking from gallery */
  allowGallery?: boolean;
  /** JPEG quality 0–100 (native only) */
  quality?: number;
}

function mapCameraError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (lower.includes("cancel") || lower.includes("cancelled") || lower.includes("canceled")) {
    return new Error("Photo cancelled.");
  }
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("restricted")) {
    return new Error(
      "Camera permission is blocked. Open Android Settings → Apps → AVS ERP → Permissions and allow Camera.",
    );
  }
  if (lower.includes("unavailable") || lower.includes("no camera")) {
    return new Error("No camera is available on this device.");
  }
  return new Error(msg || "Could not open camera.");
}

async function ensureCameraPermission(): Promise<void> {
  const { Camera } = await import("@capacitor/camera");
  try {
    const current = await Camera.checkPermissions();
    if (current.camera === "granted" || current.camera === "limited") return;
    const asked = await Camera.requestPermissions({ permissions: ["camera"] });
    if (asked.camera === "denied" || asked.camera === "prompt-with-rationale") {
      // Still try getPhoto — some OEMs grant at capture time.
      if (asked.camera === "denied") {
        throw new Error(
          "Camera permission is blocked. Open Android Settings → Apps → AVS ERP → Permissions and allow Camera.",
        );
      }
    }
  } catch (err) {
    // Older plugin builds may not support the permissions argument — continue to getPhoto.
    if (err instanceof Error && err.message.includes("Settings → Apps")) throw err;
  }
}

async function captureViaCapacitor(opts: CapturePhotoOptions): Promise<CapturedPhoto> {
  const { Camera, CameraResultType, CameraSource, CameraDirection } =
    await import("@capacitor/camera");

  // allowGallery === true → Photos; false → Camera only; undefined → Prompt
  const source =
    opts.allowGallery === true
      ? CameraSource.Photos
      : opts.allowGallery === false
        ? CameraSource.Camera
        : CameraSource.Prompt;

  if (source === CameraSource.Camera || source === CameraSource.Prompt) {
    await ensureCameraPermission();
  }

  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source,
      quality: opts.quality ?? 85,
      correctOrientation: true,
      direction: opts.rear !== false ? CameraDirection.Rear : CameraDirection.Front,
      allowEditing: false,
      saveToGallery: false,
    });
    const dataUrl = photo.dataUrl;
    if (!dataUrl) throw new Error("Camera returned no image.");
    const mimeType = photo.format === "png" ? "image/png" : "image/jpeg";
    const ext = mimeType === "image/png" ? "png" : "jpg";
    return {
      previewUrl: dataUrl,
      base64: dataUrl.split(",")[1],
      mimeType,
      fileName: `ornexa-${Date.now()}.${ext}`,
    };
  } catch (err) {
    throw mapCameraError(err);
  }
}

async function captureViaFileInput(opts: CapturePhotoOptions): Promise<CapturedPhoto> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (opts.allowGallery !== true) {
      input.capture = opts.rear !== false ? "environment" : "user";
    }
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No photo selected."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const previewUrl = String(reader.result || "");
        if (!previewUrl) {
          reject(new Error("Could not read photo."));
          return;
        }
        resolve({
          previewUrl,
          base64: previewUrl.includes(",") ? previewUrl.split(",")[1] : undefined,
          mimeType: file.type || "image/jpeg",
          fileName: file.name || `photo-${Date.now()}.jpg`,
        });
      };
      reader.onerror = () => reject(new Error("Could not read photo."));
      reader.readAsDataURL(file);
    };
    input.oncancel = () => reject(new Error("Photo cancelled."));
    input.click();
  });
}

/** Capture or pick a photo. Never returns a temporary-only preview without bytes. */
export async function capturePhoto(opts: CapturePhotoOptions = {}): Promise<CapturedPhoto> {
  if (isNativeApp()) {
    try {
      return await captureViaCapacitor(opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Permission / hardware hard-fail — don't silently fall back.
      if (msg.includes("permission") || msg.includes("Settings → Apps")) throw err;
      if (msg.includes("cancelled") || msg.includes("canceled")) throw err;
      // Plugin bridge failure — last-resort WebView file picker (still works on many OEMs).
      try {
        return await captureViaFileInput(opts);
      } catch {
        throw err instanceof Error ? err : new Error("Could not capture photo.");
      }
    }
  }
  return captureViaFileInput(opts);
}

/** Convert CapturedPhoto to File for existing upload helpers. */
export async function capturedPhotoToFile(photo: CapturedPhoto): Promise<File> {
  if (photo.base64) {
    const bin = atob(photo.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], photo.fileName, { type: photo.mimeType });
  }
  const res = await fetch(photo.previewUrl);
  const blob = await res.blob();
  return new File([blob], photo.fileName, { type: photo.mimeType || blob.type });
}
