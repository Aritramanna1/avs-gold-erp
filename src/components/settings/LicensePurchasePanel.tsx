/**
 * Tenant license purchase — trial conversion via Razorpay (same tenant preserved).
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fetchTenantInvoices,
  fetchPurchasablePlans,
  startPlanPurchase,
  startInvoicePayment,
  type PurchasablePlan,
} from "@/lib/platform-payments/platform-payment-service";
import { resolveSubscriptionAccess } from "@/lib/identity/subscription-access-service";
import { RazorpayCheckoutButton } from "@/components/billing/RazorpayCheckout";
import { CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSubscriptionAccess } from "@/lib/identity/subscription-access-service";

export function LicensePurchasePanel() {
  const { status, trialEndsAt } = useSubscriptionAccess();
  const [plans, setPlans] = useState<PurchasablePlan[]>([]);
  const [invoices, setInvoices] = useState<Awaited<ReturnType<typeof fetchTenantInvoices>>>([]);
  const [checkout, setCheckout] = useState<{
    orderId: string;
    amountPaise: number;
    keyId: string;
    returnUrl?: string;
    internalPaymentId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setInvoices(await fetchTenantInvoices());
    setPlans(await fetchPurchasablePlans());
  };

  useEffect(() => {
    void load();
  }, []);

  async function handleBuyPlan(planCode: string) {
    setLoading(true);
    const result = await startPlanPurchase(planCode);
    setLoading(false);
    if (!result.ok || !result.orderId || !result.keyId) {
      toast.error(result.error ?? "Could not start purchase");
      return;
    }
    setCheckout({
      orderId: result.orderId,
      amountPaise: result.amountPaise ?? 0,
      keyId: result.keyId,
      returnUrl: result.returnUrl,
      internalPaymentId: result.invoiceId,
    });
    toast.success("Invoice created — complete payment below");
    void load();
  }

  async function handlePayInvoice(inv: (typeof invoices)[number]) {
    setLoading(true);
    const result = await startInvoicePayment(inv.id, inv.balancePaise);
    setLoading(false);
    if (!result.ok || !result.orderId || !result.keyId) {
      toast.error(result.error ?? "Could not create order");
      return;
    }
    setCheckout({
      orderId: result.orderId,
      amountPaise: result.amountPaise ?? 0,
      keyId: result.keyId,
      returnUrl: result.returnUrl,
      internalPaymentId: result.invoiceId,
    });
  }

  async function onPaymentSuccess() {
    setCheckout(null);
    void load();
    // Poll subscription access — webhook may take a few seconds
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const access = await resolveSubscriptionAccess();
      if (access.status === "ACTIVE") {
        toast.success("Subscription activated!");
        return;
      }
    }
    toast.info(
      "Payment received — activation may take a minute. Refresh if status does not update.",
    );
  }

  const daysLeft =
    trialEndsAt != null ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86_400_000)) : null;

  const showPurchase =
    status === "TRIAL_ACTIVE" ||
    status === "TRIAL_EXPIRING" ||
    status === "EXPIRED" ||
    status === "GRACE_PERIOD" ||
    status === "SUSPENDED";

  return (
    <div className="space-y-4">
      {showPurchase && (
        <Card className="p-4 border-gold/30 bg-gold/5">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gold" />
            {status.startsWith("TRIAL") ? "Convert Trial to Paid" : "Renew / Purchase License"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {status.startsWith("TRIAL") && daysLeft != null
              ? `${daysLeft} day(s) left on trial. Payment converts this tenant — no data migration.`
              : "Select a plan and pay via Razorpay. Entitlements activate after verified payment."}
          </p>
          <div className="grid gap-2 mt-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.length === 0 ? (
              <p className="text-xs text-muted-foreground col-span-full">
                No purchasable plans loaded. Platform Owner must configure plans and Razorpay keys.
              </p>
            ) : (
              plans.map((p) => (
                <Button
                  key={p.code}
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col items-start p-3 text-left"
                  disabled={loading}
                  onClick={() => void handleBuyPlan(p.code)}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground font-normal line-clamp-2">
                    {p.description ?? p.code}
                  </span>
                  <span className="text-xs text-gold mt-1 font-mono">
                    {p.pricePaise > 0
                      ? `₹${(p.pricePaise / 100).toLocaleString("en-IN")}`
                      : "Contact sales"}
                    {p.billingCycle ? ` / ${p.billingCycle}` : ""}
                  </span>
                </Button>
              ))
            )}
          </div>
        </Card>
      )}

      {checkout && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">
            Amount: ₹{(checkout.amountPaise / 100).toLocaleString("en-IN")}
          </p>
          <RazorpayCheckoutButton
            orderId={checkout.orderId}
            amountPaise={checkout.amountPaise}
            keyId={checkout.keyId}
            returnUrl={checkout.returnUrl}
            internalPaymentId={checkout.internalPaymentId}
            onSuccess={() => void onPaymentSuccess()}
          />
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Platform Invoices</h3>
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => void load()}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">No platform invoices yet.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs border border-border rounded-md p-2"
              >
                <div>
                  <span className="font-mono font-medium">{inv.invoiceNo}</span>
                  <Badge variant="outline" className="ml-2 text-[9px]">
                    {inv.status}
                  </Badge>
                  <p className="text-muted-foreground mt-0.5">
                    ₹{(inv.totalPaise / 100).toLocaleString("en-IN")}
                    {inv.balancePaise > 0 && inv.balancePaise < inv.totalPaise
                      ? ` · due ₹${(inv.balancePaise / 100).toLocaleString("en-IN")}`
                      : ""}
                  </p>
                </div>
                {inv.balancePaise > 0 && inv.status !== "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void handlePayInvoice(inv)}
                  >
                    Pay
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
