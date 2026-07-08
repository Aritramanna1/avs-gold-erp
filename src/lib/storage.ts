import { getAttachmentSignedUrl, ensureStorageBucketsReady } from "./supabase-storage";
import { useAttachments, type AttachmentRecord } from "./attachments-store";
import { useSettings } from "./settings-store";

/**
 * Resolves fresh signed URLs for all cached attachments in useAttachments store
 * so that they never show as broken icons.
 */
export async function resolveAllSignedUrls(items: Record<string, AttachmentRecord>): Promise<void> {
  const entries = Object.entries(items).filter(([, item]) => item.bucket && item.storagePath);
  if (entries.length === 0) return;

  // Presign all URLs in parallel; collect results before touching React state
  const results = await Promise.allSettled(
    entries.map(async ([key, item]) => {
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
 * Refreshes the firm logo signed URL from Supabase Storage.
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

    // Lazy pre-signing of cached images
    const loadedItems = useAttachments.getState().items;
    void resolveAllSignedUrls(loadedItems);
    void refreshFirmLogoSignedUrl();
  } catch (err) {
    console.warn("Storage startup routine failed:", err);
  }
}
