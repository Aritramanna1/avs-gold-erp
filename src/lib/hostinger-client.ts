/**
 * Compatibility adapter for legacy callers. The final Hybrid architecture
 * keeps every file local, so this stores the blob in the local application
 * vault and never contacts Hostinger or Supabase Storage.
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
