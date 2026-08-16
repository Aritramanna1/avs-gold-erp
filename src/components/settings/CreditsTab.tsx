import React, { useEffect, useState } from "react";
import { useCreditStore } from "@/lib/credit-service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Coins,
  Sparkles,
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
import { PaymentCheckoutCard } from "@/components/billing/RazorpayCheckout";
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
    setCheckout({
      orderId: result.orderId,
      amountPaise: result.amountPaise ?? 0,
      keyId: result.keyId,
      credits: amt,
    });
    toast.success("Ready to pay — complete checkout below");
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
            <Coins className="h-5 w-5 text-amber-500" /> Tenant Credit Centre & Usage Wallet
          </h3>
          <p className="text-xs text-muted-foreground">
            Prepaid balance for AI assistant, WhatsApp messaging, and metered automations.
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
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Balance
          </Button>
          <Button
            size="sm"
            onClick={() => setIsTopUpOpen(!isTopUpOpen)}
            className="h-8 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Top-Up Credits
          </Button>
        </div>
      </div>

      {/* Top-up Drawer / Form */}
      {isTopUpOpen && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4 text-amber-500" /> Instant Credit Purchase
            </h4>
            <span className="text-[11px] text-muted-foreground">
              1 Credit = ₹1.00 Value Equivalent
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <Label className="text-[11px] text-muted-foreground">Credits Amount</Label>
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
              {processing ? "Processing..." : "Confirm Top-Up"}
            </Button>
          </div>
        </Card>
      )}

      {checkout ? (
        <PaymentCheckoutCard
          title={`${checkout.credits.toLocaleString("en-IN")} credits`}
          subtitle="Instant top-up for AI and WhatsApp usage"
          amountPaise={checkout.amountPaise}
          orderId={checkout.orderId}
          keyId={checkout.keyId}
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
              Available Credits
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
                <AlertTriangle className="h-2.5 w-2.5" /> Low Balance Alert
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
              >
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Active & Healthy
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
            <Sparkles className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {wallet?.usage?.ai_deducted !== undefined
              ? Number(wallet.usage.ai_deducted).toFixed(1)
              : "0.0"}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Conversational queries & Vision OCR
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
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4 text-muted-foreground" /> Standard Service Rate Card
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              AI Query
            </span>
            <span className="font-bold text-foreground text-sm">1.0</span>
            <span className="text-[10px] text-muted-foreground block">per message</span>
          </div>
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              AI Vision/OCR
            </span>
            <span className="font-bold text-foreground text-sm">5.0</span>
            <span className="text-[10px] text-muted-foreground block">per image/doc</span>
          </div>
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              AI Action
            </span>
            <span className="font-bold text-foreground text-sm">2.0</span>
            <span className="text-[10px] text-muted-foreground block">per write mutation</span>
          </div>
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              WA Utility
            </span>
            <span className="font-bold text-foreground text-sm">1.5</span>
            <span className="text-[10px] text-muted-foreground block">invoice/receipt</span>
          </div>
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              WA Marketing
            </span>
            <span className="font-bold text-foreground text-sm">3.0</span>
            <span className="text-[10px] text-muted-foreground block">catalogue share</span>
          </div>
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              WA Service
            </span>
            <span className="font-bold text-foreground text-sm">0.5</span>
            <span className="text-[10px] text-muted-foreground block">inbound 24h</span>
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
