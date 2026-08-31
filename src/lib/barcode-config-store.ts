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
import { resolveAppSettingsReadId } from "@/lib/firm-scoped-app-settings";
import type { BarcodeSymbology } from "./barcode-symbology";

export type QrFormat = "json" | "url";
export type TagTemplate = "standard" | "compact" | "detailed";
export type { BarcodeSymbology };

export interface BarcodeConfig {
  id: "barcode_config";
  prefix: string;
  numberLength: number;
  qrFormat: QrFormat;
  tagTemplate: TagTemplate;
  /** Primary scannable identity symbology. Default Code128 (shop practice). */
  symbology: BarcodeSymbology;
  /**
   * Optional GS1 company prefix (6–9 digits). Required for certified EAN-13 /
   * (01)GTIN DataMatrix. Without it, EAN/DataMatrix fall back to internal code.
   * Never invents a fake BIS/hallmark claim.
   */
  gs1CompanyPrefix?: string;
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
    fineWeight: boolean;
    purity: boolean;
    pieces: boolean;
    manufacturingDate: boolean;
    huid: boolean;
    lot: boolean;
    serial: boolean;
    gtin: boolean;
    jobRef: boolean;
  };
}

export const DEFAULT_BARCODE_CONFIG: BarcodeConfig = {
  id: "barcode_config",
  prefix: "ORN",
  numberLength: 8,
  qrFormat: "json",
  tagTemplate: "standard",
  symbology: "code128",
  gs1CompanyPrefix: undefined,
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
    fineWeight: true,
    purity: true,
    pieces: true,
    manufacturingDate: true,
    huid: true,
    lot: false,
    serial: false,
    gtin: false,
    jobRef: false,
  },
};

const configRepository = createRepository<BarcodeConfig>("app_settings");

async function barcodeConfigSettingsId(): Promise<string> {
  return resolveAppSettingsReadId("barcode_config");
}

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
    const id = await barcodeConfigSettingsId();
    const record = await configRepository.read(id);
    set({
      config: {
        ...DEFAULT_BARCODE_CONFIG,
        ...record,
        fieldsVisible: {
          ...DEFAULT_BARCODE_CONFIG.fieldsVisible,
          ...(record?.fieldsVisible ?? {}),
        },
        symbology: record?.symbology ?? DEFAULT_BARCODE_CONFIG.symbology,
      },
      loaded: true,
    });
  },
  update: async (patch) => {
    const next = {
      ...get().config,
      ...patch,
      fieldsVisible: {
        ...get().config.fieldsVisible,
        ...(patch.fieldsVisible ?? {}),
      },
    };
    set({ config: next });
    await configRepository.saveAs(await barcodeConfigSettingsId(), next);
  },
}));
