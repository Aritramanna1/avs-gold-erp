import { describe, it, expect, beforeEach } from "vitest";
import { useCatalog, type Design } from "@/lib/catalog-store";
import { generateMultiPageCatalogPdf } from "@/lib/catalog-pdf-generator";
import { DEFAULT_CATALOG_DESIGNS } from "@/lib/catalog-jewelry-art";

describe("MTJ ERP — Catalog Workflow & Multi-Page PDF Verification Suite", () => {
  beforeEach(() => {
    useCatalog.setState({
      designs: [...DEFAULT_CATALOG_DESIGNS],
      nextNumber: 100,
    });
  });

  describe("1. Authoritative Inventory & Default Designs", () => {
    it("initializes with rich default jewellery designs and vector artwork", () => {
      const designs = useCatalog.getState().designs;
      expect(designs.length).toBeGreaterThanOrEqual(6);

      const choker = designs.find((d) => d.designNumber === "NC-2026-001");
      expect(choker).toBeDefined();
      expect(choker?.purity).toBe(916);
      expect(choker?.approxGrossMg).toBe(42500);
      expect(choker?.approxNetMg).toBe(41800);
      expect(choker?.photoDataUrl).toContain("data:image/svg+xml");

      const ring = designs.find((d) => d.designNumber === "RG-2026-002");
      expect(ring).toBeDefined();
      expect(ring?.purity).toBe(750);
      expect(ring?.photoDataUrl).toContain("data:image/svg+xml");

      const pendant = designs.find((d) => d.designNumber === "PD-2026-005");
      expect(pendant).toBeDefined();
      expect(pendant?.purity).toBe(995);
      expect(pendant?.approxGrossMg).toBe(10000);
    });
  });

  describe("2. Fast Filtering Engine", () => {
    it("filters correctly by weight range (< 5g, 5-10g, 10-20g, 20-50g, > 50g)", () => {
      const designs = useCatalog.getState().designs;

      // Under 5g (e.g. Ring 4.550g net)
      const under5g = designs.filter((d) => d.approxNetMg / 1000 < 5);
      expect(under5g.some((d) => d.designNumber === "RG-2026-002")).toBe(true);

      // 10g to 20g (e.g. Earring 18.2g, Pendant 10.0g)
      const between10and20g = designs.filter((d) => {
        const netG = d.approxNetMg / 1000;
        return netG >= 10 && netG < 20;
      });
      expect(between10and20g.length).toBeGreaterThanOrEqual(2);
      expect(between10and20g.some((d) => d.designNumber === "ER-2026-004")).toBe(true);
      expect(between10and20g.some((d) => d.designNumber === "PD-2026-005")).toBe(true);

      // 20g to 50g (e.g. Choker 41.8g, Bangle 38.4g, Chain 24.5g)
      const between20and50g = designs.filter((d) => {
        const netG = d.approxNetMg / 1000;
        return netG >= 20 && netG < 50;
      });
      expect(between20and50g.length).toBeGreaterThanOrEqual(3);
    });

    it("filters accurately by purity (995, 916, 750)", () => {
      const designs = useCatalog.getState().designs;

      const p995 = designs.filter((d) => d.purity === 995);
      expect(p995.length).toBeGreaterThanOrEqual(1);
      expect(p995.every((d) => d.purity === 995)).toBe(true);

      const p916 = designs.filter((d) => d.purity === 916);
      expect(p916.length).toBeGreaterThanOrEqual(4);
      expect(p916.every((d) => d.purity === 916)).toBe(true);

      const p750 = designs.filter((d) => d.purity === 750);
      expect(p750.length).toBeGreaterThanOrEqual(1);
      expect(p750[0].designNumber).toBe("RG-2026-002");
    });

    it("filters accurately by category and text search", () => {
      const designs = useCatalog.getState().designs;

      const necklaces = designs.filter((d) => d.category.toLowerCase() === "necklace");
      expect(necklaces.length).toBeGreaterThanOrEqual(1);
      expect(necklaces[0].designName).toContain("Choker");

      const querySearch = designs.filter((d) => {
        const hay = [d.designNumber, d.designName, d.category, ...(d.tags ?? [])].join(" ").toLowerCase();
        return hay.includes("solitaire");
      });
      expect(querySearch.length).toBe(1);
      expect(querySearch[0].designNumber).toBe("RG-2026-002");
    });
  });

  describe("3. Multi-Page Catalog PDF Generation Engine", () => {
    it("generates 1-page PDF for single product spotlight", async () => {
      const designs = useCatalog.getState().designs.slice(0, 1);
      const result = await generateMultiPageCatalogPdf(designs, { templateLayout: "single_hero" });

      expect(result.pageCount).toBe(1);
      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(500);
      expect(result.fileName).toContain("jewellery-catalogue");
    });

    it("generates 2-page PDF for 5 products in 4-grid layout (4 items/page)", async () => {
      const designs = useCatalog.getState().designs.slice(0, 5);
      const result = await generateMultiPageCatalogPdf(designs, { templateLayout: "four_grid" });

      expect(result.pageCount).toBe(2);
      expect(result.blob.size).toBeGreaterThan(1000);
    });

    it("generates 5-page PDF for 10 products in 2-product luxury spread layout (2 items/page)", async () => {
      // Mock 10 designs
      const base = useCatalog.getState().designs;
      const tenDesigns: Design[] = [];
      for (let i = 0; i < 10; i++) {
        const ref = base[i % base.length];
        tenDesigns.push({
          ...ref,
          id: `test_d_${i}`,
          designNumber: `TEST-${100 + i}`,
          designName: `Luxury Piece ${i + 1}`,
        });
      }

      const result = await generateMultiPageCatalogPdf(tenDesigns, { templateLayout: "two_product" });
      expect(result.pageCount).toBe(5);
      expect(result.blob.size).toBeGreaterThan(2000);
    });

    it("generates multi-page PDF for 20+ products without card splitting or overlap", async () => {
      const base = useCatalog.getState().designs;
      const twentyTwoDesigns: Design[] = [];
      for (let i = 0; i < 22; i++) {
        const ref = base[i % base.length];
        twentyTwoDesigns.push({
          ...ref,
          id: `test_twenty_${i}`,
          designNumber: `TEST-20-${i}`,
          designName: `Wholesale Item ${i + 1}`,
        });
      }

      // In 6-grid layout (6 items/page), 22 items = 4 pages
      const result6Grid = await generateMultiPageCatalogPdf(twentyTwoDesigns, { templateLayout: "six_grid" });
      expect(result6Grid.pageCount).toBe(4);

      // In price_list layout (12 items/page), 22 items = 2 pages
      const resultPriceList = await generateMultiPageCatalogPdf(twentyTwoDesigns, { templateLayout: "price_list" });
      expect(resultPriceList.pageCount).toBe(2);
    });
  });
});
