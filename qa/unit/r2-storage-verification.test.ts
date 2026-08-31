import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isR2ProxyUrl,
  getBucketForEntityType,
  base64ToBlob,
  fetchAuthorizedObjectBlob,
  resolveR2ObjectUrl,
  revokeR2DisplayUrl,
} from "@/lib/supabase-storage";

describe("Cloudflare R2 Storage Engine & Proxy Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("R2 Proxy URL Detection", () => {
    it("recognizes mtj-storage-proxy URLs as R2 proxy URLs", () => {
      expect(
        isR2ProxyUrl("https://mtj-storage-proxy.aritramanna222.workers.dev/firm-assets/path/logo.png")
      ).toBe(true);
    });

    it("rejects non-R2 external URLs", () => {
      expect(isR2ProxyUrl("https://images.unsplash.com/photo-123.jpg")).toBe(false);
      expect(isR2ProxyUrl("https://google.com")).toBe(false);
      expect(isR2ProxyUrl("")).toBe(false);
    });
  });

  describe("Entity Type to R2 Bucket Mapping", () => {
    it("maps firm-logo to firm-assets bucket", () => {
      expect(getBucketForEntityType("firm-logo")).toBe("firm-assets");
    });

    it("maps catalog to catalog-designs bucket", () => {
      expect(getBucketForEntityType("catalog")).toBe("catalog-designs");
    });

    it("maps person to customer-documents bucket", () => {
      expect(getBucketForEntityType("person")).toBe("customer-documents");
    });

    it("maps worker to worker-kyc bucket", () => {
      expect(getBucketForEntityType("worker")).toBe("worker-kyc");
    });

    it("maps supplier to supplier-documents bucket", () => {
      expect(getBucketForEntityType("supplier")).toBe("supplier-documents");
    });

    it("maps order and jobcard to order-attachments bucket", () => {
      expect(getBucketForEntityType("order")).toBe("order-attachments");
      expect(getBucketForEntityType("jobcard")).toBe("order-attachments");
    });

    it("maps repair to repair-attachments bucket", () => {
      expect(getBucketForEntityType("repair")).toBe("repair-attachments");
    });

    it("maps expense to expense-receipts bucket", () => {
      expect(getBucketForEntityType("expense")).toBe("expense-receipts");
    });

    it("maps stock to stock-assets bucket", () => {
      expect(getBucketForEntityType("stock")).toBe("stock-assets");
    });
  });

  describe("Base64 Data URL to Blob Conversion", () => {
    it("correctly converts base64 data URLs to Blobs with correct MIME type", () => {
      const samplePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const { blob, mimeType } = base64ToBlob(samplePng);
      expect(mimeType).toBe("image/png");
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("handles plain text base64 conversions", () => {
      const sampleText = "data:text/plain;base64,SGVsbG8gTVRKIEVSUA==";
      const { blob, mimeType } = base64ToBlob(sampleText);
      expect(mimeType).toBe("text/plain");
      expect(blob.size).toBe(13);
    });
  });

  describe("Authorized Blob Fetching for Printing & PDF Generation", () => {
    it("fetches data URLs directly in memory without network proxy", async () => {
      const sampleDataUrl = "data:text/plain;base64,SGVsbG8=";
      const blob = await fetchAuthorizedObjectBlob(sampleDataUrl);
      expect(blob).toBeInstanceOf(Blob);
    });

    it("handles empty or blank URL gracefully by throwing meaningful error", async () => {
      await expect(fetchAuthorizedObjectBlob("   ")).rejects.toThrow("Empty image URL");
    });
  });

  describe("R2 Cache Management", () => {
    it("safely executes revokeR2DisplayUrl without errors", () => {
      expect(() => revokeR2DisplayUrl("firm-assets", "test/path.png")).not.toThrow();
    });

    it("resolves null when storage path is undefined or null", async () => {
      expect(await resolveR2ObjectUrl("firm-assets", null)).toBeNull();
      expect(await resolveR2ObjectUrl("firm-assets", undefined)).toBeNull();
      expect(await resolveR2ObjectUrl("firm-assets", "")).toBeNull();
    });
  });
});
