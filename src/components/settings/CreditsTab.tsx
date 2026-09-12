import React, { useEffect, useState } from "react";
import { useCreditStore } from "@/lib/credit-service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Coins,
  Flame,
  MessageSquare,
  History,
  TrendingDown,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import { startCreditTopUp } from "@/lib/platform-payments/platform-payment-service";
import { PaymentCheckoutCard, openRazorpayModal } from "@/components/billing/RazorpayCheckout";
import { PaymentResultBanner } from "@/components/billing/PaymentResultBanner";
import { usePaymentConfirmation } from "@/hooks/use-payment-confirmation";
import { toast } from "sonner";

export function CreditsTab() {
  const { wallet, loading, fetchWallet } = useCreditStore();
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const [checkout, setCheckout] = useState<{
    orderId: string;
    amountPaise: number;
    keyId: string;
    credits: number;
    internalPaymentId?: string;
  } | null>(null);
  const {
    state: payState,
    message: payMessage,
    waitForConfirmation,
    markFailed,
    reset,
  } = usePaymentConfirmation();

  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive credit amount.");
      return;
    }
    setProcessing(true);
    const result = await startCreditTopUp(amt, "ai");
    setProcessing(false);
    if (!result.ok || !result.orderId || !result.keyId) {
      toast.error(result.error ?? "Could not start credit purchase");
      return;
    }
    const orderData = {
      orderId: result.orderId,
      amountPaise: result.amountPaise ?? Math.round(amt * 100),
      keyId: result.keyId,
      credits: amt,
      internalPaymentId: result.invoiceId,
    };
    setCheckout(orderData);
    toast.success("Opening payment gateway...");

    // Immediately trigger the payment gateway modal
    try {
      await openRazorpayModal({
        orderId: orderData.orderId,
        amountPaise: orderData.amountPaise,
        keyId: orderData.keyId,
        description: `Buy credits: ${amt}`,
        internalPaymentId: orderData.internalPaymentId,
        redirectOnSuccess: false,
        onSuccess: () => void onPaymentSuccess(),
        onFailure: (reason) => markFailed(reason),
        onDismiss: () => {},
      });
    } catch (e: any) {
      // User dismissed or gateway error handled via banner
    }
  };

  async function onPaymentSuccess() {
    reset();
    await waitForConfirmation({ kind: "credits" });
    setCheckout(null);
    setIsTopUpOpen(false);
    await fetchWallet();
  }

  return (
    <div className="space-y-6">
      <PaymentResultBanner
        state={payState}
        message={payMessage}
        onDismiss={reset}
        onRetry={() => checkout && void onPaymentSuccess()}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" /> Credits left
          </h3>
          <p className="text-xs text-muted-foreground">
            Pays for WhatsApp messages and AI help.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchWallet()}
            disabled={loading}
            className="h-8 text-xs gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsTopUpOpen(!isTopUpOpen)}
            className="min-h-12 h-12 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Buy credits
          </Button>
        </div>
      </div>

      {/* Top-up Drawer / Form */}
      {isTopUpOpen && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4 text-amber-500" /> Buy credits
            </h4>
            <span className="text-[11px] text-muted-foreground">
              1 Credit = ₹1.00 Value Equivalent
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <Label className="text-[11px] text-muted-foreground">Credits</Label>
              <Input
                type="number"
                min="100"
                step="100"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="h-8 text-xs font-semibold"
                placeholder="500"
              />
            </div>
            <div className="flex gap-1.5 self-end">
              {[250, 500, 1000, 2500].map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTopUpAmount(String(v))}
                  className="h-8 text-xs"
                >
                  +{v}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={handleTopUp}
              disabled={processing}
              className="h-8 text-xs self-end bg-amber-500 hover:bg-amber-600 text-white"
            >
              {processing ? "Processing..." : "Pay now"}
            </Button>
          </div>
        </Card>
      )}

      {checkout ? (
        <PaymentCheckoutCard
          title={`${checkout.credits.toLocaleString("en-IN")} credits`}
          subtitle="Pays for WhatsApp messages and AI help"
          amountPaise={checkout.amountPaise}
          orderId={checkout.orderId}
          keyId={checkout.keyId}
          internalPaymentId={checkout.internalPaymentId}
          onSuccess={() => void onPaymentSuccess()}
          onFailure={(reason) => markFailed(reason)}
          onDismiss={() => setCheckout(null)}
          onCancel={() => setCheckout(null)}
        />
      ) : null}

      {/* Wallet Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Available Balance */}
        <Card className="p-4 border-border/80 bg-card space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Credits left
            </span>
            <Coins className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {wallet?.balance_credits !== undefined
              ? Number(wallet.balance_credits).toFixed(1)
              : "—"}
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {wallet?.is_low_balance ? (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Low credits — buy more
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
              >
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Active
              </Badge>
            )}
          </div>
        </Card>

        {/* AI Deducted This Month */}
        <Card className="p-4 border-border/80 bg-card space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              AI Usage (This Month)
            </span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {wallet?.usage?.ai_deducted !== undefined
              ? Number(wallet.usage.ai_deducted).toFixed(1)
              : "0.0"}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Calculations, vision & smart automations
          </p>
        </Card>

        {/* WhatsApp Deducted This Month */}
        <Card className="p-4 border-border/80 bg-card space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              WhatsApp (This Month)
            </span>
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {wallet?.usage?.wa_deducted !== undefined
              ? Number(wallet.usage.wa_deducted).toFixed(1)
              : "0.0"}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Invoices, notifications & receipts
          </p>
        </Card>

        {/* Monthly Plan Allocation */}
        <Card className="p-4 border-border/80 bg-card space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Monthly Plan Grant
            </span>
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {wallet?.plan_credits_monthly || 500}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">Recharges on 1st of every month</p>
        </Card>
      </div>

      {/* Credit Consumption Rates Reference */}
      <div className="rounded-md border border-border/80 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-muted-foreground" /> Transparent Meta API + AVS Service Rate Card
          </h4>
          <span className="text-[11px] text-muted-foreground">
            Meta Base Pass-Through + ₹0.20 AVS Cloud Gateway Fee (1 Credit = ₹1.00)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                WhatsApp Utility (Invoices & OTP)
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
                ₹0.31 / msg
              </Badge>
            </div>
            <p className="text-xs font-semibold text-foreground">
              Meta ₹0.11 + AVS Service Charge ₹0.20
            </p>
            <p className="text-[10px] text-muted-foreground">
              Tax invoices, Jama slips, order confirmation, Karigar issue alerts, and OTP verification codes.
            </p>
          </div>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                WhatsApp Marketing (Campaigns)
              </span>
              <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-500">
                ₹0.98 / msg
              </Badge>
            </div>
            <p className="text-xs font-semibold text-foreground">
              Meta ₹0.78 + AVS Service Charge ₹0.20
            </p>
            <p className="text-[10px] text-muted-foreground">
              Jewellery catalog collections, festival greetings, promotional announcements, and customer outreach.
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                Customer Service (24h Window)
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">
                ₹0.20 / msg
              </Badge>
            </div>
            <p className="text-xs font-semibold text-foreground">
              Meta FREE + AVS Service Charge ₹0.20
            </p>
            <p className="text-[10px] text-muted-foreground">
              Customer-initiated inquiries and replies within active 24-hour service conversation windows.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Ledger Transactions Table */}
      <div className="rounded-md border border-border/80 bg-card p-4 space-y-3 shadow-sm">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" /> Usage & top-up history
        </h4>
        {!wallet?.usage?.recent_entries || wallet.usage.recent_entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No credit ledger entries recorded yet. Usage will automatically appear here.
          </p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  <th className="py-2 px-3 text-left">Timestamp</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-left">Service Code</th>
                  <th className="py-2 px-3 text-left">Description</th>
                  <th className="py-2 px-3 text-right">Units</th>
                  <th className="py-2 px-3 text-right">Credits</th>
                  <th className="py-2 px-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wallet.usage.recent_entries.map((e) => {
                  const isDebit = e.amount_credits < 0;
                  return (
                    <tr key={e.id} className="hover:bg-muted/40">
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 px-3 capitalize">
                        <Badge variant="outline" className="text-[10px]">
                          {e.entry_type.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">{e.service_type}</td>
                      <td className="py-2 px-3">{e.description}</td>
                      <td className="py-2 px-3 text-right">{e.units}</td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold ${isDebit ? "text-red-500" : "text-emerald-500"}`}
                      >
                        {isDebit ? `${e.amount_credits}` : `+${e.amount_credits}`}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {Number(e.balance_after_credits).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
