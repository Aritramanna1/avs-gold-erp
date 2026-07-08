/**
 * Hostinger file upload client.
 * Uploads a file blob to the PHP endpoint at hostingerUploadUrl (configured in firm settings).
 * Returns the public URL of the uploaded file.
 *
 * Falls back gracefully: if no Hostinger URL is configured, throws so callers can use
 * Supabase Storage as the fallback.
 */
import { useSettings } from "@/lib/settings-store";

export interface HostingerUploadResult {
  fileUrl: string;
  filePath: string;
  fileName: string;
}

export async function uploadToHostingerServer(
  blob: Blob,
  fileName: string,
  module: string,
  recordId: string,
): Promise<HostingerUploadResult> {
  const uploadUrl = useSettings.getState().firm.hostingerUploadUrl?.trim();
  if (!uploadUrl) {
    throw new Error("Hostinger upload URL not configured in Settings → Firm Profile.");
  }

  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("module", module);
  form.append("recordId", recordId);

  const res = await fetch(uploadUrl, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Hostinger upload failed (HTTP ${res.status}): ${text}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(`Hostinger upload error: ${json.error ?? "Unknown error"}`);
  }

  return {
    fileUrl: json.file_url as string,
    filePath: json.file_path as string,
    fileName: json.file_name as string,
  };
}
