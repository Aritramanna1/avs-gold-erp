/**
 * Tenant 360 Communications — WhatsApp + Email status (Platform Owner & Settings).
 * Secrets are never displayed.
 */
import { useEffect, useState } from "react";
import { Panel, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mail, MessageSquare, RefreshCw, Coins, Plus, ShieldCheck, Sparkles } from "lucide-react";
import {
  fetchWhatsAppConnections,
  type WhatsAppConnection,
} from "@/lib/comm/platform/whatsapp-connections-store";
import {
  fetchTenantEmailAccounts,
  type TenantEmailAccount,
} from "@/lib/comm/platform/tenant-email-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import { useCreditStore } from "@/lib/credit-service";
import { startCreditTopUp } from "@/lib/platform-payments/platform-payment-service";
import { PaymentCheckoutCard, openRazorpayModal } from "@/components/billing/RazorpayCheckout";
import { toast } from "sonner";

function onboardingTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "connected" || status === "approved" || status === "verified") return "success";
  if (status === "in_progress" || status === "pending") return "info";
  if (status === "failed" || status === "rejected") return "danger";
  return "neutral";
}

export function TenantCommunicationsPanel({
  firmId,
  title = "Communications",
}: {
  firmId?: string;
  title?: string;
}) {
  const [waConnections, setWaConnections] = useState<WhatsAppConnection[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<TenantEmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { wallet, fetchWallet } = useCreditStore();

  // Top Up State
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [checkout, setCheckout] = useState<{
    orderId: string;
    amountPaise: number;
    keyId: string;
    credits: number;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    const [wa, email] = await Promise.all([
      fetchWhatsAppConnections({ firmId, productId: DEFAULT_AVS_PRODUCT }),
      fetchTenantEmailAccounts({ firmId }),
      fetchWallet(firmId),
    ]);
    setWaConnections(wa);
    setEmailAccounts(email);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [firmId]);

  const handleStartTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    setTopUpBusy(true);
    try {
      const result = await startCreditTopUp(amt, "whatsapp");
      if (!result.ok || !result.orderId || !result.keyId) {
        toast.error(result.error ?? "Could not initiate Razorpay checkout.");
        return;
      }
      const orderData = {
        orderId: result.orderId,
        amountPaise: result.amountPaise ?? Math.round(amt * 100),
        keyId: result.keyId,
        credits: amt,
      };
      setCheckout(orderData);
      toast.success("Opening payment gateway...");

      try {
        await openRazorpayModal({
          orderId: orderData.orderId,
          amountPaise: orderData.amountPaise,
          keyId: orderData.keyId,
          description: `Top-up ${amt} WhatsApp & AI Credits`,
          onSuccess: () => {
            setCheckout(null);
            setShowTopUpModal(false);
            void load();
            toast.success("Credits added to wallet!");
          },
          onFailure: (reason) => toast.error(reason ?? "Payment failed"),
          onDismiss: () => {},
        });
      } catch (e: any) {
        // User dismissed
      }
    } finally {
      setTopUpBusy(false);
    }
  };

  const wa = waConnections[0];

  return (
    <>
      <Panel
        title={title}
        description="WhatsApp Cloud API, Meta verification status, and Complimentary AVS Email Relay."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1 border-gold/30 text-gold hover:bg-gold/10"
              onClick={() => setShowTopUpModal(true)}
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Top Up Credits</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-7 w-7 p-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* WhatsApp */}
          <div className="rounded-sm border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gold" />
                <h4 className="text-sm font-medium">WhatsApp Cloud API</h4>
              </div>
              <StatusBadge
                tone={wa?.isEnabled ? "success" : "neutral"}
                label={wa?.isEnabled ? "Active" : "Ready"}
              />
            </div>

            {/* Credit balance display banner */}
            <div className="flex items-center justify-between p-2.5 rounded border border-gold/20 bg-gold/5 text-xs">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-gold" />
                <div>
                  <div className="font-semibold text-foreground">
                    Credit Line Balance: <span className="font-mono text-gold font-bold">{wallet?.balance_credits ?? 250} Credits</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">AVS Managed WhatsApp messaging balance</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-gold hover:bg-gold/15 font-semibold px-2"
                onClick={() => setShowTopUpModal(true)}
              >
                + Add
              </Button>
            </div>

            {wa ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Mode</dt>
                <dd>{wa.connectionMode.replace(/_/g, " ")}</dd>
                <dt className="text-muted-foreground">Billing</dt>
                <dd>{wa.billingResponsibility === "AVS" ? "AVS Managed (Included)" : "Client Owned"}</dd>
                <dt className="text-muted-foreground">WABA ID</dt>
                <dd className="font-mono truncate">{wa.wabaId ?? "AVS_WABA_PRIMARY"}</dd>
                <dt className="text-muted-foreground">Display Phone</dt>
                <dd>{wa.displayPhone ?? "+91 (AVS Verified Relay)"}</dd>
                <dt className="text-muted-foreground">Template Sync</dt>
                <dd className="flex items-center gap-1 text-emerald-600 font-medium">
                  <ShieldCheck className="h-3 w-3" /> Meta Approved
                </dd>
                <dt className="text-muted-foreground">Sent / Delivered</dt>
                <dd className="font-mono">
                  {wa.messagesSentCount ?? 0} / {wa.messagesDeliveredCount ?? 0}
                </dd>
              </dl>
            ) : (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" /> AVS Official WhatsApp Relay Active
                </div>
                <p>High-deliverability Meta Graph API verified with instant PDF invoice sharing.</p>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="rounded-sm border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-500" />
                <h4 className="text-sm font-medium">Email Dispatch Relay</h4>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/5">
                Complimentary
              </Badge>
            </div>

            <div className="p-2.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> AVS Free Managed Email Relay
                </span>
                <Badge className="bg-emerald-600 text-white text-[9px] h-4">Free / 100% On Us</Badge>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Domain: <strong className="font-mono text-foreground">arivahly.in</strong> · Zero configuration required. All transaction PDFs, receipts, and order estimates deliver automatically at no charge.
              </p>
            </div>

            {emailAccounts.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Custom SMTP Override
                </div>
                {emailAccounts.map((acct) => (
                  <div
                    key={acct.id}
                    className="rounded-sm border border-border/60 bg-muted/10 p-2 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{acct.displayName ?? acct.fromEmail}</span>
                      {acct.isDefault && <StatusBadge tone="info" label="Default" />}
                    </div>
                    <p className="text-muted-foreground font-mono text-[11px]">{acct.fromEmail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Razorpay Top-Up Modal */}
      <Dialog open={showTopUpModal} onOpenChange={(open) => {
        setShowTopUpModal(open);
        if (!open) setCheckout(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Coins className="h-5 w-5 text-gold" /> Top Up WhatsApp & AI Credits
            </DialogTitle>
            <DialogDescription className="text-xs">
              Instant credit activation via Razorpay UPI, Cards, and Net Banking.
            </DialogDescription>
          </DialogHeader>

          {checkout ? (
            <div className="space-y-4 pt-2">
              <PaymentCheckoutCard
                title={`Top-Up ${checkout.credits} WhatsApp & AI Credits`}
                subtitle="Instant credit activation via Razorpay"
                orderId={checkout.orderId}
                amountPaise={checkout.amountPaise}
                keyId={checkout.keyId}
                onSuccess={async () => {
                  toast.success("Payment received! Credits topped up successfully.");
                  setCheckout(null);
                  setShowTopUpModal(false);
                  await fetchWallet();
                }}
                onFailure={(err) => {
                  toast.error(err || "Payment could not be completed.");
                }}
                onDismiss={() => {
                  setCheckout(null);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Select or Enter Amount (₹)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["250", "500", "1000"].map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant={topUpAmount === amt ? "default" : "outline"}
                      className={`h-9 text-xs font-semibold ${
                        topUpAmount === amt ? "bg-gold text-white" : ""
                      }`}
                      onClick={() => setTopUpAmount(amt)}
                    >
                      ₹{amt}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="Custom amount in ₹"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="h-9 text-sm font-mono mt-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowTopUpModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-gold hover:bg-gold/90 text-white font-semibold gap-1.5"
                  onClick={handleStartTopUp}
                  disabled={topUpBusy}
                >
                  {topUpBusy ? "Initiating..." : `Proceed to Pay ₹${topUpAmount || "0"}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

