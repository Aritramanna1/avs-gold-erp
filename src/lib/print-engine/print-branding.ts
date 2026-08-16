import type { FirmProfile } from "@/lib/settings-store";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";

/** Tenant must explicitly enable and upload assets — never render fake stamps. */
export function shouldRenderPrintStamp(
  firm: FirmProfile,
  templateRequestsStamp?: boolean,
): boolean {
  return !!templateRequestsStamp && !!firm.printStampEnabled && !!firm.stampImageStoragePath;
}

export function shouldRenderAuthorizedSignature(
  firm: FirmProfile,
  templateRequestsSignatureImage?: boolean,
): boolean {
  return (
    !!templateRequestsSignatureImage &&
    !!firm.printSignatureEnabled &&
    !!firm.authorizedSignatureStoragePath
  );
}

/** Legacy bill-verify QR — off unless tenant explicitly enables in Customization. */
export function shouldRenderVerificationQr(firm: FirmProfile): boolean {
  return !!firm.printVerificationQrEnabled;
}

export async function resolveFirmAssetPreviewUrl(
  storagePath?: string | null,
): Promise<string | null> {
  if (!storagePath) return null;
  try {
    return await getAttachmentSignedUrl("firm-assets", storagePath);
  } catch {
    return null;
  }
}
