import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Payment service unavailable"));
    document.body.appendChild(s);
  });
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export type RazorpayCheckoutProps = {
  orderId: string;
  amountPaise: number;
  keyId: string;
  label?: string;
  description?: string;
  invoiceNo?: string;
  variant?: "default" | "outline" | "premium";
  size?: "default" | "sm" | "lg";
  className?: string;
  onSuccess?: () => void;
  onFailure?: (reason?: string) => void;
  onDismiss?: () => void;
};

export function RazorpayCheckoutButton({
  orderId,
  amountPaise,
  keyId,
  label = "Pay securely",
  description = "Subscription or platform services",
  invoiceNo,
  variant = "premium",
  size = "default",
  className,
  onSuccess,
  onFailure,
  onDismiss,
}: RazorpayCheckoutProps) {
  const [busy, setBusy] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    void loadRazorpayScript().catch(() => {});
  }, []);

  async function handlePay() {
    if (opened.current || busy) return;
    setBusy(true);
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Payment service unavailable");

      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email ?? undefined;
      const name =
        (userData.user?.user_metadata?.full_name as string | undefined) ??
        (userData.user?.user_metadata?.name as string | undefined);

      const rzp = new window.Razorpay({
        key: keyId,
        amount: amountPaise,
        currency: "INR",
        order_id: orderId,
        name: "Ornexa",
        description: invoiceNo ? `Invoice ${invoiceNo}` : description,
        prefill: { email, name, contact: "" },
        theme: { color: "#b8860b" },
        modal: {
          ondismiss: () => {
            opened.current = false;
            setBusy(false);
            onDismiss?.();
          },
        },
        handler: () => {
          opened.current = false;
          setBusy(false);
          onSuccess?.();
        },
      });

      rzp.on("payment.failed", (response: unknown) => {
        opened.current = false;
        setBusy(false);
        const reason =
          (response as { error?: { description?: string } })?.error?.description ??
          "Payment was declined";
        toast.error(reason);
        onFailure?.(reason);
      });

      opened.current = true;
      rzp.open();
    } catch (e) {
      opened.current = false;
      const msg = e instanceof Error ? e.message : "Checkout failed";
      toast.error(msg);
      onFailure?.(msg);
      setBusy(false);
    }
  }

  const buttonClass =
    variant === "premium"
      ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-md border-0"
      : "";

  return (
    <div className={className}>
      <Button
        onClick={() => void handlePay()}
        disabled={busy}
        size={size}
        variant={variant === "premium" ? "default" : variant === "outline" ? "outline" : "default"}
        className={`gap-2 w-full sm:w-auto ${buttonClass}`}
        data-testid="razorpay-checkout-button"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {busy ? "Opening secure checkout…" : label}
        {!busy ? (
          <span className="font-mono text-xs opacity-90">· {formatInr(amountPaise)}</span>
        ) : null}
      </Button>
      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2">
        <Lock className="h-3 w-3" />
        <ShieldCheck className="h-3 w-3" />
        Encrypted checkout · UPI, cards & net banking
      </p>
      {import.meta.env.DEV ? (
        <p className="text-[10px] text-amber-600/90 mt-1">
          Test mode: use card 4111 1111 1111 1111, any future expiry, any CVV.
        </p>
      ) : null}
    </div>
  );
}

/** Inline checkout summary card shown before payment. */
export function PaymentCheckoutCard({
  title,
  subtitle,
  amountPaise,
  orderId,
  keyId,
  invoiceNo,
  testMode,
  onSuccess,
  onFailure,
  onDismiss,
  onCancel,
}: {
  title: string;
  subtitle?: string;
  amountPaise: number;
  orderId: string;
  keyId: string;
  invoiceNo?: string;
  testMode?: boolean;
  onSuccess?: () => void;
  onFailure?: (reason?: string) => void;
  onDismiss?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-gold/25 bg-gradient-to-br from-gold/5 via-card to-card p-5 space-y-4 shadow-sm"
      data-testid="payment-checkout-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Secure checkout
          </p>
          <h3 className="text-base font-semibold text-foreground mt-0.5">{title}</h3>
          {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono text-gold">{formatInr(amountPaise)}</p>
          <p className="text-[10px] text-muted-foreground">incl. taxes where applicable</p>
        </div>
      </div>
      <RazorpayCheckoutButton
        orderId={orderId}
        amountPaise={amountPaise}
        keyId={keyId}
        invoiceNo={invoiceNo}
        label="Complete payment"
        onSuccess={onSuccess}
        onFailure={onFailure}
        onDismiss={onDismiss}
      />
      {onCancel ? (
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
      {testMode ? (
        <p className="text-[10px] text-center text-amber-600/90">
          Demo test mode — card 4111 1111 1111 1111 · any future expiry · any CVV
        </p>
      ) : null}
    </div>
  );
}
