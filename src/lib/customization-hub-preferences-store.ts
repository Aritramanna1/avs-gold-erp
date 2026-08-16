/**
 * Customization Hub — portal, report, and gold policy preferences.
 * Persisted to app_settings[id="customization_hub"].
 */
import { create } from "zustand";
import { createRepository } from "@/lib/repositories/base-repository";
import { DEFAULT_STAFF_ROLE_TEMPLATES, type StaffRoleTemplate } from "@/lib/staff-role-types";

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
};

export type CustomizationHubPreferences = {
  portals: PortalHubPreferences;
  reports: ReportHubPreferences;
  gold: GoldHubPreferences;
  staffRoles: StaffRoleTemplate[];
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
  },
  staffRoles: DEFAULT_STAFF_ROLE_TEMPLATES,
};

const repo = createRepository<{ id: string } & Record<string, unknown>>("app_settings");

interface CustomizationHubPreferencesState extends CustomizationHubPreferences {
  hydrated: boolean;
  saving: boolean;
  hydrate: () => Promise<void>;
  savePortals: (portals: PortalHubPreferences) => Promise<void>;
  saveReports: (reports: ReportHubPreferences) => Promise<void>;
  saveGold: (gold: GoldHubPreferences) => Promise<void>;
  saveStaffRoles: (staffRoles: StaffRoleTemplate[]) => Promise<void>;
}

async function persist(prefs: CustomizationHubPreferences): Promise<void> {
  await repo.saveAs("customization_hub", { id: "customization_hub", ...prefs });
}

export const useCustomizationHubPreferences = create<CustomizationHubPreferencesState>()(
  (set, get) => ({
    ...DEFAULTS,
    hydrated: false,
    saving: false,

    hydrate: async () => {
      try {
        const row = await repo.read("customization_hub");
        if (row && typeof row === "object") {
          const data = row as Partial<CustomizationHubPreferences>;
          set({
            portals: { ...DEFAULTS.portals, ...(data.portals ?? {}) },
            reports: { ...DEFAULTS.reports, ...(data.reports ?? {}) },
            gold: { ...DEFAULTS.gold, ...(data.gold ?? {}) },
            staffRoles:
              Array.isArray(data.staffRoles) && data.staffRoles.length > 0
                ? (data.staffRoles as StaffRoleTemplate[])
                : DEFAULT_STAFF_ROLE_TEMPLATES,
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
      const next = {
        portals,
        reports: get().reports,
        gold: get().gold,
        staffRoles: get().staffRoles,
      };
      set({ portals });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveReports: async (reports) => {
      set({ saving: true });
      const next = {
        portals: get().portals,
        reports,
        gold: get().gold,
        staffRoles: get().staffRoles,
      };
      set({ reports });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveGold: async (gold) => {
      set({ saving: true });
      const next = {
        portals: get().portals,
        reports: get().reports,
        gold,
        staffRoles: get().staffRoles,
      };
      set({ gold });
      try {
        await persist(next);
      } finally {
        set({ saving: false });
      }
    },

    saveStaffRoles: async (staffRoles) => {
      set({ saving: true });
      const next = {
        portals: get().portals,
        reports: get().reports,
        gold: get().gold,
        staffRoles,
      };
      set({ staffRoles });
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
