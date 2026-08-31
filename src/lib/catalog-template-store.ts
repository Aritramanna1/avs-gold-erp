/**
 * Catalog Page Template Store
 *
 * Manages visual page-layout templates for generating/exporting
 * product catalogues as PDF/print.  Templates control PRESENTATION;
 * underlying product data remains authoritative in catalog-store / stock.
 *
 * These are PAGE DESIGNS, not jewellery/product designs.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ────────────────────────────────────────────────────────────────────

export type PageSize = "a4_portrait" | "a4_landscape" | "a5_portrait" | "square";
export type TemplateLayout =
  | "single_hero"
  | "two_product"
  | "three_product"
  | "four_grid"
  | "six_grid"
  | "large_image_details"
  | "minimal"
  | "luxury"
  | "collection"
  | "price_list"
  | "cover_page"
  | "section_divider"
  | "contact_page";

export interface CatalogTemplateConfig {
  productsPerPage: number;
  imageSize: "small" | "medium" | "large" | "full";
  imagePosition: "top" | "left" | "right" | "center";
  showPrice: boolean;
  showWeight: boolean;
  showPurity: boolean;
  showItemCode: boolean;
  showDescription: boolean;
  showHsn: boolean;
  showFine: boolean;
  showBranding: boolean;
  showFooter: boolean;
  showPageNumber: boolean;
  background: "white" | "cream" | "dark" | "gradient" | "custom";
  customBackground?: string;
  spacing: "compact" | "normal" | "relaxed";
  pageSize: PageSize;
  primaryColor: string;
  accentColor: string;
  fontFamily: "serif" | "sans" | "mono";
}

export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  layout: TemplateLayout;
  isDefault: boolean;        // built-in, cannot be deleted
  isActive: boolean;
  config: CatalogTemplateConfig;
  thumbnailEmoji: string;   // visual stand-in for thumbnail
  createdAt: number;
  updatedAt: number;
}

// ── Default config helper ────────────────────────────────────────────────────

function baseConfig(overrides: Partial<CatalogTemplateConfig> = {}): CatalogTemplateConfig {
  return {
    productsPerPage: 4,
    imageSize: "medium",
    imagePosition: "top",
    showPrice: true,
    showWeight: true,
    showPurity: true,
    showItemCode: true,
    showDescription: false,
    showHsn: false,
    showFine: false,
    showBranding: true,
    showFooter: true,
    showPageNumber: true,
    background: "white",
    spacing: "normal",
    pageSize: "a4_portrait",
    primaryColor: "#B8860B",
    accentColor: "#2C1810",
    fontFamily: "serif",
    ...overrides,
  };
}

// ── Built-in Default Templates ────────────────────────────────────────────────

const NOW = Date.now();

export const DEFAULT_TEMPLATES: CatalogTemplate[] = [
  {
    id: "tpl_classic",
    name: "MTJ Classic",
    description: "Traditional 4-product grid layout with gold accents",
    layout: "four_grid",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 4,
      imageSize: "medium",
      showDescription: false,
      background: "cream",
      primaryColor: "#B8860B",
      fontFamily: "serif",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_premium",
    name: "MTJ Premium",
    description: "Luxury 2-product spread with large imagery",
    layout: "two_product",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 2,
      imageSize: "large",
      showDescription: true,
      showFine: true,
      background: "dark",
      primaryColor: "#D4AF37",
      accentColor: "#8B7355",
      spacing: "relaxed",
      fontFamily: "serif",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_minimal",
    name: "MTJ Minimal",
    description: "Clean 6-product grid, no frills, maximum items per page",
    layout: "six_grid",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 6,
      imageSize: "small",
      showDescription: false,
      showHsn: false,
      background: "white",
      primaryColor: "#333333",
      accentColor: "#666666",
      spacing: "compact",
      fontFamily: "sans",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_grid",
    name: "MTJ Grid",
    description: "Balanced 4-grid with item code and weights",
    layout: "four_grid",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 4,
      imageSize: "medium",
      showItemCode: true,
      showWeight: true,
      background: "white",
      primaryColor: "#8B4513",
      accentColor: "#D2691E",
      fontFamily: "sans",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_collection",
    name: "MTJ Collection",
    description: "Jewellery collection showcase with category headers",
    layout: "collection",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 3,
      imageSize: "medium",
      imagePosition: "top",
      showDescription: true,
      showPurity: true,
      background: "cream",
      primaryColor: "#7B3F00",
      accentColor: "#C68B59",
      spacing: "relaxed",
      fontFamily: "serif",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_product_focus",
    name: "MTJ Product Focus",
    description: "Single hero product — full page spotlight",
    layout: "single_hero",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 1,
      imageSize: "full",
      imagePosition: "left",
      showDescription: true,
      showFine: true,
      showHsn: false,
      background: "gradient",
      primaryColor: "#B8860B",
      accentColor: "#2C1810",
      spacing: "relaxed",
      fontFamily: "serif",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_price_list",
    name: "MTJ Price List",
    description: "Rate-card style: tabular list with weights and prices",
    layout: "price_list",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 12,
      imageSize: "small",
      showPrice: true,
      showWeight: true,
      showPurity: true,
      showHsn: true,
      showDescription: false,
      background: "white",
      primaryColor: "#1a1a2e",
      accentColor: "#B8860B",
      spacing: "compact",
      fontFamily: "sans",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_luxury",
    name: "MTJ Luxury Showcase",
    description: "High-end two-product spread with gradient and fine gold details",
    layout: "luxury",
    isDefault: true,
    isActive: true,
    thumbnailEmoji: "",
    config: baseConfig({
      productsPerPage: 2,
      imageSize: "large",
      imagePosition: "center",
      showDescription: true,
      showFine: true,
      showPrice: false,
      background: "dark",
      primaryColor: "#FFD700",
      accentColor: "#C0A060",
      spacing: "relaxed",
      fontFamily: "serif",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ── Store ─────────────────────────────────────────────────────────────────────

interface CatalogTemplateState {
  templates: CatalogTemplate[];
  selectedTemplateId: string;

  // Actions
  selectTemplate: (id: string) => void;
  createTemplate: (t: Omit<CatalogTemplate, "id" | "createdAt" | "updatedAt" | "isDefault">) => CatalogTemplate;
  updateTemplate: (id: string, patch: Partial<Pick<CatalogTemplate, "name" | "description" | "config" | "isActive">>) => void;
  duplicateTemplate: (id: string) => CatalogTemplate;
  deleteTemplate: (id: string) => void;
  resetToDefaults: () => void;
}

export const useCatalogTemplates = create<CatalogTemplateState>()(
  persist(
    (set, get) => ({
      templates: DEFAULT_TEMPLATES,
      selectedTemplateId: DEFAULT_TEMPLATES[0].id,

      selectTemplate: (id) => set({ selectedTemplateId: id }),

      createTemplate: (t) => {
        const newTpl: CatalogTemplate = {
          ...t,
          id: `tpl_custom_${Date.now()}`,
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ templates: [...s.templates, newTpl] }));
        return newTpl;
      },

      updateTemplate: (id, patch) => {
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
          ),
        }));
      },

      duplicateTemplate: (id) => {
        const orig = get().templates.find((t) => t.id === id);
        if (!orig) throw new Error("Template not found");
        const copy: CatalogTemplate = {
          ...orig,
          id: `tpl_copy_${Date.now()}`,
          name: `${orig.name} (Copy)`,
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ templates: [...s.templates, copy] }));
        return copy;
      },

      deleteTemplate: (id) => {
        const tpl = get().templates.find((t) => t.id === id);
        if (tpl?.isDefault) throw new Error("Cannot delete a built-in template");
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
          selectedTemplateId:
            s.selectedTemplateId === id ? DEFAULT_TEMPLATES[0].id : s.selectedTemplateId,
        }));
      },

      resetToDefaults: () => {
        set({
          templates: DEFAULT_TEMPLATES,
          selectedTemplateId: DEFAULT_TEMPLATES[0].id,
        });
      },
    }),
    {
      name: "mtj-catalog-templates-v1",
      // Merge persisted custom templates with fresh defaults on upgrade
      merge: (persisted: any, current) => {
        const customTpls = (persisted?.templates ?? []).filter(
          (t: CatalogTemplate) => !t.isDefault,
        );
        return {
          ...current,
          templates: [...DEFAULT_TEMPLATES, ...customTpls],
          selectedTemplateId: persisted?.selectedTemplateId ?? DEFAULT_TEMPLATES[0].id,
        };
      },
    },
  ),
);
