/**
 * Commercial pricing store — platform-configurable fees and plan versions (no hardcoded prices).
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";

export type CommercialFeeType =
  | "setup"
  | "annual_integration"
  | "annual_management"
  | "support"
  | "amc"
  | "migration"
  | "training"
  | "custom"
  | "whatsapp_managed"
  | "whatsapp_external_bsp";

export interface CommercialProductFee {
  id: string;
  productId: string;
  feeCode: string;
  feeName: string;
  feeType: CommercialFeeType;
  amountPaise: number;
  billingCycle: "one_time" | "monthly" | "annual";
  effectiveFrom: string;
  effectiveTo?: string;
  planEligibility: string[];
  tenantOverrideFirmId?: string;
  isActive: boolean;
}

export interface CommercialPlanVersion {
  id: string;
  planId: string;
  productId: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo?: string;
  priceMonthlyPaise: number;
  priceAnnualPaise: number;
  setupFeePaise: number;
  amcAnnualPaise: number;
  featureLimits: Record<string, unknown>;
  whatsappEligibility: "none" | "external_bsp" | "managed_full" | "managed_limited";
  aiEligibility: boolean;
  isPublished: boolean;
}

function mapFee(row: Record<string, unknown>): CommercialProductFee {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    feeCode: String(row.fee_code),
    feeName: String(row.fee_name),
    feeType: String(row.fee_type) as CommercialFeeType,
    amountPaise: Number(row.amount_paise ?? 0),
    billingCycle: String(row.billing_cycle ?? "one_time") as CommercialProductFee["billingCycle"],
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to ? String(row.effective_to) : undefined,
    planEligibility: Array.isArray(row.plan_eligibility) ? (row.plan_eligibility as string[]) : [],
    tenantOverrideFirmId: row.tenant_override_firm_id
      ? String(row.tenant_override_firm_id)
      : undefined,
    isActive: Boolean(row.is_active ?? true),
  };
}

function mapPlanVersion(row: Record<string, unknown>): CommercialPlanVersion {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    productId: String(row.product_id),
    versionNumber: Number(row.version_number ?? 1),
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to ? String(row.effective_to) : undefined,
    priceMonthlyPaise: Number(row.price_monthly_paise ?? 0),
    priceAnnualPaise: Number(row.price_annual_paise ?? 0),
    setupFeePaise: Number(row.setup_fee_paise ?? 0),
    amcAnnualPaise: Number(row.amc_annual_paise ?? 0),
    featureLimits: (row.feature_limits ?? {}) as Record<string, unknown>,
    whatsappEligibility: String(
      row.whatsapp_eligibility ?? "none",
    ) as CommercialPlanVersion["whatsappEligibility"],
    aiEligibility: Boolean(row.ai_eligibility ?? false),
    isPublished: Boolean(row.is_published ?? false),
  };
}

interface CommercialPricingState {
  fees: CommercialProductFee[];
  planVersions: CommercialPlanVersion[];
  loading: boolean;
  hydrate: (productId?: string) => Promise<void>;
  upsertFee: (input: Omit<CommercialProductFee, "id"> & { id?: string }) => Promise<void>;
  publishPlanVersion: (input: Omit<CommercialPlanVersion, "id"> & { id?: string }) => Promise<void>;
}

export const useCommercialPricingStore = create<CommercialPricingState>()((set, get) => ({
  fees: [],
  planVersions: [],
  loading: false,

  hydrate: async (productId = DEFAULT_AVS_PRODUCT) => {
    set({ loading: true });
    const [feeRes, verRes] = await Promise.all([
      supabase
        .from("commercial_product_fees" as never)
        .select("*")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("effective_from", { ascending: false }),
      supabase
        .from("commercial_plan_versions" as never)
        .select("*")
        .eq("product_id", productId)
        .order("version_number", { ascending: false }),
    ]);
    if (!feeRes.error && feeRes.data) {
      set({ fees: (feeRes.data as Record<string, unknown>[]).map(mapFee) });
    }
    if (!verRes.error && verRes.data) {
      set({ planVersions: (verRes.data as Record<string, unknown>[]).map(mapPlanVersion) });
    }
    set({ loading: false });
  },

  upsertFee: async (input) => {
    const payload = {
      id: input.id,
      product_id: input.productId,
      fee_code: input.feeCode,
      fee_name: input.feeName,
      fee_type: input.feeType,
      amount_paise: input.amountPaise,
      billing_cycle: input.billingCycle,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo ?? null,
      plan_eligibility: input.planEligibility,
      tenant_override_firm_id: input.tenantOverrideFirmId ?? null,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    };
    if (input.id) {
      await supabase
        .from("commercial_product_fees" as never)
        .update(payload as never)
        .eq("id", input.id);
    } else {
      await supabase.from("commercial_product_fees" as never).insert(payload as never);
    }
    await get().hydrate(input.productId);
  },

  publishPlanVersion: async (input) => {
    const payload = {
      plan_id: input.planId,
      product_id: input.productId,
      version_number: input.versionNumber,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo ?? null,
      price_monthly_paise: input.priceMonthlyPaise,
      price_annual_paise: input.priceAnnualPaise,
      setup_fee_paise: input.setupFeePaise,
      amc_annual_paise: input.amcAnnualPaise,
      feature_limits: input.featureLimits,
      whatsapp_eligibility: input.whatsappEligibility,
      ai_eligibility: input.aiEligibility,
      is_published: true,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (input.id) {
      await supabase
        .from("commercial_plan_versions" as never)
        .update(payload as never)
        .eq("id", input.id);
    } else {
      await supabase.from("commercial_plan_versions" as never).insert(payload as never);
    }
    await get().hydrate(input.productId);
  },
}));

/** Active fee for product + code on a given date */
export function resolveActiveFee(
  fees: CommercialProductFee[],
  feeCode: string,
  asOf = new Date(),
): CommercialProductFee | undefined {
  const day = asOf.toISOString().slice(0, 10);
  return fees.find(
    (f) =>
      f.feeCode === feeCode &&
      f.isActive &&
      f.effectiveFrom <= day &&
      (!f.effectiveTo || f.effectiveTo >= day),
  );
}
