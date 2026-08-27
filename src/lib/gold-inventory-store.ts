/**
 * Gold Inventory, Ownership Decoupling & Real Conversion Engine Store
 * Master Reference: docs/MASTER/GOLD/
 *
 * Supabase tables: metal_inventory_lots, gold_ownership_positions, gold_lineage_events
 * Integer mg storage; UI layer uses grams for display.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { gramsToMg, mgToGrams, fineGoldMgFromTouchPercent } from "@/lib/gold";
import { tryPostUniversalLedgerMirror } from "@/lib/universal-transaction-bridge";
import { toast } from "sonner";

export type CustodianType =
  "vault" | "melting_crucible" | "karigar_bench" | "outside_vendor" | "ready_stock" | "in_transit";

export type LiabilityStatus = "active" | "settled" | "allocated_to_order" | "returned";

export interface GoldOwnershipPosition {
  id: string;
  partyId: string;
  partyName: string;
  positionType: "customer_deposit" | "bullion_advance" | "karigar_custody" | "company_stock";
  grossWeightG: number;
  touchPurity: number;
  fineGoldG: number;
  physicalCustodianType: CustodianType;
  physicalVaultId: string;
  physicalLotId?: string;
  physicalIsUtilized: boolean;
  liabilityStatus: LiabilityStatus;
  allocatedOrderId?: string;
  depositVoucherRef: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PhysicalForm = "bar" | "granules" | "scrap" | "alloy_master" | "wire" | "sheet";

export interface MetalInventoryLot {
  id: string;
  lotNumber: string;
  metalType: "gold" | "silver" | "platinum";
  purityKarat: "24K" | "22K" | "18K" | "14K" | "9K" | "scrap";
  touchPurity: number;
  physicalForm: PhysicalForm;
  vaultLocation: string;
  grossWeightG: number;
  fineGoldG: number;
  availableGrossG: number;
  availableFineG: number;
  ownershipPartyId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoldLineageEvent {
  id: string;
  timestamp: string;
  eventType:
    | "deposit"
    | "melt_conversion"
    | "alloy_addition"
    | "job_issue"
    | "worker_return"
    | "outside_mina"
    | "polish_recovery"
    | "tag_stock"
    | "sale_invoice";
  sourceLotNumber?: string;
  targetLotNumber?: string;
  voucherRef: string;
  grossWeightG: number;
  touchPurity: number;
  fineGoldG: number;
  fromLocation: string;
  toLocation: string;
  partyName?: string;
  operatorName: string;
  notes?: string;
}

export interface ConversionExecutionPlan {
  sourceLotId: string;
  sourceGrossG: number;
  sourceTouch: number;
  targetPurityKarat: "24K" | "22K" | "18K" | "14K";
  targetTouch: number;
  alloyType: "copper_silver_master" | "pure_copper" | "pure_silver" | "fine_gold_999";
  alloyAddedG: number;
  expectedLossG: number;
  targetVault: string;
  targetForm: PhysicalForm;
  notes?: string;
  operatorName?: string;
}

interface LotRow {
  id: string;
  lot_number: string;
  metal_type: string;
  purity_karat: string;
  touch_purity: number;
  physical_form: string;
  vault_location: string;
  gross_weight_mg: number;
  fine_gold_mg: number;
  available_gross_weight_mg: number;
  available_fine_gold_mg: number;
  ownership_party_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PositionRow {
  id: string;
  party_id: string | null;
  party_name: string;
  position_type: string;
  gross_weight_mg: number;
  touch_purity: number;
  fine_gold_mg: number;
  physical_custodian_type: string;
  physical_vault_id: string | null;
  physical_lot_id: string | null;
  physical_is_utilized: boolean;
  liability_status: string;
  allocated_order_id: string | null;
  deposit_voucher_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LineageRow {
  id: string;
  event_type: string;
  source_lot_number: string | null;
  target_lot_number: string | null;
  voucher_ref: string | null;
  gross_weight_mg: number;
  touch_purity: number;
  fine_gold_mg: number;
  from_location: string | null;
  to_location: string | null;
  party_name: string | null;
  operator_name: string | null;
  notes: string | null;
  created_at: string;
}

function mgToGramsNumber(mg: number): number {
  return parseFloat(mgToGrams(mg));
}

function fromLotRow(row: LotRow): MetalInventoryLot {
  return {
    id: row.id,
    lotNumber: row.lot_number,
    metalType: (row.metal_type as MetalInventoryLot["metalType"]) || "gold",
    purityKarat: (row.purity_karat as MetalInventoryLot["purityKarat"]) || "24K",
    touchPurity: Number(row.touch_purity),
    physicalForm: (row.physical_form as PhysicalForm) || "bar",
    vaultLocation: row.vault_location,
    grossWeightG: mgToGramsNumber(row.gross_weight_mg),
    fineGoldG: mgToGramsNumber(row.fine_gold_mg),
    availableGrossG: mgToGramsNumber(row.available_gross_weight_mg),
    availableFineG: mgToGramsNumber(row.available_fine_gold_mg),
    ownershipPartyId: row.ownership_party_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromPositionRow(row: PositionRow): GoldOwnershipPosition {
  return {
    id: row.id,
    partyId: row.party_id ?? "",
    partyName: row.party_name,
    positionType: row.position_type as GoldOwnershipPosition["positionType"],
    grossWeightG: mgToGramsNumber(row.gross_weight_mg),
    touchPurity: Number(row.touch_purity),
    fineGoldG: mgToGramsNumber(row.fine_gold_mg),
    physicalCustodianType: row.physical_custodian_type as CustodianType,
    physicalVaultId: row.physical_vault_id ?? "",
    physicalLotId: row.physical_lot_id ?? undefined,
    physicalIsUtilized: row.physical_is_utilized,
    liabilityStatus: row.liability_status as LiabilityStatus,
    allocatedOrderId: row.allocated_order_id ?? undefined,
    depositVoucherRef: row.deposit_voucher_ref ?? "",
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromLineageRow(row: LineageRow): GoldLineageEvent {
  return {
    id: row.id,
    timestamp: row.created_at,
    eventType: row.event_type as GoldLineageEvent["eventType"],
    sourceLotNumber: row.source_lot_number ?? undefined,
    targetLotNumber: row.target_lot_number ?? undefined,
    voucherRef: row.voucher_ref ?? "",
    grossWeightG: mgToGramsNumber(row.gross_weight_mg),
    touchPurity: Number(row.touch_purity),
    fineGoldG: mgToGramsNumber(row.fine_gold_mg),
    fromLocation: row.from_location ?? "",
    toLocation: row.to_location ?? "",
    partyName: row.party_name ?? undefined,
    operatorName: row.operator_name ?? "System",
    notes: row.notes ?? undefined,
  };
}

interface GoldInventoryState {
  ownershipPositions: GoldOwnershipPosition[];
  inventoryLots: MetalInventoryLot[];
  lineageEvents: GoldLineageEvent[];
  loading: boolean;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  recordCustomerGoldDeposit: (params: {
    partyId: string;
    partyName: string;
    grossWeightG: number;
    touchPurity: number;
    vaultLocation: string;
    voucherRef: string;
    notes?: string;
  }) => Promise<GoldOwnershipPosition | null>;
  executeMetalConversion: (
    plan: ConversionExecutionPlan,
  ) => Promise<{ success: boolean; outputLot?: MetalInventoryLot; error?: string }>;
  allocateCustomerGoldToOrder: (positionId: string, orderId: string) => Promise<boolean>;
  settleCustomerGoldLiability: (positionId: string, returnVoucherRef: string) => Promise<boolean>;
  getLineageForLot: (lotNumber: string) => GoldLineageEvent[];
  getTotalPhysicalGoldPosition: () => {
    totalGrossG: number;
    totalFineG: number;
    vaultGrossG: number;
    karigarGrossG: number;
    outsideGrossG: number;
    readyStockGrossG: number;
    customerOwnedGrossG: number;
    companyOwnedGrossG: number;
    byPurity: Record<string, { grossG: number; fineG: number }>;
  };
}

export const useGoldInventoryStore = create<GoldInventoryState>()((set, get) => ({
  ownershipPositions: [],
  inventoryLots: [],
  lineageEvents: [],
  loading: false,
  isHydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const [lotsRes, posRes, lineageRes] = await Promise.all([
        supabase
          .from("metal_inventory_lots" as never)
          .select(
            "id,lot_number,metal_type,purity_karat,touch_purity,physical_form,vault_location,gross_weight_mg,fine_gold_mg,available_gross_weight_mg,available_fine_gold_mg,ownership_party_id,is_active,created_at,updated_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("gold_ownership_positions" as never)
          .select(
            "id,party_id,party_name,position_type,gross_weight_mg,touch_purity,fine_gold_mg,physical_custodian_type,physical_vault_id,physical_lot_id,physical_is_utilized,liability_status,allocated_order_id,deposit_voucher_ref,notes,created_at,updated_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("gold_lineage_events" as never)
          .select(
            "id,event_type,source_lot_number,target_lot_number,voucher_ref,gross_weight_mg,touch_purity,fine_gold_mg,from_location,to_location,party_name,operator_name,notes,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (lotsRes.error) throw lotsRes.error;
      if (posRes.error) throw posRes.error;
      // lineage table may not exist until migration applied — tolerate
      const lineageRows = lineageRes.error
        ? []
        : ((lineageRes.data ?? []) as unknown as LineageRow[]);

      set({
        inventoryLots: ((lotsRes.data ?? []) as unknown as LotRow[]).map(fromLotRow),
        ownershipPositions: ((posRes.data ?? []) as unknown as PositionRow[]).map(fromPositionRow),
        lineageEvents: lineageRows.map(fromLineageRow),
        isHydrated: true,
        loading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load gold inventory";
      console.warn("[gold-inventory] hydrate failed:", message);
      set({ isHydrated: true, loading: false });
    }
  },

  recordCustomerGoldDeposit: async (params) => {
    const grossMg = gramsToMg(params.grossWeightG);
    const fineMg = fineGoldMgFromTouchPercent(grossMg, params.touchPurity);
    const lotNumber = `LOT-CUST-${params.voucherRef.replace(/[^A-Z0-9]/gi, "")}`;
    const now = new Date().toISOString();

    const { data: lotData, error: lotErr } = await supabase
      .from("metal_inventory_lots" as never)
      .insert({
        lot_number: lotNumber,
        metal_type: "gold",
        purity_karat: params.touchPurity >= 91.6 ? "22K" : "scrap",
        touch_purity: params.touchPurity,
        physical_form: "scrap",
        vault_location: params.vaultLocation,
        gross_weight_mg: grossMg,
        fine_gold_mg: fineMg,
        available_gross_weight_mg: grossMg,
        available_fine_gold_mg: fineMg,
        ownership_party_id: params.partyId,
        is_active: true,
      } as never)
      .select(
        "id,lot_number,metal_type,purity_karat,touch_purity,physical_form,vault_location,gross_weight_mg,fine_gold_mg,available_gross_weight_mg,available_fine_gold_mg,ownership_party_id,is_active,created_at,updated_at",
      )
      .single();
    if (lotErr) {
      toast.error(lotErr.message ?? "Could not record deposit lot.");
      return null;
    }
    const lot = fromLotRow(lotData as unknown as LotRow);

    const { data: posData, error: posErr } = await supabase
      .from("gold_ownership_positions" as never)
      .insert({
        party_id: params.partyId,
        party_name: params.partyName,
        position_type: "customer_deposit",
        gross_weight_mg: grossMg,
        touch_purity: params.touchPurity,
        fine_gold_mg: fineMg,
        physical_custodian_type: "vault",
        physical_vault_id: params.vaultLocation,
        physical_lot_id: lot.id,
        physical_is_utilized: false,
        liability_status: "active",
        deposit_voucher_ref: params.voucherRef,
        notes: params.notes ?? null,
      } as never)
      .select(
        "id,party_id,party_name,position_type,gross_weight_mg,touch_purity,fine_gold_mg,physical_custodian_type,physical_vault_id,physical_lot_id,physical_is_utilized,liability_status,allocated_order_id,deposit_voucher_ref,notes,created_at,updated_at",
      )
      .single();
    if (posErr) {
      toast.error(posErr.message ?? "Could not record ownership position.");
      return null;
    }
    const position = fromPositionRow(posData as unknown as PositionRow);

    await supabase.from("gold_lineage_events" as never).insert({
      event_type: "deposit",
      target_lot_number: lotNumber,
      voucher_ref: params.voucherRef,
      gross_weight_mg: grossMg,
      touch_purity: params.touchPurity,
      fine_gold_mg: fineMg,
      from_location: `Customer (${params.partyName})`,
      to_location: params.vaultLocation,
      party_name: params.partyName,
      operator_name: "Vault Inward Executive",
      notes: params.notes ?? null,
    } as never);

    set((s) => ({
      inventoryLots: [lot, ...s.inventoryLots],
      ownershipPositions: [position, ...s.ownershipPositions],
    }));
    await get().hydrate();
    return position;
  },

  executeMetalConversion: async (plan) => {
    const sourceGrossMg = gramsToMg(plan.sourceGrossG);
    const alloyAddedMg = gramsToMg(plan.alloyAddedG);
    const expectedLossMg = gramsToMg(plan.expectedLossG);

    const { data, error } = await supabase.rpc(
      "rpc_execute_inventory_metal_conversion" as never,
      {
        p_source_lot_id: plan.sourceLotId,
        p_source_gross_mg: sourceGrossMg,
        p_target_purity_karat: plan.targetPurityKarat,
        p_target_touch: plan.targetTouch,
        p_alloy_added_mg: alloyAddedMg,
        p_expected_loss_mg: expectedLossMg,
        p_target_vault: plan.targetVault,
        p_target_form: plan.targetForm,
        p_operator_name: plan.operatorName ?? "Master Melter",
        p_notes: plan.notes ?? null,
      } as never,
    );

    if (error) {
      return { success: false, error: error.message };
    }

    const result = data as {
      success?: boolean;
      outputLotId?: string;
      outputLotNumber?: string;
      outputGrossMg?: number;
      outputFineMg?: number;
    };

    await get().hydrate();

    void tryPostUniversalLedgerMirror({
      voucherKind: "metal_conversion",
      voucherNumber: result.outputLotNumber ?? result.outputLotId ?? plan.sourceLotId,
      grossWeightMg: result.outputGrossMg,
      netWeightMg: result.outputGrossMg,
      fineGoldCreditMg: result.outputFineMg,
      metadata: {
        sourceLotId: plan.sourceLotId,
        outputLotId: result.outputLotId,
        targetPurityKarat: plan.targetPurityKarat,
      },
    }).catch(() => undefined);

    const outputLot = get().inventoryLots.find((l) => l.id === result.outputLotId);
    return { success: true, outputLot };
  },

  allocateCustomerGoldToOrder: async (positionId, orderId) => {
    const { error } = await supabase
      .from("gold_ownership_positions" as never)
      .update({
        liability_status: "allocated_to_order",
        allocated_order_id: orderId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", positionId)
      .eq("liability_status", "active");
    if (error) return false;
    await get().hydrate();
    return true;
  },

  settleCustomerGoldLiability: async (positionId, returnVoucherRef) => {
    const pos = get().ownershipPositions.find((p) => p.id === positionId);
    if (!pos) return false;
    const { error } = await supabase
      .from("gold_ownership_positions" as never)
      .update({
        liability_status: "settled",
        notes: `${pos.notes || ""}; Settled via voucher ${returnVoucherRef}`,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", positionId);
    if (error) return false;
    await get().hydrate();
    return true;
  },

  getLineageForLot: (lotNumber) =>
    get().lineageEvents.filter(
      (e) => e.sourceLotNumber === lotNumber || e.targetLotNumber === lotNumber,
    ),

  getTotalPhysicalGoldPosition: () => {
    const lots = get().inventoryLots.filter((l) => l.isActive);
    let totalGrossG = 0;
    let totalFineG = 0;
    let vaultGrossG = 0;
    let customerOwnedGrossG = 0;
    let companyOwnedGrossG = 0;
    const byPurity: Record<string, { grossG: number; fineG: number }> = {};

    for (const lot of lots) {
      totalGrossG += lot.availableGrossG;
      totalFineG += lot.availableFineG;
      if (
        lot.vaultLocation.toLowerCase().includes("vault") ||
        lot.vaultLocation.toLowerCase().includes("strongroom")
      ) {
        vaultGrossG += lot.availableGrossG;
      }
      if (lot.ownershipPartyId) customerOwnedGrossG += lot.availableGrossG;
      else companyOwnedGrossG += lot.availableGrossG;
      if (!byPurity[lot.purityKarat]) byPurity[lot.purityKarat] = { grossG: 0, fineG: 0 };
      byPurity[lot.purityKarat].grossG += lot.availableGrossG;
      byPurity[lot.purityKarat].fineG += lot.availableFineG;
    }

    return {
      totalGrossG,
      totalFineG,
      vaultGrossG,
      karigarGrossG: 0,
      outsideGrossG: 0,
      readyStockGrossG: 0,
      customerOwnedGrossG,
      companyOwnedGrossG,
      byPurity,
    };
  },
}));

let hydrateOnce: Promise<void> | null = null;

export function ensureGoldInventoryLoaded(): Promise<void> {
  if (!hydrateOnce) hydrateOnce = useGoldInventoryStore.getState().hydrate();
  return hydrateOnce;
}
