/**
 * Canonical Route: /platform/plans
 * Platform Owner — Central Plan Configuration & Entitlement Manager
 * Single source of truth for platform subscription plans, pricing, limits, and features.
 */
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { guardRoute } from "@/lib/permissions";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Check,
  Plus,
  Save,
  Search,
  RefreshCw,
  Edit2,
  Copy,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { useCommercialPricingStore } from "@/lib/comm/platform/commercial-pricing-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import { PlatformAddonsManager } from "@/components/platform/PlatformAddonsManager";
import { PlatformPlanVerification } from "@/components/platform/PlatformPlanVerification";

export const Route = createFileRoute("/platform/plans")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "plans",
    filter: typeof search.filter === "string" ? search.filter : "all",
  }),
  head: () => ({ meta: [{ title: "Central Plan Configuration · Platform Owner" }] }),
  component: PlatformPlanBuilderPage,
});

export interface PlatformPlanRecord {
  id: string;
  code: string;
  edition_code: string | null;
  name: string;
  description: string | null;
  billing_cycle: string;
  price_minor: number;
  branch_limit: number | null;
  user_limit: number | null;
  workshop_limit: number | null;
  storage_limit_bytes: number | null;
  feature_limits: Record<string, any>;
  commercial_config: Record<string, any>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const AVAILABLE_MODULE_FEATURES = [
  { key: "business.core", label: "Business Core & Masters", category: "Core" },
  { key: "business.orders", label: "Custom Orders & Approvals", category: "Core" },
  { key: "business.workshop", label: "Workshop & Job Cards", category: "Manufacturing" },
  { key: "business.workshop_full", label: "Advanced Workshop & Multi-Stage Melt", category: "Manufacturing" },
  { key: "business.karigar_portal", label: "Karigar Artisan Portal & Settlements", category: "Manufacturing" },
  { key: "business.inventory", label: "Inventory & Stock Valuations", category: "Inventory" },
  { key: "business.barcode", label: "Barcode Tagging & Scanning", category: "Inventory" },
  { key: "business.barcode_tagging", label: "Hallmark & HUID Tracking", category: "Inventory" },
  { key: "business.billing_basic", label: "Standard Estimates & Invoicing", category: "Billing" },
  { key: "business.billing_full", label: "Comprehensive GST & Tax Invoicing", category: "Billing" },
  { key: "business.billing_gst_einv", label: "E-Way & E-Invoicing Integration", category: "Billing" },
  { key: "business.ledger", label: "Financial Ledgers & Metal Balances", category: "Accounts" },
  { key: "business.gst", label: "Statutory GST Reports (GSTR-1/3B)", category: "Accounts" },
  { key: "business.customer_portal", label: "Customer Order Tracking Portal", category: "Portals" },
  { key: "business.supplier_portal", label: "Supplier Bullion Portal", category: "Portals" },
  { key: "business.whatsapp", label: "Automated WhatsApp & Notifications", category: "Communications" },
  { key: "business.analytics", label: "Advanced Analytics & Profitability", category: "Intelligence" },
  { key: "business.multi_branch", label: "Multi-Branch Sync & Central Vault", category: "Scale" },
  { key: "business.api_webhooks", label: "REST API & Webhooks Integration", category: "Developer" },
  { key: "business.document_hosting", label: "Secure Document & Cloud Hosting", category: "Storage" },
];

const DEFAULT_PLAN_TEMPLATE: Omit<PlatformPlanRecord, "id"> = {
  code: "new_custom_plan",
  edition_code: "new_custom_plan",
  name: "New Enterprise Plan",
  description: "Standard comprehensive jewelry manufacturing ERP subscription.",
  billing_cycle: "monthly",
  price_minor: 250000, // ₹2,500.00
  branch_limit: 1,
  user_limit: 5,
  workshop_limit: 1,
  storage_limit_bytes: 5 * 1024 * 1024 * 1024, // 5 GB
  feature_limits: {
    features: [
      "business.core",
      "business.orders",
      "business.workshop",
      "business.inventory",
      "business.billing_full",
      "business.ledger",
      "business.gst",
      "business.barcode",
    ],
    storage_gb: 5,
    customer_capacity: 5000,
    inventory_capacity: 10000,
  },
  commercial_config: {
    currency: "INR",
    priority: 10,
    annual_discount_percent: 15,
    setup_fee_paise: 0,
    allowed_surfaces: ["client.web", "client.desktop"],
  },
  is_active: true,
};

function PlatformPlanBuilderPage() {
  const routerSearch = useRouterState({
    select: (s) => s.location.search as { tab?: string; filter?: string },
  });
  const filter = routerSearch.filter ?? "all";
  const activeTab = routerSearch.tab ?? "plans";

  const [plans, setPlans] = useState<PlatformPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPlan, setEditingPlan] = useState<PlatformPlanRecord | null>(null);
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState<Omit<PlatformPlanRecord, "id">>(DEFAULT_PLAN_TEMPLATE);
  const [formPriceINR, setFormPriceINR] = useState("2500");
  const [formStorageGB, setFormStorageGB] = useState("5");
  const [saving, setSaving] = useState(false);

  const publishPlanVersion = useCommercialPricingStore((s) => s.publishPlanVersion);
  const hydratePricing = useCommercialPricingStore((s) => s.hydrate);

  async function loadPlans() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("platform_plans")
        .select("*")
        .order("price_minor", { ascending: true });

      if (error) {
        toast.error("Failed to load platform plans: " + error.message);
        return;
      }

      if (data) {
        setPlans(
          (data as any[]).map((row) => ({
            id: row.id,
            code: row.code,
            edition_code: row.edition_code || row.code,
            name: row.name,
            description: row.description || "",
            billing_cycle: row.billing_cycle || "monthly",
            price_minor: Number(row.price_minor || 0),
            branch_limit: row.branch_limit,
            user_limit: row.user_limit,
            workshop_limit: row.workshop_limit,
            storage_limit_bytes: row.storage_limit_bytes,
            feature_limits: (typeof row.feature_limits === "object" && row.feature_limits !== null)
              ? row.feature_limits
              : {},
            commercial_config: (typeof row.commercial_config === "object" && row.commercial_config !== null)
              ? row.commercial_config
              : {},
            is_active: Boolean(row.is_active),
            created_at: row.created_at,
            updated_at: row.updated_at,
          })),
        );
      }
    } catch (err: any) {
      toast.error("Error loading plans: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void hydratePricing();
    void loadPlans();
  }, [hydratePricing]);

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (filter === "active" && !p.is_active) return false;
      if (filter === "inactive" && p.is_active) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [plans, filter, searchQuery]);

  function openCreateModal(template?: Partial<PlatformPlanRecord>) {
    const initial: Omit<PlatformPlanRecord, "id"> = {
      ...DEFAULT_PLAN_TEMPLATE,
      ...template,
      code: template?.code ? `${template.code}_copy` : `plan_${Date.now().toString(36)}`,
      name: template?.name ? `${template.name} (Copy)` : "New Custom Plan",
    };
    setPlanForm(initial);
    setFormPriceINR(String(Math.round((initial.price_minor || 0) / 100)));
    setFormStorageGB(String(initial.feature_limits?.storage_gb || 5));
    setEditingPlan(null);
    setIsNewPlanModalOpen(true);
  }

  function openEditModal(plan: PlatformPlanRecord) {
    setEditingPlan(plan);
    setPlanForm({
      code: plan.code,
      edition_code: plan.edition_code || plan.code,
      name: plan.name,
      description: plan.description || "",
      billing_cycle: plan.billing_cycle || "monthly",
      price_minor: plan.price_minor,
      branch_limit: plan.branch_limit,
      user_limit: plan.user_limit,
      workshop_limit: plan.workshop_limit,
      storage_limit_bytes: plan.storage_limit_bytes,
      feature_limits: plan.feature_limits || {},
      commercial_config: plan.commercial_config || {},
      is_active: plan.is_active,
    });
    setFormPriceINR(String(Math.round((plan.price_minor || 0) / 100)));
    setFormStorageGB(String(plan.feature_limits?.storage_gb || 5));
    setIsNewPlanModalOpen(true);
  }

  async function handleTogglePlanStatus(plan: PlatformPlanRecord) {
    const nextActive = !plan.is_active;
    try {
      const { error } = await supabase
        .from("platform_plans")
        .update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan.id);

      if (error) throw error;
      toast.success(`Plan "${plan.name}" is now ${nextActive ? "ACTIVE" : "INACTIVE"}.`);
      void loadPlans();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  }

  function toggleFeature(featureKey: string) {
    const currentFeatures: string[] = planForm.feature_limits?.features || [];
    const has = currentFeatures.includes(featureKey);
    const nextFeatures = has
      ? currentFeatures.filter((f) => f !== featureKey)
      : [...currentFeatures, featureKey];

    setPlanForm((prev) => ({
      ...prev,
      feature_limits: {
        ...prev.feature_limits,
        features: nextFeatures,
        [featureKey.replace("business.", "")]: !has,
      },
    }));
  }

  async function handleSavePlanForm() {
    if (!planForm.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    if (!planForm.code.trim()) {
      toast.error("Plan code is required");
      return;
    }

    setSaving(true);
    try {
      const cleanCode = planForm.code
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_");

      const priceMinor = Math.round((parseFloat(formPriceINR) || 0) * 100);
      const storageGb = parseFloat(formStorageGB) || 5;

      const payload = {
        code: cleanCode,
        edition_code: cleanCode,
        name: planForm.name.trim(),
        description: planForm.description?.trim() || null,
        billing_cycle: planForm.billing_cycle || "monthly",
        price_minor: priceMinor,
        branch_limit: planForm.branch_limit ? Number(planForm.branch_limit) : null,
        user_limit: planForm.user_limit ? Number(planForm.user_limit) : null,
        workshop_limit: planForm.workshop_limit ? Number(planForm.workshop_limit) : null,
        storage_limit_bytes: Math.round(storageGb * 1024 * 1024 * 1024),
        feature_limits: {
          ...planForm.feature_limits,
          storage_gb: storageGb,
          max_branches: planForm.branch_limit || 1,
          max_users: planForm.user_limit || 5,
        },
        commercial_config: {
          ...planForm.commercial_config,
          currency: planForm.commercial_config?.currency || "INR",
          priority: Number(planForm.commercial_config?.priority || 10),
        },
        is_active: planForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("platform_plans")
          .update(payload)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success(`Plan "${payload.name}" updated successfully.`);
      } else {
        const { error } = await supabase
          .from("platform_plans")
          .insert(payload);

        if (error) throw error;
        toast.success(`New plan "${payload.name}" created.`);
      }

      // Sync with commercial catalog if applicable
      if (editingPlan?.id) {
        try {
          await publishPlanVersion({
            planId: editingPlan.id,
            productId: DEFAULT_AVS_PRODUCT,
            versionNumber: Math.floor(Date.now() / 1000),
            effectiveFrom: new Date().toISOString().slice(0, 10),
            priceMonthlyPaise: priceMinor,
            priceAnnualPaise: priceMinor * 12,
            setupFeePaise: 0,
            amcAnnualPaise: Math.round(priceMinor * 12 * 0.15),
            featureLimits: payload.feature_limits,
            whatsappEligibility: "managed_limited",
            aiEligibility: true,
            isPublished: payload.is_active,
          });
        } catch {
          // Non-blocking sync
        }
      }

      setIsNewPlanModalOpen(false);
      void loadPlans();
    } catch (err: any) {
      toast.error("Failed to save plan: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="Products & Commercial Catalog"
            subtitle="Authoritative platform subscription plans, add-ons, pricing & plan cost verification"
          />
        </div>
        {activeTab === "plans" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPlans()}
              disabled={loading}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              onClick={() => openCreateModal()}
              size="sm"
              className="h-9 gap-1.5 text-xs font-bold bg-gold text-black hover:bg-gold/90 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Create New Plan
            </Button>
          </div>
        )}
      </div>

      {/* Top Level Section Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <a
          href="/platform/plans?tab=plans"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "plans"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-muted/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" /> Subscription Plans
        </a>
        <a
          href="/platform/plans?tab=addons"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "addons"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-muted/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Plus className="h-4 w-4" /> Platform Add-ons
        </a>
        <a
          href="/platform/plans?tab=verification"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "verification"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-muted/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Check className="h-4 w-4" /> Plan Verification & Calculator
        </a>
      </div>

      {activeTab === "addons" && <PlatformAddonsManager />}
      {activeTab === "verification" && <PlatformPlanVerification />}

      {activeTab === "plans" && (
        <>
          {/* Overview Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Total Plans
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">{plans.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Active Plans
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-500">
                  {plans.filter((p) => p.is_active).length}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Inactive Plans
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-muted-foreground">
                  {plans.filter((p) => !p.is_active).length}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Price Range
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-gold">
                  {plans.length > 0
                    ? `₹${Math.round(Math.min(...plans.map((p) => p.price_minor)) / 100)} - ₹${Math.round(
                        Math.max(...plans.map((p) => p.price_minor)) / 100,
                      )}`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plans by name, code, description..."
            className="pl-9 h-9 text-xs bg-background border-border"
          />
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-muted-foreground font-mono">
            Showing {filteredPlans.length} plans
          </span>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPlans.map((plan) => {
          const priceDisplay = (plan.price_minor / 100).toLocaleString("en-IN");
          const currency = plan.commercial_config?.currency || "INR";
          const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
          const includedFeaturesCount = Array.isArray(plan.feature_limits?.features)
            ? plan.feature_limits.features.length
            : Object.values(plan.feature_limits || {}).filter(Boolean).length;

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all border ${
                plan.is_active
                  ? "border-border bg-card shadow-sm hover:border-gold/50"
                  : "border-border/60 bg-muted/20 opacity-80"
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header with status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">{plan.name}</h3>
                      <Badge
                        variant={plan.is_active ? "default" : "secondary"}
                        className={`text-[10px] font-mono uppercase font-bold ${
                          plan.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-gold mt-0.5">{plan.code}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase shrink-0">
                    {plan.billing_cycle}
                  </Badge>
                </div>

                {/* Tagline / Description */}
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                  {plan.description || "No description provided."}
                </p>

                {/* Price Display */}
                <div className="pt-2 border-t border-border flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-mono font-extrabold text-foreground">
                      {currencySymbol}{priceDisplay}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono ml-1">
                      /{plan.billing_cycle === "annual" ? "yr" : "mo"}
                    </span>
                  </div>
                  {plan.commercial_config?.priority != null && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Priority: #{plan.commercial_config.priority}
                    </span>
                  )}
                </div>

                {/* Limits Matrix */}
                <div className="grid grid-cols-3 gap-2 py-2 bg-muted/30 rounded-md p-2 text-center text-xs">
                  <div>
                    <span className="block text-[10px] text-muted-foreground font-mono uppercase">
                      Users
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {plan.user_limit ?? "∞"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground font-mono uppercase">
                      Branches
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {plan.branch_limit ?? "∞"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground font-mono uppercase">
                      Storage
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {plan.feature_limits?.storage_gb
                        ? `${plan.feature_limits.storage_gb} GB`
                        : plan.storage_limit_bytes
                          ? `${Math.round(plan.storage_limit_bytes / (1024 * 1024 * 1024))} GB`
                          : "Standard"}
                    </span>
                  </div>
                </div>

                {/* Features Summary */}
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Included Modules:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {includedFeaturesCount} features
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(plan.feature_limits?.features || []).slice(0, 4).map((feat: string) => (
                      <span
                        key={feat}
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                      >
                        <Check className="h-2.5 w-2.5 text-emerald-500" />
                        {feat.replace("business.", "")}
                      </span>
                    ))}
                    {(plan.feature_limits?.features || []).length > 4 && (
                      <span className="text-[10px] font-mono text-muted-foreground self-center">
                        +{(plan.feature_limits?.features || []).length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTogglePlanStatus(plan)}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    {plan.is_active ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5 text-muted-foreground" /> Deactivate
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5 text-emerald-500" /> Activate
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreateModal(plan)}
                      className="h-8 text-xs font-semibold gap-1 px-2"
                      title="Clone this plan as template"
                    >
                      <Copy className="h-3.5 w-3.5" /> Clone
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(plan)}
                      className="h-8 text-xs font-bold gap-1 bg-gold/10 text-gold border-gold/30 hover:bg-gold/20"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

          {filteredPlans.length === 0 && !loading && (
            <Card className="p-12 text-center border-dashed">
              <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-bold text-base text-foreground">No matching plans found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Try adjusting your search criteria or create a new plan to make it available to tenants.
              </p>
              <Button
                onClick={() => openCreateModal()}
                size="sm"
                className="mt-4 bg-gold text-black font-bold text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Plan
              </Button>
            </Card>
          )}
        </>
      )}

      {/* Modal: Create or Edit Plan */}
      <Dialog open={isNewPlanModalOpen} onOpenChange={setIsNewPlanModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-gold flex items-center gap-2">
              <Layers className="h-5 w-5" />
              {editingPlan ? `Edit Plan: ${editingPlan.name}` : "Create New Subscription Plan"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure commercial pricing, limits, and module entitlements. Active plans will
              instantly become selectable in tenant billing and subscription screens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Plan Display Name *</Label>
                <Input
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="e.g. AVS Manufacturing Pro"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">System Code (Slug) *</Label>
                <Input
                  value={planForm.code}
                  onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
                  placeholder="e.g. avs_manufacturing_pro"
                  className="text-xs h-9 font-mono"
                  disabled={Boolean(editingPlan)}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold">Description / Tagline</Label>
                <Input
                  value={planForm.description || ""}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Short summary of target tier and value proposition"
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Pricing & Billing Cycle */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Billing Frequency</Label>
                <Select
                  value={planForm.billing_cycle}
                  onValueChange={(v) => setPlanForm({ ...planForm, billing_cycle: v })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="half_yearly">Half-Yearly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Price (₹ INR / Standard Unit) *</Label>
                <Input
                  type="number"
                  value={formPriceINR}
                  onChange={(e) => setFormPriceINR(e.target.value)}
                  placeholder="e.g. 2500"
                  className="text-xs h-9 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Currency</Label>
                <Select
                  value={planForm.commercial_config?.currency || "INR"}
                  onValueChange={(v) =>
                    setPlanForm({
                      ...planForm,
                      commercial_config: { ...planForm.commercial_config, currency: v },
                    })
                  }
                >
                  <SelectTrigger className="text-xs h-9 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Display Priority</Label>
                <Input
                  type="number"
                  value={planForm.commercial_config?.priority ?? 10}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      commercial_config: {
                        ...planForm.commercial_config,
                        priority: Number(e.target.value) || 0,
                      },
                    })
                  }
                  placeholder="1, 2, 3..."
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* Capacity & Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Included User Seats</Label>
                <Input
                  type="number"
                  value={planForm.user_limit ?? ""}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      user_limit: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Leave empty for unlimited"
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Empty = unlimited seats</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Included Branch Locations</Label>
                <Input
                  type="number"
                  value={planForm.branch_limit ?? ""}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      branch_limit: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Leave empty for unlimited"
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Empty = unlimited branches</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Cloud Storage (GB)</Label>
                <Input
                  type="number"
                  value={formStorageGB}
                  onChange={(e) => setFormStorageGB(e.target.value)}
                  placeholder="e.g. 5"
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Document and barcode asset quota</p>
              </div>
            </div>

            {/* Included Module Entitlements Checklist */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Included Functional Modules & Entitlements
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Select which business capabilities are enabled when a tenant subscribes to this plan.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {(planForm.feature_limits?.features || []).length} / {AVAILABLE_MODULE_FEATURES.length} Selected
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border rounded-md bg-muted/10">
                {AVAILABLE_MODULE_FEATURES.map((item) => {
                  const isChecked = (planForm.feature_limits?.features || []).includes(item.key);
                  return (
                    <div
                      key={item.key}
                      onClick={() => toggleFeature(item.key)}
                      className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition ${
                        isChecked
                          ? "bg-gold/10 border-gold/40 text-foreground font-semibold"
                          : "border-border/60 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded flex items-center justify-center border text-[10px] ${
                            isChecked
                              ? "bg-gold text-black border-gold font-bold"
                              : "border-border bg-background"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        <div>
                          <span className="block">{item.label}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            {item.key}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono">
                        {item.category}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Plan Status</Label>
                <p className="text-[11px] text-muted-foreground">
                  When active, tenants can view, select and purchase this subscription tier.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold ${planForm.is_active ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {planForm.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
                <Switch
                  checked={planForm.is_active}
                  onCheckedChange={(checked) => setPlanForm({ ...planForm, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNewPlanModalOpen(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSavePlanForm()}
              disabled={saving}
              size="sm"
              className="text-xs font-bold bg-gold text-black hover:bg-gold/90 gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
