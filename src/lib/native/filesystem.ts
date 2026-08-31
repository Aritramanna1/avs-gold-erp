/**
 * Persist blobs (PDF) to device cache for native share / print / download.
 * Writes in chunks — never String.fromCharCode + btoa on the full buffer (OOM).
 */
import { isNativeApp } from "@/lib/native/platform";

const CHUNK_BYTES = 256 * 1024;

function blobSliceToBase64(slice: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not encode file"));
    reader.readAsDataURL(slice);
  });
}

function textToBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export async function writeCacheFile(
  fileName: string,
  data: string | Blob,
): Promise<{ uri: string; path: string } | null> {
  if (!isNativeApp()) return null;
  try {
    const { Filesystem, Directory } = await import(
      /* @vite-ignore */ "@capacitor/filesystem"
    );
    const path = `ornexa/${fileName}`;

    if (typeof data === "string") {
      await Filesystem.writeFile({
        path,
        data: textToBase64Utf8(data),
        directory: Directory.Cache,
        recursive: true,
      });
    } else {
      const first = data.slice(0, Math.min(CHUNK_BYTES, data.size));
      await Filesystem.writeFile({
        path,
        data: await blobSliceToBase64(first),
        directory: Directory.Cache,
        recursive: true,
      });
      for (let offset = CHUNK_BYTES; offset < data.size; offset += CHUNK_BYTES) {
        const slice = data.slice(offset, offset + CHUNK_BYTES);
        await Filesystem.appendFile({
          path,
          data: await blobSliceToBase64(slice),
          directory: Directory.Cache,
        });
      }
    }

    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    return { uri, path };
  } catch {
    return null;
  }
}

export async function writeDocumentsFile(
  fileName: string,
  data: Blob,
): Promise<{ uri: string; path: string } | null> {
  if (!isNativeApp()) return null;
  try {
    const { Filesystem, Directory } = await import(
      /* @vite-ignore */ "@capacitor/filesystem"
    );
    const path = `AVS ERP/${fileName}`;
    const first = data.slice(0, Math.min(CHUNK_BYTES, data.size));
    await Filesystem.writeFile({
      path,
      data: await blobSliceToBase64(first),
      directory: Directory.Documents,
      recursive: true,
    });
    for (let offset = CHUNK_BYTES; offset < data.size; offset += CHUNK_BYTES) {
      const slice = data.slice(offset, offset + CHUNK_BYTES);
      await Filesystem.appendFile({
        path,
        data: await blobSliceToBase64(slice),
        directory: Directory.Documents,
      });
    }
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });
    return { uri, path };
  } catch {
    return writeCacheFile(fileName, data);
  }
}

export async function readCacheFileAsBase64(path: string): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { Filesystem, Directory } = await import(
      /* @vite-ignore */ "@capacitor/filesystem"
    );
    const result = await Filesystem.readFile({ path, directory: Directory.Cache });
    return typeof result.data === "string" ? result.data : null;
  } catch {
    return null;
  }
}
