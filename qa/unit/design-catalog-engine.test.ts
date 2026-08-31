import { describe, it, expect, beforeEach } from "vitest";
import {
  bindTemplateData,
  compileCatalogPagesHtml,
} from "../../src/lib/design-catalog-engine";
import {
  STARTER_DESIGNER_TEMPLATES,
} from "../../src/lib/designer-templates-library";
import { useDesignCatalogStore } from "../../src/lib/design-catalog-store";
import type { Design } from "../../src/lib/catalog-store";

describe("MTJ ERP — Design Catalog & HTML Template Engine", () => {
  beforeEach(() => {
    useDesignCatalogStore.getState().resetToBuiltInTemplates();
  });

  const mockDesigns: Design[] = [
    {
      id: "d1",
      designNumber: "RG-2026-001",
      designName: "Classic Solitaire Ring",
      category: "Ring",
      purity: 916,
      approxGrossMg: 4500,
      approxNetMg: 4500,
      difficulty: "easy",
      tags: ["solitaire", "engagement"],
      source: "internal",
    },
    {
      id: "d2",
      designNumber: "RG-2026-002",
      designName: "Floral Diamond Ring",
      category: "Ring",
      purity: 916,
      approxGrossMg: 8200,
      approxNetMg: 8000,
      difficulty: "medium",
      tags: ["floral"],
      source: "internal",
    },
    {
      id: "d3",
      designNumber: "NC-2026-001",
      designName: "Royal Antique Choker",
      category: "Necklace",
      purity: 916,
      approxGrossMg: 48000,
      approxNetMg: 45000,
      difficulty: "hard",
      tags: ["antique", "bridal"],
      source: "internal",
    },
    {
      id: "d4",
      designNumber: "BG-2026-001",
      designName: "Traditional Kada Bangle",
      category: "Bangle",
      purity: 916,
      approxGrossMg: 24000,
      approxNetMg: 24000,
      difficulty: "medium",
      tags: ["traditional"],
      source: "internal",
    },
    {
      id: "d5",
      designNumber: "ER-2026-001",
      designName: "Jhumka Earring",
      category: "Earring",
      purity: 750,
      approxGrossMg: 6500,
      approxNetMg: 6500,
      difficulty: "medium",
      tags: ["jhumka"],
      source: "internal",
    },
    {
      id: "d6",
      designNumber: "PD-2026-001",
      designName: "Peacock Pendant",
      category: "Pendant",
      purity: 916,
      approxGrossMg: 3800,
      approxNetMg: 3800,
      difficulty: "easy",
      tags: ["peacock"],
      source: "internal",
    },
  ];

  it("1. Correctly binds template variables for company, hero, and product lists", () => {
    const templateHtml = `
      <div class="header">{{company.name}} | {{company.phone}}</div>
      {{#hero}}
        <div class="hero">{{hero.name}} ({{hero.designNumber}}) - {{hero.netWeight}}g</div>
      {{/hero}}
      <div class="products">
        {{#products}}
          <div class="card">{{name}} - {{netWeight}}g ({{purity}})</div>
        {{/products}}
      </div>
      <footer>Page {{page.number}} of {{page.total}}</footer>
    `;

    const bound = bindTemplateData(templateHtml, {
      company: {
        name: "Maa Tara Jewellers",
        phone: "+91 9876543210",
      },
      hero: {
        name: "Royal Antique Choker",
        designNumber: "NC-2026-001",
        netWeight: 45.0,
      },
      products: [
        { name: "Classic Solitaire Ring", netWeight: 4.5, purity: "916‰" },
        { name: "Floral Diamond Ring", netWeight: 8.0, purity: "916‰" },
      ],
      collection: { name: "Bridal Signature" },
      catalog: { title: "Lookbook", date: "31 Aug 2026" },
      page: { number: 1, total: 2 },
    });

    expect(bound).toContain("Maa Tara Jewellers | +91 9876543210");
    expect(bound).toContain("Royal Antique Choker (NC-2026-001) - 45g");
    expect(bound).toContain("Classic Solitaire Ring - 4.5g (916‰)");
    expect(bound).toContain("Floral Diamond Ring - 8g (916‰)");
    expect(bound).toContain("Page 1 of 2");
  });

  it("2. Accurately compiles multiple pages and allocates Hero vs Supporting products", () => {
    const luxuryTemplate = STARTER_DESIGNER_TEMPLATES.find((t) => t.id === "mtj-luxury-gold")!;
    expect(luxuryTemplate).toBeDefined();

    // Select all 6 designs with d3 as Hero
    const { pagesHtml, totalPages } = compileCatalogPagesHtml(
      mockDesigns,
      "d3", // Royal Antique Choker as Hero
      luxuryTemplate,
      { collectionName: "ROYAL HERITAGE" },
    );

    expect(totalPages).toBeGreaterThanOrEqual(2);
    expect(pagesHtml.length).toBe(totalPages);

    // Page 1 should contain the hero
    expect(pagesHtml[0]).toContain("Royal Antique Choker");
    expect(pagesHtml[0]).toContain("ROYAL HERITAGE");
    expect(pagesHtml[0]).toContain("NC-2026-001");

    // Page 2 should have page count 2 of totalPages
    expect(pagesHtml[1]).toContain(`Page 2 of ${totalPages}`);
  });

  it("3. Template store supports importing custom HTML/CSS templates", () => {
    const store = useDesignCatalogStore.getState();

    const importResult = store.importTemplate({
      name: "Bespoke Royal Brochure",
      description: "Custom bridal spread with 3 large images",
      productsPerPage: 3,
      supportsHero: true,
      html: "<div class='page'><h1>{{company.name}}</h1>{{#products}}<div>{{name}}</div>{{/products}}</div>",
      css: ".page { width: 210mm; }",
    });

    expect(importResult.ok).toBe(true);
    expect(importResult.template).toBeDefined();
    expect(importResult.template?.name).toBe("Bespoke Royal Brochure");

    const updatedTemplates = useDesignCatalogStore.getState().templates;
    expect(updatedTemplates.some((t) => t.id === importResult.template?.id)).toBe(true);
  });

  it("4. Rejects invalid or incomplete template import manifests", () => {
    const store = useDesignCatalogStore.getState();

    const emptyName = store.importTemplate({
      name: "",
      html: "<div></div>",
      css: ".a {}",
    });
    expect(emptyName.ok).toBe(false);
    expect(emptyName.error).toContain("name is required");

    const emptyHtml = store.importTemplate({
      name: "Valid Name",
      html: "",
      css: ".a {}",
    });
    expect(emptyHtml.ok).toBe(false);
    expect(emptyHtml.error).toContain("HTML is required");
  });

  it("5. Sets and persists default template across exports", () => {
    const store = useDesignCatalogStore.getState();
    store.setDefaultTemplate("mtj-premium-ivory");

    expect(useDesignCatalogStore.getState().defaultTemplateId).toBe("mtj-premium-ivory");
  });

  it("6. Binds dynamic text blocks and user-customized text variables into templates", () => {
    const templateHtml = `
      <div class="header">
        <h1>{{text.collectionTitle}}</h1>
        <span class="badge">{{text.catalogBadge}}</span>
      </div>
      {{#text.specialOffer}}
      <div class="offer">{{text.specialOffer}}</div>
      {{/text.specialOffer}}
      <main>
        <h3>{{text.sectionTitle}}</h3>
        <p>{{text.aboutCollection}}</p>
      </main>
      <footer>
        <div class="notice">{{text.footerNotice}}</div>
        <div class="contact">{{text.contactText}}</div>
      </footer>
    `;

    const bound = bindTemplateData(templateHtml, {
      company: { name: "Maa Tara Jewellers" },
      products: [],
      collection: { name: "DIWALI 2026 COLLECTION" },
      catalog: { title: "Diwali Catalog", date: "31 Aug 2026" },
      page: { number: 1, total: 1 },
      text: {
        collectionTitle: "DIWALI 2026 EXCLUSIVE SHOWCASE",
        catalogBadge: "LIMITED EDITION",
        specialOffer: "Flat 0% Wastage on Necklaces",
        sectionTitle: "ROYAL BRIDAL MASTERPIECES",
        aboutCollection: "Handcrafted pure gold ornaments crafted by master karigars.",
        footerNotice: "100% BIS Hallmarked 916 Gold • All weights approximate",
        contactText: "Call +91 9876543210 for private viewing",
      },
    });

    expect(bound).toContain("DIWALI 2026 EXCLUSIVE SHOWCASE");
    expect(bound).toContain("LIMITED EDITION");
    expect(bound).toContain("Flat 0% Wastage on Necklaces");
    expect(bound).toContain("ROYAL BRIDAL MASTERPIECES");
    expect(bound).toContain("Handcrafted pure gold ornaments crafted by master karigars.");
    expect(bound).toContain("100% BIS Hallmarked 916 Gold • All weights approximate");
    expect(bound).toContain("Call +91 9876543210 for private viewing");
  });

  it("7. Updates and persists text blocks across edits and resets to defaults", () => {
    const store = useDesignCatalogStore.getState();
    store.updateTextBlock("collectionTitle", "WEDDING COLLECTION 2026");
    store.updateTextBlock("specialOffer", "20% Off on Making Charges");

    expect(useDesignCatalogStore.getState().textBlocks.collectionTitle.content).toBe("WEDDING COLLECTION 2026");
    expect(useDesignCatalogStore.getState().textBlocks.specialOffer.content).toBe("20% Off on Making Charges");

    // Reset back to defaults
    store.resetTextBlocks();
    expect(useDesignCatalogStore.getState().textBlocks.collectionTitle.content).toBe("DIWALI 2026 COLLECTION");
  });

  it("8. Compiles catalog pages with dynamic text blocks and resolves design photos", () => {
    const luxuryTemplate = STARTER_DESIGNER_TEMPLATES.find((t) => t.id === "mtj-luxury-gold")!;
    const store = useDesignCatalogStore.getState();
    store.updateTextBlock("collectionTitle", "FESTIVE GOLD GALA");
    store.updateTextBlock("specialOffer", "Zero Making Charges on Coins");

    const { pagesHtml } = compileCatalogPagesHtml(
      mockDesigns,
      "d1",
      luxuryTemplate,
      {
        textBlocks: {
          collectionTitle: "FESTIVE GOLD GALA",
          specialOffer: "Zero Making Charges on Coins",
        },
      },
    );

    expect(pagesHtml[0]).toContain("FESTIVE GOLD GALA");
    expect(pagesHtml[0]).toContain("Zero Making Charges on Coins");
  });
});
