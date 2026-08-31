/** Filesystem access stub for web; native Capacitor path is optional. */
export async function writeBlobToCache(
  blob: Blob,
  fileName: string,
): Promise<{ uri: string; path: string }> {
  const url = URL.createObjectURL(blob);
  return { uri: url, path: fileName };
}

export async function readCacheFile(_path: string): Promise<Blob | null> {
  return null;
}

export async function deleteCacheFile(_path: string): Promise<void> {}
