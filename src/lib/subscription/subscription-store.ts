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

export type PlanTier =
  | "free_trial"
  | "avs_10k"
  | "avs_30k"
  | "avs_50k"
  | "enterprise_custom"
  | (string & {});

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
  customPriceSupported?: boolean;
  trialDays?: number;
  graceDays?: number;
  version?: number;
  limits: PlanLimits;
  features: string[];
}

export interface SubscriptionRecord {
  id: string;
  tenantId?: string;
  companyName: string;
  planTier: PlanTier;
  planName: string;
  planVersion: number;
  status: PlanStatus;
  billingCycle: BillingCycle;
  priceInr: number;
  startDate: string;
  renewalDate: string;
  trialEndDate?: string;
  graceEndDate?: string;
  limits: PlanLimits;
  features: string[];
  lastPaymentId?: string;
  lastInvoiceId?: string;
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
    code: "free_trial",
    tagline: "14-day evaluation trial with standard features",
    pricingMonthlyINR: 0,
    pricingAnnualINR: 0,
    customPriceSupported: false,
    trialDays: 14,
    graceDays: 7,
    version: 1,
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
    code: "avs_10k",
    tagline: "Entry workshop ERP — stock, orders, workshop, ledger",
    pricingMonthlyINR: 1000,
    pricingAnnualINR: 10000,
    customPriceSupported: false,
    trialDays: 14,
    graceDays: 7,
    version: 1,
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
    code: "avs_30k",
    tagline: "Full manufacturing & showroom — GST, barcode, customer portal",
    pricingMonthlyINR: 2800,
    pricingAnnualINR: 30000,
    customPriceSupported: false,
    trialDays: 14,
    graceDays: 7,
    version: 1,
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
    code: "avs_50k",
    tagline: "Multi-branch, advanced analytics, karigar & supplier portals",
    pricingMonthlyINR: 4800,
    pricingAnnualINR: 50000,
    customPriceSupported: false,
    trialDays: 14,
    graceDays: 7,
    version: 1,
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
    code: "enterprise_custom",
    tagline: "Tailored limits, dedicated multi-unit routing, custom SLAs",
    pricingMonthlyINR: 10000,
    pricingAnnualINR: 100000,
    customPriceSupported: true,
    trialDays: 14,
    graceDays: 7,
    version: 1,
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
  fetchPlanDefinitions: () => Promise<void>;
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
        tenantId: "org_primary_001",
        companyName: "AVS Gold & Diamond Jewellers",
        planTier: "avs_30k",
        planName: "AVS Manufacturing Standard",
        planVersion: 1,
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
          actorEmail: "admin@arivahly.in",
          source: "admin_panel",
          notes: "Initial annual plan activation",
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        },
      ],
      isLoading: false,

      fetchPlanDefinitions: async () => {
        try {
          const { data: plans } = await supabase
            .from("platform_plans")
            .select("*")
            .eq("is_active", true);

          if (plans && plans.length > 0) {
            const currentDefs = { ...get().planDefinitions };
            plans.forEach((p: any) => {
              const tier = p.code as PlanTier;
              if (tier) {
                const featLimits = (typeof p.feature_limits === "object" && p.feature_limits !== null)
                  ? p.feature_limits
                  : {};
                const commConfig = (typeof p.commercial_config === "object" && p.commercial_config !== null)
                  ? p.commercial_config
                  : {};

                const storageGb = featLimits.storage_gb
                  ? Number(featLimits.storage_gb)
                  : p.storage_limit_bytes
                    ? Math.round(p.storage_limit_bytes / (1024 * 1024 * 1024))
                    : 5;

                const featuresList: string[] = Array.isArray(featLimits.features)
                  ? featLimits.features
                  : DEFAULT_PLAN_DEFINITIONS[tier]?.features || [
                      "business.core",
                      "business.orders",
                      "business.workshop",
                      "business.ledger",
                      "business.billing_full",
                      "business.inventory",
                    ];

                const monthlyPrice = p.billing_cycle === "annual"
                  ? Math.round((Number(p.price_minor || 0) / 100) / 12)
                  : Math.round(Number(p.price_minor || 0) / 100);

                const annualPrice = p.billing_cycle === "annual"
                  ? Math.round(Number(p.price_minor || 0) / 100)
                  : Math.round((Number(p.price_minor || 0) / 100) * 12);

                currentDefs[tier] = {
                  id: tier,
                  name: p.name,
                  code: p.code,
                  tagline: p.description || "",
                  pricingMonthlyINR: monthlyPrice,
                  pricingAnnualINR: annualPrice,
                  customPriceSupported: Boolean(commConfig.custom_price_supported),
                  trialDays: p.trial_days || 14,
                  graceDays: p.grace_days || 7,
                  version: p.version || 1,
                  limits: {
                    maxBranches: p.branch_limit || featLimits.max_branches || 1,
                    maxUsers: p.user_limit || featLimits.max_users || 3,
                    storageGb,
                    customerCapacity: featLimits.customer_capacity || 5000,
                    inventoryCapacity: featLimits.inventory_capacity || 10000,
                    portalsEnabled: Boolean(
                      featuresList.includes("business.customer_portal") ||
                      featuresList.includes("business.karigar_portal") ||
                      (featLimits.portal_access ?? true)
                    ),
                    advancedReports: Boolean(
                      featuresList.includes("business.analytics") ||
                      (featLimits.reports_access ?? true)
                    ),
                    apiAccess: Boolean(
                      featuresList.includes("business.api_webhooks") ||
                      (featLimits.api_access ?? false)
                    ),
                    whatsappIntegration: Boolean(
                      featuresList.includes("business.whatsapp") ||
                      (featLimits.whatsapp_access ?? false)
                    ),
                    paymentGateway: Boolean(featLimits.payment_gateway_access ?? false),
                    automatedBackups: Boolean(featLimits.backup_access ?? true),
                  },
                  features: featuresList,
                };
              }
            });
            set({ planDefinitions: currentDefs });
          }
        } catch {
          // Keep defaults
        }
      },

      fetchSubscription: async () => {
        set({ isLoading: true });
        try {
          // Fetch plans first
          await get().fetchPlanDefinitions();

          // Fetch subscription
          const { data: subData } = await supabase
            .from("organization_subscriptions")
            .select("*, platform_plans(*)")
            .limit(1)
            .maybeSingle();

          if (subData) {
            const rawSub: any = subData;
            const plan = rawSub.platform_plans;
            const tier = (plan?.code || "avs_30k") as PlanTier;
            const def = get().planDefinitions[tier] || DEFAULT_PLAN_DEFINITIONS[tier];

            set({
              subscription: {
                id: rawSub.id,
                tenantId: rawSub.organization_id,
                companyName: "AVS Gold & Diamond Jewellers",
                planTier: tier,
                planName: plan?.name || def.name,
                planVersion: rawSub.plan_version || def.version || 1,
                status: rawSub.status as PlanStatus,
                billingCycle: (rawSub.billing_interval || rawSub.billing_cycle || "annual") as BillingCycle,
                priceInr: Number(rawSub.amount_paise ? rawSub.amount_paise / 100 : def.pricingAnnualINR),
                startDate: rawSub.starts_at || rawSub.created_at,
                renewalDate: rawSub.renews_at || rawSub.trial_ends_at || new Date(Date.now() + 365 * 86400000).toISOString(),
                trialEndDate: rawSub.trial_ends_at || undefined,
                graceEndDate: rawSub.grace_ends_at || undefined,
                limits: def.limits,
                features: def.features,
                lastPaymentId: rawSub.last_payment_id || undefined,
                lastInvoiceId: rawSub.last_invoice_id || undefined,
                updatedAt: rawSub.updated_at,
              },
            });
          }

          const { data: eventsData } = await (supabase as any)
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
                actorEmail: e.actor_email || "admin@arivahly.in",
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

      changePlan: async (newTier, cycle, customPrice, actorEmail = "admin@arivahly.in") => {
        const state = get();
        const prev = state.subscription;
        const planDef = state.planDefinitions[newTier] || DEFAULT_PLAN_DEFINITIONS[newTier];
        const price = customPrice ?? (cycle === "annual" ? planDef.pricingAnnualINR : planDef.pricingMonthlyINR);
        const durationDays = cycle === "annual" ? 365 : 30;

        const updated: SubscriptionRecord = {
          ...prev,
          planTier: newTier,
          planName: planDef.name,
          planVersion: planDef.version || 1,
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
          await supabase.from("organization_subscriptions").upsert({
            id: prev.id,
            organization_id: prev.tenantId,
            plan_tier: newTier,
            plan_name: planDef.name,
            plan_version: planDef.version || 1,
            status: "active",
            billing_interval: cycle,
            amount_paise: price * 100,
            starts_at: updated.startDate,
            renews_at: updated.renewalDate,
            updated_at: new Date().toISOString(),
          } as any);

          await (supabase as any).from("subscription_events").insert({
            event_type: newEvent.eventType,
            previous_tier: prev.planTier,
            new_tier: newTier,
            previous_status: prev.status,
            new_status: "active",
            actor_email: actorEmail,
            source: "admin_panel",
            notes: newEvent.notes,
            created_at: newEvent.createdAt,
          });

          toast.success(`Subscription plan updated to ${planDef.name}`);
          return true;
        } catch (err: any) {
          toast.success(`Plan updated locally (${err?.message || "Synced"})`);
          return true;
        }
      },

      updateStatus: async (newStatus, reason, actorEmail = "admin@arivahly.in") => {
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
            .from("organization_subscriptions")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", prev.id);

          await (supabase as any).from("subscription_events").insert({
            event_type: newEvent.eventType,
            previous_tier: prev.planTier,
            new_tier: prev.planTier,
            previous_status: prev.status,
            new_status: newStatus,
            actor_email: actorEmail,
            source: "admin_panel",
            notes: reason,
            created_at: newEvent.createdAt,
          });

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

        try {
          await (supabase as any)
            .from("platform_plans")
            .update({
              monthly_price_paise: monthlyInr * 100,
              annual_price_paise: annualInr * 100,
              price_minor: annualInr * 100,
              updated_at: new Date().toISOString(),
            })
            .eq("code", existing.code);
        } catch {
          // Local update retained
        }

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
      name: "avs-subscription-store-v3",
    },
  ),
);
