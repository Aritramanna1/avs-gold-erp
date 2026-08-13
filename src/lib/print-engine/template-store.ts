/**
 * Unified Print Engine — Template CRUD + versioning.
 *
 * Persistence follows printlog-store.ts's pattern exactly: one row per
 * template in the generic Supabase-backed `print_templates` table via
 * createRepository, not a single JSON blob. Builtin
 * templates (isBuiltin: true) ship as in-memory defaults and only get a
 * row written once a user edits them — resetToDefault() removes the row
 * again, i.e. "reset" means "stop overriding the shipped default."
 */
import { create } from "zustand";
import { createRepository } from "@/lib/repositories/base-repository";
import type { PrintDocType, PrintTemplate, SectionConfig, TemplateVersion } from "./types";
import { DEFAULT_TEMPLATES } from "./default-templates";

const TEMPLATE_VERSION_HISTORY_LIMIT = 20;

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const templateRepository = createRepository<PrintTemplate>("print_templates");

interface PrintTemplateState {
  templates: PrintTemplate[];
  loaded: boolean;

  refresh: () => Promise<void>;
  /**
   * The active template for a doc type: a saved override if one exists for
   * that (docType, paperSize) pair, else the shipped default for it. Most
   * doc types have exactly one paper size and `paperSize` can be omitted;
   * a doc type with multiple structurally distinct layouts per size (e.g.
   * the GST invoice's premium A4/A5 vs. thermal vs. tag-card layouts)
   * requires it to pick the right variant.
   */
  getForDocType: (docType: PrintDocType, paperSize?: PrintTemplate["paperSize"]) => PrintTemplate;
  /** Every paper size a doc type has a distinct default template for — drives whether PrintEngine shows a size switcher at all. */
  getAvailablePaperSizes: (docType: PrintDocType) => PrintTemplate["paperSize"][];
  getById: (id: string) => PrintTemplate | undefined;

  create: (input: {
    docType: PrintDocType;
    name: string;
    paperSize: PrintTemplate["paperSize"];
    sections: SectionConfig[];
  }) => Promise<PrintTemplate>;
  update: (
    id: string,
    patch: Partial<Omit<PrintTemplate, "id" | "version" | "versions" | "createdAt" | "updatedAt">>,
    savedBy?: string,
  ) => Promise<PrintTemplate>;
  remove: (id: string) => Promise<void>;
  /** Omit paperSize to reset every saved variant for the doc type. */
  resetToDefault: (docType: PrintDocType, paperSize?: PrintTemplate["paperSize"]) => Promise<void>;
  restoreVersion: (id: string, version: number) => Promise<PrintTemplate | null>;
}

export const usePrintTemplates = create<PrintTemplateState>()((set, get) => {
  const persist = async (templates: PrintTemplate[]) => {
    set({ templates });
  };

  return {
    templates: [],
    loaded: false,

    refresh: async () => {
      const saved = await templateRepository.readAll();
      set({ templates: saved, loaded: true });
    },

    getForDocType: (docType, paperSize) => {
      const variants = DEFAULT_TEMPLATES[docType] ?? [];
      const defaultForSize = paperSize
        ? (variants.find((t) => t.paperSize === paperSize) ?? variants[0])
        : variants[0];

      const savedVariants = get().templates.filter((t) => t.docType === docType);
      const saved = paperSize
        ? (savedVariants.find((t) => t.paperSize === paperSize) ??
          (savedVariants.length === 1 ? savedVariants[0] : undefined))
        : savedVariants[0];
      if (saved) return saved;
      if (defaultForSize) return defaultForSize;
      // No default authored yet for this doc type (pre-migration) — an
      // empty single-header template keeps every call site total instead
      // of needing a null check, while being obviously incomplete if ever
      // actually rendered.
      const now = Date.now();
      return {
        id: `unconfigured_${docType}`,
        docType,
        name: "Unconfigured",
        isBuiltin: true,
        paperSize: paperSize ?? "a4",
        sections: [{ type: "header", id: "header" }],
        version: 1,
        versions: [],
        createdAt: now,
        updatedAt: now,
      };
    },

    getAvailablePaperSizes: (docType) => {
      const fromDefaults = (DEFAULT_TEMPLATES[docType] ?? []).map((t) => t.paperSize);
      const fromSaved = get()
        .templates.filter((t) => t.docType === docType)
        .map((t) => t.paperSize);
      return Array.from(new Set([...fromDefaults, ...fromSaved]));
    },

    getById: (id) => get().templates.find((t) => t.id === id),

    create: async (input) => {
      const now = Date.now();
      const template: PrintTemplate = {
        id: makeId(),
        docType: input.docType,
        name: input.name,
        isBuiltin: false,
        paperSize: input.paperSize,
        sections: input.sections,
        version: 1,
        versions: [],
        createdAt: now,
        updatedAt: now,
      };
      await templateRepository.save(template);
      await persist([...get().templates, template]);
      return template;
    },

    update: async (id, patch, savedBy) => {
      const existing = get().templates.find((t) => t.id === id) ?? DEFAULT_TEMPLATES_BY_ID[id];
      const base: PrintTemplate =
        existing ??
        (() => {
          throw new Error(`Unknown print template: ${id}`);
        })();

      const priorSnapshot: TemplateVersion = {
        version: base.version,
        savedAt: base.updatedAt,
        savedBy,
        snapshot: {
          id: base.id,
          docType: base.docType,
          name: base.name,
          isBuiltin: base.isBuiltin,
          paperSize: base.paperSize,
          margins: base.margins,
          fontFamily: base.fontFamily,
          fontSize: base.fontSize,
          primaryColor: base.primaryColor,
          accentColor: base.accentColor,
          sections: base.sections,
          version: base.version,
          createdAt: base.createdAt,
          updatedAt: base.updatedAt,
        },
      };

      const updated: PrintTemplate = {
        ...base,
        ...patch,
        id: base.id,
        version: base.version + 1,
        versions: [priorSnapshot, ...base.versions].slice(0, TEMPLATE_VERSION_HISTORY_LIMIT),
        updatedAt: Date.now(),
      };

      await templateRepository.save(updated);
      const rest = get().templates.filter((t) => t.id !== id);
      await persist([...rest, updated]);
      return updated;
    },

    remove: async (id) => {
      const t = get().templates.find((x) => x.id === id);
      if (!t || t.isBuiltin) return; // builtins are reset, not deleted
      await templateRepository.delete(id);
      await persist(get().templates.filter((x) => x.id !== id));
    },

    resetToDefault: async (docType, paperSize) => {
      const savedVariants = get().templates.filter((t) => t.docType === docType);
      const targets = paperSize
        ? savedVariants.filter((t) => t.paperSize === paperSize)
        : savedVariants;
      if (targets.length === 0) return; // already at the shipped default
      await Promise.all(targets.map((t) => templateRepository.delete(t.id)));
      const targetIds = new Set(targets.map((t) => t.id));
      await persist(get().templates.filter((t) => !targetIds.has(t.id)));
    },

    restoreVersion: async (id, version) => {
      const current = get().templates.find((t) => t.id === id) ?? DEFAULT_TEMPLATES_BY_ID[id];
      const found = current?.versions.find((v) => v.version === version);
      if (!current || !found) return null;
      return get().update(id, found.snapshot);
    },
  };
});

const DEFAULT_TEMPLATES_BY_ID: Record<string, PrintTemplate> = Object.fromEntries(
  Object.values(DEFAULT_TEMPLATES)
    .flat()
    .map((t) => [t.id, t]),
);
