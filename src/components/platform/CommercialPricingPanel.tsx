/**
 * Platform Owner — Commercial Pricing (products, fees, plan versions)
 */
import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/app-info";
import { Panel } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCommercialPricingStore,
  type CommercialFeeType,
} from "@/lib/comm/platform/commercial-pricing-store";
import { DEFAULT_AVS_PRODUCT, type AvsProductId } from "@/lib/comm/platform/communication-events";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

const FEE_TYPES: CommercialFeeType[] = [
  "setup",
  "annual_integration",
  "annual_management",
  "whatsapp_managed",
  "whatsapp_external_bsp",
  "amc",
  "support",
  "migration",
  "training",
  "custom",
];

export function CommercialPricingPanel() {
  const { fees, planVersions, loading, hydrate, upsertFee } = useCommercialPricingStore();
  const [productId, setProductId] = useState<AvsProductId>(DEFAULT_AVS_PRODUCT);
  const [plans, setPlans] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [feeCode, setFeeCode] = useState("whatsapp_external_bsp_annual");
  const [feeName, setFeeName] = useState("WhatsApp External BSP Annual Integration");
  const [feeType, setFeeType] = useState<CommercialFeeType>("whatsapp_external_bsp");
  const [amountInr, setAmountInr] = useState("");

  useEffect(() => {
    void hydrate(productId);
    void supabase
      .from("platform_plans" as never)
      .select("id,name,code")
      .then(({ data }) => setPlans((data ?? []) as typeof plans));
  }, [hydrate, productId]);

  async function handleSaveFee() {
    const paise = Math.round(Number(amountInr || "0") * 100);
    await upsertFee({
      productId,
      feeCode,
      feeName,
      feeType,
      amountPaise: paise,
      billingCycle: feeType.includes("annual") ? "annual" : "one_time",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      planEligibility: [],
      isActive: true,
    });
    toast.success("Commercial fee saved");
    setAmountInr("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gold">Commercial Pricing</h2>
        <p className="text-xs text-muted-foreground">
          Configure setup fees, AMC, WhatsApp managed/external BSP fees, and effective-dated plan
          versions. No hardcoded prices — existing contracts use their locked version.
        </p>
      </div>

      <Panel title="Product">
        <Select value={productId} onValueChange={(v) => setProductId(v as AvsProductId)}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ORNEXA">{APP_NAME}</SelectItem>
            <SelectItem value="RESTAURANT_POS">Restaurant POS</SelectItem>
            <SelectItem value="ACCOUNTING_ERP">Accounting ERP</SelectItem>
            <SelectItem value="INVENTORY_ERP">Inventory ERP</SelectItem>
          </SelectContent>
        </Select>
      </Panel>

      <Panel
        title="Add / Update Fee"
        description="Platform-configurable commercial line items for invoicing."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Fee Code</Label>
            <Input value={feeCode} onChange={(e) => setFeeCode(e.target.value)} className="h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Fee Name</Label>
            <Input value={feeName} onChange={(e) => setFeeName(e.target.value)} className="h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Fee Type</Label>
            <Select value={feeType} onValueChange={(v) => setFeeType(v as CommercialFeeType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Amount (INR)</Label>
            <Input
              type="number"
              value={amountInr}
              onChange={(e) => setAmountInr(e.target.value)}
              className="h-9"
              placeholder="0"
            />
          </div>
        </div>
        <Button size="sm" className="mt-3" onClick={() => void handleSaveFee()}>
          Save Fee
        </Button>
      </Panel>

      <Panel title="Active Fees">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        <ul className="divide-y divide-border text-sm">
          {fees.map((f) => (
            <li key={f.id} className="py-2 flex justify-between gap-2">
              <div>
                <p className="font-medium">{f.feeName}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {f.feeCode} · {f.feeType} · from {f.effectiveFrom}
                </p>
              </div>
              <span className="font-mono">₹{(f.amountPaise / 100).toLocaleString("en-IN")}</span>
            </li>
          ))}
          {fees.length === 0 && !loading && (
            <li className="py-4 text-xs text-muted-foreground">
              No fees configured for this product.
            </li>
          )}
        </ul>
      </Panel>

      <Panel
        title="Plan Versions"
        description={`${plans.length} platform plans · ${planVersions.length} version rows`}
      >
        <ul className="divide-y divide-border text-xs">
          {planVersions.map((v) => (
            <li key={v.id} className="py-2 flex justify-between">
              <span>
                Plan {v.planId.slice(0, 8)} v{v.versionNumber} · WA: {v.whatsappEligibility}
              </span>
              <span className="font-mono">
                ₹{(v.priceMonthlyPaise / 100).toLocaleString("en-IN")}/mo
              </span>
            </li>
          ))}
          {planVersions.length === 0 && (
            <li className="py-4 text-muted-foreground">
              Publish plan versions from Plan Builder with effective dates.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
