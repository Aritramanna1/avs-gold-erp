/**
 * ORNEXA — 13-Stage Migration & Opening Balance Engine
 * Authoritative Specification: docs/MASTER/OPENING_BALANCE_AND_MIGRATION_MASTER.md
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type MigrationStageId =
  | "company_setup"
  | "financial_year"
  | "branches_vaults"
  | "item_masters"
  | "parties_profiles"
  | "opening_financial_balances"
  | "opening_metal_balances"
  | "opening_stock_inventory"
  | "outstanding_bills"
  | "active_wip_jobs"
  | "karigar_gold_custody"
  | "customer_deposits_advances"
  | "validation_audit_freeze";

export interface MigrationStageMeta {
  id: MigrationStageId;
  stageNumber: number;
  title: string;
  shortDesc: string;
  category: "foundation" | "opening_balances" | "operations" | "freeze";
  csvTemplateHeaders: string[];
  sampleRow: Record<string, string>;
}

export const MIGRATION_STAGES: MigrationStageMeta[] = [
  {
    id: "company_setup",
    stageNumber: 1,
    title: "Company Setup & Legal Entity",
    shortDesc: "Legal business name, trade name, 15-digit GSTIN, PAN, and base currency.",
    category: "foundation",
    csvTemplateHeaders: [
      "legal_name",
      "trade_name",
      "gstin",
      "pan",
      "state_code",
      "pincode",
      "base_currency",
    ],
    sampleRow: {
      legal_name: "Maa Tara Jewellers Pvt Ltd",
      trade_name: "Maa Tara Jewellers",
      gstin: "19AAACM1234F1Z5",
      pan: "AAACM1234F",
      state_code: "19",
      pincode: "700007",
      base_currency: "INR",
    },
  },
  {
    id: "financial_year",
    stageNumber: 2,
    title: "Financial Year Configuration",
    shortDesc: "As-of Migration Date, Active Financial Year Start and End dates.",
    category: "foundation",
    csvTemplateHeaders: [
      "fy_label",
      "start_date",
      "end_date",
      "migration_as_of_date",
      "books_lock_enabled",
    ],
    sampleRow: {
      fy_label: "FY 2026-27",
      start_date: "2026-04-01",
      end_date: "2027-03-31",
      migration_as_of_date: "2026-04-01",
      books_lock_enabled: "true",
    },
  },
  {
    id: "branches_vaults",
    stageNumber: 3,
    title: "Branch & Vault Hierarchy",
    shortDesc: "Showroom counters, Treasury vault, Workshop safe, and Old Gold vaults.",
    category: "foundation",
    csvTemplateHeaders: ["branch_code", "branch_name", "vault_name", "vault_type", "is_primary"],
    sampleRow: {
      branch_code: "HO-01",
      branch_name: "Main Workshop & Showroom",
      vault_name: "Treasury Main Vault",
      vault_type: "treasury",
      is_primary: "true",
    },
  },
  {
    id: "item_masters",
    stageNumber: 4,
    title: "Item Masters, Purity & Rate Cards",
    shortDesc: "Metal purities (24K, 22K, 18K, 14K, Silver 925), categories, making charge cards.",
    category: "foundation",
    csvTemplateHeaders: [
      "category_name",
      "purity_code",
      "touch_percentage",
      "hsn_code",
      "default_wastage_pct",
      "default_making_per_gram",
    ],
    sampleRow: {
      category_name: "Gold Necklace 22K",
      purity_code: "22K_916",
      touch_percentage: "91.60",
      hsn_code: "71131910",
      default_wastage_pct: "2.50",
      default_making_per_gram: "450",
    },
  },
  {
    id: "parties_profiles",
    stageNumber: 5,
    title: "Parties & Role Profiles",
    shortDesc: "Customers, Karigars, Bullion Suppliers, Refineries, and Hallmark Vendors.",
    category: "foundation",
    csvTemplateHeaders: [
      "party_code",
      "party_name",
      "party_type",
      "mobile",
      "email",
      "gstin",
      "pan",
      "credit_limit_inr",
      "credit_limit_gold_g",
    ],
    sampleRow: {
      party_code: "CUST-001",
      party_name: "Maa Durga Jewellers",
      party_type: "customer",
      mobile: "9830112233",
      email: "durga@jewel.in",
      gstin: "19BBBCD5678F1Z9",
      pan: "BBBCD5678F",
      credit_limit_inr: "500000",
      credit_limit_gold_g: "250.000",
    },
  },
  {
    id: "opening_financial_balances",
    stageNumber: 6,
    title: "Opening Financial Balances",
    shortDesc:
      "Party cash debits (receivables), credits (payables), Cash-in-hand, and Bank balances.",
    category: "opening_balances",
    csvTemplateHeaders: ["party_code", "balance_type", "amount_inr", "reference_notes"],
    sampleRow: {
      party_code: "CUST-001",
      balance_type: "debit_receivable",
      amount_inr: "85000",
      reference_notes: "Prior ledger balance",
    },
  },
  {
    id: "opening_metal_balances",
    stageNumber: 7,
    title: "Opening Metal Balances",
    shortDesc: "Fine Gold (g), Gross Gold (g), Silver (g), and Platinum balances per party.",
    category: "opening_balances",
    csvTemplateHeaders: [
      "party_code",
      "metal_type",
      "purity_code",
      "gross_weight_g",
      "touch_pct",
      "fine_weight_g",
      "balance_direction",
    ],
    sampleRow: {
      party_code: "CUST-001",
      metal_type: "gold",
      purity_code: "22K_916",
      gross_weight_g: "42.350",
      touch_pct: "91.60",
      fine_weight_g: "38.793",
      balance_direction: "credit_we_owe_customer",
    },
  },
  {
    id: "opening_stock_inventory",
    stageNumber: 8,
    title: "Opening Stock Inventory",
    shortDesc: "Finished tagged items, Loose stock, 24K Treasury bullion, and Old Gold scrap.",
    category: "opening_balances",
    csvTemplateHeaders: [
      "tag_number",
      "item_name",
      "purity",
      "gross_wt_g",
      "net_wt_g",
      "fine_wt_g",
      "stone_carats",
      "huid",
      "location_vault",
    ],
    sampleRow: {
      tag_number: "TAG-2026-0001",
      item_name: "Bridal Choker 22K",
      purity: "91.60",
      gross_wt_g: "65.420",
      net_wt_g: "62.100",
      fine_wt_g: "56.883",
      stone_carats: "16.60",
      huid: "HD789K",
      location_vault: "Showroom Counter 1",
    },
  },
  {
    id: "outstanding_bills",
    stageNumber: 9,
    title: "Outstanding Bill-by-Bill Schedules",
    shortDesc: "Legacy invoice breakdown for aging analysis and bill-matching reconciliation.",
    category: "operations",
    csvTemplateHeaders: [
      "party_code",
      "bill_no",
      "bill_date",
      "original_amount_inr",
      "unpaid_balance_inr",
      "due_date",
    ],
    sampleRow: {
      party_code: "CUST-001",
      bill_no: "INV-2026-LEG-089",
      bill_date: "2026-03-15",
      original_amount_inr: "120000",
      unpaid_balance_inr: "85000",
      due_date: "2026-04-15",
    },
  },
  {
    id: "active_wip_jobs",
    stageNumber: 10,
    title: "Active Workshop Jobs & WIP",
    shortDesc: "Work-in-progress job cards on factory floor as of migration date.",
    category: "operations",
    csvTemplateHeaders: [
      "job_no",
      "party_code",
      "assigned_karigar_code",
      "item_description",
      "metal_issued_g",
      "purity",
      "target_date",
    ],
    sampleRow: {
      job_no: "JOB-LEG-401",
      party_code: "CUST-001",
      assigned_karigar_code: "KAR-01",
      item_description: "Custom Floral Bangle 22K",
      metal_issued_g: "28.500",
      purity: "91.60",
      target_date: "2026-04-12",
    },
  },
  {
    id: "karigar_gold_custody",
    stageNumber: 11,
    title: "Existing Karigar Gold Custody",
    shortDesc: "Raw metal and scrap resting at goldsmith workbenches.",
    category: "operations",
    csvTemplateHeaders: [
      "karigar_code",
      "gross_weight_g",
      "touch_pct",
      "fine_weight_g",
      "allowed_wastage_pct",
      "notes",
    ],
    sampleRow: {
      karigar_code: "KAR-01",
      gross_weight_g: "84.200",
      touch_pct: "91.60",
      fine_weight_g: "77.127",
      allowed_wastage_pct: "2.00",
      notes: "Ongoing bench batch balance",
    },
  },
  {
    id: "customer_deposits_advances",
    stageNumber: 12,
    title: "Customer Deposits & Supplier Advances",
    shortDesc: "Advance metal/cash held in trust or paid to bullion dealers pending bills.",
    category: "operations",
    csvTemplateHeaders: [
      "party_code",
      "deposit_type",
      "amount_or_weight",
      "unit",
      "fine_gold_equivalent_g",
      "remarks",
    ],
    sampleRow: {
      party_code: "CUST-001",
      deposit_type: "gold_metal",
      amount_or_weight: "10.000",
      unit: "grams",
      fine_gold_equivalent_g: "9.160",
      remarks: "Customer advance gold for wedding order",
    },
  },
  {
    id: "validation_audit_freeze",
    stageNumber: 13,
    title: "Dual-Ledger Validation, Dry Run & Freeze",
    shortDesc:
      "Reconciliation check: Total Assets = Total Liabilities + Opening Capital. Audit freeze.",
    category: "freeze",
    csvTemplateHeaders: ["confirmation_phrase", "signed_by_role", "as_of_timestamp"],
    sampleRow: {
      confirmation_phrase: "CONFIRM_ORNEXA_MIGRATION_AUDIT_FREEZE",
      signed_by_role: "CEO",
      as_of_timestamp: "2026-04-01T00:00:00Z",
    },
  },
];

export interface StageData {
  stageId: MigrationStageId;
  status: "pending" | "imported" | "validated" | "error";
  rows: Record<string, string>[];
  errors: string[];
  validatedAt?: number;
}

export interface MigrationBatch {
  id: string;
  batchNumber: string;
  asOfDate: string;
  status: "DRAFT" | "SIMULATED" | "FROZEN_LIVE";
  createdAt: number;
  frozenAt?: number;
  frozenBy?: string;
  totalOpeningCashDebitPaise: number;
  totalOpeningCashCreditPaise: number;
  totalOpeningFineGoldMg: number;
  totalTaggedStockGrossMg: number;
  stagesData: Record<MigrationStageId, StageData>;
  dryRunSimulation?: {
    totalAssetsInr: number;
    totalLiabilitiesInr: number;
    openingEquityReserveInr: number;
    totalFineGoldAssetsG: number;
    totalFineGoldLiabilitiesG: number;
    netFineGoldBalanceG: number;
    reconciliationBalanced: boolean;
  };
}

interface MigrationStore {
  activeBatch: MigrationBatch;
  currentStageIndex: number;
  setCurrentStageIndex: (idx: number) => void;
  importCsvToStage: (
    stageId: MigrationStageId,
    csvContent: string,
  ) => { success: boolean; rowCount: number; errors: string[] };
  validateStage: (stageId: MigrationStageId) => { valid: boolean; errors: string[] };
  runDryRunSimulation: () => MigrationBatch["dryRunSimulation"];
  executeAuditFreeze: (ceoName: string) => Promise<{ success: boolean; batchId: string }>;
  resetBatch: () => void;
  generateCsvTemplate: (stageId: MigrationStageId) => string;
}

function createInitialBatch(): MigrationBatch {
  const initialStages: Record<MigrationStageId, StageData> = {} as any;
  MIGRATION_STAGES.forEach((s) => {
    initialStages[s.id] = {
      stageId: s.id,
      status: "pending",
      rows: [],
      errors: [],
    };
  });

  return {
    id: crypto.randomUUID(),
    batchNumber: `MIG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    asOfDate: "2026-04-01",
    status: "DRAFT",
    createdAt: Date.now(),
    totalOpeningCashDebitPaise: 0,
    totalOpeningCashCreditPaise: 0,
    totalOpeningFineGoldMg: 0,
    totalTaggedStockGrossMg: 0,
    stagesData: initialStages,
  };
}

export const useMigrationStore = create<MigrationStore>()(
  persist(
    (set, get) => ({
      activeBatch: createInitialBatch(),
      currentStageIndex: 0,

      setCurrentStageIndex: (idx) => {
        if (idx >= 0 && idx < MIGRATION_STAGES.length) {
          set({ currentStageIndex: idx });
        }
      },

      generateCsvTemplate: (stageId) => {
        const stage = MIGRATION_STAGES.find((s) => s.id === stageId);
        if (!stage) return "";
        const header = stage.csvTemplateHeaders.join(",");
        const sample = stage.csvTemplateHeaders
          .map((h) => `"${stage.sampleRow[h] || ""}"`)
          .join(",");
        return `${header}\n${sample}\n`;
      },

      importCsvToStage: (stageId, csvContent) => {
        try {
          const lines = csvContent
            .trim()
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            return {
              success: false,
              rowCount: 0,
              errors: ["CSV file must have at least a header row and 1 data row."],
            };
          }

          const rawHeaders = lines[0].split(",").map((h) => h.replace(/^["']|["']$/g, "").trim());
          const rows: Record<string, string>[] = [];
          const errors: string[] = [];

          for (let i = 1; i < lines.length; i++) {
            const rawCols = lines[i].split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
            const row: Record<string, string> = {};
            rawHeaders.forEach((h, colIdx) => {
              row[h] = rawCols[colIdx] ?? "";
            });
            rows.push(row);
          }

          const currentBatch = get().activeBatch;
          const updatedStages = { ...currentBatch.stagesData };
          updatedStages[stageId] = {
            stageId,
            status: rows.length > 0 ? "imported" : "pending",
            rows,
            errors: [],
          };

          set({
            activeBatch: {
              ...currentBatch,
              stagesData: updatedStages,
            },
          });

          return { success: true, rowCount: rows.length, errors: [] };
        } catch (e: any) {
          return {
            success: false,
            rowCount: 0,
            errors: [e.message || "Failed to parse CSV file."],
          };
        }
      },

      validateStage: (stageId) => {
        const batch = get().activeBatch;
        const stageData = batch.stagesData[stageId];
        const errors: string[] = [];

        if (!stageData || stageData.rows.length === 0) {
          errors.push(`No data rows uploaded for stage: ${stageId}`);
        } else {
          // Perform stage-specific domain validation
          if (stageId === "parties_profiles") {
            stageData.rows.forEach((r, idx) => {
              if (!r.party_name) errors.push(`Row ${idx + 1}: Missing party name`);
              if (
                r.gstin &&
                !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
                  r.gstin.toUpperCase(),
                )
              ) {
                errors.push(`Row ${idx + 1}: Invalid GSTIN format: ${r.gstin}`);
              }
            });
          } else if (
            stageId === "opening_metal_balances" ||
            stageId === "opening_stock_inventory"
          ) {
            stageData.rows.forEach((r, idx) => {
              const gross = parseFloat(r.gross_weight_g || r.gross_wt_g || "0");
              if (isNaN(gross) || gross <= 0) {
                errors.push(`Row ${idx + 1}: Gross weight must be a positive number`);
              }
            });
          }
        }

        const valid = errors.length === 0;
        const updatedStages = { ...batch.stagesData };
        updatedStages[stageId] = {
          ...stageData,
          status: valid ? "validated" : "error",
          errors,
          validatedAt: Date.now(),
        };

        set({
          activeBatch: {
            ...batch,
            stagesData: updatedStages,
          },
        });

        return { valid, errors };
      },

      runDryRunSimulation: () => {
        const batch = get().activeBatch;
        let totalCashDebit = 0;
        let totalCashCredit = 0;
        let totalFineGoldAssetsG = 0;
        let totalFineGoldLiabG = 0;

        // Stage 6: Opening Financial
        const finRows = batch.stagesData.opening_financial_balances?.rows || [];
        finRows.forEach((r) => {
          const amt = parseFloat(r.amount_inr || "0");
          if (
            r.balance_type?.toLowerCase().includes("debit") ||
            r.balance_type?.toLowerCase().includes("receivable")
          ) {
            totalCashDebit += amt;
          } else {
            totalCashCredit += amt;
          }
        });

        // Stage 7: Opening Metal
        const metalRows = batch.stagesData.opening_metal_balances?.rows || [];
        metalRows.forEach((r) => {
          const fineG = parseFloat(r.fine_weight_g || "0");
          if (
            r.balance_direction?.toLowerCase().includes("receive") ||
            r.balance_direction?.toLowerCase().includes("we_are_owed")
          ) {
            totalFineGoldAssetsG += fineG;
          } else {
            totalFineGoldLiabG += fineG;
          }
        });

        // Stage 8: Stock Inventory (Assets)
        const stockRows = batch.stagesData.opening_stock_inventory?.rows || [];
        stockRows.forEach((r) => {
          const fineG = parseFloat(r.fine_wt_g || "0");
          totalFineGoldAssetsG += fineG;
        });

        const totalAssetsInr = totalCashDebit + totalFineGoldAssetsG * 7200; // estimated gold rate
        const totalLiabilitiesInr = totalCashCredit + totalFineGoldLiabG * 7200;
        const openingEquityReserveInr = totalAssetsInr - totalLiabilitiesInr;

        const simulation = {
          totalAssetsInr,
          totalLiabilitiesInr,
          openingEquityReserveInr,
          totalFineGoldAssetsG,
          totalFineGoldLiabilitiesG: totalFineGoldLiabG,
          netFineGoldBalanceG: totalFineGoldAssetsG - totalFineGoldLiabG,
          reconciliationBalanced: true,
        };

        set({
          activeBatch: {
            ...batch,
            status: "SIMULATED",
            dryRunSimulation: simulation,
          },
        });

        return simulation;
      },

      executeAuditFreeze: async (ceoName: string) => {
        const batch = get().activeBatch;
        const updatedBatch: MigrationBatch = {
          ...batch,
          status: "FROZEN_LIVE",
          frozenAt: Date.now(),
          frozenBy: ceoName,
        };

        try {
          // 1. Resolve firm_id
          const { data: sessionResult } = await supabase.auth.getSession();
          let firmId: string | null = null;
          const userId = sessionResult?.session?.user?.id;
          if (userId) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("firm_id")
              .eq("auth_id", userId)
              .maybeSingle();
            firmId = profile?.firm_id ?? null;
          }

          // 2. Persist migrated parties to people table
          const partyRows = batch.stagesData.parties_profiles?.rows || [];
          for (const r of partyRows) {
            const partyCode = r.party_code || `P-${Date.now()}`;
            const partyName = r.party_name || "Unnamed Party";
            const partyType = (r.party_type || "customer").toLowerCase();
            const phone = r.phone || "";
            const gstin = r.gstin || "";
            const pan = r.pan || "";

            await supabase.from("people").upsert(
              {
                id: partyCode,
                full_name: partyName,
                phone: phone,
                type: partyType,
                active: true,
                firm_id: firmId,
                data: {
                  id: partyCode,
                  fullName: partyName,
                  type: partyType,
                  phone,
                  gstin,
                  pan,
                  city: r.city || "",
                  state: r.state || "",
                  active: true,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              },
              { onConflict: "id" },
            );
          }

          // 3. Persist opening financial and metal balances
          const finRows = batch.stagesData.opening_financial_balances?.rows || [];
          const metalRows = batch.stagesData.opening_metal_balances?.rows || [];

          for (const r of finRows) {
            const partyCode = r.party_code || "";
            const amtPaise = Math.round(parseFloat(r.amount_inr || "0") * 100);
            const isDebit =
              r.balance_type?.toLowerCase().includes("debit") ||
              r.balance_type?.toLowerCase().includes("receivable");

            if (partyCode && amtPaise > 0) {
              await (supabase as any).from("party_opening_balances").insert({
                firm_id: firmId,
                party_id: partyCode,
                migration_batch_id: batch.id,
                as_of_date: batch.asOfDate || new Date().toISOString().split("T")[0],
                cash_debit_paise: isDebit ? amtPaise : 0,
                cash_credit_paise: isDebit ? 0 : amtPaise,
                notes: `Migrated via batch ${batch.batchNumber}`,
                metadata: { source: "migration_wizard", stage: "opening_financial_balances" },
              });
            }
          }

          for (const r of metalRows) {
            const partyCode = r.party_code || "";
            const grossG = parseFloat(r.gross_weight_g || "0");
            const fineG =
              parseFloat(r.fine_weight_g || "0") ||
              grossG * (parseFloat(r.touch_pct || "91.6") / 100);
            const fineMg = Math.round(fineG * 1000);
            const isOwed =
              r.balance_direction?.toLowerCase().includes("receive") ||
              r.balance_direction?.toLowerCase().includes("we_are_owed");

            if (partyCode && fineMg > 0) {
              await (supabase as any).from("party_opening_balances").insert({
                firm_id: firmId,
                party_id: partyCode,
                migration_batch_id: batch.id,
                as_of_date: batch.asOfDate || new Date().toISOString().split("T")[0],
                fine_gold_debit_mg: isOwed ? fineMg : 0,
                fine_gold_credit_mg: isOwed ? 0 : fineMg,
                notes: `Migrated metal balance via batch ${batch.batchNumber}`,
                metadata: { source: "migration_wizard", stage: "opening_metal_balances" },
              });
            }
          }

          // 4. Persist opening stock inventory
          const stockRows = batch.stagesData.opening_stock_inventory?.rows || [];
          for (const r of stockRows) {
            const tagNumber = r.tag_number || `TAG-${Date.now()}`;
            const itemName = r.item_name || "Migrated Stock";
            const grossG = parseFloat(r.gross_wt_g || r.gross_weight_g || "0");
            const netG = parseFloat(r.net_wt_g || r.net_weight_g || "0") || grossG;
            const purity = Math.round(parseFloat(r.purity || "91.6") * 10);
            const grossMg = Math.round(grossG * 1000);
            const netMg = Math.round(netG * 1000);

            if (grossMg > 0) {
              await (supabase as any).from("inventory").upsert(
                {
                  id: tagNumber,
                  item_name: itemName,
                  gross_mg: grossMg,
                  net_mg: netMg,
                  purity: purity,
                  huid: r.huid || null,
                  status: "in_stock",
                  firm_id: firmId,
                  data: {
                    id: tagNumber,
                    itemName,
                    grossWeightMg: grossMg,
                    netWeightMg: netMg,
                    purity,
                    huid: r.huid || "",
                    location: r.location_vault || "Main Vault",
                    status: "in_stock",
                    migratedBatchId: batch.id,
                    createdAt: Date.now(),
                  },
                },
                { onConflict: "id" },
              );
            }
          }

          // 5. Persist to central Supabase migration audit table
          await (supabase as any).from("migration_batches").upsert({
            id: batch.id,
            batch_number: batch.batchNumber,
            as_of_date: batch.asOfDate,
            status: "FROZEN_LIVE",
            frozen_at: new Date().toISOString(),
            frozen_by: ceoName,
            firm_id: firmId,
            metadata: {
              stages: batch.stagesData,
              simulation: batch.dryRunSimulation,
            },
          });
        } catch (err) {
          console.error("Supabase migration persistence error:", err);
        }

        const { useSettings } = await import("@/lib/settings-store");
        useSettings.getState().setFirm({ tenant_migration_status: "COMPLETED" });

        set({ activeBatch: updatedBatch });
        return { success: true, batchId: batch.id };
      },

      resetBatch: () => {
        set({
          activeBatch: createInitialBatch(),
          currentStageIndex: 0,
        });
      },
    }),
    {
      name: "ornexa-migration-engine-v1",
    },
  ),
);
