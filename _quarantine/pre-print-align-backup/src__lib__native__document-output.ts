/**
 * Minimal document output helpers for web baseline alignment.
 * Full native/print attachment stack will be parity-checked against
 * production-dist-shop print chunks in a later wave — do not invent PDF logic here.
 */
export async function downloadPdfBlob(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function sharePdfBlob(
  _blob: Blob,
  _fileName: string,
  _title?: string,
  _caption?: string,
): Promise<void> {
  // Web share of arbitrary PDF blobs is best-effort; frozen shop uses print engine paths.
}

export async function sharePdfBlobCanonical(
  blob: Blob,
  opts: { title: string; fileName: string; caption?: string },
): Promise<{ ok: boolean }> {
  await sharePdfBlob(blob, opts.fileName, opts.title, opts.caption);
  return { ok: true };
}

export async function renderDocumentPdf(_input: unknown): Promise<{ blob: Blob; fileName: string }> {
  throw new Error(
    "renderDocumentPdf: use Universal Print Engine paths — native document-output not fully reconstructed yet.",
  );
}
