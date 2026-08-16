/**
 * Unified Print Engine — Print Profile Store & Hardware Calibration.
 *
 * Master Reference: docs/PRINT_PROFILE_MASTER.md
 */
import { create } from "zustand";
import { createRepository } from "@/lib/repositories/base-repository";
import type { PrintDocType, PrintProfile, PrintSize } from "./types";

const now = Date.now();

export const DEFAULT_PRINT_PROFILES: PrintProfile[] = [
  {
    id: "prof_a4_standard_laser",
    name: "A4 Standard Laser (Executive Client Copy)",
    isDefault: true,
    paperSize: "a4",
    orientation: "portrait",
    margins: { top: 12, right: 12, bottom: 12, left: 12 },
    scale: 100,
    copies: 1,
    printerClass: "laser",
    colorMode: "color",
    headerFooterRepeat: "all_pages",
    fitToPage: false,
    targetDocTypes: [
      "gst_invoice",
      "retail_invoice",
      "credit_note",
      "debit_note",
      "estimate_doc",
      "delivery_challan",
      "customer_ledger_statement",
      "manufacturing_bill",
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_a4_compact_dense",
    name: "A4 Compact Dense (15+ Items / Internal Audit)",
    isDefault: false,
    paperSize: "a4",
    orientation: "portrait",
    margins: { top: 6, right: 6, bottom: 6, left: 6 },
    scale: 90,
    copies: 1,
    printerClass: "laser",
    colorMode: "grayscale",
    headerFooterRepeat: "all_pages",
    fitToPage: true,
    targetDocTypes: ["gst_invoice", "retail_invoice", "daily_close_report", "attendance_sheet"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_a5_landscape_jobcard",
    name: "A5 Half-Page Landscape (Workshop Bench Slip)",
    isDefault: true,
    paperSize: "a5l",
    orientation: "landscape",
    margins: { top: 8, right: 8, bottom: 8, left: 8 },
    scale: 100,
    copies: 1,
    printerClass: "laser",
    colorMode: "color",
    headerFooterRepeat: "first_page_only",
    fitToPage: true,
    targetDocTypes: ["job_card"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_a5_portrait_receipt",
    name: "A5 Half-Page Portrait (Counter Delivery & Cash Memo)",
    isDefault: true,
    paperSize: "a5",
    orientation: "portrait",
    margins: { top: 8, right: 8, bottom: 8, left: 8 },
    scale: 100,
    copies: 1,
    printerClass: "laser",
    colorMode: "color",
    headerFooterRepeat: "all_pages",
    fitToPage: true,
    targetDocTypes: [
      "order_slip",
      "advance_receipt",
      "gold_receipt",
      "old_gold_receipt",
      "repair_receipt",
      "repair_delivery_slip",
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_pos_80mm_thermal",
    name: "80mm POS Thermal Receipt (Counter Token Slip)",
    isDefault: true,
    paperSize: "thermal",
    orientation: "portrait",
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    scale: 100,
    copies: 1,
    printerClass: "thermal",
    colorMode: "monochrome",
    headerFooterRepeat: "first_page_only",
    fitToPage: false,
    targetDocTypes: ["gst_invoice", "retail_invoice", "payment_receipt", "ratecut_slip"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_pos_58mm_thermal",
    name: "58mm POS Mini Thermal (Compact Token Receipt)",
    isDefault: false,
    paperSize: "thermal58",
    orientation: "portrait",
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    scale: 90,
    copies: 1,
    printerClass: "thermal",
    colorMode: "monochrome",
    headerFooterRepeat: "first_page_only",
    fitToPage: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_jewellery_tag_label",
    name: "Jewellery Tag / Butterfly Label (50 × 25 mm)",
    isDefault: true,
    paperSize: "tag",
    orientation: "landscape",
    margins: { top: 1, right: 1, bottom: 1, left: 1 },
    scale: 100,
    copies: 1,
    printerClass: "tag",
    colorMode: "monochrome",
    headerFooterRepeat: "first_page_only",
    fitToPage: true,
    labelWidthMm: 50,
    labelHeightMm: 25,
    targetDocTypes: ["jewellery_tag"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_workshop_cardstock_slip",
    name: "Workshop Cardstock Slip (Dual Copy Vault Sign-Off)",
    isDefault: false,
    paperSize: "a5",
    orientation: "portrait",
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    scale: 100,
    copies: 2,
    printerClass: "laser",
    colorMode: "color",
    headerFooterRepeat: "first_page_only",
    fitToPage: true,
    watermarkText: "WORKSHOP COPY",
    targetDocTypes: ["daily_material_slip", "worker_material_given", "worker_material_return"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "prof_continuous_dot_matrix",
    name: "Continuous Dot Matrix Ledger (10 × 12 inch)",
    isDefault: false,
    paperSize: "a4",
    orientation: "portrait",
    margins: { top: 15, right: 10, bottom: 15, left: 10 },
    scale: 100,
    copies: 1,
    printerClass: "dot_matrix",
    colorMode: "monochrome",
    headerFooterRepeat: "all_pages",
    fitToPage: false,
    targetDocTypes: ["karigar_custody_statement", "customer_ledger_statement"],
    createdAt: now,
    updatedAt: now,
  },
];

const profileRepository = createRepository<PrintProfile>("print_profiles");

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface PrintProfileState {
  profiles: PrintProfile[];
  loaded: boolean;

  refresh: () => Promise<void>;
  getAll: () => PrintProfile[];
  getById: (id: string) => PrintProfile | undefined;
  getForDocType: (docType: PrintDocType, paperSize?: PrintSize) => PrintProfile;
  create: (input: Omit<PrintProfile, "id" | "createdAt" | "updatedAt">) => Promise<PrintProfile>;
  update: (
    id: string,
    patch: Partial<Omit<PrintProfile, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<PrintProfile>;
  remove: (id: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const usePrintProfiles = create<PrintProfileState>()((set, get) => ({
  profiles: DEFAULT_PRINT_PROFILES,
  loaded: false,

  refresh: async () => {
    try {
      const saved = await profileRepository.readAll();
      if (saved && saved.length > 0) {
        set({ profiles: saved, loaded: true });
      } else {
        set({ profiles: DEFAULT_PRINT_PROFILES, loaded: true });
      }
    } catch {
      set({ profiles: DEFAULT_PRINT_PROFILES, loaded: true });
    }
  },

  getAll: () => get().profiles,

  getById: (id: string) => get().profiles.find((p) => p.id === id),

  getForDocType: (docType: PrintDocType, paperSize?: PrintSize) => {
    const list = get().profiles;
    if (paperSize) {
      const match = list.find(
        (p) => p.paperSize === paperSize && p.targetDocTypes?.includes(docType),
      );
      if (match) return match;
      const sizeMatch = list.find((p) => p.paperSize === paperSize);
      if (sizeMatch) return sizeMatch;
    }
    const docMatch = list.find((p) => p.targetDocTypes?.includes(docType));
    if (docMatch) return docMatch;
    return list.find((p) => p.isDefault) ?? DEFAULT_PRINT_PROFILES[0];
  },

  create: async (input) => {
    const nowTs = Date.now();
    const newProfile: PrintProfile = {
      ...input,
      id: makeId(),
      createdAt: nowTs,
      updatedAt: nowTs,
    };
    const updatedList = [...get().profiles, newProfile];
    set({ profiles: updatedList });
    void profileRepository.save(newProfile);
    return newProfile;
  },

  update: async (id, patch) => {
    const existing = get().profiles.find((p) => p.id === id);
    if (!existing) throw new Error(`Print Profile not found: ${id}`);
    const updated: PrintProfile = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    const updatedList = get().profiles.map((p) => (p.id === id ? updated : p));
    set({ profiles: updatedList });
    void profileRepository.save(updated);
    return updated;
  },

  remove: async (id) => {
    const updatedList = get().profiles.filter((p) => p.id !== id);
    set({ profiles: updatedList });
    void profileRepository.delete(id);
  },

  resetToDefaults: async () => {
    set({ profiles: DEFAULT_PRINT_PROFILES });
    await Promise.all(DEFAULT_PRINT_PROFILES.map((p) => profileRepository.save(p)));
  },
}));
