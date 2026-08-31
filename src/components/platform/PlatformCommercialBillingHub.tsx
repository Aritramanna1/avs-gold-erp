/**
 * Platform Owner — Razorpay billing hub: invoices, payments, cash, settlements.
 */
import { useCallback, useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchAllPlatformInvoices,
  fetchPlatformPayments,
  fetchCashCollections,
  fetchSettlements,
  fetchTenantReceipts,
  proposeCashCollection,
  confirmCashCollection,
  createPaymentLink,
  createCommercialInvoice,
  recordPlatformRefund,
  fetchPaymentConfiguration,
  updatePaymentConfiguration,
  type AdminPlatformInvoiceRow,
} from "@/lib/platform-payments/platform-payment-service";
import { toast } from "sonner";
import { Banknote, CreditCard, FileText, Link2, Loader2, RefreshCw, Wallet } from "lucide-react";

type FirmOption = { id: string; name: string };

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export function PlatformCommercialBillingHub({ firms }: { firms: FirmOption[] }) {
  const [invoices, setInvoices] = useState<AdminPlatformInvoiceRow[]>([]);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof fetchPlatformPayments>>>([]);
  const [cashRows, setCashRows] = useState<Awaited<ReturnType<typeof fetchCashCollections>>>([]);
  const [settlements, setSettlements] = useState<Awaited<ReturnType<typeof fetchSettlements>>>([]);
  const [receipts, setReceipts] = useState<Awaited<ReturnType<typeof fetchTenantReceipts>>>([]);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<Awaited<ReturnType<typeof fetchPaymentConfiguration>>>(null);

  const [cashFirmId, setCashFirmId] = useState(firms[0]?.id ?? "");
  const [cashInvoiceId, setCashInvoiceId] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashLocation, setCashLocation] = useState("Ichalkaranji");
  const [cashCollector, setCashCollector] = useState("");
  const [cashReceiptNo, setCashReceiptNo] = useState("");
  const [cashNotes, setCashNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [policyLocations, setPolicyLocations] = useState("Ichalkaranji, Kolhapur");
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [inv, pay, cash, sett, rcpt, cfg] = await Promise.all([
      fetchAllPlatformInvoices(),
      fetchPlatformPayments(),
      fetchCashCollections(),
      fetchSettlements(),
      fetchTenantReceipts(),
      fetchPaymentConfiguration(),
    ]);
    setInvoices(inv);
    setPayments(pay);
    setCashRows(cash);
    setSettlements(sett);
    setReceipts(rcpt);
    setPolicy(cfg);
    if (cfg) setPolicyLocations(cfg.cashAllowedLocations.join(", "));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firmInvoices = invoices.filter((i) => i.firmId === cashFirmId && i.balancePaise > 0);

  async function handleProposeCash() {
    const amountPaise = Math.round((parseFloat(cashAmount) || 0) * 100);
    if (!cashFirmId || !cashInvoiceId || amountPaise <= 0 || !cashCollector.trim()) {
      toast.error("Firm, invoice, amount, and collector are required");
      return;
    }
    const result = await proposeCashCollection({
      firmId: cashFirmId,
      platformInvoiceId: cashInvoiceId,
      amountPaise,
      collectionLocation: cashLocation.trim(),
      collector: cashCollector.trim(),
      receiptNo: cashReceiptNo.trim() || undefined,
      notes: cashNotes.trim() || undefined,
    });
    if (!result.ok) {
      toast.error(result.error ?? "Could not propose cash collection");
      return;
    }
    const needsOverride = (result as { requires_override?: boolean }).requires_override;
    if (needsOverride) {
      toast.warning("Location outside policy — confirm with override reason");
    } else {
      toast.success("Cash collection proposed — confirm to post payment");
    }
    await load();
  }

  async function handleConfirmCash(id: string, needsOverride: boolean) {
    const result = await confirmCashCollection(id, needsOverride ? overrideReason : undefined);
    if (!result.ok) {
      toast.error(result.error ?? "Confirmation failed");
      return;
    }
    toast.success("Cash collection confirmed — payment allocated");
    setOverrideReason("");
    await load();
  }

  async function handlePaymentLink(invoiceId: string) {
    const result = await createPaymentLink(invoiceId);
    if (!result.ok || !result.shortUrl) {
      toast.error(result.error ?? "Could not create payment link");
      return;
    }
    await navigator.clipboard.writeText(result.shortUrl);
    toast.success("Payment link copied to clipboard");
  }

  async function savePolicy() {
    setSavingPolicy(true);
    const locations = policyLocations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = await updatePaymentConfiguration({ cashAllowedLocations: locations });
    setSavingPolicy(false);
    if (!ok) {
      toast.error("Could not save payment policy");
      return;
    }
    toast.success("Cash collection policy saved");
    await load();
  }

  async function issueAmcInvoice() {
    const firm = firms.find((f) => f.id === cashFirmId);
    if (!firm) return;

    let amcPaise = 0;
    try {
      const { data: feeRows } = await supabase
        .from("commercial_product_fees" as never)
        .select("amount_paise")
        .eq("fee_type", "amc")
        .eq("is_active", true)
        .order("effective_from", { ascending: false })
        .limit(1);
      amcPaise = Number((feeRows as { amount_paise?: number }[] | null)?.[0]?.amount_paise ?? 0);
    } catch {
      amcPaise = 0;
    }

    if (amcPaise <= 0) {
      const { data: planVer } = await supabase
        .from("commercial_plan_versions" as never)
        .select("amc_annual_paise")
        .eq("is_published", true)
        .order("version_number", { ascending: false })
        .limit(1);
      amcPaise = Number(
        (planVer as { amc_annual_paise?: number }[] | null)?.[0]?.amc_annual_paise ?? 0,
      );
    }

    if (amcPaise <= 0) {
      toast.error("Configure AMC fee in Commercial Pricing before issuing AMC invoice");
      return;
    }

    const result = await createCommercialInvoice({
      firmId: firm.id,
      billingName: firm.name,
      primaryItemType: "amc",
      lines: [
        {
          itemType: "amc",
          description: "Annual Maintenance Contract renewal",
          quantity: 1,
          unitPricePaise: amcPaise,
          metadata: { months: 12 },
        },
      ],
    });
    if (!result.ok) {
      toast.error(result.error ?? "Invoice failed");
      return;
    }
    toast.success(`AMC invoice draft created at ${rupees(amcPaise)}`);
    await load();
  }

  async function handleRefund(paymentId: string, amountPaise: number) {
    setRefundingId(paymentId);
    const result = await recordPlatformRefund({
      paymentId,
      amountPaise,
      reason: refundReason.trim() || "Platform Owner refund",
    });
    setRefundingId(null);
    if (!result.ok) {
      toast.error(result.error ?? "Refund failed");
      return;
    }
    toast.success("Refund recorded");
    setRefundReason("");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-serif font-bold text-base text-gold flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Platform Payment Engine
          </h3>
          <p className="text-xs text-muted-foreground">
            Invoice → Razorpay / Cash → Webhook → Ledger → Allocation → Receipt → Settlement
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card className="p-4 border-gold/20">
        <h4 className="text-xs font-bold mb-2">Cash Collection Policy (configurable)</h4>
        <p className="text-[10px] text-muted-foreground mb-2">
          Cash is permitted only in approved locations. Elsewhere requires Razorpay or authorized
          override with audit.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-[10px]">Allowed locations (comma-separated)</Label>
            <Input
              value={policyLocations}
              onChange={(e) => setPolicyLocations(e.target.value)}
              className="h-8 text-xs mt-1"
              placeholder="Ichalkaranji, Kolhapur"
            />
          </div>
          <Button size="sm" onClick={() => void savePolicy()} disabled={savingPolicy}>
            {savingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Policy"}
          </Button>
        </div>
        {policy && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Environment:{" "}
            <Badge variant="outline" className="text-[9px]">
              {policy.environment}
            </Badge>{" "}
            · Methods: {policy.enabledMethods.join(", ")}
          </p>
        )}
      </Card>

      <Tabs defaultValue="invoices">
        <TabsList className="h-8">
          <TabsTrigger value="invoices" className="text-xs">
            Invoices
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">
            Payments
          </TabsTrigger>
          <TabsTrigger value="cash" className="text-xs">
            Cash
          </TabsTrigger>
          <TabsTrigger value="settlements" className="text-xs">
            Settlements
          </TabsTrigger>
          <TabsTrigger value="receipts" className="text-xs">
            Receipts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-3">
          {invoices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No platform invoices yet.</p>
          ) : (
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Invoice</th>
                    <th className="p-2 text-left">Tenant</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">Balance</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="p-2 font-mono">{inv.invoiceNo}</td>
                      <td className="p-2">{inv.firmName ?? inv.firmId.slice(0, 8)}</td>
                      <td className="p-2">{inv.itemType ?? "—"}</td>
                      <td className="p-2 text-right">{rupees(inv.totalPaise)}</td>
                      <td className="p-2 text-right">{rupees(inv.balancePaise)}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-[9px]">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {inv.balancePaise > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => void handlePaymentLink(inv.id)}
                          >
                            <Link2 className="h-3 w-3" /> Link
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-3">
          {payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Method</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Razorpay ID</th>
                    <th className="p-2 text-left">Captured</th>
                    <th className="p-2 text-left">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2">{p.method ?? "—"}</td>
                      <td className="p-2 text-right">{rupees(p.amountPaise)}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-[9px]">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono text-[10px]">{p.razorpayPaymentId ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">
                        {p.capturedAt ? new Date(p.capturedAt).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="p-2">
                        {p.status === "CAPTURED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            disabled={refundingId === p.id}
                            onClick={() => void handleRefund(p.id, p.amountPaise)}
                          >
                            {refundingId === p.id ? "…" : "Refund"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cash" className="mt-3 space-y-4">
          <Card className="p-4 space-y-3 border-amber-500/20">
            <h4 className="text-xs font-bold flex items-center gap-1">
              <Banknote className="h-4 w-4" /> Record Local Cash Collection
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <label>
                <span className="text-[10px] text-muted-foreground">Tenant</span>
                <select
                  className="mt-1 w-full border rounded p-2 bg-background"
                  value={cashFirmId}
                  onChange={(e) => {
                    setCashFirmId(e.target.value);
                    setCashInvoiceId("");
                  }}
                >
                  {firms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[10px] text-muted-foreground">Invoice (open balance)</span>
                <select
                  className="mt-1 w-full border rounded p-2 bg-background"
                  value={cashInvoiceId}
                  onChange={(e) => setCashInvoiceId(e.target.value)}
                >
                  <option value="">Select invoice</option>
                  {firmInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNo} — due {rupees(inv.balancePaise)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[10px] text-muted-foreground">Amount (₹)</span>
                <Input
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="h-8 mt-1"
                />
              </label>
              <label>
                <span className="text-[10px] text-muted-foreground">Collection location</span>
                <Input
                  value={cashLocation}
                  onChange={(e) => setCashLocation(e.target.value)}
                  className="h-8 mt-1"
                />
              </label>
              <label>
                <span className="text-[10px] text-muted-foreground">Collector (authorized)</span>
                <Input
                  value={cashCollector}
                  onChange={(e) => setCashCollector(e.target.value)}
                  className="h-8 mt-1"
                />
              </label>
              <label>
                <span className="text-[10px] text-muted-foreground">Receipt number</span>
                <Input
                  value={cashReceiptNo}
                  onChange={(e) => setCashReceiptNo(e.target.value)}
                  className="h-8 mt-1"
                />
              </label>
            </div>
            <label className="block text-xs">
              <span className="text-[10px] text-muted-foreground">Notes / proof reference</span>
              <Input
                value={cashNotes}
                onChange={(e) => setCashNotes(e.target.value)}
                className="h-8 mt-1"
              />
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void handleProposeCash()}>
                Propose Cash Collection
              </Button>
              <Button size="sm" variant="outline" onClick={() => void issueAmcInvoice()}>
                Issue AMC Invoice Shell
              </Button>
            </div>
          </Card>

          {cashRows.length > 0 && (
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">Collector</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cashRows.map((c) => {
                    const needsOverride =
                      c.status === "pending" &&
                      policy &&
                      !policy.cashAllowedLocations.some(
                        (loc) => loc.toLowerCase() === c.collectionLocation.toLowerCase(),
                      );
                    return (
                      <tr key={c.id}>
                        <td className="p-2">{c.collectionLocation}</td>
                        <td className="p-2">{c.collector}</td>
                        <td className="p-2 text-right">{rupees(c.amountPaise)}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[9px]">
                            {c.status}
                          </Badge>
                          {needsOverride && (
                            <Badge variant="destructive" className="text-[9px] ml-1">
                              override req.
                            </Badge>
                          )}
                        </td>
                        <td className="p-2">
                          {c.status === "pending" && (
                            <div className="flex flex-col gap-1">
                              {needsOverride && (
                                <Input
                                  placeholder="Override reason (required)"
                                  value={overrideReason}
                                  onChange={(e) => setOverrideReason(e.target.value)}
                                  className="h-7 text-[10px]"
                                />
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                onClick={() => void handleConfirmCash(c.id, Boolean(needsOverride))}
                              >
                                Confirm & Post
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settlements" className="mt-3">
          {settlements.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No Razorpay settlements yet (webhook: settlement.processed).
            </p>
          ) : (
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Settlement ID</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-right">Fees</th>
                    <th className="p-2 text-left">UTR</th>
                    <th className="p-2 text-left">Settled</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {settlements.map((s) => (
                    <tr key={s.id}>
                      <td className="p-2 font-mono text-[10px]">{s.razorpaySettlementId}</td>
                      <td className="p-2 text-right">{rupees(s.amountPaise)}</td>
                      <td className="p-2 text-right">{rupees(s.feesPaise)}</td>
                      <td className="p-2">{s.utr ?? "—"}</td>
                      <td className="p-2">
                        {s.settledAt ? new Date(s.settledAt).toLocaleString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="receipts" className="mt-3">
          {receipts.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Receipts appear after successful payment
              allocation.
            </p>
          ) : (
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Receipt</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Method</th>
                    <th className="p-2 text-left">Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 font-mono">{r.receiptNo}</td>
                      <td className="p-2 text-right">{rupees(r.amountPaise)}</td>
                      <td className="p-2">{r.paymentMethod}</td>
                      <td className="p-2">{new Date(r.issuedAt).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Wallet className="h-3 w-3" />
        Legacy <code>platform_billing_documents</code> remains for GST print; new commercial flows
        use <code>platform_invoices</code> + Razorpay.
      </p>
    </div>
  );
}
