/**
 * Customization Hub — portal, report, gold policy, and full legacy trade/system preferences.
 * Persisted to app_settings[id="customization_hub"].
 *
 * 18 Legacy configuration sections (5 original + 13 added for full production parity):
 * Features, General, Master, Tagging, Vouchers,
 * Valuation1, Valuation2, DefaultValue, Export, Members,
 * Salary, Bullion, Manufacturing, WebUpload, Girvi,
 * PrintSetup, OtherSetups, JewelDesk.
 */
import { create } from "zustand";
import { createRepository } from "@/lib/repositories/base-repository";
import { resolveAppSettingsReadId } from "@/lib/firm-scoped-app-settings";
import { DEFAULT_STAFF_ROLE_TEMPLATES, type StaffRoleTemplate } from "@/lib/staff-role-types";
import {
  type LegacyFeaturesConfig,
  type LegacyGeneralConfig,
  type LegacyMasterConfig,
  type LegacyTaggingConfig,
  type LegacyVoucherConfig,
  type LegacyValuation1Config,
  type LegacyValuation2Config,
  type LegacyDefaultValueConfig,
  type LegacyExportConfig,
  type LegacyMembersConfig,
  type LegacySalaryConfig,
  type LegacyBullionConfig,
  type LegacyManufacturingConfig,
  type LegacyWebUploadConfig,
  type LegacyGirviConfig,
  type LegacyPrintSetupConfig,
  type LegacyOtherSetupsConfig,
  type LegacyJewelDeskConfig,
  DEFAULT_LEGACY_FEATURES,
  DEFAULT_LEGACY_GENERAL,
  DEFAULT_LEGACY_MASTER,
  DEFAULT_LEGACY_TAGGING,
  DEFAULT_LEGACY_VOUCHERS,
  DEFAULT_LEGACY_VALUATION1,
  DEFAULT_LEGACY_VALUATION2,
  DEFAULT_LEGACY_DEFAULT_VALUE,
  DEFAULT_LEGACY_EXPORT,
  DEFAULT_LEGACY_MEMBERS,
  DEFAULT_LEGACY_SALARY,
  DEFAULT_LEGACY_BULLION,
  DEFAULT_LEGACY_MANUFACTURING,
  DEFAULT_LEGACY_WEB_UPLOAD,
  DEFAULT_LEGACY_GIRVI,
  DEFAULT_LEGACY_PRINT_SETUP,
  DEFAULT_LEGACY_OTHER_SETUPS,
  DEFAULT_LEGACY_JEWEL_DESK,
} from "@/lib/types/legacy-config-types";

export type PortalHubPreferences = {
  customerLedger: boolean;
  customerOrders: boolean;
  karigarGoldBook: boolean;
  karigarMetalReceipts: boolean;
  supplierPo: boolean;
  supplierGoldSettlements: boolean;
};

export type ReportHubPreferences = {
  defaultExport: "xlsx" | "csv" | "tally_xml" | "pdf";
  showProfit: boolean;
};

export type GoldHubPreferences = {
  physicalUtilization: boolean;
  allowNegativeStock: boolean;
  /** When true, gold issue screens require picking a vault purity line with stock. */
  requireVaultStockLine: boolean;
  /** When true, cash receipts/payments post to the company cash book (universal ledger). */
  cashBookEnabled: boolean;
};

export type PaymentHubPreferences = {
  /** Days after invoice date before unpaid becomes overdue. 0 = no due date. */
  defaultDueDays: number;
};

export type CustomizationHubPreferences = {
  portals: PortalHubPreferences;
  reports: ReportHubPreferences;
  gold: GoldHubPreferences;
  payment: PaymentHubPreferences;
  staffRoles: StaffRoleTemplate[];
  // ── Original 5 legacy sections ──
  features: LegacyFeaturesConfig;
  general: LegacyGeneralConfig;
  master: LegacyMasterConfig;
  tagging: LegacyTaggingConfig;
  vouchers: LegacyVoucherConfig;
  // ── 13 additional legacy sections (production parity) ──
  valuation1: LegacyValuation1Config;
  valuation2: LegacyValuation2Config;
  defaultValues: LegacyDefaultValueConfig;
  exportConfig: LegacyExportConfig;
  members: LegacyMembersConfig;
  salary: LegacySalaryConfig;
  bullion: LegacyBullionConfig;
  manufacturing: LegacyManufacturingConfig;
  webUpload: LegacyWebUploadConfig;
  girvi: LegacyGirviConfig;
  printSetup: LegacyPrintSetupConfig;
  otherSetups: LegacyOtherSetupsConfig;
  jewelDesk: LegacyJewelDeskConfig;
};

const DEFAULTS: CustomizationHubPreferences = {
  portals: {
    customerLedger: true,
    customerOrders: true,
    karigarGoldBook: true,
    karigarMetalReceipts: true,
    supplierPo: true,
    supplierGoldSettlements: true,
  },
  reports: {
    defaultExport: "xlsx",
    showProfit: true,
  },
  gold: {
    physicalUtilization: true,
    allowNegativeStock: false,
    requireVaultStockLine: true,
    cashBookEnabled: true,
  },
  payment: {
    defaultDueDays: 0,
  },
  staffRoles: DEFAULT_STAFF_ROLE_TEMPLATES,
  features: DEFAULT_LEGACY_FEATURES,
  general: DEFAULT_LEGACY_GENERAL,
  master: DEFAULT_LEGACY_MASTER,
  tagging: DEFAULT_LEGACY_TAGGING,
  vouchers: DEFAULT_LEGACY_VOUCHERS,
  valuation1: DEFAULT_LEGACY_VALUATION1,
  valuation2: DEFAULT_LEGACY_VALUATION2,
  defaultValues: DEFAULT_LEGACY_DEFAULT_VALUE,
  exportConfig: DEFAULT_LEGACY_EXPORT,
  members: DEFAULT_LEGACY_MEMBERS,
  salary: DEFAULT_LEGACY_SALARY,
  bullion: DEFAULT_LEGACY_BULLION,
  manufacturing: DEFAULT_LEGACY_MANUFACTURING,
  webUpload: DEFAULT_LEGACY_WEB_UPLOAD,
  girvi: DEFAULT_LEGACY_GIRVI,
  printSetup: DEFAULT_LEGACY_PRINT_SETUP,
  otherSetups: DEFAULT_LEGACY_OTHER_SETUPS,
  jewelDesk: DEFAULT_LEGACY_JEWEL_DESK,
};

const CUSTOMIZATION_HUB_KEY = "customization_hub";
const repo = createRepository<{ id: string } & Record<string, unknown>>("app_settings");

async function customizationHubSettingsId(): Promise<string> {
  return resolveAppSettingsReadId(CUSTOMIZATION_HUB_KEY);
}

interface CustomizationHubPreferencesState extends CustomizationHubPreferences {
  hydrated: boolean;
  saving: boolean;
  hydrate: () => Promise<void>;
  savePortals: (portals: PortalHubPreferences) => Promise<void>;
  saveReports: (reports: ReportHubPreferences) => Promise<void>;
  saveGold: (gold: GoldHubPreferences) => Promise<void>;
  savePayment: (payment: PaymentHubPreferences) => Promise<void>;
  saveStaffRoles: (staffRoles: StaffRoleTemplate[]) => Promise<void>;
  saveFeatures: (features: LegacyFeaturesConfig) => Promise<void>;
  saveGeneral: (general: LegacyGeneralConfig) => Promise<void>;
  saveMaster: (master: LegacyMasterConfig) => Promise<void>;
  saveTagging: (tagging: LegacyTaggingConfig) => Promise<void>;
  saveVouchers: (vouchers: LegacyVoucherConfig) => Promise<void>;
  saveValuation1: (valuation1: LegacyValuation1Config) => Promise<void>;
  saveValuation2: (valuation2: LegacyValuation2Config) => Promise<void>;
  saveDefaultValues: (defaultValues: LegacyDefaultValueConfig) => Promise<void>;
  saveExportConfig: (exportConfig: LegacyExportConfig) => Promise<void>;
  saveMembers: (members: LegacyMembersConfig) => Promise<void>;
  saveSalary: (salary: LegacySalaryConfig) => Promise<void>;
  saveBullion: (bullion: LegacyBullionConfig) => Promise<void>;
  saveManufacturing: (manufacturing: LegacyManufacturingConfig) => Promise<void>;
  saveWebUpload: (webUpload: LegacyWebUploadConfig) => Promise<void>;
  saveGirvi: (girvi: LegacyGirviConfig) => Promise<void>;
  savePrintSetup: (printSetup: LegacyPrintSetupConfig) => Promise<void>;
  saveOtherSetups: (otherSetups: LegacyOtherSetupsConfig) => Promise<void>;
  saveJewelDesk: (jewelDesk: LegacyJewelDeskConfig) => Promise<void>;
  /** Persist a full preferences snapshot (used by customization version restore). */
  saveAll: (prefs: CustomizationHubPreferences) => Promise<void>;
}

async function persist(prefs: CustomizationHubPreferences): Promise<void> {
  const id = await customizationHubSettingsId();
  await repo.saveAs(id, { id, ...prefs });
  void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => emitUiFeedback("save"));
}

export const useCustomizationHubPreferences = create<CustomizationHubPreferencesState>()(
  (set, get) => ({
    ...DEFAULTS,
    hydrated: false,
    saving: false,

    hydrate: async () => {
      try {
        const id = await customizationHubSettingsId();
        const row = await repo.read(id);
        if (row && typeof row === "object") {
          const data = row as Partial<CustomizationHubPreferences>;
          set({
            portals: { ...DEFAULTS.portals, ...(data.portals ?? {}) },
            reports: { ...DEFAULTS.reports, ...(data.reports ?? {}) },
            gold: { ...DEFAULTS.gold, ...(data.gold ?? {}) },
            payment: { ...DEFAULTS.payment, ...(data.payment ?? {}) },
            staffRoles:
              Array.isArray(data.staffRoles) && data.staffRoles.length > 0
                ? (data.staffRoles as StaffRoleTemplate[])
                : DEFAULT_STAFF_ROLE_TEMPLATES,
            features: { ...DEFAULTS.features, ...(data.features ?? {}) },
            general: { ...DEFAULTS.general, ...(data.general ?? {}) },
            master: { ...DEFAULTS.master, ...(data.master ?? {}) },
            tagging: { ...DEFAULTS.tagging, ...(data.tagging ?? {}) },
            vouchers: { ...DEFAULTS.vouchers, ...(data.vouchers ?? {}) },
            valuation1: { ...DEFAULTS.valuation1, ...(data.valuation1 ?? {}) },
            valuation2: { ...DEFAULTS.valuation2, ...(data.valuation2 ?? {}) },
            defaultValues: { ...DEFAULTS.defaultValues, ...(data.defaultValues ?? {}) },
            exportConfig: { ...DEFAULTS.exportConfig, ...(data.exportConfig ?? {}) },
            members: { ...DEFAULTS.members, ...(data.members ?? {}) },
            salary: { ...DEFAULTS.salary, ...(data.salary ?? {}) },
            bullion: { ...DEFAULTS.bullion, ...(data.bullion ?? {}) },
            manufacturing: { ...DEFAULTS.manufacturing, ...(data.manufacturing ?? {}) },
            webUpload: { ...DEFAULTS.webUpload, ...(data.webUpload ?? {}) },
            girvi: { ...DEFAULTS.girvi, ...(data.girvi ?? {}) },
            printSetup: { ...DEFAULTS.printSetup, ...(data.printSetup ?? {}) },
            otherSetups: { ...DEFAULTS.otherSetups, ...(data.otherSetups ?? {}) },
            jewelDesk: { ...DEFAULTS.jewelDesk, ...(data.jewelDesk ?? {}) },
            hydrated: true,
          });
          return;
        }
      } catch (err) {
        console.warn("[customization-hub] hydrate failed:", err);
      }
      set({ hydrated: true });
    },

    savePortals: async (portals) => {
      set({ saving: true });
      const next = { ...get(), portals };
      set({ portals });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveReports: async (reports) => {
      set({ saving: true });
      const next = { ...get(), reports };
      set({ reports });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveGold: async (gold) => {
      set({ saving: true });
      const next = { ...get(), gold };
      set({ gold });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    savePayment: async (payment) => {
      set({ saving: true });
      const next = { ...get(), payment };
      set({ payment });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveStaffRoles: async (staffRoles) => {
      set({ saving: true });
      const next = { ...get(), staffRoles };
      set({ staffRoles });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveFeatures: async (features) => {
      set({ saving: true });
      const next = { ...get(), features };
      set({ features });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveGeneral: async (general) => {
      set({ saving: true });
      const next = { ...get(), general };
      set({ general });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveMaster: async (master) => {
      set({ saving: true });
      const next = { ...get(), master };
      set({ master });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveTagging: async (tagging) => {
      set({ saving: true });
      const next = { ...get(), tagging };
      set({ tagging });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveVouchers: async (vouchers) => {
      set({ saving: true });
      const next = { ...get(), vouchers };
      set({ vouchers });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveValuation1: async (valuation1) => {
      set({ saving: true });
      const next = { ...get(), valuation1 };
      set({ valuation1 });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveValuation2: async (valuation2) => {
      set({ saving: true });
      const next = { ...get(), valuation2 };
      set({ valuation2 });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveDefaultValues: async (defaultValues) => {
      set({ saving: true });
      const next = { ...get(), defaultValues };
      set({ defaultValues });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveExportConfig: async (exportConfig) => {
      set({ saving: true });
      const next = { ...get(), exportConfig };
      set({ exportConfig });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveMembers: async (members) => {
      set({ saving: true });
      const next = { ...get(), members };
      set({ members });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveSalary: async (salary) => {
      set({ saving: true });
      const next = { ...get(), salary };
      set({ salary });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveBullion: async (bullion) => {
      set({ saving: true });
      const next = { ...get(), bullion };
      set({ bullion });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveManufacturing: async (manufacturing) => {
      set({ saving: true });
      const next = { ...get(), manufacturing };
      set({ manufacturing });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveWebUpload: async (webUpload) => {
      set({ saving: true });
      const next = { ...get(), webUpload };
      set({ webUpload });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveGirvi: async (girvi) => {
      set({ saving: true });
      const next = { ...get(), girvi };
      set({ girvi });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    savePrintSetup: async (printSetup) => {
      set({ saving: true });
      const next = { ...get(), printSetup };
      set({ printSetup });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveOtherSetups: async (otherSetups) => {
      set({ saving: true });
      const next = { ...get(), otherSetups };
      set({ otherSetups });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveJewelDesk: async (jewelDesk) => {
      set({ saving: true });
      const next = { ...get(), jewelDesk };
      set({ jewelDesk });
      try { await persist(next); } finally { set({ saving: false }); }
    },

    saveAll: async (prefs) => {
      set({ saving: true });
      const next: CustomizationHubPreferences = {
        portals: { ...DEFAULTS.portals, ...prefs.portals },
        reports: { ...DEFAULTS.reports, ...prefs.reports },
        gold: { ...DEFAULTS.gold, ...prefs.gold },
        payment: { ...DEFAULTS.payment, ...prefs.payment },
        staffRoles:
          Array.isArray(prefs.staffRoles) && prefs.staffRoles.length > 0
            ? prefs.staffRoles
            : get().staffRoles,
        features: { ...DEFAULTS.features, ...prefs.features },
        general: { ...DEFAULTS.general, ...prefs.general },
        master: { ...DEFAULTS.master, ...prefs.master },
        tagging: { ...DEFAULTS.tagging, ...prefs.tagging },
        vouchers: { ...DEFAULTS.vouchers, ...prefs.vouchers },
        valuation1: { ...DEFAULTS.valuation1, ...prefs.valuation1 },
        valuation2: { ...DEFAULTS.valuation2, ...prefs.valuation2 },
        defaultValues: { ...DEFAULTS.defaultValues, ...prefs.defaultValues },
        exportConfig: { ...DEFAULTS.exportConfig, ...prefs.exportConfig },
        members: { ...DEFAULTS.members, ...prefs.members },
        salary: { ...DEFAULTS.salary, ...prefs.salary },
        bullion: { ...DEFAULTS.bullion, ...prefs.bullion },
        manufacturing: { ...DEFAULTS.manufacturing, ...prefs.manufacturing },
        webUpload: { ...DEFAULTS.webUpload, ...prefs.webUpload },
        girvi: { ...DEFAULTS.girvi, ...prefs.girvi },
        printSetup: { ...DEFAULTS.printSetup, ...prefs.printSetup },
        otherSetups: { ...DEFAULTS.otherSetups, ...prefs.otherSetups },
        jewelDesk: { ...DEFAULTS.jewelDesk, ...prefs.jewelDesk },
      };
      set({ ...next });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },
  }),
);

export function getPortalHubPreferences(): PortalHubPreferences {
  return useCustomizationHubPreferences.getState().portals;
}

export function getReportHubPreferences(): ReportHubPreferences {
  return useCustomizationHubPreferences.getState().reports;
}

export async function ensureCustomizationHubPreferencesLoaded(): Promise<void> {
  if (!useCustomizationHubPreferences.getState().hydrated) {
    await useCustomizationHubPreferences.getState().hydrate();
  }
}
