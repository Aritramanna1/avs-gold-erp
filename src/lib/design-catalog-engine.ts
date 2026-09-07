/**
 * MTJ ERP — Design Catalog Rendering & Template Engine
 *
 * Provides data-binding for HTML/CSS/SVG templates, multi-page pagination,
 * hero product assignment, and PDF generation.
 */

import { jsPDF } from "jspdf";
import DOMPurify from "dompurify";
import type { Design } from "@/lib/catalog-store";
import type { DesignerTemplateManifest, DynamicTextBlock } from "@/lib/designer-templates-library";
import { DEFAULT_DYNAMIC_TEXT_BLOCKS } from "@/lib/designer-templates-library";
import { useDesignCatalogStore } from "@/lib/design-catalog-store";
import { mgToGrams } from "@/lib/gold";
import { formatDateMedium as formatDate } from "@/lib/format-date";
import { useSettings } from "@/lib/settings-store";
import { useAttachments } from "@/lib/attachments-store";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";
import { urlToPdfImageData } from "@/lib/print-engine/attachment-images";

export interface CompanyBrandingContext {
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  website?: string;
  gstin?: string;
  social?: string;
  qr?: string;
}

export interface CatalogRenderContext {
  company: CompanyBrandingContext;
  collectionName?: string;
  catalogTitle?: string;
  catalogDate?: string;
  textBlocks?: Record<string, string | DynamicTextBlock>;
}

export function resolveDesignPhoto(d: Design): string | undefined {
  if (d.photoDataUrl) return d.photoDataUrl;
  const att = useAttachments.getState().items[`catalog:${d.id}:design_photo`];
  return att?.fileDataUrl || att?.thumbnailDataUrl;
}

/**
 * Lightweight, robust mustache-style template binder with dynamic text blocks.
 * Supports:
 * - `{{variable}}`
 * - `{{text.blockId}}`
 * - `{{#condition}} ... {{/condition}}`
 * - `{{#text.blockId}} ... {{/text.blockId}}`
 * - `{{#products}} ... {{/products}}`
 */
export function bindTemplateData(
  templateHtml: string,
  data: {
    company: CompanyBrandingContext;
    hero?: Record<string, any>;
    products: Record<string, any>[];
    collection: { name: string; description?: string };
    catalog: { title: string; date: string };
    page: { number: number; total: number };
    text?: Record<string, string>;
  },
): string {
  let output = templateHtml;

  // 1. Process dynamic text blocks {{#text.xxx}} ... {{/text.xxx}} conditionals
  const textMap: Record<string, string> = {
    collectionTitle: data.collection.name,
    aboutCollection: data.collection.description || "",
    catalogBadge: "EXCLUSIVE HIGH JEWELLERY",
    sectionTitle: "CURATED COLLECTION SHOWCASE",
    specialOffer: "",
    footerNotice: "Certified 100% BIS Hallmarked Pure Gold • All weights approximate",
    contactText: "",
    terms: "Govt. Hallmarked jewellery.",
    ...(data.text || {}),
  };

  Object.entries(textMap).forEach(([k, val]) => {
    if (val && val.trim().length > 0) {
      output = output.replace(new RegExp(`\\{\\{#text\\.${k}\\}\\}([\\s\\S]*?)\\{\\{/text\\.${k}\\}\\}`, "g"), "$1");
    } else {
      output = output.replace(new RegExp(`\\{\\{#text\\.${k}\\}\\}[\\s\\S]*?\\{\\{/text\\.${k}\\}\\}`, "g"), "");
    }
    output = output.replace(new RegExp(`\\{\\{text\\.${k}\\}\\}`, "g"), String(val ?? ""));
  });

  // 2. Process {{#hero}} ... {{/hero}}
  if (data.hero) {
    output = output.replace(/\{\{#hero\}\}([\s\S]*?)\{\{\/hero\}\}/g, (_, inner) => {
      let heroSection = inner;
      Object.entries(data.hero!).forEach(([k, v]) => {
        heroSection = heroSection.replace(new RegExp(`\\{\\{hero\\.${k}\\}\\}`, "g"), String(v ?? ""));
      });
      // Handle optional price in hero
      if (!data.hero?.price) {
        heroSection = heroSection.replace(/\{\{#hero\.price\}\}[\s\S]*?\{\{\/hero\.price\}\}/g, "");
      } else {
        heroSection = heroSection.replace(/\{\{#hero\.price\}\}([\s\S]*?)\{\{\/hero\.price\}\}/g, "$1");
      }
      return heroSection;
    });
  } else {
    output = output.replace(/\{\{#hero\}\}[\s\S]*?\{\{\/hero\}\}/g, "");
  }

  // 3. Process {{#company.logo}} ... {{/company.logo}}
  if (data.company.logo) {
    output = output.replace(/\{\{#company\.logo\}\}([\s\S]*?)\{\{\/company\.logo\}\}/g, "$1");
  } else {
    output = output.replace(/\{\{#company\.logo\}\}[\s\S]*?\{\{\/company\.logo\}\}/g, "");
  }

  // 4. Process {{#products}} ... {{/products}}
  output = output.replace(/\{\{#products\}\}([\s\S]*?)\{\{\/products\}\}/g, (_, cardTemplate) => {
    return data.products
      .map((prod) => {
        let card = cardTemplate;
        Object.entries(prod).forEach(([k, v]) => {
          card = card.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v ?? ""));
        });
        // Handle optional price in product
        if (!prod.price) {
          card = card.replace(/\{\{#price\}\}[\s\S]*?\{\{\/price\}\}/g, "");
        } else {
          card = card.replace(/\{\{#price\}\}([\s\S]*?)\{\{\/price\}\}/g, "$1");
        }
        return card;
      })
      .join("\n");
  });

  // 5. Replace company variables
  Object.entries(data.company).forEach(([k, v]) => {
    output = output.replace(new RegExp(`\\{\\{company\\.${k}\\}\\}`, "g"), String(v ?? ""));
  });

  // 6. Replace collection & catalog variables
  output = output.replace(/\{\{collection\.name\}\}/g, data.collection.name);
  output = output.replace(/\{\{collection\.description\}\}/g, data.collection.description ?? "");
  output = output.replace(/\{\{catalog\.title\}\}/g, data.catalog.title);
  output = output.replace(/\{\{catalog\.date\}\}/g, data.catalog.date);
  output = output.replace(/\{\{page\.number\}\}/g, String(data.page.number));
  output = output.replace(/\{\{page\.total\}\}/g, String(data.page.total));

  // Clean any leftover unused bindings
  output = output.replace(/\{\{[^}]+\}\}/g, "");

  return output;
}

/**
 * Renders all pages of a design catalogue into HTML strings with bound CSS.
 */
export function compileCatalogPagesHtml(
  designs: Design[],
  heroId: string | undefined,
  template: DesignerTemplateManifest,
  context?: Partial<CatalogRenderContext>,
): { pagesHtml: string[]; totalPages: number } {
  const firm = useSettings.getState().firm;
  const branding: CompanyBrandingContext = {
    name: context?.company?.name || firm?.shopName || "AVS GOLD JEWELLERY",
    logo: context?.company?.logo || firm?.logoUrl,
    address: context?.company?.address || firm?.address || "Main Branch",
    phone: context?.company?.phone || firm?.phone || "",
    website: context?.company?.website || firm?.website || "",
    gstin: context?.company?.gstin || (firm?.gstin ? `GSTIN: ${firm.gstin}` : ""),
    social: context?.company?.social || "@avsgolderp",
  };

  // Resolve dynamic text blocks from store / context
  const storedBlocks = useDesignCatalogStore.getState().textBlocks || DEFAULT_DYNAMIC_TEXT_BLOCKS;
  const rawText = context?.textBlocks || {};
  const textStrings: Record<string, string> = {};

  Object.entries(storedBlocks).forEach(([k, b]) => {
    textStrings[k] = typeof b === "string" ? b : b.content || b.defaultValue;
  });

  if (context?.collectionName) {
    textStrings.collectionTitle = context.collectionName;
  }
  if (context?.catalogTitle) {
    textStrings.catalogBadge = context.catalogTitle;
  }

  Object.entries(rawText).forEach(([k, v]) => {
    textStrings[k] = typeof v === "string" ? v : (v as DynamicTextBlock).content;
  });

  const heroDesign = heroId ? designs.find((d) => d.id === heroId) : undefined;
  const nonHeroDesigns = heroDesign ? designs.filter((d) => d.id !== heroDesign.id) : designs;

  const perPage = Math.max(1, template.productsPerPage);
  // If page 1 has a hero, it accommodates (perPage - 1) supporting items, subsequent pages take perPage
  const page1Items = heroDesign ? nonHeroDesigns.slice(0, perPage - 1) : nonHeroDesigns.slice(0, perPage);
  const remainingItems = heroDesign ? nonHeroDesigns.slice(perPage - 1) : nonHeroDesigns.slice(perPage);

  const additionalPages = [];
  for (let i = 0; i < remainingItems.length; i += perPage) {
    additionalPages.push(remainingItems.slice(i, i + perPage));
  }

  const totalPages = Math.max(1, 1 + additionalPages.length);
  const pagesHtml: string[] = [];

  // ── Page 1 ──
  const mapDesignToProduct = (d: Design) => ({
    id: d.id,
    name: d.designName || d.designNumber,
    designNumber: d.designNumber,
    category: d.category,
    image: resolveDesignPhoto(d) || "",
    grossWeight: mgToGrams(d.approxGrossMg),
    netWeight: mgToGrams(d.approxNetMg || d.approxGrossMg),
    purity: `${d.purity}‰ (${d.purity >= 916 ? "22K" : d.purity >= 750 ? "18K" : "Gold"})`,
    description: d.notes || d.tags?.join(", ") || "",
  });

  const page1HeroData = heroDesign
    ? {
        name: heroDesign.designName || heroDesign.designNumber,
        designNumber: heroDesign.designNumber,
        category: heroDesign.category,
        image: resolveDesignPhoto(heroDesign) || "",
        grossWeight: mgToGrams(heroDesign.approxGrossMg),
        netWeight: mgToGrams(heroDesign.approxNetMg || heroDesign.approxGrossMg),
        purity: `${heroDesign.purity}‰`,
        description: heroDesign.notes || "Exquisite artisanal craftsmanship with precision finishing.",
      }
    : undefined;

  const page1Html = bindTemplateData(template.html, {
    company: branding,
    hero: page1HeroData,
    products: page1Items.map(mapDesignToProduct),
    collection: {
      name: context?.collectionName || textStrings.collectionTitle || "SIGNATURE MASTERPIECES",
      description: textStrings.aboutCollection || undefined,
    },
    catalog: {
      title: context?.catalogTitle || textStrings.collectionTitle || "EXQUISITE JEWELLERY CATALOGUE",
      date: context?.catalogDate || formatDate(Date.now()),
    },
    page: { number: 1, total: totalPages },
    text: textStrings,
  });

  pagesHtml.push(page1Html);

  // ── Additional Pages (Subsequent pages without hero banner) ──
  additionalPages.forEach((items, idx) => {
    const pageHtml = bindTemplateData(template.html, {
      company: branding,
      hero: undefined, // no hero on supporting pages
      products: items.map(mapDesignToProduct),
      collection: {
        name: context?.collectionName || textStrings.collectionTitle || "SIGNATURE MASTERPIECES",
        description: textStrings.aboutCollection || undefined,
      },
      catalog: {
        title: context?.catalogTitle || textStrings.collectionTitle || "EXQUISITE JEWELLERY CATALOGUE",
        date: context?.catalogDate || formatDate(Date.now()),
      },
      page: { number: idx + 2, total: totalPages },
      text: textStrings,
    });
    pagesHtml.push(pageHtml);
  });

  return { pagesHtml, totalPages };
}

/**
 * Generates a high-quality multi-page PDF document from the Designer Template.
 */
export async function generateDesignerCatalogPdf(
  designs: Design[],
  heroId: string | undefined,
  template: DesignerTemplateManifest,
  context?: Partial<CatalogRenderContext>,
): Promise<{ blob: Blob; fileName: string; pageCount: number }> {
  const { pagesHtml, totalPages } = compileCatalogPagesHtml(designs, heroId, template, context);
  const doc = new jsPDF({
    unit: "mm",
    format: template.pageSize === "A5" ? "a5" : "a4",
    orientation: template.orientation || "portrait",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Render each page into an offscreen container, rasterize to canvas, and add to PDF
  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) doc.addPage();

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "210mm";
    container.style.minHeight = "297mm";
    container.style.background = "#fff";
    container.style.zIndex = "-1000";

    const styleEl = document.createElement("style");
    styleEl.innerHTML = template.css;
    container.appendChild(styleEl);

    const bodyEl = document.createElement("div");
    bodyEl.innerHTML = DOMPurify.sanitize(pagesHtml[i]);
    container.appendChild(bodyEl);

    document.body.appendChild(container);

    try {
      // Use html2canvas if available for pixel-perfect fidelity, or jsPDF vector fallback
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      doc.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
    } catch (e) {
      console.warn("[Designer Catalog] html2canvas render fallback:", e);
    } finally {
      document.body.removeChild(container);
    }
  }

  const blob = doc.output("blob");
  const fileName = `Design_Catalog_${template.name.replace(/\s+/g, "_")}_${Date.now()}.pdf`;

  return { blob, fileName, pageCount: totalPages };
}
