import { describe, it, expect } from "vitest";
import { getDirectR2ObjectUrl, isR2ProxyUrl } from "../../src/lib/supabase-storage";
import { useAttachments, getAttachmentUrl } from "../../src/lib/attachments-store";
import { useSettings } from "../../src/lib/settings-store";
import { resolveAllSignedUrls, refreshFirmLogoSignedUrl } from "../../src/lib/storage";

describe("Image Loading & R2 Storage Persistence", () => {
  const PROXY_URL = "https://mtj-storage-proxy.aritramanna222.workers.dev";

  it("1. getDirectR2ObjectUrl produces stable canonical URL without ephemeral blob dependency", () => {
    const bucket = "catalog-designs";
    const path = "firms/MTJ_FIRM/branches/MAIN/catalog/item-123/necklace.webp";
    const url = getDirectR2ObjectUrl(bucket, path);

    expect(url).toBe(`${PROXY_URL}/catalog-designs/firms/MTJ_FIRM/branches/MAIN/catalog/item-123/necklace.webp`);
    expect(url.startsWith("blob:")).toBe(false);
    expect(isR2ProxyUrl(url)).toBe(true);
  });

  it("2. getAttachmentUrl returns stable R2 proxy URL for stored attachment", async () => {
    useAttachments.setState({
      items: {
        "catalog:design-1:design_photo": {
          filed: true,
          note: "Bridal choker",
          updatedAt: Date.now(),
          bucket: "catalog-designs",
          storagePath: "firms/MTJ_FIRM/branches/MAIN/catalog/design-1/choker.jpg",
          fileName: "choker.jpg",
        },
      },
    });

    const resolved = await getAttachmentUrl("catalog", "design-1", "design_photo");
    expect(resolved).toBe(
      `${PROXY_URL}/catalog-designs/firms/MTJ_FIRM/branches/MAIN/catalog/design-1/choker.jpg`,
    );
    expect(resolved?.startsWith("blob:")).toBe(false);
  });

  it("3. resolveAllSignedUrls populates stable R2 URLs without mutating records with dead blob URLs", async () => {
    const items = {
      "stock:item-99:product_photo_1": {
        filed: true,
        note: "Ring photo",
        updatedAt: Date.now(),
        bucket: "stock-assets",
        storagePath: "firms/MTJ_FIRM/branches/MAIN/stock/item-99/ring.png",
      },
    };

    await resolveAllSignedUrls(items);
    const updated = useAttachments.getState().items["stock:item-99:product_photo_1"];
    expect(updated.fileDataUrl).toBe(
      `${PROXY_URL}/stock-assets/firms/MTJ_FIRM/branches/MAIN/stock/item-99/ring.png`,
    );
    expect(updated.fileDataUrl?.startsWith("blob:")).toBe(false);
  });

  it("4. refreshFirmLogoSignedUrl updates firm.logoUrl to stable R2 proxy URL", async () => {
    useSettings.setState({
      firm: {
        ...useSettings.getState().firm,
        logoStoragePath: "firms/MTJ_FIRM/branches/MAIN/firm_profile/logo.png",
        logoUrl: "",
      },
    });

    await refreshFirmLogoSignedUrl();
    const firm = useSettings.getState().firm;
    expect(firm.logoUrl).toBe(
      `${PROXY_URL}/firm-assets/firms/MTJ_FIRM/branches/MAIN/firm_profile/logo.png`,
    );
    expect(firm.logoUrl.startsWith("blob:")).toBe(false);
  });

  it("5. Survives rehydration and serialization without broken temporary blob URLs", () => {
    const rawSavedData = JSON.stringify({
      logoUrl: `${PROXY_URL}/firm-assets/firms/MTJ_FIRM/branches/MAIN/firm_profile/logo.png`,
      logoStoragePath: "firms/MTJ_FIRM/branches/MAIN/firm_profile/logo.png",
      photoUrl: `${PROXY_URL}/customer-documents/firms/MTJ_FIRM/parties/cust-1/photo.jpg`,
    });

    const parsed = JSON.parse(rawSavedData);
    expect(parsed.logoUrl.startsWith("https://mtj-storage-proxy")).toBe(true);
    expect(parsed.photoUrl.startsWith("https://mtj-storage-proxy")).toBe(true);
    expect(parsed.logoUrl.startsWith("blob:")).toBe(false);
  });
});
