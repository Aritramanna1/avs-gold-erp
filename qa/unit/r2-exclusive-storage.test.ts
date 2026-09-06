import { describe, it, expect } from "vitest";
import {
  getDirectR2ObjectUrl,
  getAttachmentSignedUrl,
  getBucketForEntityType,
  fetchAuthorizedObjectBlob,
} from "@/lib/supabase-storage";

describe("Cloudflare R2 Exclusive Storage Layer (Zero Supabase Storage)", () => {
  it("generates deterministic Cloudflare R2 proxy URLs for all buckets", async () => {
    const url = getDirectR2ObjectUrl("catalog-designs", "tenant_1/design_123.webp");
    expect(url).toContain("mtj-storage-proxy.aritramanna222.workers.dev/catalog-designs/tenant_1/design_123.webp");
    expect(url).not.toContain("supabase.co/storage");
  });

  it("maps entity types to R2 namespaces", () => {
    expect(getBucketForEntityType("firm-logo")).toBe("firm-assets");
    expect(getBucketForEntityType("catalog")).toBe("catalog-designs");
    expect(getBucketForEntityType("person")).toBe("customer-documents");
    expect(getBucketForEntityType("worker")).toBe("worker-kyc");
    expect(getBucketForEntityType("order")).toBe("order-attachments");
    expect(getBucketForEntityType("expense")).toBe("expense-receipts");
    expect(getBucketForEntityType("stock")).toBe("stock-assets");
  });

  it("resolves attachment URLs with instant R2 proxy endpoint", async () => {
    const signed = await getAttachmentSignedUrl("stock-assets", "tags/item_001.png");
    expect(signed).toContain("mtj-storage-proxy.aritramanna222.workers.dev/stock-assets/tags/item_001.png");
  });

  it("handles data URLs and blob URLs with in-memory caching", async () => {
    const dummyDataUrl = "data:text/plain;base64,SGVsbG8gV29ybGQ=";
    const blob1 = await fetchAuthorizedObjectBlob(dummyDataUrl);
    expect(blob1).toBeDefined();
    expect(blob1.size).toBe(11);

    // Second call should return cached blob instantly
    const blob2 = await fetchAuthorizedObjectBlob(dummyDataUrl);
    expect(blob2).toBe(blob1);
  });
});
