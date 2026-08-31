import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { createRepository } from "./repositories/base-repository";

const moduleStateRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "module_states",
);

export type ERPModuleKey =
  | "billing"
  | "manufacturing"
  | "job_work"
  | "gst"
  | "bullion"
  | "melt_account"
  | "crm_communications"
  | "inventory"
  | "repairs"
  | "orders"
  | "attendance"
  | "payroll"
  | "hr"
  | "loyalty_program"
  | "barcode"
  | "hardware_integration"
  | "whatsapp"
  | "email"
  | "sms"
  | "customer_portal"
  | "supplier_management"
  | "reports"
  | "analytics"
  | "multi_branch"
  | "catalog";

export interface ModuleDefinition {
  key: ERPModuleKey;
  label: string;
  description: string;
  dependencies: ERPModuleKey[];
}

export const ERP_MODULES: ModuleDefinition[] = [
  {
    key: "catalog",
    label: "Design Catalog & Showcase",
    description:
      "Digital design catalog, category tags, purity specs, and design-to-order creation.",
    dependencies: [],
  },
  {
    key: "billing",
    label: "Billing & Invoicing",
    description: "Invoices, estimates, retail checkout, customer ledger, and payments.",
    dependencies: [],
  },
  {
    key: "gst",
    label: "GST Taxes & Compliance",
    description:
      "Split tax configurations (CGST, SGST, IGST), HSN templates, tax reports. Depends on Billing.",
    dependencies: ["billing"],
  },
  {
    key: "inventory",
    label: "Inventory & Stock",
    description: "Finished jewellery items, loose gold, categories, and stock movement logs.",
    dependencies: [],
  },
  {
    key: "manufacturing",
    label: "Manufacturing / Karigar",
    description:
      "Karigar assignments, tunch, wastage calculations, and job templates. Depends on Inventory.",
    dependencies: ["inventory"],
  },
  {
    key: "job_work",
    label: "Job Work Flow",
    description: "Detailed Karigar step-by-step casting, polishing, and QC checklist flow.",
    dependencies: [],
  },
  {
    key: "bullion",
    label: "Bullion & Loose Gold",
    description:
      "Tracking primary metal deposits, loose metal bookings, rates, and margins. Depends on Inventory.",
    dependencies: ["inventory"],
  },
  {
    key: "melt_account",
    label: "Melt Account",
    description: "Scrap collection, gold dust refining, recovery sweeps, and daily melt registers.",
    dependencies: [],
  },
  {
    key: "crm_communications",
    label: "CRM & Communications",
    description:
      "Opportunities pipeline, timeline details, automated wishing, and provider configurations.",
    dependencies: [],
  },
  {
    key: "repairs",
    label: "Repairs & Polishing",
    description:
      "Customer intake slips, repair tracking, estimated costs, and polishing assignments.",
    dependencies: [],
  },
  {
    key: "orders",
    label: "Customer Orders",
    description: "Custom orders intake, advance bookings, designs, and expected deliveries.",
    dependencies: [],
  },
  {
    key: "attendance",
    label: "Attendance Log",
    description: "Staff & Karigar daily attendance check-ins, over-time tracking.",
    dependencies: [],
  },
  {
    key: "payroll",
    label: "Payroll Ledger",
    description: "Karigar wages, loans ledger, and salary advances adjustments.",
    dependencies: [],
  },
  {
    key: "hr",
    label: "HR & Org Management",
    description: "User permission matrices, user profile assignments, audit logs.",
    dependencies: [],
  },
  {
    key: "loyalty_program",
    label: "Loyalty Program",
    description: "Reward points, tiers, and customer birthday/anniversary campaigns.",
    dependencies: [],
  },
  {
    key: "barcode",
    label: "Barcode Printing & Tagging",
    description:
      "Thermal label tag generation, printing setups, SKU barcodes. Depends on Inventory.",
    dependencies: ["inventory"],
  },
  {
    key: "hardware_integration",
    label: "Hardware Integrations",
    description: "WebSerial digital weighing scales, WebUSB ESC/POS printing. Depends on Barcode.",
    dependencies: ["barcode"],
  },
  {
    key: "whatsapp",
    label: "WhatsApp Messaging",
    description: "Auto WhatsApp dispatches, custom template variables mapping.",
    dependencies: [],
  },
  {
    key: "email",
    label: "SMTP Email Hub",
    description: "Newsletter campaigns, email template configurator, sender profiles.",
    dependencies: [],
  },
  {
    key: "sms",
    label: "SMS Gateway",
    description: "Transactional text message dispatches on billing, order bookings.",
    dependencies: [],
  },
  {
    key: "customer_portal",
    label: "Customer Portal API",
    description: "API endpoints mapping, online status check, order progress lookup.",
    dependencies: [],
  },
  {
    key: "supplier_management",
    label: "Supplier Management",
    description: "Supplier KYC records, supplier accounts, bullion purchases ledger.",
    dependencies: [],
  },
  {
    key: "reports",
    label: "Advanced Reports",
    description: "Printable gold position books, daily closes summaries, branch stats.",
    dependencies: [],
  },
  {
    key: "analytics",
    label: "Business Analytics",
    description: "Executive profit charts, branch comparison dashboards.",
    dependencies: [],
  },
  {
    key: "multi_branch",
    label: "Multi-Branch Ledger",
    description: "Independent branch entities, branch-wise ledger consolidation.",
    dependencies: [],
  },
];

export interface ModuleStatesRecord {
  id: string;
  branchId: string;
  moduleKey: ERPModuleKey;
  enabled: boolean;
}

interface ModuleStoreState {
  moduleStates: Record<string, boolean>; // key -> enabled
  isLoading: boolean;
  refresh: (branchId: string) => Promise<void>;
  toggleModule: (branchId: string, key: ERPModuleKey, enabled: boolean) => Promise<void>;
  isModuleEnabled: (key: ERPModuleKey) => boolean;
}

export const useModuleStore = create<ModuleStoreState>()((set, get) => ({
  moduleStates: {},
  isLoading: false,

  refresh: async (branchId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await (supabase as any)
        .from("module_states")
        .select("*")
        .eq("branch_id", branchId);

      if (error) throw error;

      // Build key-value mapping (default to true if not present in db)
      const mapping: Record<string, boolean> = {};
      ERP_MODULES.forEach((mod) => {
        mapping[mod.key] = true; // Default
      });

      if (data) {
        data.forEach((row: any) => {
          mapping[row.module_key] = row.enabled;
        });
      }

      set({ moduleStates: mapping, isLoading: false });
    } catch (err) {
      console.error("[module-store] Failed to fetch module states:", err);
      // Fallback: Enable all modules
      const mapping: Record<string, boolean> = {};
      ERP_MODULES.forEach((mod) => {
        mapping[mod.key] = true;
      });
      set({ moduleStates: mapping, isLoading: false });
    }
  },

  toggleModule: async (branchId: string, key: ERPModuleKey, enabled: boolean) => {
    // 1. Check dependency constraints before toggling off
    if (!enabled) {
      const dependentModules = ERP_MODULES.filter((m) => m.dependencies.includes(key));
      const activeDependents = dependentModules.filter((m) => get().isModuleEnabled(m.key));
      if (activeDependents.length > 0) {
        throw new Error(
          `Cannot disable ${key.toUpperCase()}. The following active modules depend on it: ${activeDependents.map((m) => m.label).join(", ")}`,
        );
      }
    }

    // 2. Check dependency constraints before enabling
    if (enabled) {
      const def = ERP_MODULES.find((m) => m.key === key);
      if (def && def.dependencies.length > 0) {
        const missingDeps = def.dependencies.filter((dep) => !get().isModuleEnabled(dep));
        if (missingDeps.length > 0) {
          throw new Error(
            `Cannot enable ${def.label}. You must first enable: ${missingDeps.map((d) => d.toUpperCase()).join(", ")}`,
          );
        }
      }
    }

    // Update state locally first
    set((s) => ({
      moduleStates: { ...s.moduleStates, [key]: enabled },
    }));

    try {
      // Upsert to Supabase
      const { data: existing } = await (supabase as any)
        .from("module_states")
        .select("id")
        .eq("branch_id", branchId)
        .eq("module_key", key)
        .maybeSingle();

      const recordId = existing?.id || crypto.randomUUID();
      await moduleStateRepository.save({
        id: recordId,
        branch_id: branchId,
        module_key: key,
        enabled,
      });
    } catch (err: any) {
      // Revert state on error
      set((s) => ({
        moduleStates: { ...s.moduleStates, [key]: !enabled },
      }));
      throw new Error(`Failed to save module configuration: ${err.message}`);
    }
  },

  isModuleEnabled: (key: ERPModuleKey) => {
    const states = get().moduleStates;
    // Default to true if not initialized yet
    return states[key] !== false;
  },
}));
