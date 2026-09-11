import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePrintEngine } from "@/lib/print-engine";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useBilling,
  PAYMENT_MODE_LABELS,
  INVOICE_STATUS_LABELS,
  paiseToRupees,
  rupeesToPaise,
  type PaymentMode,
} from "@/lib/billing-store";
import { fetchBillingCustomerContact } from "@/lib/billing-query";
import { useBillingInvoiceById } from "@/lib/use-billing-invoice";
import { mgToGrams, getCaratLabel } from "@/lib/gold";
import { fineGoldMgConfigured } from "@/lib/gold-calculation-rules";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Banknote,
  CheckCircle,
  Coins,
  FileText,
  Loader2,
  Printer,
  Receipt,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCan } from "@/lib/rbac";
import { useSettings } from "@/lib/settings-store";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DocCommActions } from "@/components/doc-comm-actions";
import {
  useDeliveryChallans,
  useCreditNotes,
  useDebitNotes,
  type DeliveryChallanItem,
} from "@/lib/billing-documents-store";
import { toast } from "sonner";
import { Truck, PlusCircle, MinusCircle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/billing/$id")({
  head: () => ({ meta: [{ title: "Invoice · AVS Gold ERP" }] }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = useParams({ from: "/billing/$id" });
  const navigate = useNavigate();
  const addPayment = useBilling((s) => s.addPayment);
  const remove = useBilling((s) => s.remove);
  const cancelInvoice = useBilling((s) => s.cancelInvoice);
  const { can, email } = useCan();

  const { firm } = useSettings();
  const {
    invoice: inv,
    loading: loadingInvoice,
    error: invoiceError,
    retry: retryInvoice,
  } = useBillingInvoiceById(id);
  const [customerContact, setCustomerContact] = useState<{ phone?: string; email?: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!inv) {
      setCustomerContact(null);
      return;
    }
    fetchBillingCustomerContact(inv.customerId)
      .then((contact) => {
        if (!cancelled) setCustomerContact(contact);
      })
      .catch(() => {
        if (!cancelled) setCustomerContact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [inv?.customerId]);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  async function handleCancelInvoice() {
    if (!inv || !cancelReason.trim()) {
      toast.error("A reason is required to cancel an invoice.");
      return;
    }
    setCancelling(true);
    try {
      const { data } = await supabase.auth.getSession();
      const result = await cancelInvoice(inv.id, cancelReason.trim(), {
        id: data.session?.user.id ?? null,
        email: data.session?.user.email ?? email ?? null,
      });
      if (result) {
        toast.success("Invoice cancelled — gold ledger entries reversed.");
        setCancelOpen(false);
        setCancelReason("");
      } else {
        toast.error("Invoice was not cancelled — it may already be cancelled.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel invoice.");
    } finally {
      setCancelling(false);
    }
  }

  const [dcDialogOpen, setDcDialogOpen] = useState(false);
  const [dcPurpose, setDcPurpose] = useState<"job_work" | "sale_on_approval" | "transfer" | "other">("job_work");
  const [dcCarrier, setDcCarrier] = useState("");
  const [dcAddress, setDcAddress] = useState("");
  const [generatingDoc, setGeneratingDoc] = useState(false);

  const [dnDialogOpen, setDnDialogOpen] = useState(false);
  const [dnReason, setDnReason] = useState("");
  const [dnAmountRupees, setDnAmountRupees] = useState("");
  const [dnGoldGrams, setDnGoldGrams] = useState("");

  const challans = useDeliveryChallans((s) => s.challans);
  const creditNotes = useCreditNotes((s) => s.notes);
  const debitNotes = useDebitNotes((s) => s.notes);

  useEffect(() => {
    void useDeliveryChallans.getState().refresh?.();
    void useCreditNotes.getState().refresh?.();
    void useDebitNotes.getState().refresh?.();
  }, []);

  const linkedChallans = challans.filter((c) => c.linkedInvoiceId === inv?.id || c.convertedToInvoiceId === inv?.id);
  const linkedCreditNotes = creditNotes.filter((cn) => cn.invoiceId === inv?.id);
  const linkedDebitNotes = debitNotes.filter((dn) => dn.invoiceId === inv?.id);

  async function handleCreateDeliveryChallan() {
    if (!inv) return;
    setGeneratingDoc(true);
    try {
      const items: DeliveryChallanItem[] = inv.items.map((it: any) => ({
        itemName: it.itemName,
        category: it.category || "Jewellery",
        grossMg: it.grossMg || 0,
        netMg: it.netMg || it.grossMg || 0,
        purity: it.purity || 916,
        fineMg: it.fineMg || 0,
        qty: it.qty || 1,
      }));

      const dc = await useDeliveryChallans.getState().create({
        customerId: inv.customerId,
        customerName: inv.customerName,
        items,
        purpose: dcPurpose,
        carrierName: dcCarrier || undefined,
        deliveryAddress: dcAddress || undefined,
        linkedInvoiceId: inv.id,
        linkedInvoiceNo: inv.invoiceNo,
        linkedOrderId: inv.orderId || undefined,
        notes: `Generated from Invoice ${inv.invoiceNo}`,
      });

      toast.success(`Delivery Challan ${dc.challanNo} generated with 2-way lineage.`);
      setDcDialogOpen(false);
      navigate({ to: "/billing/delivery-challans/$id" as any, params: { id: dc.id } as any });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate Delivery Challan");
    } finally {
      setGeneratingDoc(false);
    }
  }

  async function handleCreateDebitNote() {
    if (!inv) return;
    if (!dnReason.trim()) {
      toast.error("Please enter a reason for the Debit Note");
      return;
    }
    const amtPaise = rupeesToPaise(parseFloat(dnAmountRupees) || 0);
    const goldMg = Math.round((parseFloat(dnGoldGrams) || 0) * 1000);
    if (amtPaise <= 0 && goldMg <= 0) {
      toast.error("Please enter an amount or fine gold weight for the adjustment.");
      return;
    }

    setGeneratingDoc(true);
    try {
      const dn = await useDebitNotes.getState().issue(
        {
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          customerId: inv.customerId,
          customerName: inv.customerName,
          amountPaise: amtPaise,
          goldFineMg: goldMg,
          reason: dnReason.trim(),
        },
        { id: email || "owner", email: email || "owner@avserp.local" },
      );

      toast.success(`Debit Note ${dn.debitNoteNo} issued and linked to Invoice.`);
      setDnDialogOpen(false);
      setDnReason("");
      setDnAmountRupees("");
      setDnGoldGrams("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate Debit Note");
    } finally {
      setGeneratingDoc(false);
    }
  }

  const [settleTab, setSettleTab] = useState<"cash" | "gold">("cash");
  const [payMode, setPayMode] = useState<PaymentMode>("cash");
  const [payAmt, setPayAmt] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [goldGrossGramsStr, setGoldGrossGramsStr] = useState("");
  const [goldPurityStr, setGoldPurityStr] = useState("916");
  const [goldMeltLossStr, setGoldMeltLossStr] = useState("");
  const [customerAdvanceGoldMg, setCustomerAdvanceGoldMg] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!inv?.customerId) {
      setCustomerAdvanceGoldMg(0);
      return;
    }
    import("@/lib/customer-account-ledger")
      .then(({ compileCustomerLedger }) => {
        if (cancelled) return;
        const ledger = compileCustomerLedger(inv.customerId);
        setCustomerAdvanceGoldMg(ledger.goldAdvanceMg || 0);
      })
      .catch(() => {
        if (!cancelled) setCustomerAdvanceGoldMg(0);
      });
    return () => {
      cancelled = true;
    };
  }, [inv?.customerId]);

  const { triggerPrint } = usePrintEngine();
  if (loadingInvoice && !inv) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading invoice from Supabase...
        </div>
      </div>
    );
  }

  if (invoiceError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <h1 className="font-serif text-2xl text-destructive">Invoice could not load</h1>
              <p className="mt-2 text-sm text-muted-foreground">{invoiceError}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={retryInvoice}>
                  <RotateCcw className="h-4 w-4" /> Retry
                </Button>
                <Link to="/billing">
                  <Button variant="ghost">Back to billing</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <h1 className="font-serif text-2xl text-gold">Invoice not found</h1>
        <Link to="/billing" className="text-gold underline mt-4 inline-block">
          Back to billing
        </Link>
      </div>
    );
  }

  async function recordCashPayment() {
    const amt = rupeesToPaise(payAmt);
    if (amt <= 0) {
      toast.error("Enter valid cash payment amount.");
      return;
    }
    try {
      await addPayment(inv!.id, {
        mode: payMode,
        amountPaise: amt,
        reference: payRef || undefined,
        notes: payNotes || undefined,
      });
      toast.success("Payment recorded successfully.");
      setPayAmt("");
      setPayRef("");
      setPayNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    }
  }

  async function recordGoldPayment() {
    const grossG = parseFloat(goldGrossGramsStr) || 0;
    if (grossG <= 0) {
      toast.error("Enter valid gold weight.");
      return;
    }
    const meltG = parseFloat(goldMeltLossStr) || 0;
    const netG = Math.max(0, grossG - meltG);
    const purity = Math.round(Number(goldPurityStr) || 916);
    const fineMg = fineGoldMgConfigured(Math.round(netG * 1000), purity);
    const currentRatePaise = goldRatePaise || 750000;
    const valuePaise = Math.round((fineMg * currentRatePaise) / 1000);

    try {
      await addPayment(inv!.id, {
        mode: "gold_exchange",
        amountPaise: valuePaise,
        goldGrossMg: Math.round(grossG * 1000),
        goldPurity: purity,
        goldFineMg: fineMg,
        goldRatePerGramPaise: currentRatePaise,
        reference: payRef || "Settlement in Gold",
        notes: payNotes || undefined,
      });
      toast.success(`Gold payment of ${mgToGrams(fineMg)} g Fine recorded.`);
      setGoldGrossGramsStr("");
      setGoldMeltLossStr("");
      setPayRef("");
      setPayNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record gold payment.");
    }
  }

  async function settleFromGoldAdvance() {
    if (customerAdvanceGoldMg <= 0) {
      toast.error("No gold advance available for this customer.");
      return;
    }
    const applyMg = Math.min(customerAdvanceGoldMg, balanceFineMg);
    if (applyMg <= 0) {
      toast.error("Invoice is already fully settled.");
      return;
    }
    const currentRatePaise = goldRatePaise || 750000;
    const valuePaise = Math.round((applyMg * currentRatePaise) / 1000);

    try {
      await addPayment(inv!.id, {
        mode: "customer_gold_credit",
        amountPaise: valuePaise,
        goldGrossMg: applyMg,
        goldPurity: 100,
        goldFineMg: applyMg,
        goldRatePerGramPaise: currentRatePaise,
        reference: "Gold Advance Usage",
        notes: `Settled from existing customer gold balance (${mgToGrams(applyMg)} g fine applied)`,
      });
      toast.success(`Applied ${mgToGrams(applyMg)} g Fine Gold from customer advance.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply gold advance.");
    }
  }

  function triggerPrintInvoice() {
    triggerPrint(`/billing/print/${inv!.id}`, `Invoice Preview · ${inv!.invoiceNo}`);
  }

  function triggerPrintReceipt() {
    triggerPrint(`/billing/receipt/${inv!.id}`, `Receipt Preview · ${inv!.invoiceNo}`);
  }

  function triggerPrintSettlementSlip() {
    triggerPrint(
      `/billing/settlement-slip/${inv!.id}`,
      `Customer Settlement Slip · ${inv!.invoiceNo}`,
    );
  }

  const goldRatePaise =
    inv?.items?.[0]?.goldRatePerGramPaise ||
    getCurrentGoldRatePaise() ||
    750000;

  const totalFineMg =
    (inv?.items?.reduce((s: number, it: any) => s + (it.fineMg || 0), 0) || 0) > 0
      ? inv!.items.reduce((s: number, it: any) => s + (it.fineMg || 0), 0)
      : Math.round(((inv?.grandTotalPaise || inv?.subtotalPaise || 0) / goldRatePaise) * 1000);

  const actualGoldPaidMg = (inv?.payments || []).reduce((s: number, p: any) => {
    if (p.mode === "gold_exchange" || p.mode === "customer_gold_credit" || (p.goldFineMg && p.goldFineMg > 0)) {
      return s + (p.goldFineMg || p.goldGrossMg || 0);
    }
    const rateUsed = p.goldRatePerGramPaise || goldRatePaise;
    const equiv = rateUsed > 0 ? Math.round((p.amountPaise / rateUsed) * 1000) : 0;
    return s + equiv;
  }, 0);

  const paidFineMg =
    actualGoldPaidMg > 0
      ? actualGoldPaidMg
      : inv && inv.grandTotalPaise > 0
        ? Math.round((totalFineMg * (inv.paidPaise || 0)) / inv.grandTotalPaise)
        : 0;

  const excessFineMg = Math.max(0, paidFineMg - totalFineMg);
  const settledFineMg = Math.min(paidFineMg, totalFineMg);
  const balanceFineMg = Math.max(0, totalFineMg - paidFineMg);

  const payAmtNumber = parseFloat(payAmt) || 0;
  const payAmtPaise = rupeesToPaise(payAmtNumber);
  const payGoldEquivMg =
    goldRatePaise > 0 ? Math.round((payAmtPaise / goldRatePaise) * 1000) : 0;

  const isPureGoldInvoice =
    inv?.transactionMode === "gold" ||
    (inv?.transactionMode !== "cash" &&
      ((inv?.billingType as string) === "job_work" ||
        (inv?.billingType as string) === "wholesale" ||
        (inv?.billingType as string) === "gold" ||
        (inv?.items || []).some(
          (it: any) =>
            it.chargeMode === "job_work" ||
            (it.hallmarkChargesGoldMg ?? 0) > 0 ||
            (it.makingChargesGoldMg ?? 0) > 0 ||
            (it.otherChargesGoldMg ?? 0) > 0 ||
            (it.stoneChargesGoldMg ?? 0) > 0,
        ) ||
        ((inv?.payments || []).length > 0 &&
          (inv?.payments || []).every(
            (p: any) =>
              p.mode === "gold_exchange" ||
              p.mode === "customer_gold_credit" ||
              ((p.goldFineMg ?? 0) > 0 && (p.amountPaise ?? 0) === 0),
          )) ||
        ((inv?.paidPaise === 0 || !inv?.paidPaise) &&
          (inv?.payments || []).some((p: any) => (p.goldFineMg ?? 0) > 0))));

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title={inv.invoiceNo}
        subtitle={`${inv.customerName} · ${new Date(inv.createdAt).toLocaleString("en-IN")} · ${mgToGrams(totalFineMg)} g Fine Gold Obligation`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link to="/billing">
              <Button variant="ghost" className="gap-2 text-xs font-semibold">
                <ArrowLeft className="h-4 w-4" /> Back to Billing
              </Button>
            </Link>
            <Button
              data-testid="billing-print-invoice"
              variant="outline"
              className="gap-2"
              onClick={triggerPrintInvoice}
            >
              <Printer className="h-4 w-4" /> Print Invoice
            </Button>
            <Button
              data-testid="billing-print-settlement-slip"
              variant="outline"
              className="gap-2"
              onClick={triggerPrintSettlementSlip}
            >
              <Receipt className="h-4 w-4" /> Settlement Slip
            </Button>
            {inv.payments.length > 0 && (
              <Button
                data-testid="billing-print-receipt"
                variant="outline"
                className="gap-2"
                onClick={triggerPrintReceipt}
              >
                <Receipt className="h-4 w-4" /> Payment Receipt
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
              onClick={() => setDcDialogOpen(true)}
            >
              <Truck className="h-4 w-4" /> Generate Delivery Challan
            </Button>
            {!inv.isCreditNote && inv.status !== "cancelled" && (
              <>
                <Button
                  variant="outline"
                  className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => navigate({ to: "/billing/credit-note" as any, search: { invoiceId: inv.id } as any })}
                >
                  <RotateCcw className="h-4 w-4" /> Credit Note
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                  onClick={() => setDnDialogOpen(true)}
                >
                  <PlusCircle className="h-4 w-4" /> Debit Note
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Communication Actions */}
      <div className="mt-4 mb-6">
        <DocCommActions
          printA4Href={`/billing/print/${inv.id}` as any}
          whatsapp={{
            phone: customerContact?.phone ?? inv.customerPhone,
            message: isPureGoldInvoice
              ? `Hello ${inv.customerName},\nYour invoice ${inv.invoiceNo} for ${mgToGrams(totalFineMg)}g Fine Gold has been generated by ${firm.shopName}.\n\nBalance due: ${mgToGrams(balanceFineMg)}g Fine Gold.\n\nThank you for your business!`
              : `Hello ${inv.customerName},\nYour invoice ${inv.invoiceNo} for ${mgToGrams(totalFineMg)}g Fine Gold (₹${paiseToRupees(inv.subtotalPaise)}) has been generated by ${firm.shopName}.\n\nBalance due: ${mgToGrams(balanceFineMg)}g (₹${paiseToRupees(inv.balancePaise)}).\n\nThank you for your business!`,
          }}
          email={{
            to: customerContact?.email,
            subject: `Invoice ${inv.invoiceNo} (${mgToGrams(totalFineMg)}g Gold) — ${firm.shopName}`,
            body: isPureGoldInvoice
              ? `Dear ${inv.customerName},\n\nPlease find your invoice details:\nInvoice No: ${inv.invoiceNo}\nTotal Gold: ${mgToGrams(totalFineMg)} g Fine Gold\nPaid Gold: ${mgToGrams(paidFineMg)} g Fine Gold\nBalance Due: ${mgToGrams(balanceFineMg)} g Fine Gold\n\nThank you,\n${firm.shopName}`
              : `Dear ${inv.customerName},\n\nPlease find your invoice details:\nInvoice No: ${inv.invoiceNo}\nTotal Gold: ${mgToGrams(totalFineMg)} g (₹${paiseToRupees(inv.subtotalPaise)})\nPaid Gold: ${mgToGrams(paidFineMg)} g (₹${paiseToRupees(inv.paidPaise)})\nBalance Due: ${mgToGrams(balanceFineMg)} g (₹${paiseToRupees(inv.balancePaise)})\n\nThank you,\n${firm.shopName}`,
          }}
          linkedType="invoice"
          linkedId={inv.id}
          recipientLabel={inv.customerName}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-lg text-gold">
                {isPureGoldInvoice ? "Items & Fine Gold Schedule" : "Items & Gold Computation"}
              </h3>
              {inv.status === "issued" || (balanceFineMg > 0 && paidFineMg === 0) ? (
                <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/30 text-xs font-bold font-mono">
                  [ UNPAID INVOICE ] · Outstanding: {mgToGrams(balanceFineMg)} g Fine
                </Badge>
              ) : balanceFineMg > 0 ? (
                <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs font-bold font-mono">
                  [ PARTIALLY PAID ] · Balance: {mgToGrams(balanceFineMg)} g Fine
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                  [ SETTLED IN FULL ]
                </Badge>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="uppercase text-muted-foreground bg-muted/30 border-b border-border text-[10px]">
                  <tr>
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2 min-w-[140px]">Item / Description</th>
                    <th className="text-center py-2 px-1">Metal</th>
                    <th className="text-center py-2 px-1">J/N</th>
                    <th className="text-center py-2 px-1">Pcs</th>
                    <th className="text-right py-2 px-2">Gross (g)</th>
                    <th className="text-right py-2 px-2">Less (g)</th>
                    <th className="text-right py-2 px-2">Add (g)</th>
                    <th className="text-right py-2 px-2 font-semibold text-foreground">Net (g)</th>
                    <th className="text-center py-2 px-1">Tanch</th>
                    <th className="text-center py-2 px-1">Wstg %</th>
                    <th className="text-center py-2 px-1">Hisob %</th>
                    <th className="text-right py-2 px-2 font-bold text-gold">Fine (g)</th>
                    <th className="text-right py-2 px-2">{isPureGoldInvoice ? "Basis" : "Rate ₹/g"}</th>
                    <th className="text-right py-2 px-2">{isPureGoldInvoice ? "Gold (g)" : "Gold Val (₹)"}</th>
                    <th className="text-right py-2 px-2">{isPureGoldInvoice ? "Making (g)" : "Making (₹)"}</th>
                    <th className="text-right py-2 px-2">{isPureGoldInvoice ? "HM (g)" : "HM (₹)"}</th>
                    <th className="text-right py-2 px-2">{isPureGoldInvoice ? "Stone (g)" : "Stone (₹)"}</th>
                    <th className="text-right py-2 px-1">Stone Wt</th>
                    <th className="text-right py-2 px-1">Dia (ct)</th>
                    <th className="text-right py-2 px-2">{isPureGoldInvoice ? "Other (g)" : "Other (₹)"}</th>
                    <th className="text-right py-2 px-2">{isPureGoldInvoice ? "Disc (g)" : "Disc (₹)"}</th>
                    <th className="text-right py-2 px-2 font-bold text-gold">{isPureGoldInvoice ? "Total (g)" : "Total (₹)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {inv.items.map((it: any, idx: number) => {
                    const tanch = it.purity ? (it.purity / 10).toFixed(2) : "91.60";
                    const wstg = it.wastagePct != null ? Number(it.wastagePct).toFixed(2) : "0.00";
                    const hisob = it.hisobPct != null && Number(it.hisobPct) > 0 
                      ? Number(it.hisobPct).toFixed(2) 
                      : (Number(tanch) + Number(wstg)).toFixed(2);
                    const jn = it.jn === 2 ? "N" : "J";
                    const metal = it.metalKind === "silver" ? "Silver" : "Gold";
                    const diamondCt = it.diamondWeightMg ? (it.diamondWeightMg / 200).toFixed(2) : "0";
                    return (
                      <tr key={it.id} className="hover:bg-muted/20">
                        <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <div className="font-semibold text-foreground font-sans text-xs">{it.itemName}</div>
                          <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
                            {it.category && <span>{it.category}</span>}
                            {it.hsnCode && <span>· HSN: {it.hsnCode}</span>}
                            {it.huid && <span className="text-blue-400">· HUID: {it.huid}</span>}
                            {it.barcode && <span className="text-amber-500">· {it.barcode}</span>}
                          </div>
                        </td>
                        <td className="text-center py-2 px-1 text-muted-foreground">{metal}</td>
                        <td className="text-center py-2 px-1">{jn}</td>
                        <td className="text-center py-2 px-1">{it.pcs ?? 1}</td>
                        <td className="text-right py-2 px-2">{mgToGrams(it.grossMg)}</td>
                        <td className="text-right py-2 px-2 text-muted-foreground">{mgToGrams(it.lessMg || 0)}</td>
                        <td className="text-right py-2 px-2 text-muted-foreground">{mgToGrams(it.addMg || 0)}</td>
                        <td className="text-right py-2 px-2 font-semibold text-foreground">{mgToGrams(it.netMg)}</td>
                        <td className="text-center py-2 px-1">{tanch}</td>
                        <td className="text-center py-2 px-1">{wstg}</td>
                        <td className="text-center py-2 px-1 font-semibold">{hisob}%</td>
                        <td className="text-right py-2 px-2 font-bold text-gold">{mgToGrams(it.fineMg)}</td>
                        <td className="text-right py-2 px-2">
                          {isPureGoldInvoice ? "995 Basis" : `₹ ${paiseToRupees(it.goldRatePerGramPaise || 0)}`}
                        </td>
                        <td className="text-right py-2 px-2">
                          {isPureGoldInvoice ? `${mgToGrams(it.fineMg)} g` : `₹ ${paiseToRupees(it.goldValuePaise || 0)}`}
                        </td>
                        <td className="text-right py-2 px-2">
                          {isPureGoldInvoice 
                            ? (it.makingChargesGoldMg ? `${mgToGrams(it.makingChargesGoldMg)} g` : "0.000 g")
                            : `₹ ${paiseToRupees(it.makingChargesPaise || 0)}`}
                        </td>
                        <td className="text-right py-2 px-2">
                          {isPureGoldInvoice 
                            ? (it.hallmarkChargesGoldMg ? `${mgToGrams(it.hallmarkChargesGoldMg)} g` : "0.000 g")
                            : `₹ ${paiseToRupees(it.hallmarkChargesPaise || 0)}`}
                        </td>
                        <td className="text-right py-2 px-2">
                          {isPureGoldInvoice 
                            ? (it.stoneChargesGoldMg ? `${mgToGrams(it.stoneChargesGoldMg)} g` : "0.000 g")
                            : `₹ ${paiseToRupees(it.stoneChargesPaise || 0)}`}
                        </td>
                        <td className="text-right py-2 px-1 text-muted-foreground">
                          {it.stoneWeightMg ? `${mgToGrams(it.stoneWeightMg)}g` : "0.000"}
                        </td>
                        <td className="text-right py-2 px-1 text-muted-foreground">{diamondCt}</td>
                        <td className="text-right py-2 px-2">
                          {isPureGoldInvoice 
                            ? (it.otherChargesGoldMg ? `${mgToGrams(it.otherChargesGoldMg)} g` : "0.000 g")
                            : `₹ ${paiseToRupees(it.otherChargesPaise || 0)}`}
                        </td>
                        <td className="text-right py-2 px-2 text-rose-400">
                          {isPureGoldInvoice 
                            ? (it.discountGoldMg ? `-${mgToGrams(it.discountGoldMg)} g` : "0.000 g")
                            : `₹ ${paiseToRupees(it.discountPaise || 0)}`}
                        </td>
                        <td className="text-right py-2 px-2 font-bold text-gold">
                          {isPureGoldInvoice 
                            ? `${mgToGrams(it.fineMg)} g`
                            : `₹ ${paiseToRupees(it.lineTotalPaise || 0)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {inv.orderAdjustment && (
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="font-serif text-lg text-gold mb-3">Order Adjustments (Gold-First)</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {inv.orderAdjustment.cashAdvancePaise > 0 && (
                  <Kv
                    k="Cash advance (Gold Equiv)"
                    v={`${mgToGrams(Math.round((inv.orderAdjustment.cashAdvancePaise / goldRatePaise) * 1000))} g · ₹ ${paiseToRupees(inv.orderAdjustment.cashAdvancePaise)}`}
                  />
                )}
                {inv.orderAdjustment.goldGrossMg > 0 && (
                  <Kv
                    k="Old gold received"
                    v={`${mgToGrams(inv.orderAdjustment.goldGrossMg)} g gross · ₹ ${paiseToRupees(inv.orderAdjustment.goldValuePaise)}`}
                  />
                )}
              </div>
            </div>
          )}

          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="font-serif text-lg text-gold mb-3">Payments & Gold Equivalence</h3>
            {inv.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {inv.payments.map((p: any) => {
                  const rateUsed = (p as any).goldRatePerGramPaise || goldRatePaise;
                  const equivMg = (p as any).goldEquivalentMg || (rateUsed > 0 ? Math.round((p.amountPaise / rateUsed) * 1000) : 0);
                  const isGold = p.mode === "gold_exchange" || p.mode === "customer_gold_credit";

                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5"
                    >
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{PAYMENT_MODE_LABELS[p.mode as PaymentMode] || p.mode}</span>
                          {isGold ? (
                            <Badge className="bg-gold/20 text-gold border-gold/40 text-[10px]">Physical Gold</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                              Gold Equiv: {mgToGrams(equivMg)} g
                            </Badge>
                          )}
                          {p.reference ? <span className="text-xs text-muted-foreground">· {p.reference}</span> : null}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {new Date(p.ts).toLocaleString("en-IN")}
                          {!isGold && rateUsed ? ` · Rate Locked: ₹${paiseToRupees(rateUsed)}/g` : ""}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-gold font-mono font-bold">
                          {mgToGrams(equivMg)} g{isPureGoldInvoice ? " Fine Gold" : ""}
                        </div>
                        {!isPureGoldInvoice && (
                          <div className="text-[11px] text-muted-foreground font-mono">₹ {paiseToRupees(p.amountPaise)}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {inv.balancePaise > 0 && can("billing.recordPayment") && (
              <div className="mt-6 pt-5 border-t border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-gold" />
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                      Settle Outstanding Payment / पावती सेटल करा
                    </span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    Outstanding: <strong className="text-rose-500 font-bold">{mgToGrams(balanceFineMg)} g Fine</strong>
                    {!isPureGoldInvoice && ` · ₹${paiseToRupees(inv.balancePaise)}`}
                  </div>
                </div>

                {/* 1-Click Auto-Settlement from Customer Gold Advance */}
                {customerAdvanceGoldMg > 0 && (
                  <div className="p-3.5 rounded-xl border border-gold/40 bg-gold/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-gold flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-gold" /> Customer Has Available Gold Balance
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Available in Ledger: <strong className="font-mono text-foreground">{mgToGrams(customerAdvanceGoldMg)} g Fine</strong>. You can auto-settle this invoice from their existing gold advance.
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gold hover:bg-gold/90 text-white font-bold text-xs shrink-0 gap-1.5"
                      onClick={settleFromGoldAdvance}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Settle from Customer Gold ({mgToGrams(Math.min(customerAdvanceGoldMg, balanceFineMg))} g)
                    </Button>
                  </div>
                )}

                {/* Settlement Method Tabs */}
                <div className="flex gap-2 border-b border-border pb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={settleTab === "cash" ? "default" : "outline"}
                    className={`h-8 text-xs font-bold gap-1.5 ${settleTab === "cash" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}`}
                    onClick={() => setSettleTab("cash")}
                  >
                    <Banknote className="h-3.5 w-3.5" /> Settle in Cash / Bank / UPI
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={settleTab === "gold" ? "default" : "outline"}
                    className={`h-8 text-xs font-bold gap-1.5 ${settleTab === "gold" ? "bg-gold hover:bg-gold/90 text-white" : ""}`}
                    onClick={() => setSettleTab("gold")}
                  >
                    <Coins className="h-3.5 w-3.5" /> Settle in Physical Gold
                  </Button>
                </div>

                {settleTab === "cash" ? (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-[150px_140px_1fr_auto] gap-2 items-end">
                      <div>
                        <Label className="text-xs">Payment Mode</Label>
                        <Select value={payMode} onValueChange={(v) => setPayMode(v as PaymentMode)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[])
                              .filter((m) => m !== "outstanding" && m !== "gold_exchange" && m !== "customer_gold_credit")
                              .map((m) => (
                                <SelectItem key={m} value={m} className="text-xs">
                                  {PAYMENT_MODE_LABELS[m]}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Amount (₹)</Label>
                        <Input
                          className="h-9 text-xs font-mono"
                          value={payAmt}
                          onChange={(e) => setPayAmt(e.target.value)}
                          placeholder={(inv.balancePaise / 100).toString()}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Reference / UTR / Cheque</Label>
                        <Input
                          className="h-9 text-xs"
                          value={payRef}
                          onChange={(e) => setPayRef(e.target.value)}
                          placeholder="UPI ref, UTR, cheque no."
                        />
                      </div>
                      <Button
                        className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={recordCashPayment}
                      >
                        Record Cash Settlement
                      </Button>
                    </div>

                    {payAmtNumber > 0 && (
                      <div className="text-xs text-muted-foreground bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/20 flex justify-between items-center font-mono">
                        <span className="text-emerald-400">
                          Gold Equivalent Settled: <strong className="font-bold">{mgToGrams(payGoldEquivMg)} g Fine</strong>
                        </span>
                        <span>
                          Transaction Rate: <strong>₹{paiseToRupees(goldRatePaise)}/g</strong>
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-4 gap-2.5 items-end">
                      <div>
                        <Label className="text-xs">Gross Weight (g)</Label>
                        <Input
                          className="h-9 text-xs font-mono"
                          value={goldGrossGramsStr}
                          onChange={(e) => setGoldGrossGramsStr(e.target.value)}
                          placeholder={mgToGrams(balanceFineMg).toString()}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Touch / Purity %</Label>
                        <Input
                          className="h-9 text-xs font-mono"
                          value={goldPurityStr}
                          onChange={(e) => setGoldPurityStr(e.target.value)}
                          placeholder="916"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Melt Loss / Ded (g)</Label>
                        <Input
                          className="h-9 text-xs font-mono"
                          value={goldMeltLossStr}
                          onChange={(e) => setGoldMeltLossStr(e.target.value)}
                          placeholder="0.000"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Description / Ref</Label>
                        <Input
                          className="h-9 text-xs"
                          value={payRef}
                          onChange={(e) => setPayRef(e.target.value)}
                          placeholder="Old Gold / Lagad"
                        />
                      </div>
                    </div>

                    {(() => {
                      const grossG = parseFloat(goldGrossGramsStr) || 0;
                      const meltG = parseFloat(goldMeltLossStr) || 0;
                      const netG = Math.max(0, grossG - meltG);
                      const purity = Math.round(Number(goldPurityStr) || 916);
                      const fineMg = fineGoldMgConfigured(Math.round(netG * 1000), purity);
                      const valPaise = Math.round((fineMg * (goldRatePaise || 750000)) / 1000);

                      return (
                        <div className="p-3 bg-gold/5 border border-gold/20 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="text-xs font-mono space-x-3">
                            <span className="text-gold font-bold">
                              Fine Gold: <strong>{mgToGrams(fineMg)} g</strong>
                            </span>
                            {!isPureGoldInvoice && (
                              <span className="text-muted-foreground">
                                Cash Value: <strong>₹ {paiseToRupees(valPaise)}</strong> @ ₹{paiseToRupees(goldRatePaise)}/g
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="bg-gold hover:bg-gold/90 text-white font-bold text-xs"
                            onClick={recordGoldPayment}
                          >
                            Record Gold Settlement
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <Input
                  className="h-8 text-xs text-muted-foreground"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Additional settlement notes (optional)"
                />
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-md border border-border bg-card p-5 sticky top-4">
            <h3 className="font-serif text-lg text-gold mb-3">
              {isPureGoldInvoice ? "Summary (100% Gold)" : "Summary (Gold First)"}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="p-2.5 rounded bg-gold/10 border border-gold/30 mb-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Gold Obligation</div>
                <div className="text-xl font-bold font-mono text-gold">{mgToGrams(totalFineMg)} g Fine Gold</div>
                {!isPureGoldInvoice && (
                  <div className="text-xs text-muted-foreground font-mono">₹ {paiseToRupees(inv.grandTotalPaise)} Total Value</div>
                )}
              </div>
              <Row
                k="Subtotal"
                v={isPureGoldInvoice ? `${mgToGrams(totalFineMg)} g Fine Gold` : `₹ ${paiseToRupees(inv.subtotalPaise)}`}
              />
              {inv.gst === "gst3" ? (
                isPureGoldInvoice ? (
                  <Row k="GST" v="Included in 995 Basis" mute />
                ) : inv.cgstPaise > 0 && inv.sgstPaise > 0 ? (
                  <>
                    <Row k="CGST" v={`₹ ${paiseToRupees(inv.cgstPaise)}`} />
                    <Row k="SGST" v={`₹ ${paiseToRupees(inv.sgstPaise)}`} />
                  </>
                ) : (
                  <Row k="IGST" v={`₹ ${paiseToRupees(inv.cgstPaise + inv.sgstPaise)}`} />
                )
              ) : (
                <Row k="GST" v="Not applied" mute />
              )}
              {!isPureGoldInvoice && inv.adjustmentPaise > 0 && (
                <Row k="Less: adjustments" v={`− ₹ ${paiseToRupees(inv.adjustmentPaise)}`} />
              )}
              <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span>Grand Total / Obligation</span>
                  <span className="font-mono text-gold font-bold">
                    {isPureGoldInvoice
                      ? `${mgToGrams(totalFineMg)} g Fine Gold`
                      : `${mgToGrams(totalFineMg)} g (₹ ${paiseToRupees(inv.grandTotalPaise)})`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{isPureGoldInvoice ? "Total Received" : "Total Received (Gold Equiv)"}</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {isPureGoldInvoice
                      ? `${mgToGrams(paidFineMg)} g Fine Gold`
                      : `${mgToGrams(paidFineMg)} g (₹ ${paiseToRupees(inv.paidPaise)})`}
                  </span>
                </div>

                {excessFineMg > 0 && (
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1 font-mono">
                    <div className="flex justify-between items-center text-emerald-400 font-semibold">
                      <span>Excess Received:</span>
                      <span>+{mgToGrams(excessFineMg)} g Fine</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                      <span>Customer Ledger Credit:</span>
                      <span className="text-foreground font-bold">+{mgToGrams(excessFineMg)} g</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm font-bold border-t border-border/60 pt-1">
                  <span>Balance Due</span>
                  <span className="font-mono text-amber-400 text-base">
                    {balanceFineMg === 0 ? (
                      <span className="text-emerald-400 font-bold">0.000 g (PAID)</span>
                    ) : isPureGoldInvoice ? (
                      `${mgToGrams(balanceFineMg)} g Fine Gold`
                    ) : (
                      `${mgToGrams(balanceFineMg)} g Due (₹ ${paiseToRupees(inv.balancePaise)})`
                    )}
                  </span>
                </div>
              </div>
            </div>
            {inv.orderId && (
              <Link
                to="/orders/$id"
                params={{ id: inv.orderId }}
                className="text-xs text-gold underline mt-3 inline-block"
              >
                Linked order: {inv.orderNo}
              </Link>
            )}
            {inv.saleLedgerEntryId && (
              <div className="text-[11px] text-muted-foreground mt-2 font-mono">
                Ledger {inv.saleLedgerEntryId.slice(0, 8)}
              </div>
            )}
            {can("billing.delete") && inv.status !== "cancelled" && (
              <Button
                variant="outline"
                className="w-full mt-4 text-destructive border-destructive/40 gap-2"
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="h-4 w-4" /> Cancel invoice
              </Button>
            )}
            {can("billing.delete") && (
              <Button
                variant="ghost"
                className="w-full mt-2 text-destructive gap-2"
                onClick={() => {
                  if (
                    confirm(
                      "Delete this invoice? This is a raw delete and does NOT reverse gold ledger entries — prefer Cancel Invoice above, which does.",
                    )
                  ) {
                    // Record in security logs
                    useSettings
                      .getState()
                      .addSecurityLog(
                        "invoice deleted",
                        `Deleted Invoice ID: ${inv.id}, Client: ${inv.customerName}, Total Amount Paid: ₹${paiseToRupees(inv.paidPaise)} of ₹${paiseToRupees(inv.subtotalPaise)}`,
                        email || "System/Owner",
                      );
                    remove(inv.id);
                    navigate({ to: "/billing" });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete invoice (raw, no reversal)
              </Button>
            )}
            {/* 2-Way Lineage: Linked ERP Documents */}
            {(linkedChallans.length > 0 || linkedCreditNotes.length > 0 || linkedDebitNotes.length > 0) && (
              <div className="rounded-md border border-border bg-card p-4 mt-3 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Linked ERP Documents ({linkedChallans.length + linkedCreditNotes.length + linkedDebitNotes.length})
                </h4>
                <div className="space-y-1.5 text-xs">
                  {linkedChallans.map((dc) => (
                    <Link
                      key={dc.id}
                      to="/billing/delivery-challans/$id"
                      params={{ id: dc.id }}
                      className="flex items-center justify-between p-2 rounded bg-background border border-border hover:border-blue-500/50 transition-colors"
                    >
                      <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" /> {dc.challanNo}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {dc.status}
                      </Badge>
                    </Link>
                  ))}
                  {linkedCreditNotes.map((cn) => (
                    <Link
                      key={cn.id}
                      to="/billing/credit-notes"
                      className="flex items-center justify-between p-2 rounded bg-background border border-border hover:border-amber-500/50 transition-colors"
                    >
                      <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" /> {cn.creditNoteNo}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        ₹{paiseToRupees(cn.amountPaise)}
                      </span>
                    </Link>
                  ))}
                  {linkedDebitNotes.map((dn) => (
                    <Link
                      key={dn.id}
                      to="/billing/debit-notes"
                      className="flex items-center justify-between p-2 rounded bg-background border border-border hover:border-purple-500/50 transition-colors"
                    >
                      <span className="font-semibold text-purple-400 flex items-center gap-1.5">
                        <PlusCircle className="h-3.5 w-3.5" /> {dn.debitNoteNo}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        ₹{paiseToRupees(dn.amountPaise)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Generate Delivery Challan Dialog */}
        <AlertDialog open={dcDialogOpen} onOpenChange={setDcDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-gold">
                <Truck className="h-5 w-5" /> Generate Delivery Challan
              </AlertDialogTitle>
              <AlertDialogDescription>
                Create an authoritative Delivery Challan linked to Invoice <strong>{inv.invoiceNo}</strong> for {inv.customerName}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 text-sm py-2">
              <div>
                <Label className="text-xs font-semibold">Purpose</Label>
                <select
                  value={dcPurpose}
                  onChange={(e) => setDcPurpose(e.target.value as any)}
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
                >
                  <option value="job_work">Job Work / Production Dispatch</option>
                  <option value="sale_on_approval">Sale on Approval / Exhibition</option>
                  <option value="transfer">Branch Transfer</option>
                  <option value="other">Other / General Delivery</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Carrier / Transporter (optional)</Label>
                <Input
                  value={dcCarrier}
                  onChange={(e) => setDcCarrier(e.target.value)}
                  placeholder="e.g. Courier name, Driver name, Hand Delivery"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Delivery Address (optional)</Label>
                <Input
                  value={dcAddress}
                  onChange={(e) => setDcAddress(e.target.value)}
                  placeholder="e.g. Workshop address or Customer premises"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={generatingDoc}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCreateDeliveryChallan}
                disabled={generatingDoc}
                className="bg-gold hover:bg-gold/90 text-primary-foreground font-bold"
              >
                {generatingDoc ? "Generating..." : "Generate Challan"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Generate Debit Note Dialog */}
        <AlertDialog open={dnDialogOpen} onOpenChange={setDnDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-purple-400">
                <PlusCircle className="h-5 w-5" /> Generate Debit Note
              </AlertDialogTitle>
              <AlertDialogDescription>
                Issue a Debit Adjustment linked to Invoice <strong>{inv.invoiceNo}</strong> for {inv.customerName}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 text-sm py-2">
              <div>
                <Label className="text-xs font-semibold">Reason for Debit Note *</Label>
                <Input
                  value={dnReason}
                  onChange={(e) => setDnReason(e.target.value)}
                  placeholder="e.g. Under-billed making charges, additional gold weight, price revision"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Amount (₹)</Label>
                  <Input
                    type="number"
                    value={dnAmountRupees}
                    onChange={(e) => setDnAmountRupees(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Fine Gold (Grams)</Label>
                  <Input
                    type="number"
                    value={dnGoldGrams}
                    onChange={(e) => setDnGoldGrams(e.target.value)}
                    placeholder="0.000"
                  />
                </div>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={generatingDoc}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCreateDebitNote}
                disabled={generatingDoc || !dnReason.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                {generatingDoc ? "Issuing..." : "Issue Debit Note"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Invoice {inv.invoiceNo}?</AlertDialogTitle>
              <AlertDialogDescription>
                This reverses every gold-ledger entry this invoice posted (sale, Pay-In-Gold
                shortfall/surplus) as a traceable reversal entry — the invoice stays in the system
                marked "Cancelled", nothing is deleted. A reason is required for the audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (required)"
              rows={3}
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCancelReason("")}>Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelInvoice}
                disabled={cancelling || !cancelReason.trim()}
                className="bg-destructive hover:bg-destructive/90"
              >
                {cancelling ? "Cancelling…" : "Yes, Cancel Invoice"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function Row({ k, v, bold, mute }: { k: string; v: string; bold?: boolean; mute?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? "font-medium text-gold" : ""} ${mute ? "text-muted-foreground" : ""}`}
    >
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-sm">{v}</div>
    </div>
  );
}
