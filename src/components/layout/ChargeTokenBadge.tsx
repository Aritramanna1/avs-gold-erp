import { useEffect, useState } from "react";
import { useCreditStore } from "@/lib/credit-service";
import { startCreditTopUp } from "@/lib/platform-payments/platform-payment-service";
import { openRazorpayModal } from "@/components/billing/RazorpayCheckout";
import { usePaymentConfirmation } from "@/hooks/use-payment-confirmation";
import {
  Coins,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CREDIT_PACKS = [250, 500, 1000, 2500] as const;

export function ChargeTokenBadge() {
  const { wallet, loading, fetchWallet } = useCreditStore();
  const [isOpen, setIsOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [processing, setProcessing] = useState(false);

  const {
    state: payState,
    message: payMessage,
    waitForConfirmation,
    markFailed,
    reset,
  } = usePaymentConfirmation();

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const balance = wallet ? Number(wallet.balance_credits ?? 0) : 0;
  const isLowBalance = wallet ? wallet.is_low_balance : balance < 100;

  const handleTopUp = async (customAmount?: number) => {
    const amt = customAmount ?? parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid credit amount.");
      return;
    }
    setProcessing(true);
    try {
      const result = await startCreditTopUp(amt, "ai");
      setProcessing(false);
      if (!result.ok || !result.orderId || !result.keyId) {
        toast.error(result.error ?? "Could not start credit purchase");
        return;
      }

      await openRazorpayModal({
        orderId: result.orderId,
        amountPaise: result.amountPaise ?? Math.round(amt * 100),
        keyId: result.keyId,
        description: `Buy credits: ${amt}`,
        onSuccess: async () => {
          reset();
          await waitForConfirmation({ kind: "credits" });
          setIsOpen(false);
          await fetchWallet();
          toast.success(`Credits added: ${amt}`);
        },
        onFailure: (reason) => {
          markFailed(reason);
          toast.error(reason || "Payment was not completed.");
        },
        onDismiss: () => {},
      });
    } catch {
      setProcessing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 min-h-12 px-3 py-2 rounded-full text-xs font-semibold transition-all border shrink-0 cursor-pointer",
          isLowBalance
            ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 animate-pulse"
            : "bg-gold/10 text-gold border-gold/30 hover:bg-gold/20 hover:border-gold/50",
        )}
        title={`Credits left: ${balance.toLocaleString()}. Buy credits.`}
      >
        <Coins className="h-4 w-4 shrink-0" />
        <span>{loading ? "..." : balance.toLocaleString()}</span>
        <span className="hidden xl:inline text-[11px] opacity-90">Credits left</span>
        {isLowBalance && (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 relative"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-gold mb-1">
                <Coins className="h-5 w-5" />
                <span className="font-bold text-base text-foreground">Buy credits</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Credits power WhatsApp messages and AI tools.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">Credits left</div>
                <div className="text-2xl font-black text-foreground mt-0.5">
                  {balance.toLocaleString()}
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                  isLowBalance
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
                )}
              >
                {isLowBalance ? (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Low credits — buy more
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </>
                )}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Credit packs</label>
              <div className="grid grid-cols-4 gap-2">
                {CREDIT_PACKS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTopUpAmount(String(n))}
                    disabled={processing}
                    className={cn(
                      "min-h-12 flex flex-col items-center justify-center p-2 rounded-xl border bg-background hover:border-gold hover:bg-gold/5 transition-all text-center cursor-pointer",
                      topUpAmount === String(n) ? "border-gold bg-gold/10" : "border-border",
                    )}
                  >
                    <span className="text-sm font-bold text-foreground">+{n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Or enter amount</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="flex-1 min-h-12 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-gold"
                />
                <button
                  type="button"
                  onClick={() => void handleTopUp()}
                  disabled={processing}
                  className="inline-flex items-center justify-center gap-1.5 min-h-12 rounded-lg bg-gold px-4 py-2 text-xs font-bold text-black hover:bg-gold/90 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {processing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlusCircle className="h-3.5 w-3.5" />
                  )}
                  <span>Pay now</span>
                </button>
              </div>
            </div>

            {payState ? (
              <div className="text-xs p-3 rounded-lg border border-border bg-muted/40">{payMessage}</div>
            ) : null}

            <div className="text-[11px] text-muted-foreground text-center border-t border-border/50 pt-3">
              Uses existing Razorpay checkout. LIVE keys stay off until Platform Owner verification.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
