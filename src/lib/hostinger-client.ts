/**
 * Compatibility adapter for legacy callers. Files are stored in Cloudflare R2
 * through the authenticated storage proxy; Hostinger only serves the website.
 */
import { uploadToSupabaseStorage, getAttachmentSignedUrl } from "@/lib/supabase-storage";

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
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const filePath = await uploadToSupabaseStorage(module, fileName, dataUrl, recordId, "document");
  return {
    fileUrl: await getAttachmentSignedUrl(module, filePath),
    filePath,
    fileName,
  };
}
