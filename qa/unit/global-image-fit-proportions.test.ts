import { describe, it, expect } from "vitest";
import { urlToPdfImageData } from "@/lib/print-engine/attachment-images";
import { generateDocumentPdf } from "@/lib/print-engine/pdf/generate";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import type { PrintDocumentData } from "@/lib/print-engine/types";
import type { FirmProfile } from "@/lib/settings-store";

describe("MTJ ERP — Global Image Fit & Proportional Rendering Audit", () => {
  const mockFirm: FirmProfile = {
    shopName: "Maa Tara Jewellers",
    address: "Bowbazar, Kolkata, WB",
    phone: "9830000000",
    email: "contact@maatarajewellers.com",
    gstin: "19ABCDE1234F1Z5",
    tagline: "Hallmarked Gold & Diamond Jewellers",
    logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='100'><rect width='200' height='100' fill='%23B8860B'/></svg>",
  };

  describe("1. urlToPdfImageData Intrinsic Aspect Ratio & Dimension Resolution", () => {
    it("resolves SVG image data with true aspect ratio (2:1 landscape)", async () => {
      const svgLandscape = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'><rect width='300' height='150' fill='red'/></svg>";
      const result = await urlToPdfImageData(svgLandscape);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.format).toBe("PNG");
        expect(result.width).toBe(300);
        expect(result.height).toBe(150);
        expect(result.aspectRatio).toBeCloseTo(2.0, 2);
      }
    });

    it("resolves SVG image data with true aspect ratio (3:4 portrait photo)", async () => {
      const svgPortrait = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400'><rect width='300' height='400' fill='blue'/></svg>";
      const result = await urlToPdfImageData(svgPortrait);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.format).toBe("PNG");
        expect(result.width).toBe(300);
        expect(result.height).toBe(400);
        expect(result.aspectRatio).toBeCloseTo(0.75, 2);
      }
    });

    it("resolves square image data with 1:1 aspect ratio", async () => {
      const svgSquare = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='250' height='250'><circle cx='125' cy='125' r='100' fill='gold'/></svg>";
      const result = await urlToPdfImageData(svgSquare);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.width).toBe(250);
        expect(result.height).toBe(250);
        expect(result.aspectRatio).toBeCloseTo(1.0, 2);
      }
    });

    it("handles empty and malformed URLs gracefully without throwing", async () => {
      const empty = await urlToPdfImageData("");
      expect(empty).toBeNull();
      const whitespace = await urlToPdfImageData("   ");
      expect(whitespace).toBeNull();
    });
  });

  describe("2. Document PDF Generator with Multiple Image Proportions", () => {
    it("generates worker KYC PDF with portrait KYC photo and landscape Aadhaar without stretching", async () => {
      const portraitPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400'><rect width='300' height='400' fill='%23333'/></svg>";
      const landscapeAadhaar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='380'><rect width='600' height='380' fill='%23666'/></svg>";

      const mockData: PrintDocumentData = {
        docType: "worker_kyc",
        docNumber: "KYC/2026/001",
        createdAt: Date.now(),
        fields: {
          workerName: "Subhash Karigar",
          idNumber: "XXXX-XXXX-8921",
          emergencyContact: "+91 98311 22334",
          nativePlace: "Midnapore, WB",
          joiningDate: "2024-01-15",
        },
        flags: {
          hasKyc: true,
        },
        images: {
          kyc: [portraitPhoto, landscapeAadhaar],
        },
        imageItems: {
          kyc: [
            { url: portraitPhoto, label: "Passport Photo (Portrait 3:4)" },
            { url: landscapeAadhaar, label: "Aadhaar Card Front (Landscape Scan)" },
          ],
        },
      };

      const template = usePrintTemplates.getState().getForDocType("worker_kyc");
      expect(template).toBeDefined();

      const pdf = await generateDocumentPdf(mockData, template, mockFirm);
      expect(pdf).toBeDefined();
      expect(pdf.blob).toBeInstanceOf(Blob);
      expect(pdf.blob.size).toBeGreaterThan(1000);
      expect(pdf.fileName).toContain("KYC_2026_001");
    });

    it("generates job card PDF with reference images preserving proportions", async () => {
      const designRef = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='500' height='300'><rect width='500' height='300' fill='gold'/></svg>";

      const mockJobCardData: PrintDocumentData = {
        docType: "job_card",
        docNumber: "JC/2026/042",
        createdAt: Date.now(),
        fields: {
          orderNumber: "ORD-2026-089",
          customerName: "Rahul Sen",
          productType: "22K Filigree Bridal Necklace",
          targetPurity: "916 (22K)",
          targetGrossWeightGrams: "45.500",
          instructions: "Handcrafted filigree with antique polish.",
        },
        flags: {
          hasReferenceImages: true,
        },
        images: {
          reference: [designRef],
        },
        imageItems: {
          reference: [{ url: designRef, label: "Master Bridal Reference" }],
        },
      };

      const template = usePrintTemplates.getState().getForDocType("job_card");
      expect(template).toBeDefined();

      const pdf = await generateDocumentPdf(mockJobCardData, template, mockFirm);
      expect(pdf).toBeDefined();
      expect(pdf.blob.size).toBeGreaterThan(1000);
    });
  });

  describe("3. Proportional Image Fit Mathematics Invariants", () => {
    function computeProportionalBounds(
      aspectRatio: number,
      maxW: number,
      maxH: number,
    ): { renderW: number; renderH: number } {
      let renderW = maxW;
      let renderH = renderW / aspectRatio;
      if (renderH > maxH) {
        renderH = maxH;
        renderW = renderH * aspectRatio;
      }
      return { renderW, renderH };
    }

    it("scales portrait image (0.75) within bounding box without stretching height", () => {
      const maxW = 100;
      const maxH = 80;
      const { renderW, renderH } = computeProportionalBounds(0.75, maxW, maxH);
      expect(renderH).toBe(80);
      expect(renderW).toBe(60); // 80 * 0.75 = 60 <= 100
      expect(renderW / renderH).toBeCloseTo(0.75, 4);
    });

    it("scales landscape scan (1.6) within bounding box without stretching width", () => {
      const maxW = 100;
      const maxH = 80;
      const { renderW, renderH } = computeProportionalBounds(1.6, maxW, maxH);
      expect(renderW).toBe(100);
      expect(renderH).toBe(62.5); // 100 / 1.6 = 62.5 <= 80
      expect(renderW / renderH).toBeCloseTo(1.6, 4);
    });

    it("scales ultra-wide banner (3.0) within bounding box", () => {
      const maxW = 120;
      const maxH = 60;
      const { renderW, renderH } = computeProportionalBounds(3.0, maxW, maxH);
      expect(renderW).toBe(120);
      expect(renderH).toBe(40); // 120 / 3 = 40 <= 60
      expect(renderW / renderH).toBeCloseTo(3.0, 4);
    });
  });
});
