/**
 * AVS ERP — Subscription Management Store
 *
 * Authoritative client store managing:
 * - Current Company Plan & Status (Trial, Active, Past Due, Suspended, Cancelled, Expired)
 * - Commercial Plans & Configurable Pricing
 * - Quotas & Feature Limits
 * - Subscription Event Lifecycle Audit Trail
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export type PlanTier = "free_trial" | "avs_10k" | "avs_30k" | "avs_50k" | "enterprise_custom";

export type PlanStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled" | "expired";

export type BillingCycle = "monthly" | "annual" | "custom";

export interface PlanLimits {
  maxBranches: number;
  maxUsers: number;
  storageGb: number;
  customerCapacity: number;
  inventoryCapacity: number;
  portalsEnabled: boolean;
  advancedReports: boolean;
  apiAccess: boolean;
  whatsappIntegration: boolean;
  paymentGateway: boolean;
  automatedBackups: boolean;
}

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  code: string;
  tagline: string;
  pricingMonthlyINR: number;
  pricingAnnualINR: number;
  limits: PlanLimits;
  features: string[];
}

export interface SubscriptionRecord {
  id: string;
  companyName: string;
  planTier: PlanTier;
  planName: string;
  status: PlanStatus;
  billingCycle: BillingCycle;
  priceInr: number;
  startDate: string;
  renewalDate: string;
  trialEndDate?: string;
  limits: PlanLimits;
  features: string[];
  updatedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  eventType: string;
  previousTier?: string;
  newTier: string;
  previousStatus?: string;
  newStatus: string;
  actorEmail: string;
  source: string;
  notes?: string;
  createdAt: string;
}

export const DEFAULT_PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  free_trial: {
    id: "free_trial",
    name: "AVS Free Trial",
    code: "AVS_TRIAL_14D",
    tagline: "14-day evaluation trial with standard features",
    pricingMonthlyINR: 0,
    pricingAnnualINR: 0,
    limits: {
      maxBranches: 1,
      maxUsers: 3,
      storageGb: 5,
      customerCapacity: 500,
      inventoryCapacity: 1000,
      portalsEnabled: true,
      advancedReports: false,
      apiAccess: false,
      whatsappIntegration: false,
      paymentGateway: false,
      automatedBackups: true,
    },
    features: [
      "business.core",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.billing_basic",
      "business.inventory",
    ],
  },
  avs_10k: {
    id: "avs_10k",
    name: "AVS Workshop Starter",
    code: "AVS_MANUFACTURING_10K",
    tagline: "Entry workshop ERP — stock, orders, workshop, ledger",
    pricingMonthlyINR: 1000,
    pricingAnnualINR: 10000,
    limits: {
      maxBranches: 1,
      maxUsers: 3,
      storageGb: 10,
      customerCapacity: 1500,
      inventoryCapacity: 3000,
      portalsEnabled: false,
      advancedReports: false,
      apiAccess: false,
      whatsappIntegration: false,
      paymentGateway: false,
      automatedBackups: true,
    },
    features: [
      "business.core",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.billing_basic",
      "business.inventory",
    ],
  },
  avs_30k: {
    id: "avs_30k",
    name: "AVS Manufacturing Standard",
    code: "AVS_MANUFACTURING_30K",
    tagline: "Full manufacturing & showroom — GST, barcode, customer portal",
    pricingMonthlyINR: 2800,
    pricingAnnualINR: 30000,
    limits: {
      maxBranches: 2,
      maxUsers: 10,
      storageGb: 25,
      customerCapacity: 5000,
      inventoryCapacity: 10000,
      portalsEnabled: true,
      advancedReports: true,
      apiAccess: true,
      whatsappIntegration: true,
      paymentGateway: true,
      automatedBackups: true,
    },
    features: [
      "business.core",
      "business.orders",
      "business.workshop",
      "business.ledger",
      "business.billing_full",
      "business.barcode",
      "business.gst",
      "business.item_masters",
      "business.customer_portal",
      "business.document_hosting",
      "business.api_webhooks",
    ],
  },
  avs_50k: {
    id: "avs_50k",
    name: "AVS Enterprise Pro",
    code: "AVS_MANUFACTURING_50K",
    tagline: "Multi-branch, advanced analytics, karigar & supplier portals",
    pricingMonthlyINR: 4800,
    pricingAnnualINR: 50000,
    limits: {
      maxBranches: 5,
      maxUsers: 25,
      storageGb: 100,
      customerCapacity: 25000,
      inventoryCapacity: 50000,
      portalsEnabled: true,
      advancedReports: true,
      apiAccess: true,
      whatsappIntegration: true,
      paymentGateway: true,
      automatedBackups: true,
    },
    features: [
      "business.core",
      "business.orders",
      "business.workshop_full",
      "business.ledger",
      "business.billing_gst_einv",
      "business.barcode_tagging",
      "business.item_masters",
      "business.analytics",
      "business.multi_branch",
      "business.api_webhooks",
      "business.document_hosting",
      "business.karigar_portal",
      "business.supplier_portal",
    ],
  },
  enterprise_custom: {
    id: "enterprise_custom",
    name: "AVS Custom Enterprise",
    code: "AVS_ENTERPRISE_CUSTOM",
    tagline: "Tailored limits, dedicated multi-unit routing, custom SLAs",
    pricingMonthlyINR: 10000,
    pricingAnnualINR: 100000,
    limits: {
      maxBranches: 20,
      maxUsers: 100,
      storageGb: 500,
      customerCapacity: 100000,
      inventoryCapacity: 200000,
      portalsEnabled: true,
      advancedReports: true,
      apiAccess: true,
      whatsappIntegration: true,
      paymentGateway: true,
      automatedBackups: true,
    },
    features: [
      "business.core",
      "business.orders",
      "business.workshop_full",
      "business.ledger",
      "business.billing_gst_einv",
      "business.barcode_tagging",
      "business.item_masters",
      "business.analytics",
      "business.multi_branch",
      "business.api_webhooks",
      "business.document_hosting",
      "business.karigar_portal",
      "business.supplier_portal",
      "business.custom_integrations",
    ],
  },
};

interface SubscriptionState {
  subscription: SubscriptionRecord;
  planDefinitions: Record<PlanTier, PlanDefinition>;
  events: SubscriptionEvent[];
  isLoading: boolean;

  // Actions
  fetchSubscription: () => Promise<void>;
  changePlan: (
    newTier: PlanTier,
    cycle: BillingCycle,
    customPrice?: number,
    actorEmail?: string,
  ) => Promise<boolean>;
  updateStatus: (newStatus: PlanStatus, reason: string, actorEmail?: string) => Promise<boolean>;
  updateCommercialPricing: (
    tier: PlanTier,
    monthlyInr: number,
    annualInr: number,
  ) => Promise<boolean>;
  updateCustomLimits: (limits: Partial<PlanLimits>) => Promise<boolean>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscription: {
        id: "sub_primary_001",
        companyName: "AVS Gold & Diamond Jewellers",
        planTier: "avs_30k",
        planName: "AVS Manufacturing Standard",
        status: "active",
        billingCycle: "annual",
        priceInr: 30000,
        startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
        renewalDate: new Date(Date.now() + 335 * 86400000).toISOString(),
        limits: DEFAULT_PLAN_DEFINITIONS.avs_30k.limits,
        features: DEFAULT_PLAN_DEFINITIONS.avs_30k.features,
        updatedAt: new Date().toISOString(),
      },
      planDefinitions: DEFAULT_PLAN_DEFINITIONS,
      events: [
        {
          id: "evt_sub_01",
          eventType: "subscription.activated",
          previousTier: "free_trial",
          newTier: "avs_30k",
          previousStatus: "trial",
          newStatus: "active",
          actorEmail: "admin@maatarajewellers.shop",
          source: "admin_panel",
          notes: "Initial annual plan activation",
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        },
      ],
      isLoading: false,

      fetchSubscription: async () => {
        set({ isLoading: true });
        try {
          // Fetch from Supabase PostgreSQL
          const { data: subData } = await supabase
            .from("company_subscriptions")
            .select("*")
            .limit(1)
            .maybeSingle();

          if (subData) {
            set({
              subscription: {
                id: subData.id,
                companyName: subData.company_name,
                planTier: subData.plan_tier as PlanTier,
                planName: subData.plan_name,
                status: subData.status as PlanStatus,
                billingCycle: subData.billing_cycle as BillingCycle,
                priceInr: Number(subData.price_inr),
                startDate: subData.start_date,
                renewalDate: subData.renewal_date,
                trialEndDate: subData.trial_end_date,
                limits: subData.limits_json || DEFAULT_PLAN_DEFINITIONS[subData.plan_tier as PlanTier]?.limits,
                features: subData.features_json || DEFAULT_PLAN_DEFINITIONS[subData.plan_tier as PlanTier]?.features,
                updatedAt: subData.updated_at,
              },
            });
          }

          const { data: eventsData } = await supabase
            .from("subscription_events")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);

          if (eventsData && eventsData.length > 0) {
            set({
              events: eventsData.map((e: any) => ({
                id: e.id,
                eventType: e.event_type,
                previousTier: e.previous_tier,
                newTier: e.new_tier,
                previousStatus: e.previous_status,
                newStatus: e.new_status,
                actorEmail: e.actor_email || "admin@maatarajewellers.shop",
                source: e.source,
                notes: e.notes,
                createdAt: e.created_at,
              })),
            });
          }
        } catch {
          // Keep local fallback
        } finally {
          set({ isLoading: false });
        }
      },

      changePlan: async (newTier, cycle, customPrice, actorEmail = "admin@maatarajewellers.shop") => {
        const state = get();
        const prev = state.subscription;
        const planDef = state.planDefinitions[newTier] || DEFAULT_PLAN_DEFINITIONS[newTier];
        const price = customPrice ?? (cycle === "annual" ? planDef.pricingAnnualINR : planDef.pricingMonthlyINR);
        const durationDays = cycle === "annual" ? 365 : 30;

        const updated: SubscriptionRecord = {
          ...prev,
          planTier: newTier,
          planName: planDef.name,
          status: "active",
          billingCycle: cycle,
          priceInr: price,
          startDate: new Date().toISOString(),
          renewalDate: new Date(Date.now() + durationDays * 86400000).toISOString(),
          limits: planDef.limits,
          features: planDef.features,
          updatedAt: new Date().toISOString(),
        };

        const newEvent: SubscriptionEvent = {
          id: `evt_${Date.now()}`,
          eventType: newTier !== prev.planTier ? "subscription.upgraded" : "subscription.renewed",
          previousTier: prev.planTier,
          newTier,
          previousStatus: prev.status,
          newStatus: "active",
          actorEmail,
          source: "admin_panel",
          notes: `Plan changed to ${planDef.name} (${cycle}) for ₹${price.toLocaleString("en-IN")}`,
          createdAt: new Date().toISOString(),
        };

        set({
          subscription: updated,
          events: [newEvent, ...state.events],
        });

        // Persist to Supabase
        try {
          await supabase.from("company_subscriptions").upsert({
            id: prev.id,
            company_name: updated.companyName,
            plan_tier: newTier,
            plan_name: planDef.name,
            status: "active",
            billing_cycle: cycle,
            price_inr: price,
            start_date: updated.startDate,
            renewal_date: updated.renewalDate,
            limits_json: planDef.limits,
            features_json: planDef.features,
            updated_at: new Date().toISOString(),
          } as any);

          await supabase.from("subscription_events").insert({
            event_type: newEvent.eventType,
            previous_tier: prev.planTier,
            new_tier: newTier,
            previous_status: prev.status,
            new_status: "active",
            actor_email: actorEmail,
            source: "admin_panel",
            notes: newEvent.notes,
            created_at: newEvent.createdAt,
          } as any);

          await supabase.from("admin_audit_logs").insert({
            actor_id: "admin",
            actor_email: actorEmail,
            action: "plan_changed",
            entity_type: "subscription",
            entity_id: prev.id,
            previous_state: { tier: prev.planTier, price: prev.priceInr },
            new_state: { tier: newTier, price },
            result: "success",
            created_at: new Date().toISOString(),
          } as any);

          toast.success(`Subscription plan updated to ${planDef.name}`);
          return true;
        } catch (err: any) {
          toast.success(`Plan updated locally (${err?.message || "Sync warning"})`);
          return true;
        }
      },

      updateStatus: async (newStatus, reason, actorEmail = "admin@maatarajewellers.shop") => {
        const state = get();
        const prev = state.subscription;
        const updated: SubscriptionRecord = {
          ...prev,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };

        const newEvent: SubscriptionEvent = {
          id: `evt_${Date.now()}`,
          eventType: `subscription.${newStatus}`,
          previousTier: prev.planTier,
          newTier: prev.planTier,
          previousStatus: prev.status,
          newStatus,
          actorEmail,
          source: "admin_panel",
          notes: reason,
          createdAt: new Date().toISOString(),
        };

        set({
          subscription: updated,
          events: [newEvent, ...state.events],
        });

        try {
          await supabase
            .from("company_subscriptions")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", prev.id);

          await supabase.from("subscription_events").insert({
            event_type: newEvent.eventType,
            previous_tier: prev.planTier,
            new_tier: prev.planTier,
            previous_status: prev.status,
            new_status: newStatus,
            actor_email: actorEmail,
            source: "admin_panel",
            notes: reason,
            created_at: newEvent.createdAt,
          } as any);

          toast.success(`Subscription status updated to ${newStatus.toUpperCase()}`);
          return true;
        } catch {
          return true;
        }
      },

      updateCommercialPricing: async (tier, monthlyInr, annualInr) => {
        const state = get();
        const existing = state.planDefinitions[tier];
        if (!existing) return false;

        const updatedDefs = {
          ...state.planDefinitions,
          [tier]: {
            ...existing,
            pricingMonthlyINR: monthlyInr,
            pricingAnnualINR: annualInr,
          },
        };

        set({ planDefinitions: updatedDefs });
        toast.success(`Commercial pricing updated for ${existing.name}`);
        return true;
      },

      updateCustomLimits: async (limits) => {
        const state = get();
        const prev = state.subscription;
        const mergedLimits: PlanLimits = { ...prev.limits, ...limits };

        set({
          subscription: {
            ...prev,
            limits: mergedLimits,
            updatedAt: new Date().toISOString(),
          },
        });

        toast.success("Custom limits saved");
        return true;
      },
    }),
    {
      name: "avs-subscription-store-v2",
    },
  ),
);
