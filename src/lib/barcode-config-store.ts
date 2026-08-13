/**
 * Barcode & Tagging configuration — the string/number-valued settings that
 * don't fit business-rules-registry.ts's boolean-only model (prefix,
 * length, QR format, tag template, print appearance). The ON/OFF switches
 * (enable module, auto-generate, require polishing, etc.) live in
 * business-rules-registry.ts/business-rules-store.ts instead — this store
 * is purely "how", not "whether".
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";

export type QrFormat = "json" | "url";
export type TagTemplate = "standard" | "compact" | "detailed";

export interface BarcodeConfig {
  id: "barcode_config";
  prefix: string;
  numberLength: number;
  qrFormat: QrFormat;
  tagTemplate: TagTemplate;
  // Tag/print appearance — Administrator-configurable per the spec.
  tagSizeMm: { width: number; height: number };
  paperSize: "a4" | "thermal" | "tag";
  printerName?: string;
  barcodeSizeMm: { width: number; height: number };
  qrSizeMm: number;
  fontFamily: string;
  logoDataUrl?: string;
  fieldsVisible: {
    customer: boolean;
    product: boolean;
    category: boolean;
    grossWeight: boolean;
    netWeight: boolean;
    purity: boolean;
    pieces: boolean;
    manufacturingDate: boolean;
  };
}

export const DEFAULT_BARCODE_CONFIG: BarcodeConfig = {
  id: "barcode_config",
  prefix: "AVS",
  numberLength: 8,
  qrFormat: "json",
  tagTemplate: "standard",
  tagSizeMm: { width: 50, height: 30 },
  paperSize: "tag",
  printerName: undefined,
  barcodeSizeMm: { width: 40, height: 12 },
  qrSizeMm: 18,
  fontFamily: "Inter",
  logoDataUrl: undefined,
  fieldsVisible: {
    customer: true,
    product: true,
    category: true,
    grossWeight: true,
    netWeight: true,
    purity: true,
    pieces: true,
    manufacturingDate: true,
  },
};

const configRepository = createRepository<BarcodeConfig>("app_settings");

interface BarcodeConfigState {
  config: BarcodeConfig;
  loaded: boolean;
  refresh: () => Promise<void>;
  update: (patch: Partial<BarcodeConfig>) => Promise<void>;
}

export const useBarcodeConfig = create<BarcodeConfigState>()((set, get) => ({
  config: DEFAULT_BARCODE_CONFIG,
  loaded: false,
  refresh: async () => {
    const record = await configRepository.read("barcode_config");
    set({ config: { ...DEFAULT_BARCODE_CONFIG, ...record }, loaded: true });
  },
  update: async (patch) => {
    const next = { ...get().config, ...patch };
    set({ config: next });
    await configRepository.saveAs("barcode_config", next);
  },
}));
