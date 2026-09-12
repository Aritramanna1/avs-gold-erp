import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Sparkles,
  FileSpreadsheet,
  QrCode,
  Users,
  Network,
  ArrowRightLeft,
  PiggyBank,
  CheckCircle2,
  Coins,
  Zap,
  ShoppingBag,
  Flame,
} from "lucide-react";
import { startCreditTopUp } from "@/lib/platform-payments/platform-payment-service";
import { openRazorpayModal, PaymentCheckoutCard } from "@/components/billing/RazorpayCheckout";
import { useCreditStore } from "@/lib/credit-service";
import { toast } from "sonner";

interface ExtensionItem {
  id: string;
  name: string;
  category: "Communications" | "Artificial Intelligence" | "Compliance & GST" | "Hardware & RFID" | "Human Resources" | "Multi-Store" | "Accounting" | "Customer Schemes";
  description: string;
  pricePerMonth: number;
  features: string[];
  isCore?: boolean;
  status: "active" | "available";
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const EXTENSIONS_CATALOG: ExtensionItem[] = [
  {
    id: "ext_whatsapp",
    name: "WhatsApp Cloud Messaging & Marketing",
    category: "Communications",
    description: "Official Meta WhatsApp Cloud API gateway for automated sales receipts, job slips, gold bhav broadcasts, and festival campaigns.",
    pricePerMonth: 0,
    isCore: true,
    status: "active",
    icon: MessageSquare,
    accentColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    features: [
      "Official Meta Cloud API direct webhook",
      "Instant tax invoice & receipt PDF dispatches",
      "Automated customer birthday & anniversary greetings",
      "Multi-template broadcast campaigns with analytics",
    ],
  },
  {
    id: "ext_ai",
    name: "AI Jewellery Studio & Voice Intelligence",
    category: "Artificial Intelligence",
    description: "Multimodal jewellery AI assistant: voice-to-bill transcription, smart stock descriptions, photo background studio polish, and metal demand forecasting.",
    pricePerMonth: 0,
    isCore: true,
    status: "active",
    icon: Sparkles,
    accentColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    features: [
      "Voice assistant for hands-free invoice and estimate entry",
      "Generative jewellery catalog descriptions & tags",
      "Dynamic metal price prediction & bullion bhav trends",
      "Multimodal document & Karigar slip vision extraction",
    ],
  },
  {
    id: "ext_gst",
    name: "Direct GST Portal & E-Way Bill Engine",
    category: "Compliance & GST",
    description: "Government-approved GST portal gateway: automatic IRN e-invoicing QR generation, instant E-Way bills, and one-click GSTR-1 / ITC-04 JSON exports.",
    pricePerMonth: 999,
    status: "available",
    icon: FileSpreadsheet,
    accentColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    features: [
      "One-click IRN e-Invoice & QR code generation",
      "Automated E-Way bill generation on dispatch slips",
      "GSTR-1, GSTR-3B, and ITC-04 Karigar return exports",
      "HSN 7113 / 7114 / 7108 automated tax slab reconciliation",
    ],
  },
  {
    id: "ext_barcode",
    name: "Thermal Barcode & RFID Smart Tagging",
    category: "Hardware & RFID",
    description: "Ultra-fast stock tagging engine: thermal barcode printing (ZPL/TSPL), anti-counterfeit QR security tokens, and high-speed RFID tray auditing.",
    pricePerMonth: 1499,
    status: "available",
    icon: QrCode,
    accentColor: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    features: [
      "Compatible with TSC, Zebra, and Citizen thermal printers",
      "Bulk RFID scanner tray audit (100 items/second)",
      "Tamper-evident encrypted barcode security hashes",
      "Dumbbell & rat-tail jewellery label layout builder",
    ],
  },
  {
    id: "ext_payroll",
    name: "Biometric Attendance & Karigar Wage Cloud",
    category: "Human Resources",
    description: "Integrated biometric staff attendance, optical fingerprint gateway, piece-rate Karigar making charge payroll, and automated salary advance slips.",
    pricePerMonth: 799,
    status: "available",
    icon: Users,
    accentColor: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    features: [
      "Mantra / Morpho optical scanner USB & LAN bridge",
      "Gram-based Karigar wage & outside job settlement",
      "Staff monthly salary slips & PF/ESIC deductions",
      "Attendance geo-fencing for showroom sales staff",
    ],
  },
  {
    id: "ext_multibranch",
    name: "Multi-Branch Real-Time Vault Bridge",
    category: "Multi-Store",
    description: "Connect multiple showrooms & manufacturing workshops: real-time stock transfer memos, live transit tracking, and consolidated balance sheets.",
    pricePerMonth: 1999,
    status: "available",
    icon: Network,
    accentColor: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    features: [
      "Inter-branch stock transfer & transit security PINs",
      "Centralized dual-running cash & bullion vault audits",
      "Role-based branch switching & isolation safeguards",
      "Consolidated multi-unit P&L and balance sheets",
    ],
  },
  {
    id: "ext_tally",
    name: "Tally Prime & Busy Direct Financial Bridge",
    category: "Accounting",
    description: "Seamless synchronization with Tally Prime & Busy: auto-export sales registers, Karigar gold ledger vouchers, and metal journal postings.",
    pricePerMonth: 699,
    status: "available",
    icon: ArrowRightLeft,
    accentColor: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    features: [
      "XML format direct ledger sync for Tally Prime 4.x+",
      "Day-book, Rozmel, and metal position export",
      "Dual-dimension metal fine & cash voucher mapping",
      "Continuous auto-backup to local accounting server",
    ],
  },
  {
    id: "ext_scheme",
    name: "Jewellery Scheme & Gold Kitty Savings App",
    category: "Customer Schemes",
    description: "Grow repeat showroom walk-ins: manage 11+1 gold booking schemes, monthly advance instalments, customer passbooks, and maturity vouchers.",
    pricePerMonth: 1199,
    status: "available",
    icon: PiggyBank,
    accentColor: "text-pink-500 bg-pink-500/10 border-pink-500/20",
    features: [
      "Flexible monthly installment (cash or gram basis)",
      "Automated payment reminder SMS & WhatsApp links",
      "Customer digital passbook & maturity bonus calculator",
      "Special festival booking locks (Dhanteras / Akshaya Tritiya)",
    ],
  },
];

export function ExtensionsStore() {
  const { wallet, fetchWallet } = useCreditStore();
  const [activeTab, setActiveTab] = useState<"store" | "credits">("store");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState("1000");

  const [checkout, setCheckout] = useState<{
    orderId: string;
    amountPaise: number;
    keyId: string;
    credits: number;
    title: string;
    internalPaymentId?: string;
  } | null>(null);

  // Credit pack presets with tailored routing
  const WHATSAPP_PACKS = [
    { credits: 500, amount: 250, label: "500 Messages", perMsg: "₹0.50 / msg", popular: false },
    { credits: 1500, amount: 699, label: "1,500 Messages", perMsg: "₹0.46 / msg", popular: true },
    { credits: 5000, amount: 1999, label: "5,000 Messages", perMsg: "₹0.40 / msg", popular: false },
  ];

  const AI_PACKS = [
    { credits: 250, amount: 299, label: "250 AI Actions", perMsg: "₹1.20 / query", popular: false },
    { credits: 1000, amount: 899, label: "1,000 AI Actions", perMsg: "₹0.90 / query", popular: true },
    { credits: 3000, amount: 2299, label: "3,000 AI Actions", perMsg: "₹0.76 / query", popular: false },
  ];

  async function handleBuyCreditPack(pack: { credits: number; amount: number; label: string }, walletType: "whatsapp" | "ai" | "universal") {
    setPurchasing(pack.label);
    try {
      const res = await startCreditTopUp(pack.credits, walletType === "universal" ? "ai" : walletType);
      if (res && res.ok && res.orderId) {
        const orderData = {
          orderId: res.orderId,
          amountPaise: res.amountPaise ?? pack.amount * 100,
          keyId: res.keyId,
          credits: pack.credits,
          title: `${pack.label} (${walletType.toUpperCase()})`,
          internalPaymentId: res.invoiceId,
        };
        setCheckout(orderData);
        toast.success("Opening live Razorpay gateway...");

        await openRazorpayModal({
          orderId: orderData.orderId,
          amountPaise: orderData.amountPaise,
          keyId: orderData.keyId,
          description: `AVS ERP Credit Pack: ${orderData.title}`,
          internalPaymentId: orderData.internalPaymentId,
          redirectOnSuccess: false,
          onSuccess: async () => {
            toast.success(`Payment verified! ${pack.credits} credits added.`);
            setCheckout(null);
            await fetchWallet();
          },
          onFailure: (err) => {
            toast.error(err || "Payment could not be processed.");
          },
          onDismiss: () => {
            setCheckout(null);
          },
        });
      } else {
        toast.error("Could not initiate payment order.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to launch payment.");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleBuyExtension(ext: ExtensionItem) {
    setPurchasing(ext.id);
    try {
      // Create extension purchase order
      const res = await fetch("/api/payments/create-order.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "extension",
          plan_code: ext.id,
          amount_paise: ext.pricePerMonth * 100,
        }),
      });
      const data = await res.json();
      if (data && data.success && data.razorpay_order_id) {
        const orderData = {
          orderId: data.razorpay_order_id,
          amountPaise: data.amount_paise,
          keyId: data.key_id,
          credits: 0,
          title: `Extension: ${ext.name}`,
          internalPaymentId: data.internal_payment_id,
        };
        setCheckout(orderData);
        toast.success("Opening live Razorpay gateway...");

        await openRazorpayModal({
          orderId: orderData.orderId,
          amountPaise: orderData.amountPaise,
          keyId: orderData.keyId,
          description: `Activate Extension: ${ext.name}`,
          internalPaymentId: orderData.internalPaymentId,
          redirectOnSuccess: false,
          onSuccess: () => {
            toast.success(`Payment successful! ${ext.name} has been activated for your firm.`);
            setCheckout(null);
          },
          onFailure: (err) => {
            toast.error(err || "Payment was not completed.");
          },
          onDismiss: () => {
            setCheckout(null);
          },
        });
      } else {
        toast.error(data.error || "Could not create order for this extension.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate extension purchase.");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleCustomCreditTopUp() {
    const amt = parseInt(customCredits, 10);
    if (isNaN(amt) || amt < 100) {
      toast.error("Minimum top-up is 100 credits.");
      return;
    }
    await handleBuyCreditPack({ credits: amt, amount: amt, label: `${amt} Credits` }, "universal");
  }

  return (
    <div className="space-y-6">
      {/* Checkout Card Modal if open */}
      {checkout && (
        <PaymentCheckoutCard
          title={checkout.title}
          subtitle="Instant activation with live Razorpay"
          amountPaise={checkout.amountPaise}
          orderId={checkout.orderId}
          keyId={checkout.keyId}
          internalPaymentId={checkout.internalPaymentId}
          onSuccess={() => {
            toast.success("Payment confirmed!");
            setCheckout(null);
            void fetchWallet();
          }}
          onFailure={(err) => toast.error(err)}
          onDismiss={() => setCheckout(null)}
          onCancel={() => setCheckout(null)}
        />
      )}

      {/* Navigation sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-gold" /> AVS Extensions & Capability Store
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Empower your jewellery business with purpose-built add-ons, hardware bridges, and specialized intelligence engines.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/60">
          <Button
            variant={activeTab === "store" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("store")}
            className="text-xs h-7 gap-1.5"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Extensions Catalog
          </Button>
          <Button
            variant={activeTab === "credits" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("credits")}
            className="text-xs h-7 gap-1.5"
          >
            <Coins className="h-3.5 w-3.5 text-amber-500" /> Credit Routing & Packs
          </Button>
        </div>
      </div>

      {activeTab === "store" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXTENSIONS_CATALOG.map((ext) => {
            const Icon = ext.icon;
            const isProcessing = purchasing === ext.id;

            return (
              <Card
                key={ext.id}
                className="p-5 border-border/80 bg-card hover:border-gold/40 transition-all flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${ext.accentColor}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-tight">
                          {ext.name}
                        </h4>
                        <span className="text-[11px] text-muted-foreground">
                          {ext.category}
                        </span>
                      </div>
                    </div>

                    {ext.isCore ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-semibold">
                        Core Included
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gold/40 text-gold text-[10px] uppercase font-semibold">
                        Add-on
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ext.description}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    {ext.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-foreground/90">
                        <CheckCircle2 className="h-3.5 w-3.5 text-gold shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between gap-3">
                  <div>
                    {ext.isCore ? (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Included in all plans
                      </span>
                    ) : (
                      <div>
                        <div className="text-base font-bold text-foreground">
                          ₹{ext.pricePerMonth.toLocaleString("en-IN")}{" "}
                          <span className="text-xs text-muted-foreground font-normal">/ month</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Billed monthly or annually</span>
                      </div>
                    )}
                  </div>

                  {ext.isCore ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 text-emerald-600 border-emerald-500/30 bg-emerald-500/5 cursor-default"
                    >
                      Active & Configured
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void handleBuyExtension(ext)}
                      disabled={isProcessing}
                      className="text-xs h-8 bg-gold hover:bg-gold-600 text-black font-semibold gap-1.5"
                    >
                      {isProcessing ? "Launching Gateway..." : "Activate Add-on"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === "credits" && (
        <div className="space-y-6">
          {/* Credit Routing Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp Messaging Credit Router */}
            <Card className="p-5 border-emerald-500/30 bg-emerald-500/5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/40">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">WhatsApp Messaging Credits</h4>
                    <p className="text-xs text-muted-foreground">
                      Deducted exclusively for Meta Cloud API customer invoices, slips & alerts.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">
                  Direct WhatsApp Routing
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {WHATSAPP_PACKS.map((p, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border flex flex-col justify-between ${
                      p.popular
                        ? "bg-emerald-500/15 border-emerald-500/60 shadow-xs"
                        : "bg-background border-border/80"
                    }`}
                  >
                    <div>
                      {p.popular && (
                        <span className="text-[9px] uppercase font-bold text-emerald-600 tracking-wider block mb-1">
                          Most Popular
                        </span>
                      )}
                      <div className="text-sm font-bold text-foreground">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.perMsg}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-foreground">₹{p.amount}</span>
                      <Button
                        size="sm"
                        onClick={() => void handleBuyCreditPack(p, "whatsapp")}
                        disabled={purchasing === p.label}
                        className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        {purchasing === p.label ? "..." : "Buy"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* AI Jewellery Intelligence Credit Router */}
            <Card className="p-5 border-amber-500/30 bg-amber-500/5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/40">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">AI Intelligence Credits</h4>
                    <p className="text-xs text-muted-foreground">
                      Deducted exclusively for voice billing, catalog generative descriptions & OCR.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">
                  Direct AI Routing
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {AI_PACKS.map((p, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border flex flex-col justify-between ${
                      p.popular
                        ? "bg-amber-500/15 border-amber-500/60 shadow-xs"
                        : "bg-background border-border/80"
                    }`}
                  >
                    <div>
                      {p.popular && (
                        <span className="text-[9px] uppercase font-bold text-amber-600 tracking-wider block mb-1">
                          Recommended
                        </span>
                      )}
                      <div className="text-sm font-bold text-foreground">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.perMsg}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-foreground">₹{p.amount}</span>
                      <Button
                        size="sm"
                        onClick={() => void handleBuyCreditPack(p, "ai")}
                        disabled={purchasing === p.label}
                        className="h-7 text-xs px-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                      >
                        {purchasing === p.label ? "..." : "Buy"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Universal Credit Top-up Calculator */}
          <Card className="p-5 border-border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Coins className="h-4 w-4 text-gold" /> Universal Credit Wallet Top-Up
                </h4>
                <p className="text-xs text-muted-foreground">
                  Universal credits can be spent interchangeably on WhatsApp broadcasts, AI voice billing, or storage expansions.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Current Available Balance:</span>
                <div className="text-lg font-bold text-gold">
                  {wallet?.balance_credits !== undefined ? Number(wallet.balance_credits).toFixed(1) : "—"} Credits
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="w-56">
                <Label className="text-xs text-muted-foreground mb-1 block">Custom Credits Amount</Label>
                <Input
                  type="number"
                  min="100"
                  step="100"
                  value={customCredits}
                  onChange={(e) => setCustomCredits(e.target.value)}
                  className="h-9 text-xs font-semibold"
                  placeholder="1000"
                />
              </div>

              <div className="flex gap-1.5 self-end">
                {[500, 1000, 2500, 5000].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomCredits(String(v))}
                    className="h-9 text-xs"
                  >
                    +{v}
                  </Button>
                ))}
              </div>

              <Button
                size="sm"
                onClick={handleCustomCreditTopUp}
                disabled={purchasing !== null}
                className="h-9 text-xs self-end bg-gold hover:bg-gold-600 text-black font-semibold px-4 gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" /> Pay ₹{customCredits || "0"} via Razorpay
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
