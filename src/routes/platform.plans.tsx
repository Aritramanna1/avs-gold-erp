/**
 * Canonical Route: /platform/plans
 * Platform Owner Commercial Plan Builder & Entitlement Configurator
 * Master Reference: docs/MASTER/PLAN_BUILDER_MASTER.md & BUSINESS_PRODUCT_AND_ENTITLEMENT_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  COMMERCIAL_PLANS,
  type CommercialPlanTier,
  type CommercialPlanConfig,
} from "@/lib/saas-entitlements";
import { Layers, ShieldCheck, Check, Smartphone, Monitor, Globe, Plus, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/platform/plans")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Plan Builder · Platform Operations" }] }),
  component: PlatformPlanBuilderPage,
});

function PlatformPlanBuilderPage() {
  const [plans, setPlans] = useState<Record<CommercialPlanTier, CommercialPlanConfig>>(
    COMMERCIAL_PLANS as Record<CommercialPlanTier, CommercialPlanConfig>,
  );
  const [selectedTier, setSelectedTier] = useState<CommercialPlanTier>("growth");
  const currentPlan = plans[selectedTier];

  const handleUpdatePrice = (priceInr: number) => {
    setPlans((prev) => ({
      ...prev,
      [selectedTier]: {
        ...prev[selectedTier],
        pricingMonthlyINR: priceInr,
      },
    }));
  };

  const handleSave = () => {
    toast.success(`Plan ${currentPlan.name} configuration saved to platform catalog.`);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Commercial Plan Builder & Entitlement Configurator"
        subtitle="Manage 5 commercial plan tiers (Basic, Growth, Professional, Scale, Max), dynamic AMC rates, device access surface rules, and quotas."
      />

      {/* Tier Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.keys(plans) as CommercialPlanTier[]).map((tierKey) => {
          const plan = plans[tierKey];
          const isSelected = selectedTier === tierKey;
          return (
            <div
              key={tierKey}
              onClick={() => setSelectedTier(tierKey)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-amber-500 bg-amber-500/10 shadow-sm"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge
                  variant={isSelected ? "default" : "outline"}
                  className="text-[10px] uppercase font-bold"
                >
                  {tierKey}
                </Badge>
                {isSelected && <Check className="h-3.5 w-3.5 text-amber-600" />}
              </div>
              <h3 className="font-bold text-sm text-foreground">{plan.name}</h3>
              <p className="text-lg font-mono font-extrabold text-foreground mt-1">
                ₹{plan.pricingMonthlyINR.toLocaleString("en-IN")}
                <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
              </p>
              <div className="mt-3 text-[11px] text-muted-foreground space-y-1">
                <div>Max Seats: {plan.maxSeats}</div>
                <div>Max Branches: {plan.maxBranches}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Tier Configuration Detail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" />
              Configure {currentPlan.name} ({selectedTier.toUpperCase()})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Base Monthly Price (₹ INR)</Label>
                <Input
                  type="number"
                  value={currentPlan.pricingMonthlyINR}
                  onChange={(e) => handleUpdatePrice(Number(e.target.value) || 0)}
                  className="font-mono text-sm font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Included Base Branches</Label>
                <Input
                  type="number"
                  disabled
                  value={1}
                  className="font-mono text-sm bg-muted text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground">
                  1 Base branch standard across all plans
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max User Seats Included</Label>
                <Input
                  type="number"
                  value={currentPlan.maxSeats}
                  disabled
                  className="font-mono text-sm bg-muted text-muted-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Additional Branch Add-on (₹/mo)</Label>
                <Input type="number" defaultValue={2499} className="font-mono text-sm font-bold" />
              </div>
            </div>

            {/* Device Surface Gating Specification */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Device Access Surface Entitlement Policy
              </h4>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border p-3 flex items-center gap-2 bg-muted/20">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <div>
                    <span className="font-semibold block">client.web</span>
                    <span className="text-[10px] text-muted-foreground">Browser SaaS</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3 flex items-center gap-2 bg-muted/20">
                  <Monitor className="h-4 w-4 text-purple-500" />
                  <div>
                    <span className="font-semibold block">client.desktop</span>
                    <span className="text-[10px] text-muted-foreground">Tauri / Electron</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3 flex items-center gap-2 bg-muted/20">
                  <Smartphone className="h-4 w-4 text-emerald-500" />
                  <div>
                    <span className="font-semibold block">client.mobile</span>
                    <span className="text-[10px] text-muted-foreground">PWA / Native App</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Device entitlement rule:{" "}
                {selectedTier === "basic"
                  ? "Choose 1 surface (Web or Desktop, No Mobile)"
                  : selectedTier === "growth"
                    ? "Choose 1 surface (Web, Desktop, or Mobile)"
                    : selectedTier === "professional" || selectedTier === "scale"
                      ? "Choose 2 surfaces"
                      : "All 3 surfaces included (Web + Desktop + Mobile)"}
                .
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} className="gap-2 text-xs">
                <Save className="h-4 w-4" /> Save Tier Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feature Entitlements Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Included Modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {currentPlan.features.map((feat: string) => (
              <div key={feat} className="flex items-center gap-2 py-1 border-b">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="font-mono text-foreground">{feat}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
