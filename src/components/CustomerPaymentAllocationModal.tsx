import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCustomerPaymentAllocation,
  previewPaymentAllocation,
  type AllocationStrategy,
  type CustomerPaymentReceipt,
} from "@/lib/customer-payment-allocation";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import {
  Coins,
  Receipt,
  CheckCircle2,
  Printer,
  Share2,
  Clock,
  Check,
  AlertCircle,
  TrendingDown,
  Sparkles,
} from "lucide-react";

interface Props {
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (receipt: CustomerPaymentReceipt) => void;
}

export function CustomerPaymentAllocationModal({ customerId, isOpen, onClose, onSuccess }: Props) {
  const invoices = useBilling((s) => s.invoices);
  const people = usePeople((s) => s.people);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const goldRatePaise = getCurrentGoldRatePaise();
  const { receiveCustomerPaymentAndAllocate } = useCustomerPaymentAllocation();

  const customer = useMemo(() => people.find((p) => p.id === customerId), [people, customerId]);
  const customerName = customer?.fullName || (customer as any)?.name || "Customer";

  const [mode, setMode] = useState<"gold" | "cash" | "mixed">("gold");
  const [strategy, setStrategy] = useState<AllocationStrategy>("fifo");
  const [goldInputG, setGoldInputG] = useState<string>("");
  const [cashInputRs, setCashInputRs] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<CustomerPaymentReceipt | null>(null);

  // Parse inputs to mg and paise
  const goldReceivedMg = Math.max(0, Math.round(gramsToMg(parseFloat(goldInputG) || 0)));
  const cashReceivedPaise = Math.max(0, Math.round((parseFloat(cashInputRs) || 0) * 100));

  // Compute live allocation preview
  const preview = useMemo(() => {
    return previewPaymentAllocation({
      customerId,
      customerName,
      invoices,
      goldReceivedMg,
      cashReceivedPaise,
      mode,
      strategy,
    });
  }, [customerId, customerName, invoices, goldReceivedMg, cashReceivedPaise, mode, strategy]);

  const totalOutstandingGoldG = mgToGrams(preview.initialOutstandingGoldMg);
  const totalOutstandingCashRs = paiseToRupees(preview.initialOutstandingCashPaise);

  const handleFullBalanceGold = () => {
    setGoldInputG(totalOutstandingGoldG);
  };

  const handleHalfBalanceGold = () => {
    setGoldInputG((preview.initialOutstandingGoldMg / 2000).toFixed(3));
  };

  const handleFullBalanceCash = () => {
    setCashInputRs(totalOutstandingCashRs);
  };

  const handleHalfBalanceCash = () => {
    setCashInputRs((preview.initialOutstandingCashPaise / 200).toFixed(2));
  };

  const handleConfirmPayment = async () => {
    if (goldReceivedMg <= 0 && cashReceivedPaise <= 0) return;
    setIsSubmitting(true);
    try {
      const idempotencyKey = `pay_alloc_${customerId}_${Date.now()}_${goldReceivedMg}_${cashReceivedPaise}`;
      const receipt = await receiveCustomerPaymentAndAllocate({
        customerId,
        customerName,
        customerPhone: customer?.phone,
        branchId: selectedBranchId || undefined,
        goldReceivedMg,
        cashReceivedPaise,
        mode,
        strategy,
        notes: notes.trim() || undefined,
        idempotencyKey,
      });

      setSubmittedReceipt(receipt);
      if (onSuccess) onSuccess(receipt);
    } catch (err) {
      console.error("Payment allocation error:", err);
      alert("Failed to allocate payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetModal = () => {
    setGoldInputG("");
    setCashInputRs("");
    setNotes("");
    setSubmittedReceipt(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleResetModal}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border shadow-2xl p-0">
        {!submittedReceipt ? (
          <div>
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/15 via-background to-background p-6 border-b border-border">
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant="outline" className="text-gold border-gold/30 bg-gold/5 mb-1.5 uppercase font-semibold text-[10px] tracking-wider">
                    Automatic Outstanding Allocation · Gold-First
                  </Badge>
                  <DialogTitle className="text-xl font-bold text-foreground">
                    Receive Payment — {customerName}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Enter received amount. The ERP automatically allocates across oldest unpaid invoices in FIFO order.
                  </DialogDescription>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Outstanding</div>
                  <div className="font-mono font-bold text-base text-amber-400">
                    {totalOutstandingGoldG} g <span className="text-xs text-muted-foreground font-normal">Gold</span>
                  </div>
                  {mode !== "gold" && (
                    <div className="font-mono text-xs text-muted-foreground">
                      ₹ {totalOutstandingCashRs}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {preview.eligibleInvoiceCount} Unpaid Invoice{preview.eligibleInvoiceCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Payment Mode Selection */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  1. Select Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("gold");
                      setCashInputRs("");
                    }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${
                      mode === "gold"
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold shadow-sm"
                        : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Coins className="h-4 w-4 text-amber-400" />
                    GOLD ONLY
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("cash");
                      setGoldInputG("");
                    }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${
                      mode === "cash"
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold shadow-sm"
                        : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Receipt className="h-4 w-4 text-emerald-400" />
                    CASH ONLY
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("mixed")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${
                      mode === "mixed"
                        ? "bg-purple-500/15 border-purple-500/50 text-purple-300 font-bold shadow-sm"
                        : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    MIXED (Gold + Cash)
                  </button>
                </div>
              </div>

              {/* Amount Entry */}
              <div className="grid sm:grid-cols-2 gap-4">
                {(mode === "gold" || mode === "mixed") && (
                  <div className="bg-amber-500/5 p-4 rounded-lg border border-amber-500/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Gold Received (Grams)
                      </label>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={handleFullBalanceGold}
                        >
                          100% Full ({totalOutstandingGoldG}g)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-1.5"
                          onClick={handleHalfBalanceGold}
                        >
                          50%
                        </Button>
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="0.000 g"
                      value={goldInputG}
                      onChange={(e) => setGoldInputG(e.target.value)}
                      className="font-mono text-base font-bold text-amber-300 bg-background border-amber-500/30"
                    />
                  </div>
                )}

                {(mode === "cash" || mode === "mixed") && (
                  <div className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                        Cash Received (₹ Rupees)
                      </label>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={handleFullBalanceCash}
                        >
                          100% Full (₹{totalOutstandingCashRs})
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-1.5"
                          onClick={handleHalfBalanceCash}
                        >
                          50%
                        </Button>
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="1"
                      placeholder="₹ 0.00"
                      value={cashInputRs}
                      onChange={(e) => setCashInputRs(e.target.value)}
                      className="font-mono text-base font-bold text-emerald-300 bg-background border-emerald-500/30"
                    />
                  </div>
                )}
              </div>

              {/* Allocation Strategy */}
              <div className="flex items-center justify-between gap-4 py-2 px-3 bg-muted/20 rounded-md border border-border/60 text-xs">
                <span className="font-medium text-muted-foreground">Allocation Method:</span>
                <div className="flex gap-2">
                  <Badge
                    variant={strategy === "fifo" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setStrategy("fifo")}
                  >
                    AUTO — Oldest First (FIFO)
                  </Badge>
                  <Badge
                    variant={strategy === "due_date" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setStrategy("due_date")}
                  >
                    Due Date Priority
                  </Badge>
                </div>
              </div>

              {/* Live Preview Breakdown Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    Allocation Preview (Auto-Fills Invoices)
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    {preview.clearedInvoiceCount} Paid · {preview.partiallyClearedInvoiceCount} Partial · {preview.unaffectedInvoiceCount} Unaffected
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground sticky top-0 uppercase text-[10px]">
                      <tr className="border-b border-border text-left">
                        <th className="p-2.5">Invoice #</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Due</th>
                        <th className="p-2.5 text-right font-bold text-foreground">Applied Payment</th>
                        <th className="p-2.5 text-right">Remaining</th>
                        <th className="p-2.5 text-center">Projected Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {preview.items.map((item) => (
                        <tr
                          key={item.invoice.id}
                          className={`hover:bg-muted/20 transition-colors ${
                            item.appliedGoldMg > 0 || item.appliedCashPaise > 0
                              ? "bg-amber-500/5 font-medium"
                              : "opacity-60"
                          }`}
                        >
                          <td className="p-2.5 font-mono font-semibold text-gold">
                            {item.invoice.invoiceNo}
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {new Date(item.invoice.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {mode === "gold" ? (
                              <span>{mgToGrams(item.dueGoldMg)} g</span>
                            ) : mode === "cash" ? (
                              <span>₹ {paiseToRupees(item.dueCashPaise)}</span>
                            ) : (
                              <span>{mgToGrams(item.dueGoldMg)}g / ₹{paiseToRupees(item.dueCashPaise)}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-300">
                            {mode === "gold" ? (
                              <span>{mgToGrams(item.appliedGoldMg)} g</span>
                            ) : mode === "cash" ? (
                              <span>₹ {paiseToRupees(item.appliedCashPaise)}</span>
                            ) : (
                              <span>{mgToGrams(item.appliedGoldMg)}g / ₹{paiseToRupees(item.appliedCashPaise)}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono text-muted-foreground">
                            {mode === "gold" ? (
                              <span>{mgToGrams(item.remainingGoldMg)} g</span>
                            ) : mode === "cash" ? (
                              <span>₹ {paiseToRupees(item.remainingCashPaise)}</span>
                            ) : (
                              <span>{mgToGrams(item.remainingGoldMg)}g / ₹{paiseToRupees(item.remainingCashPaise)}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase font-bold ${
                                item.nextStatus === "paid"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : item.nextStatus === "partial"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : "text-muted-foreground border-border"
                              }`}
                            >
                              {item.nextStatus}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Received</div>
                  <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                    {mode === "gold"
                      ? `${mgToGrams(preview.totalReceivedGoldMg)} g`
                      : mode === "cash"
                      ? `₹ ${paiseToRupees(preview.totalReceivedCashPaise)}`
                      : `${mgToGrams(preview.totalReceivedGoldMg)}g / ₹${paiseToRupees(preview.totalReceivedCashPaise)}`}
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                  <div className="text-[10px] uppercase font-bold text-emerald-400">Total Allocated</div>
                  <div className="text-sm font-bold font-mono text-emerald-300 mt-0.5">
                    {mode === "gold"
                      ? `${mgToGrams(preview.totalAllocatedGoldMg)} g`
                      : mode === "cash"
                      ? `₹ ${paiseToRupees(preview.totalAllocatedCashPaise)}`
                      : `${mgToGrams(preview.totalAllocatedGoldMg)}g / ₹${paiseToRupees(preview.totalAllocatedCashPaise)}`}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                  <div className="text-[10px] uppercase font-bold text-amber-400">Remaining Due</div>
                  <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                    {mode === "gold"
                      ? `${mgToGrams(preview.remainingOutstandingGoldMg)} g`
                      : mode === "cash"
                      ? `₹ ${paiseToRupees(preview.remainingOutstandingCashPaise)}`
                      : `${mgToGrams(preview.remainingOutstandingGoldMg)}g / ₹${paiseToRupees(preview.remainingOutstandingCashPaise)}`}
                  </div>
                </div>

                <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <div className="text-[10px] uppercase font-bold text-blue-400">Unapplied Advance</div>
                  <div className="text-sm font-bold font-mono text-blue-300 mt-0.5">
                    {mode === "gold"
                      ? `${mgToGrams(preview.unappliedGoldMg)} g`
                      : mode === "cash"
                      ? `₹ ${paiseToRupees(preview.unappliedCashPaise)}`
                      : `${mgToGrams(preview.unappliedGoldMg)}g / ₹${paiseToRupees(preview.unappliedCashPaise)}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-muted/20 border-t border-border flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleResetModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-gold hover:bg-gold/90 text-white font-bold gap-2 px-6"
                disabled={isSubmitting || (goldReceivedMg <= 0 && cashReceivedPaise <= 0)}
                onClick={handleConfirmPayment}
              >
                <Check className="h-4 w-4" />
                {isSubmitting ? "Posting..." : "Confirm & Apply Payment"}
              </Button>
            </div>
          </div>
        ) : (
          /* Post-Payment Success Receipt Card */
          <div className="p-8 space-y-6 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-full border border-emerald-500/30 mb-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">Payment Allocated Successfully!</h3>
              <p className="text-xs text-muted-foreground font-mono">
                Receipt No: <span className="font-bold text-gold">{submittedReceipt.receiptNo}</span>
              </p>
            </div>

            <div className="max-w-md mx-auto bg-muted/20 p-5 rounded-lg border border-border space-y-3 text-left">
              <div className="flex justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-semibold text-foreground">{submittedReceipt.customerName}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground">Payment Mode</span>
                <span className="font-bold uppercase text-gold">{submittedReceipt.mode}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground">Total Received</span>
                <span className="font-mono font-bold text-emerald-400">
                  {submittedReceipt.mode === "gold"
                    ? `${mgToGrams(submittedReceipt.goldReceivedMg)} g Fine Gold`
                    : submittedReceipt.mode === "cash"
                    ? `₹ ${paiseToRupees(submittedReceipt.cashReceivedPaise)}`
                    : `${mgToGrams(submittedReceipt.goldReceivedMg)}g Gold + ₹${paiseToRupees(submittedReceipt.cashReceivedPaise)}`}
                </span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-border/40">
                <span className="text-muted-foreground">Invoices Allocated</span>
                <span className="font-bold text-foreground">{submittedReceipt.allocations.length} Invoices</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-muted-foreground">Remaining Customer Balance</span>
                <span className="font-mono font-bold text-amber-300">
                  {mgToGrams(submittedReceipt.remainingOutstandingGoldMg)} g Gold
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" /> Print Payment Slip
              </Button>
              <Button
                className="bg-gold hover:bg-gold/90 text-white font-bold px-6"
                onClick={handleResetModal}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
