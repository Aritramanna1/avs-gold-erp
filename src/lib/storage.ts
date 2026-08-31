import { getAttachmentSignedUrl, ensureStorageBucketsReady } from "./supabase-storage";
import { useAttachments, type AttachmentRecord } from "./attachments-store";
import { useSettings } from "./settings-store";

/** Boot-time cap — presign only the most recent slice; others sign on open/view. */
const BOOT_PRESIGN_LIMIT = 20;

/**
 * Resolves fresh signed URLs for cached attachments. At boot we presign only a
 * recent slice to avoid storage/API egress storms; remaining URLs sign on demand.
 */
export async function resolveAllSignedUrls(
  items: Record<string, AttachmentRecord>,
  options?: { limit?: number },
): Promise<void> {
  const entries = Object.entries(items)
    .filter(([, item]) => item.bucket && item.storagePath)
    .sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (entries.length === 0) return;

  const cap = options?.limit ?? BOOT_PRESIGN_LIMIT;
  const batch = entries.slice(0, cap);

  const results = await Promise.allSettled(
    batch.map(async ([key, item]) => {
      const signedUrl = await getAttachmentSignedUrl(item.bucket!, item.storagePath!);
      return { key, item, signedUrl };
    }),
  );

  // Build patch object and apply in a single setState (one re-render instead of N)
  const patch: Record<string, AttachmentRecord> = {};
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.signedUrl) {
      const { key, item, signedUrl } = result.value;
      patch[key] = { ...item, fileDataUrl: signedUrl };
    }
  }
  if (Object.keys(patch).length > 0) {
    useAttachments.setState((s) => ({ items: { ...s.items, ...patch } }));
  }
}

/**
 * Refreshes the firm logo object URL from the local application vault.
 * Saves the link directly in the store / local cache.
 */
export async function refreshFirmLogoSignedUrl(): Promise<void> {
  const logoPath = useSettings.getState().firm.logoStoragePath;
  if (!logoPath) return;

  if (logoPath.startsWith("uploads/")) {
    // Already public Hostinger path, bypass pre-signing
    return;
  }

  try {
    const signedUrl = await getAttachmentSignedUrl("firm-assets", logoPath);
    if (signedUrl) {
      const currentFirm = useSettings.getState().firm;
      if (currentFirm.logoUrl !== signedUrl) {
        useSettings.setState({
          firm: {
            ...currentFirm,
            logoUrl: signedUrl,
          },
        });
      }
    }
  } catch (err) {
    console.error("Error refreshing firm logo signed URL:", err);
  }
}

/**
 * High-level initialization routine for storage.
 * Verifies buckets and pre-signs images.
 */
export async function initializeStorage(): Promise<void> {
  try {
    await ensureStorageBucketsReady();

    // Presign logo + a small recent attachment slice only (full gallery on demand).
    void refreshFirmLogoSignedUrl();
    const loadedItems = useAttachments.getState().items;
    void resolveAllSignedUrls(loadedItems, { limit: BOOT_PRESIGN_LIMIT });
  } catch (err) {
    console.warn("Storage startup routine failed:", err);
  }
}
