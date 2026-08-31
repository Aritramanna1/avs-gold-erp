/**
 * MTJ ERP — Design Catalog Templates Store & Package Manager
 *
 * Manages importable/custom HTML/CSS/SVG templates for the Design Catalog.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  STARTER_DESIGNER_TEMPLATES,
  DEFAULT_DYNAMIC_TEXT_BLOCKS,
  type DesignerTemplateManifest,
  type DynamicTextBlock,
} from "./designer-templates-library";

interface DesignCatalogState {
  templates: DesignerTemplateManifest[];
  defaultTemplateId: string;
  textBlocks: Record<string, DynamicTextBlock>;

  // Actions
  setDefaultTemplate: (id: string) => void;
  updateTextBlock: (id: string, content: string) => void;
  resetTextBlocks: () => void;
  importTemplate: (pkg: {
    name: string;
    description?: string;
    pageSize?: "A4" | "A5" | "Letter";
    orientation?: "portrait" | "landscape";
    productsPerPage?: number;
    supportsHero?: boolean;
    html: string;
    css: string;
  }) => { ok: boolean; template?: DesignerTemplateManifest; error?: string };
  toggleTemplateActive: (id: string) => void;
  duplicateTemplate: (id: string) => DesignerTemplateManifest | null;
  deleteTemplate: (id: string) => boolean;
  resetToBuiltInTemplates: () => void;
}

export const useDesignCatalogStore = create<DesignCatalogState>()(
  persist(
    (set, get) => ({
      templates: STARTER_DESIGNER_TEMPLATES,
      defaultTemplateId: "mtj-luxury-gold",
      textBlocks: DEFAULT_DYNAMIC_TEXT_BLOCKS,

      setDefaultTemplate: (id: string) => {
        set({ defaultTemplateId: id });
      },

      updateTextBlock: (id: string, content: string) => {
        const current = get().textBlocks[id] || {
          id,
          label: id,
          type: "text",
          content,
          defaultValue: content,
          editable: true,
        };
        set({
          textBlocks: {
            ...get().textBlocks,
            [id]: { ...current, content },
          },
        });
      },

      resetTextBlocks: () => {
        set({ textBlocks: DEFAULT_DYNAMIC_TEXT_BLOCKS });
      },

      importTemplate: (pkg) => {
        if (!pkg.name?.trim()) {
          return { ok: false, error: "Template name is required." };
        }
        if (!pkg.html?.trim()) {
          return { ok: false, error: "Template HTML is required." };
        }
        if (!pkg.css?.trim()) {
          return { ok: false, error: "Template CSS is required." };
        }

        const id = `custom-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const now = Date.now();
        const newTemplate: DesignerTemplateManifest = {
          id,
          name: pkg.name.trim(),
          version: "1.0",
          description: pkg.description || "Imported custom catalogue layout",
          pageSize: pkg.pageSize || "A4",
          orientation: pkg.orientation || "portrait",
          productsPerPage: pkg.productsPerPage || 6,
          supportsHero: pkg.supportsHero ?? true,
          supportsMultipleProducts: true,
          fields: ["companyName", "productImage", "productName", "designNumber", "grossWeight", "netWeight", "purity"],
          html: pkg.html,
          css: pkg.css,
          createdAt: now,
          updatedAt: now,
          isBuiltIn: false,
          isActive: true,
        };

        set({ templates: [newTemplate, ...get().templates] });
        return { ok: true, template: newTemplate };
      },

      toggleTemplateActive: (id: string) => {
        set({
          templates: get().templates.map((t) =>
            t.id === id ? { ...t, isActive: !t.isActive, updatedAt: Date.now() } : t,
          ),
        });
      },

      duplicateTemplate: (id: string) => {
        const source = get().templates.find((t) => t.id === id);
        if (!source) return null;
        const now = Date.now();
        const copy: DesignerTemplateManifest = {
          ...source,
          id: `tpl-copy-${now}`,
          name: `${source.name} (Copy)`,
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
        };
        set({ templates: [copy, ...get().templates] });
        return copy;
      },

      deleteTemplate: (id: string) => {
        const target = get().templates.find((t) => t.id === id);
        if (!target || target.isBuiltIn) return false;
        set({ templates: get().templates.filter((t) => t.id !== id) });
        return true;
      },

      resetToBuiltInTemplates: () => {
        set({
          templates: STARTER_DESIGNER_TEMPLATES,
          defaultTemplateId: "mtj-luxury-gold",
          textBlocks: DEFAULT_DYNAMIC_TEXT_BLOCKS,
        });
      },
    }),
    {
      name: "mtj-designer-catalog-store-v1",
    },
  ),
);
