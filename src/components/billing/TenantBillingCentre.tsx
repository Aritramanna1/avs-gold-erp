/**
 * Tenant Billing Centre — premium SaaS subscription & payments experience.
 * Test Mode ready: no raw API details exposed to customers.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/design-system/Panel";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { PaymentCheckoutCard } from "@/components/billing/RazorpayCheckout";
import { PaymentResultBanner } from "@/components/billing/PaymentResultBanner";
import { CreditsTab } from "@/components/settings/CreditsTab";
import {
  resolveSubscriptionAccess,
  useSubscriptionAccess,
} from "@/lib/identity/subscription-access-service";
import {
  createPaymentLink,
  fetchPaymentConfiguration,
  fetchPurchasablePlans,
  fetchTenantInvoices,
  fetchTenantPayments,
  fetchTenantPaymentLinks,
  fetchTenantReceipts,
  startInvoicePayment,
  startPlanPurchase,
  type PlatformInvoiceRow,
  type PurchasablePlan,
} from "@/lib/platform-payments/platform-payment-service";
import { usePaymentConfirmation } from "@/hooks/use-payment-confirmation";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Copy,
  CreditCard,
  FileText,
  History,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

type CheckoutSession = {
  orderId: string;
  amountPaise: number;
  keyId: string;
  invoiceId?: string;
  invoiceNo?: string;
  title: string;
  subtitle?: string;
  confirmTarget: { kind: "subscription" } | { kind: "invoice"; invoiceId: string };
};

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function invoiceStatusTone(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  const s = status.toLowerCase();
  if (s === "paid") return "success";
  if (s === "partially_paid" || s === "sent") return "warning";
  if (s === "overdue" || s === "cancelled") return "danger";
  return "neutral";
}

function paymentStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const s = status.toUpperCase();
  if (s === "CAPTURED" || s === "PAID") return "success";
  if (s === "PENDING" || s === "AUTHORIZED") return "warning";
  if (s === "FAILED" || s === "REFUNDED") return "danger";
  return "neutral";
}

function friendlyItemType(itemType: string | null): string {
  if (!itemType) return "Platform services";
  const map: Record<string, string> = {
    licence: "Subscription",
    license: "Subscription",
    credit_topup: "Credit top-up",
    amc: "AMC / Renewal",
    addon: "Add-on",
  };
  return map[itemType.toLowerCase()] ?? "Platform services";
}

function subscriptionStatusTone(status: string): "success" | "warning" | "danger" | "brand" {
  if (status === "ACTIVE") return "success";
  if (status.startsWith("TRIAL") || status === "GRACE_PERIOD") return "warning";
  return "danger";
}

export function TenantBillingCentre() {
  const {
    checking,
    status,
    message,
    edition,
    planName,
    planCode,
    trialEndsAt,
    expiry,
    daysRemaining,
    features,
  } = useSubscriptionAccess();

  const [plans, setPlans] = useState<PurchasablePlan[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoiceRow[]>([]);
  const [receipts, setReceipts] = useState<Awaited<ReturnType<typeof fetchTenantReceipts>>>([]);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof fetchTenantPayments>>>([]);
  const [paymentLinks, setPaymentLinks] = useState<
    Awaited<ReturnType<typeof fetchTenantPaymentLinks>>
  >([]);
  const [payConfig, setPayConfig] =
    useState<Awaited<ReturnType<typeof fetchPaymentConfiguration>>>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const {
    state: payState,
    message: payMessage,
    waitForConfirmation,
    markFailed,
    reset,
  } = usePaymentConfirmation();

  const load = useCallback(async () => {
    setLoading(true);
    const [p, inv, rcpt, pay, links, cfg] = await Promise.all([
      fetchPurchasablePlans(),
      fetchTenantInvoices(),
      fetchTenantReceipts(),
      fetchTenantPayments(),
      fetchTenantPaymentLinks(),
      fetchPaymentConfiguration(),
    ]);
    setPlans(p);
    setInvoices(inv);
    setReceipts(rcpt);
    setPayments(pay);
    setPaymentLinks(links);
    setPayConfig(cfg);
    setLoading(false);
  }, []);

  useEffect(() => {
    void resolveSubscriptionAccess();
    void load();
  }, [load]);

  const enabledFeatures = useMemo(
    () =>
      Object.entries(features)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [features],
  );

  const showPurchase =
    status === "TRIAL_ACTIVE" ||
    status === "TRIAL_EXPIRING" ||
    status === "EXPIRED" ||
    status === "GRACE_PERIOD" ||
    status === "SUSPENDED" ||
    status === "ACTIVE";

  const amcInvoices = invoices.filter(
    (i) => i.itemType?.toLowerCase() === "amc" && i.balancePaise > 0,
  );
  const openInvoices = invoices.filter((i) => i.balancePaise > 0 && i.status !== "paid");

  async function handleBuyPlan(plan: PurchasablePlan) {
    if (plan.pricePaise <= 0) {
      toast.error("This plan is not available for online purchase. Contact support.");
      return;
    }
    setSelectedPlan(plan.code);
    setActionLoading(true);
    const result = await startPlanPurchase(plan.code);
    setActionLoading(false);
    if (!result.ok || !result.orderId || !result.keyId) {
      toast.error(result.error ?? "Could not start checkout");
      return;
    }
    setCheckout({
      orderId: result.orderId,
      amountPaise: result.amountPaise ?? plan.pricePaise,
      keyId: result.keyId,
      invoiceId: result.invoiceId,
      title: plan.name,
      subtitle: plan.description ?? "Annual subscription for your business",
      confirmTarget: { kind: "subscription" },
    });
    void load();
  }

  async function handlePayInvoice(inv: PlatformInvoiceRow) {
    setActionLoading(true);
    const result = await startInvoicePayment(inv.id, inv.balancePaise);
    setActionLoading(false);
    if (!result.ok || !result.orderId || !result.keyId) {
      toast.error(result.error ?? "Could not start checkout");
      return;
    }
    setCheckout({
      orderId: result.orderId,
      amountPaise: result.amountPaise ?? inv.balancePaise,
      keyId: result.keyId,
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      title: friendlyItemType(inv.itemType),
      subtitle: `Invoice ${inv.invoiceNo}`,
      confirmTarget: { kind: "invoice", invoiceId: inv.id },
    });
  }

  async function handlePaymentLink(inv: PlatformInvoiceRow) {
    const result = await createPaymentLink(inv.id);
    if (!result.ok || !result.shortUrl) {
      toast.error(result.error ?? "Could not create payment link");
      return;
    }
    await navigator.clipboard.writeText(result.shortUrl);
    toast.success("Payment link copied — share with your accounts team");
    void load();
  }

  async function onCheckoutSuccess() {
    if (!checkout) return;
    reset();
    await waitForConfirmation(checkout.confirmTarget);
    setCheckout(null);
    setSelectedPlan(null);
    await resolveSubscriptionAccess();
    void load();
  }

  function onCheckoutFailure(reason?: string) {
    markFailed(reason);
  }

  if (checking && loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
        Loading billing…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tenant-billing-centre">
      {/* Hero subscription card */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-gold/5 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={status.replace(/_/g, " ")}
                tone={subscriptionStatusTone(status)}
                dot
              />
              {payConfig?.environment === "test" ? (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                  Demo test mode
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-xl font-serif font-semibold text-foreground">
                {planName ?? edition ?? "Your Ornexa plan"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                {message ??
                  "Manage subscription, invoices, receipts, and usage credits in one place."}
              </p>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Plan</dt>
                <dd className="font-medium mt-0.5">{planCode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {status.startsWith("TRIAL") ? "Trial ends" : "Renewal"}
                </dt>
                <dd className="font-medium mt-0.5">
                  {status.startsWith("TRIAL") && trialEndsAt
                    ? fmtDate(new Date(trialEndsAt).toISOString())
                    : expiry
                      ? fmtDate(new Date(expiry).toISOString())
                      : "—"}
                  {daysRemaining != null ? ` · ${daysRemaining}d` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Open invoices
                </dt>
                <dd className="font-medium mt-0.5">{openInvoices.length}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Payments
                </dt>
                <dd className="font-medium mt-0.5">{payments.length}</dd>
              </div>
            </dl>
            {enabledFeatures.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {enabledFeatures.slice(0, 6).map((f) => (
                  <Badge key={f} variant="secondary" className="text-[10px] font-normal">
                    {f.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5" asChild>
              <a href="mailto:support@avsjewellers.com">
                <ShieldCheck className="h-3.5 w-3.5" /> Contact support
              </a>
            </Button>
          </div>
        </div>
      </div>

      <PaymentResultBanner
        state={payState}
        message={payMessage}
        onDismiss={reset}
        onRetry={() => checkout && void onCheckoutSuccess()}
      />

      {checkout ? (
        <PaymentCheckoutCard
          title={checkout.title}
          subtitle={checkout.subtitle}
          amountPaise={checkout.amountPaise}
          orderId={checkout.orderId}
          keyId={checkout.keyId}
          invoiceNo={checkout.invoiceNo}
          testMode={payConfig?.environment === "test"}
          onSuccess={() => void onCheckoutSuccess()}
          onFailure={onCheckoutFailure}
          onDismiss={() => setCheckout(null)}
          onCancel={() => setCheckout(null)}
        />
      ) : null}

      {amcInvoices.length > 0 && !checkout ? (
        <Panel
          title="AMC & renewal"
          description="Keep your subscription current with annual maintenance."
          variant="muted"
        >
          <div className="space-y-2">
            {amcInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-3"
              >
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-5 w-5 text-gold shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNo}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {rupees(inv.balancePaise)} · {fmtDate(inv.createdAt)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => void handlePayInvoice(inv)}
                >
                  Renew now
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="plans" className="text-xs gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Plans
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs gap-1">
            <FileText className="h-3.5 w-3.5" /> Invoices
          </TabsTrigger>
          <TabsTrigger value="receipts" className="text-xs gap-1">
            <CreditCard className="h-3.5 w-3.5" /> Receipts
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1">
            <History className="h-3.5 w-3.5" /> History
          </TabsTrigger>
          <TabsTrigger value="credits" className="text-xs gap-1">
            <Wallet className="h-3.5 w-3.5" /> Credits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          {showPurchase ? (
            <Panel
              title={status.startsWith("TRIAL") ? "Choose your plan" : "Upgrade or renew"}
              description={
                status.startsWith("TRIAL")
                  ? "Convert your trial without losing data. Payment activates entitlements automatically."
                  : "Select a plan to renew or upgrade your subscription."
              }
            >
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Plans are being configured. Please contact support or try again shortly.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.map((plan) => {
                    const selected = selectedPlan === plan.code;
                    const isPopular = plan.billingCycle === "yearly" || plan.code.includes("pro");
                    return (
                      <div
                        key={plan.code}
                        className={`relative rounded-xl border p-5 flex flex-col transition-all ${
                          selected
                            ? "border-gold bg-gold/5 shadow-md ring-1 ring-gold/30"
                            : "border-border bg-card hover:border-gold/40 hover:shadow-sm"
                        }`}
                      >
                        {isPopular ? (
                          <Badge className="absolute -top-2 right-3 text-[9px] bg-gold text-background">
                            Popular
                          </Badge>
                        ) : null}
                        <h3 className="font-semibold text-base">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 flex-1 line-clamp-3">
                          {plan.description ??
                            "Full manufacturing ERP for your jewellery business."}
                        </p>
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-2xl font-bold font-mono text-gold">
                            {plan.pricePaise > 0 ? rupees(plan.pricePaise) : "Contact us"}
                          </p>
                          {plan.billingCycle ? (
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                              per {plan.billingCycle}
                            </p>
                          ) : null}
                        </div>
                        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500" /> All core ERP modules
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500" /> Secure cloud backup
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500" /> Priority support
                          </li>
                        </ul>
                        <Button
                          className="mt-4 w-full gap-1"
                          variant={selected ? "default" : "outline"}
                          disabled={actionLoading || plan.pricePaise <= 0 || !!checkout}
                          onClick={() => void handleBuyPlan(plan)}
                        >
                          {selected ? "Selected" : "Select plan"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          ) : (
            <Panel title="Your subscription is active" variant="muted">
              <p className="text-sm text-muted-foreground">
                You are on <strong>{planName}</strong>. Visit the Invoices tab for billing history
                or Credits to top up AI and WhatsApp usage.
              </p>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="invoices">
          <Panel title="Invoices" description="View and pay platform invoices.">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left py-2.5 px-3 font-medium">Invoice</th>
                      <th className="text-left py-2.5 px-3 font-medium">Type</th>
                      <th className="text-left py-2.5 px-3 font-medium">Date</th>
                      <th className="text-right py-2.5 px-3 font-medium">Amount</th>
                      <th className="text-center py-2.5 px-3 font-medium">Status</th>
                      <th className="text-right py-2.5 px-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-mono text-xs font-medium">
                          {inv.invoiceNo}
                        </td>
                        <td className="py-2.5 px-3 text-xs">{friendlyItemType(inv.itemType)}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {fmtDate(inv.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">
                          {rupees(inv.totalPaise)}
                          {inv.balancePaise > 0 && inv.balancePaise < inv.totalPaise ? (
                            <span className="block text-[10px] text-amber-600">
                              due {rupees(inv.balancePaise)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge label={inv.status} tone={invoiceStatusTone(inv.status)} />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex justify-end gap-1">
                            {inv.balancePaise > 0 && inv.status !== "paid" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs"
                                  disabled={actionLoading || !!checkout}
                                  onClick={() => void handlePayInvoice(inv)}
                                >
                                  Pay
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  disabled={actionLoading}
                                  onClick={() => void handlePaymentLink(inv)}
                                >
                                  <Link2 className="h-3 w-3" /> Link
                                </Button>
                              </>
                            ) : (
                              <span className="text-[10px] text-muted-foreground px-2">Paid</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {paymentLinks.length > 0 ? (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active payment links
                </p>
                {paymentLinks.slice(0, 5).map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between gap-2 text-xs rounded-md border p-2 bg-muted/20"
                  >
                    <span className="truncate text-muted-foreground">{link.shortUrl}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(link.shortUrl);
                        toast.success("Link copied");
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
        </TabsContent>

        <TabsContent value="receipts">
          <Panel title="Receipts" description="Payment confirmations for your records.">
            {receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Receipts appear here after successful payments.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left py-2.5 px-3">Receipt</th>
                      <th className="text-left py-2.5 px-3">Method</th>
                      <th className="text-left py-2.5 px-3">Date</th>
                      <th className="text-right py-2.5 px-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {receipts.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-mono text-xs">{r.receiptNo}</td>
                        <td className="py-2.5 px-3 text-xs capitalize">
                          {r.paymentMethod.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {fmtDate(r.issuedAt)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-emerald-600">
                          {rupees(r.amountPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="history">
          <Panel title="Payment history" description="All recorded transactions for your business.">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No payments recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left py-2.5 px-3">Date</th>
                      <th className="text-left py-2.5 px-3">Method</th>
                      <th className="text-right py-2.5 px-3">Amount</th>
                      <th className="text-center py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {p.capturedAt ? fmtDate(p.capturedAt) : fmtDate(p.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 text-xs capitalize">
                          {p.method?.replace(/_/g, " ") ?? "Online"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">
                          {rupees(p.amountPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge label={p.status} tone={paymentStatusTone(p.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="credits">
          <CreditsTab />
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-center text-muted-foreground">
        Need help with billing?{" "}
        <Link to="/help" className="text-gold hover:underline">
          Visit Training Centre
        </Link>{" "}
        or email support@avsjewellers.com
      </p>
    </div>
  );
}
