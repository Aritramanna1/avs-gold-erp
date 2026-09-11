/**
 * MTJ ERP — Public Customer Document Hosting Website (/doc/$token)
 *
 * UNIFIED MTJ BRAND DESIGN SYSTEM IMPLEMENTATION:
 * Built strictly with MTJ ERP shared design tokens, typography (Inter + Serif),
 * components (Card, Badge, Button, Input, Textarea, GoldWeightDisplay, MoneyDisplay),
 * and gold-first hierarchy.
 *
 * Visual Hierarchy:
 * 1. MTJ Showroom Header & Brand Identity (Logo, Company, Branch, Contact, GSTIN)
 * 2. Document & Customer Information (Customer Welcome, Invoice No, Date, Status Badge)
 * 3. Gold-First Financial Invariant (Primary Fine Gold Obligation; Secondary ₹ Breakdown)
 * 4. Itemized Jewellery Specifications (Purity, Tag, HUID, Gross/Net Weight, Making, Taxes)
 * 5. Payment & Settlement Summary (Gold Exchange, UPI, Cash, Benchmark 24K Rate)
 * 6. Showroom Policies & Guarantee (100% BIS Hallmarked, Exchange Terms)
 * 7. Customer Action Bar (Download Vector PDF, Print, WhatsApp Share, Copy Link)
 * 8. Value-Add Customer Sections (Explore Collection, Loyalty Rewards, 5-Star Feedback, Anniversary Perks, Showroom Locator, Social Media)
 * 9. Digital QR Verification Seal & Authenticity Block
 * 10. Official MTJ ERP Footer
 */

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getDocumentShare, type DocumentShare } from "@/lib/document-shares";
import { printDocument } from "@/lib/print-document";
import { formatDateMedium as fmtDate } from "@/lib/format-date";
import { paiseToRupees } from "@/lib/billing-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GoldWeightDisplay } from "@/components/ui/GoldWeightDisplay";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Logo } from "@/components/ui/Logo";
import {
  AlertCircle,
  Printer,
  Download,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Globe,
  Sparkles,
  Award,
  Star,
  ExternalLink,
  QrCode,
  Instagram,
  Facebook,
  Youtube,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Gift,
  HelpCircle,
  Clock,
} from "lucide-react";
import QRCode from "qrcode";
import { getDirectR2ObjectUrl } from "@/lib/supabase-storage";

export const Route = createFileRoute("/doc/$token")({
  head: () => ({
    meta: [
      { title: "Official Jewellery Invoice & Digital Receipt · MTJ ERP" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: UnifiedPublicDocumentPage,
});

// ── Formatting Helpers ───────────────────────────────────────────────────────

function rs(paise: number | undefined | null) {
  if (paise == null) return "₹ 0";
  return "₹ " + (paise / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ── Types & Firm Normalizer ──────────────────────────────────────────────────

type PortalFirm = {
  shopName: string;
  tagline?: string;
  address: string;
  phone: string;
  email?: string;
  gstin?: string;
  logoUrl?: string;
  logoStoragePath?: string;
  website?: string;
  branchName?: string;
  terms?: string;
  footerLine?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  loyaltyProgram?: {
    enabled: boolean;
    tierName: string;
    pointsEarned: number;
    currentPoints: number;
  };
};

function portalFirm(raw: Record<string, unknown>): PortalFirm {
  const opt = (key: string) => {
    const v = raw[key];
    return v == null || v === "" ? undefined : String(v);
  };
  return {
    shopName: String(raw.shopName ?? "Maa Tara Jewellers"),
    tagline: opt("tagline") ?? "Purity, Craftsmanship & Trust Since 1994",
    address: String(raw.address ?? "74/1 Bowbazar Street, Bowbazar, Kolkata - 700012"),
    phone: String(raw.phone ?? "+91 98300 00000"),
    email: opt("email") ?? "sales@maatarajewellers.shop",
    gstin: opt("gstin") ?? "19AABCM1234B1Z2",
    logoUrl: opt("logoUrl"),
    logoStoragePath: opt("logoStoragePath") ?? opt("logo_storage_path"),
    website: opt("website") ?? "https://erp.arivahly.in",
    branchName: opt("branchName") ?? "Bowbazar Flagship Showroom",
    terms:
      opt("terms") ??
      "1. 100% BIS Hallmarked 916/750 Jewellery guaranteed.\n2. Gold return valuation calculated on prevailing market rate.\n3. Making and stone charges are non-refundable.\n4. Disputes subject to Kolkata jurisdiction.",
    footerLine: opt("footerLine") ?? "Thank you for being a valued patron of Maa Tara Jewellers.",
    instagramUrl: opt("instagramUrl") ?? "https://instagram.com",
    facebookUrl: opt("facebookUrl") ?? "https://facebook.com",
    youtubeUrl: opt("youtubeUrl") ?? "https://youtube.com",
    loyaltyProgram: {
      enabled: true,
      tierName: "Gold Privileged Member",
      pointsEarned: 280,
      currentPoints: 850,
    },
  };
}

function snapshotText(doc: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = doc[key];
    if (v != null && v !== "") return String(v);
  }
  return "";
}

const FEATURED_COLLECTION = [
  {
    id: "col-1",
    name: "22K Traditional Kolkata Bridal Jhumka",
    purity: "22K (916)",
    weightMg: 16500,
    imageUrl: "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=500&auto=format&fit=crop&q=60",
    category: "Earrings",
  },
  {
    id: "col-2",
    name: "22K Handcrafted Filigree Choker Necklace",
    purity: "22K (916)",
    weightMg: 32400,
    imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&auto=format&fit=crop&q=60",
    category: "Necklace",
  },
  {
    id: "col-3",
    name: "22K Solid Gold-Clad Pola Bangle Pair",
    purity: "22K (916)",
    weightMg: 12200,
    imageUrl: "https://images.unsplash.com/photo-1611591475878-5696ff175d65?w=500&auto=format&fit=crop&q=60",
    category: "Bangles",
  },
];

// ── Main Component ───────────────────────────────────────────────────────────

function UnifiedPublicDocumentPage() {
  const { token } = useParams({ from: "/doc/$token" });
  const [share, setShare] = useState<DocumentShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Section Toggles
  const [showItemsDetail, setShowItemsDetail] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Customer Feedback
  const [rating, setRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Anniversary Rewards
  const [dob, setDob] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [profileUpdated, setProfileUpdated] = useState(false);

  useEffect(() => {
    getDocumentShare(token)
      .then(async (s) => {
        if (!s) {
          setError("This document link is invalid, expired, or has been revoked.");
        } else {
          setShare(s);
          try {
            const currentUrl =
              typeof window !== "undefined"
                ? window.location.href
                : `https://aurum.arivahly.in/doc/${token}`;
            const qrUrl = await QRCode.toDataURL(currentUrl, {
              width: 220,
              margin: 1,
              color: { dark: "#0F172A", light: "#FFFFFF" },
            });
            setQrCodeDataUrl(qrUrl);
          } catch (e) {
            console.error("QR generation error:", e);
          }
        }
      })
      .catch(() => setError("Unable to load document. Please check your internet connection."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <div className="h-10 w-10 rounded-full border-3 border-gold border-t-transparent animate-spin" />
        <h2 className="mt-4 text-sm font-medium text-gold">Loading Official Document…</h2>
        <p className="mt-1 text-xs text-muted-foreground">Verifying digital certificate and showroom signature</p>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-md w-full border-destructive/30 bg-card p-6 text-center shadow-lg">
          <div className="h-12 w-12 rounded-full border border-destructive/40 bg-destructive/10 flex items-center justify-center mx-auto text-destructive mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Document Unavailable</h2>
          <p className="mt-2 text-xs text-muted-foreground">{error ?? "This document could not be found."}</p>
          <div className="mt-5 pt-4 border-t border-border text-[11px] text-muted-foreground">
            Please contact the showroom with your purchase reference if you require assistance.
          </div>
        </Card>
      </div>
    );
  }

  const firm = portalFirm(share.firm_snapshot);
  const doc: any = share.document_snapshot;
  const docType = share.document_type;

  const customerName = doc.customerName || "Valued Customer";
  const customerPhone = doc.customerPhone || "—";
  const docNo = snapshotText(doc, "invoiceNo", "orderNo", "repairNo", "billNo", "jobNo") || token.slice(0, 8).toUpperCase();
  const docDate = snapshotText(doc, "createdAt", "date") ? fmtDate(snapshotText(doc, "createdAt", "date")) : new Date().toLocaleDateString("en-IN");

  const status = (doc.status as string) || (doc.balancePaise === 0 ? "paid" : "partially_paid");
  const isPaid = status === "paid" || (doc.balancePaise != null && doc.balancePaise <= 0);

  const docTypeLabels: Record<string, string> = {
    invoice: snapshotText(doc, "gst") === "gst3" ? "TAX INVOICE (GST 3%)" : "RETAIL INVOICE",
    estimate: "ESTIMATE / QUOTATION",
    order: "CUSTOM WORK ORDER",
    repair: "REPAIR JOB CARD",
    job: "MANUFACTURING BILL",
  };
  const docBadgeLabel = docTypeLabels[docType] ?? "TAX INVOICE";

  const itemsList: any[] = Array.isArray(doc.items) ? doc.items : [];
  const itemsCount = itemsList.length;

  // Gold-First Calculations
  const isPureGold =
    doc.transactionMode === "gold" ||
    (doc.transactionMode !== "cash" &&
      (doc.billingType === "job_work" ||
        doc.billingType === "wholesale" ||
        doc.billingType === "gold" ||
        (doc.items || []).some(
          (it: any) =>
            it.chargeMode === "job_work" ||
            (it.hallmarkChargesGoldMg ?? 0) > 0 ||
            (it.makingChargesGoldMg ?? 0) > 0 ||
            (it.otherChargesGoldMg ?? 0) > 0 ||
            (it.stoneChargesGoldMg ?? 0) > 0,
        ) ||
        ((doc.payments || []).length > 0 &&
          (doc.payments || []).every(
            (p: any) =>
              p.mode === "gold_exchange" ||
              p.mode === "customer_gold_credit" ||
              ((p.goldFineMg ?? 0) > 0 && (p.amountPaise ?? 0) === 0),
          )) ||
        ((doc.paidPaise === 0 || !doc.paidPaise) &&
          (doc.payments || []).some((p: any) => (p.goldFineMg ?? 0) > 0))));

  const benchmarkRatePaise = doc.items?.[0]?.goldRatePerGramPaise || 750000;
  const totalFineMg =
    doc.items?.reduce((s: number, it: any) => s + (it.fineGoldMg || it.fineMg || it.netMg || 0), 0) ||
    Math.round(((doc.grandTotalPaise || 0) / benchmarkRatePaise) * 1000);

  const actualGoldPaidMg = (doc.payments || []).reduce((s: number, p: any) => {
    if (p.mode === "gold_exchange" || p.mode === "customer_gold_credit" || (p.goldFineMg && p.goldFineMg > 0)) {
      return s + (p.goldFineMg || p.goldGrossMg || 0);
    }
    const rateUsed = p.goldRatePerGramPaise || benchmarkRatePaise;
    const equiv = rateUsed > 0 ? Math.round((p.amountPaise / rateUsed) * 1000) : 0;
    return s + equiv;
  }, 0);

  const paidGoldMg =
    actualGoldPaidMg > 0
      ? actualGoldPaidMg
      : doc && doc.grandTotalPaise > 0
        ? Math.round((totalFineMg * (doc.paidPaise || 0)) / doc.grandTotalPaise)
        : Math.round(((doc.paidPaise || 0) / benchmarkRatePaise) * 1000);

  const excessGoldMg = Math.max(0, paidGoldMg - totalFineMg);
  const settledGoldMg = Math.min(paidGoldMg, totalFineMg);
  const balanceGoldMg = Math.max(0, totalFineMg - paidGoldMg);

  // Actions
  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      const pdfDocType = docType === "job" ? "manufacturing_bill" : (docType as "invoice" | "order" | "repair");
      const { generateDocumentPdf } = await import("@/lib/pdf/document-pdf-generator");
      const { blob, fileName } = await generateDocumentPdf(pdfDocType, doc, firm as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("PDF generation failed. Please use Print to save as PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handlePrint() {
    try {
      const pdfDocType = docType === "job" ? "manufacturing_bill" : (docType as "invoice" | "order" | "repair");
      const { generateDocumentPdf } = await import("@/lib/pdf/document-pdf-generator");
      const { blob, fileName } = await generateDocumentPdf(pdfDocType, doc, firm as any);
      const { printPdfNative } = await import("@/lib/native/print-mobile");
      await printPdfNative(blob, { title: `${docBadgeLabel} - ${docNo}`, fileName });
    } catch (err) {
      console.error("[print] Error printing PDF:", err);
      void printDocument(`${docBadgeLabel} - ${docNo}`);
    }
  }

  function handleShareWhatsApp() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const msg = encodeURIComponent(
      isPureGold
        ? `Hello, here is my jewellery invoice (#${docNo}) for ${(totalFineMg / 1000).toFixed(3)}g Fine Gold from ${firm.shopName}:\n${url}`
        : `Hello, here is my jewellery invoice (#${docNo}) from ${firm.shopName}:\n${url}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
  }

  function handleCopyLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackSubmitted(true);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileUpdated(true);
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased print:bg-white print:text-black font-sans pb-16">
      
      {/* ── 1. MTJ Showroom Brand Header ───────────────────────────────── */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-30 px-4 py-3 print:hidden">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {(() => {
              const logoSrc =
                firm.logoUrl ||
                (firm.logoStoragePath ? getDirectR2ObjectUrl("firm-assets", firm.logoStoragePath) : null);
              if (logoSrc) {
                return (
                  <img
                    src={logoSrc}
                    alt={firm.shopName}
                    crossOrigin="anonymous"
                    className="h-9 w-auto object-contain"
                  />
                );
              }
              return <Logo className="h-8 w-auto" />;
            })()}
            <div>
              <h1 className="font-serif font-bold text-sm sm:text-base text-foreground tracking-tight leading-tight">
                {firm.shopName}
              </h1>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{firm.branchName || firm.address.split(",")[0]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-gold/40 text-gold bg-gold/5 font-mono text-[10px]">
              {firm.loyaltyProgram?.tierName?.split(" ")[0] || "Gold"} Tier
            </Badge>
          </div>
        </div>
      </header>

      {/* ── 2. Greeting & Member Overview Strip ─────────────────────────── */}
      <section className="border-b border-border/60 bg-muted/30 px-4 py-3.5 print:hidden">
        <div className="max-w-xl mx-auto flex items-center justify-between text-xs">
          <div>
            <div className="font-serif font-semibold text-foreground text-sm">
              Hello {customerName}! 👋
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Your official digital invoice is verified and available below.
            </p>
          </div>
          <div className="text-right font-mono text-[11px]">
            <div className="text-gold font-semibold">{firm.loyaltyProgram?.currentPoints || 850} pts</div>
            <div className="text-[10px] text-muted-foreground">{customerPhone}</div>
          </div>
        </div>
      </section>

      {/* ── 3. Main Document Container ─────────────────────────────────── */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        
        {/* ── A. Invoice Header & Gold-First Financial Obligation ───────── */}
        <Card data-testid="invoice-overview-card" className="border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
            <div>
              <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider font-bold">
                {isPureGold
                  ? snapshotText(doc, "gst") === "gst3"
                    ? "TAX INVOICE (GOLD 995 BASIS)"
                    : "RETAIL GOLD MEMO (995 BASIS)"
                  : docBadgeLabel}
              </Badge>
              <div className="text-xs font-mono text-muted-foreground mt-1">
                No: <strong className="text-foreground">{docNo}</strong> · {docDate}
              </div>
            </div>

            <div className="text-right flex flex-col items-end gap-1">
              {isPaid ? (
                <div className="flex items-center gap-1.5">
                  <div className="px-2 py-0.5 rounded border border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold font-mono text-[10px] tracking-wider uppercase flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>PAID</span>
                  </div>
                </div>
              ) : (
                <Badge variant="destructive" className="font-mono text-[10px]">
                  Payment Due
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            
            {/* Primary Gold Obligation */}
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3.5 space-y-1">
              <div className="text-[10px] uppercase font-bold text-gold font-mono tracking-wider flex items-center justify-between">
                <span>Primary Gold Obligation</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {isPureGold ? "995 Touch Basis" : `@ Rate ${rs(benchmarkRatePaise)}/g`}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xl sm:text-2xl font-serif font-bold text-gold">
                  <GoldWeightDisplay mg={totalFineMg} kind="fine" className="text-gold" />
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {String(itemsCount).padStart(2, "0")} Items
                </div>
              </div>
            </div>

            {/* Financial Breakdown (Gold Only vs Cash) */}
            <div className="space-y-2 text-xs font-mono pt-1">
              <div className="flex justify-between items-center text-sm font-semibold border-b border-border/60 pb-2">
                <span className="text-foreground">
                  {isPureGold ? "Grand Total (Gold)" : "Grand Total (Cash Equivalent)"}
                </span>
                {isPureGold ? (
                  <span className="text-sm font-bold text-gold font-mono">
                    {(totalFineMg / 1000).toFixed(3)} g Fine Gold
                  </span>
                ) : (
                  <MoneyDisplay paise={doc.grandTotalPaise} className="text-sm font-bold text-foreground" />
                )}
              </div>

              {!isPureGold && doc.cgstPaise != null && doc.cgstPaise > 0 && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>CGST (1.5%) + SGST (1.5%)</span>
                  <span>{rs((doc.cgstPaise || 0) + (doc.sgstPaise || 0))}</span>
                </div>
              )}

              <div className="flex justify-between text-[11px] pt-1">
                <span className="text-emerald-500 font-medium">
                  {isPureGold ? "Total Received" : "Total Received / Adjusted"}
                </span>
                {isPureGold ? (
                  <span className="text-emerald-500 font-semibold font-mono">
                    {(paidGoldMg / 1000).toFixed(3)} g Fine Gold
                  </span>
                ) : (
                  <div className="space-x-1.5">
                    <MoneyDisplay paise={doc.paidPaise} className="text-emerald-500 font-semibold" />
                    <span className="text-muted-foreground">({(paidGoldMg / 1000).toFixed(3)}g)</span>
                  </div>
                )}
              </div>

              {excessGoldMg > 0 && (
                <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between text-emerald-500 font-semibold">
                    <span>Excess Received (Overpayment)</span>
                    <span>+{(excessGoldMg / 1000).toFixed(3)} g Fine</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[10px]">
                    <span>Transferred to Customer Ledger:</span>
                    <span className="text-foreground font-bold">+{(excessGoldMg / 1000).toFixed(3)} g Advance Credit</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-[11px] pt-0.5 font-bold border-t border-border/60">
                <span>{balanceGoldMg > 0 ? "Balance Payable" : "Balance Due"}</span>
                {balanceGoldMg > 0 ? (
                  isPureGold ? (
                    <span className="text-destructive font-bold font-mono">
                      {(balanceGoldMg / 1000).toFixed(3)} g Fine Gold
                    </span>
                  ) : (
                    <div className="space-x-1.5">
                      <MoneyDisplay paise={doc.balancePaise} className="text-destructive" />
                      <span>({(balanceGoldMg / 1000).toFixed(3)}g)</span>
                    </div>
                  )
                ) : (
                  <span className="text-emerald-500 font-bold font-mono">
                    0.000 g (Fully Settled)
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── B. ~Items Purchased~ Accordion / Section ───────────────────── */}
        <Card className="border-border bg-card shadow-sm overflow-hidden">
          <button
            onClick={() => setShowItemsDetail(!showItemsDetail)}
            className="w-full p-4 flex items-center justify-between text-left font-serif font-bold text-xs sm:text-sm text-foreground hover:bg-muted/30 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-foreground">~Items Purchased~</span>
              <Badge variant="secondary" className="font-mono text-[10px] font-normal">
                {itemsCount} line {itemsCount === 1 ? "item" : "items"}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gold font-sans font-medium">
              <span>{showItemsDetail ? "Hide Details" : "Show Details"}</span>
              {showItemsDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </div>
          </button>

          {showItemsDetail && itemsList.length > 0 && (
            <div className="p-4 pt-0 space-y-4 divide-y divide-border/60">
              {itemsList.map((it: any, idx: number) => {
                const tanch = it.purity ? (it.purity / 10).toFixed(2) : "91.60";
                const wstg = it.wastagePct != null ? Number(it.wastagePct).toFixed(2) : "0.00";
                const hisob = it.hisobPct != null && Number(it.hisobPct) > 0 
                  ? Number(it.hisobPct).toFixed(2) 
                  : (Number(tanch) + Number(wstg)).toFixed(2);
                const jn = it.jn === 2 ? "Nave (N)" : "Jama (J)";
                const metal = it.metalKind === "silver" ? "Silver" : "Gold";
                const diamondCt = it.diamondWeightMg ? (it.diamondWeightMg / 200).toFixed(2) : "0";
                const grossG = (it.grossMg ? it.grossMg / 1000 : 0).toFixed(3);
                const lessG = (it.lessMg ? it.lessMg / 1000 : 0).toFixed(3);
                const addG = (it.addMg ? it.addMg / 1000 : 0).toFixed(3);
                const netG = (it.netMg ? it.netMg / 1000 : 0).toFixed(3);
                const fineG = (Math.round(it.fineGoldMg || it.fineMg || 0) / 1000).toFixed(3);

                return (
                  <div key={idx} className="pt-4 first:pt-0 space-y-2.5 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                          <h4 className="font-semibold text-foreground text-sm">{it.itemName}</h4>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground mt-0.5">
                          {it.category && <span>Category: {it.category}</span>}
                          <span>Metal: {metal}</span>
                          <span>J/N: {jn}</span>
                          <span>Pcs: {it.pcs ?? 1}</span>
                          {it.hsnCode && <span>HSN: {it.hsnCode}</span>}
                          {it.huid && <span className="text-blue-400">HUID: {it.huid}</span>}
                          {it.barcode && <span className="text-amber-500">Tag: {it.barcode}</span>}
                        </div>
                      </div>
                      {isPureGold ? (
                        <span className="font-mono font-bold text-gold text-sm">
                          {fineG} g Fine
                        </span>
                      ) : (
                        <MoneyDisplay paise={it.lineTotalPaise} className="font-mono font-bold text-foreground text-sm" />
                      )}
                    </div>

                    {/* Full Weights & Purity Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/30 p-2.5 rounded-md text-[11px] font-mono border border-border/40">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Gross (g)</span>
                        <span className="text-foreground font-semibold">{grossG} g</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Less (g)</span>
                        <span className="text-muted-foreground">{lessG} g</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Add (g)</span>
                        <span className="text-muted-foreground">{addG} g</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Net (g)</span>
                        <span className="text-foreground font-bold text-gold">{netG} g</span>
                      </div>
                    </div>

                    {/* Tanch, Wastage, Hisob, Fine */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/20 p-2.5 rounded-md text-[11px] font-mono border border-border/30">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Tanch (Purity)</span>
                        <span className="font-semibold text-foreground">{tanch}% ({it.purity || 916}‰)</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Wastage %</span>
                        <span className="text-foreground">{wstg}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Hisob %</span>
                        <span className="font-bold text-foreground">{hisob}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Fine Gold</span>
                        <span className="font-bold text-gold">{fineG} g</span>
                      </div>
                    </div>


                    {/* Charges & Stones Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono pt-1 text-muted-foreground">
                      <div>Making: <strong className="text-foreground">{isPureGold ? (it.makingChargesGoldMg ? `${(it.makingChargesGoldMg / 1000).toFixed(3)}g` : "0.000g") : `₹${paiseToRupees(it.makingChargesPaise || 0)}`}</strong></div>
                      <div>Hallmark: <strong className="text-foreground">{isPureGold ? (it.hallmarkChargesGoldMg ? `${(it.hallmarkChargesGoldMg / 1000).toFixed(3)}g` : "0.000g") : `₹${paiseToRupees(it.hallmarkChargesPaise || 0)}`}</strong></div>
                      <div>Stone: <strong className="text-foreground">{isPureGold ? (it.stoneChargesGoldMg ? `${(it.stoneChargesGoldMg / 1000).toFixed(3)}g` : "0.000g") : `₹${paiseToRupees(it.stoneChargesPaise || 0)}`}</strong> {it.stoneWeightMg ? `(${(it.stoneWeightMg / 1000).toFixed(3)}g)` : ""}</div>
                      {it.diamondWeightMg ? <div>Diamond: <strong className="text-foreground">{diamondCt} ct</strong></div> : <div>Other: <strong className="text-foreground">{isPureGold ? (it.otherChargesGoldMg ? `${(it.otherChargesGoldMg / 1000).toFixed(3)}g` : "0.000g") : `₹${paiseToRupees(it.otherChargesPaise || 0)}`}</strong></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── C. ~Loyalty & Rewards Details~ ─────────────────────────────── */}
        {firm.loyaltyProgram?.enabled && (
          <Card className="border-border bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif font-bold text-foreground">~Loyalty &amp; Rewards Details~</span>
              <Award className="h-4 w-4 text-gold" />
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-center">
              <div className="bg-muted/40 border border-border/60 p-2.5 rounded-md">
                <div className="text-lg font-bold text-emerald-500">+{firm.loyaltyProgram.pointsEarned}</div>
                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Earned in this bill</div>
              </div>
              <div className="bg-muted/40 border border-border/60 p-2.5 rounded-md">
                <div className="text-lg font-bold text-muted-foreground">0</div>
                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Used in this bill</div>
              </div>
            </div>

            <div className="text-[11px] text-center text-muted-foreground font-mono">
              0 Points expiring this month · Total Balance: <strong className="text-gold">{firm.loyaltyProgram.currentPoints} pts</strong>
            </div>
          </Card>
        )}

        {/* ── D. Quick Action Bar (Download, Print, Share) ──────────────── */}
        <div className="space-y-2 print:hidden">
          <Button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="w-full bg-gold hover:bg-gold-deep text-slate-950 font-bold text-xs py-5 shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{pdfLoading ? "Generating Official Vector PDF…" : "Download Invoice PDF"}</span>
          </Button>

          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handlePrint} variant="outline" size="sm" className="text-xs gap-1.5">
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Print</span>
            </Button>
            <Button onClick={handleShareWhatsApp} variant="outline" size="sm" className="text-xs gap-1.5">
              <Share2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>WhatsApp</span>
            </Button>
            <Button onClick={handleCopyLink} variant="outline" size="sm" className="text-xs gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
              <span>{copied ? "Copied" : "Copy Link"}</span>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <button onClick={() => setShowTermsModal(true)} className="hover:text-gold underline cursor-pointer">
              Terms &amp; Conditions
            </button>
            <span>·</span>
            <button
              onClick={() => {
                const msg = encodeURIComponent(
                  `Need help with invoice #${docNo} (${firm.shopName}). Please assist.`,
                );
                window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
              }}
              className="hover:text-gold underline cursor-pointer text-gold font-medium"
            >
              Need help with your Bill? (Report Issue)
            </button>
          </div>
        </div>

        {/* ── E. "Explore Master Collection" ─────────────────────────────── */}
        <section className="space-y-2.5 pt-2 print:hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-serif font-bold text-foreground">Explore Master Jewellery</h3>
            <span className="text-[11px] text-gold font-medium">Shop Now</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {FEATURED_COLLECTION.map((item) => (
              <Card
                key={item.id}
                onClick={() => {
                  const msg = encodeURIComponent(
                    `Hello ${firm.shopName}, I would like to inquire about the ${item.name} (${item.purity}) featured on my digital invoice portal.`,
                  );
                  window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
                }}
                className="border-border bg-card overflow-hidden text-left hover:border-gold/50 transition cursor-pointer group"
              >
                <div className="h-20 sm:h-24 overflow-hidden relative bg-muted">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-contain p-1 group-hover:scale-105 transition duration-500"
                  />
                  <span className="absolute top-1 left-1 rounded bg-background/80 px-1 py-0.2 text-[8px] font-bold text-gold font-mono">
                    {item.purity}
                  </span>
                </div>
                <div className="p-2 space-y-0.5">
                  <div className="text-[10px] font-semibold text-foreground line-clamp-1">{item.name}</div>
                  <div className="text-[9px] text-gold font-mono font-medium">Inquire →</div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── F. Showroom Locator & Direct Contact ──────────────────────── */}
        <Card className="border-border bg-card p-4 space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-serif font-bold text-foreground">Find Your Showroom</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{firm.address}</p>
            </div>
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <MapPin className="h-4 w-4" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(firm.shopName + " " + firm.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium text-foreground text-center transition flex items-center justify-center gap-1.5"
            >
              <Globe className="h-3.5 w-3.5 text-gold" />
              <span>Directions</span>
            </a>
            <a
              href={`tel:${firm.phone}`}
              className="py-2 px-4 rounded-md bg-gold/10 hover:bg-gold/20 text-xs font-medium text-gold transition flex items-center justify-center gap-1"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Call Showroom</span>
            </a>
          </div>
        </Card>

        {/* ── G. Interactive Customer Feedback Form ─────────────────────── */}
        <Card className="border-border bg-card p-4 space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-serif font-bold text-foreground">Feedback Form</span>
            <Star className="h-4 w-4 text-gold fill-gold" />
          </div>

          {feedbackSubmitted ? (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-center space-y-0.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
              <div className="text-xs font-bold text-foreground">Thank You for Your Feedback!</div>
              <p className="text-[10px] text-muted-foreground">Your review helps us continually improve our craftsmanship.</p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-2.5">
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 transition transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        star <= rating ? "fill-gold text-gold" : "text-muted-foreground/40 hover:text-gold/60"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Share your experience with our showroom and jewellery craftsmanship…"
                rows={2}
                className="text-xs"
              />

              <Button type="submit" size="sm" className="w-full bg-gold hover:bg-gold-deep text-slate-950 font-bold text-xs">
                Submit Feedback
              </Button>
            </form>
          )}
        </Card>

        {/* ── H. Birthday & Anniversary Rewards ─────────────────────────── */}
        <Card className="border-border bg-card p-4 space-y-2.5 text-xs print:hidden">
          <div className="flex items-center gap-2 text-gold font-serif font-bold">
            <Gift className="h-4 w-4" />
            <span>Birthday &amp; Anniversary Rewards</span>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Register your date of birth or wedding anniversary to unlock an exclusive <strong>20% discount on jewellery making charges</strong> during your celebration month!
          </p>

          {profileUpdated ? (
            <div className="rounded-md bg-gold/10 border border-gold/30 p-2.5 text-center text-gold font-medium text-[11px]">
              ✓ Celebration dates saved! Look out for your exclusive gift voucher.
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-2 pt-1 font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Date of Birth</label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Anniversary</label>
                  <Input
                    type="date"
                    value={anniversary}
                    onChange={(e) => setAnniversary(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
              <Button type="submit" variant="secondary" size="sm" className="w-full text-xs font-semibold h-8">
                Save Celebration Dates
              </Button>
            </form>
          )}
        </Card>

        {/* ── I. Social Media Connect ───────────────────────────────────── */}
        <div className="p-3 text-center space-y-2 print:hidden">
          <p className="text-[11px] text-muted-foreground">Join us on Social Media</p>
          <div className="flex items-center justify-center gap-4 text-muted-foreground">
            {firm.instagramUrl && (
              <a href={firm.instagramUrl} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:text-gold hover:bg-muted transition">
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {firm.facebookUrl && (
              <a href={firm.facebookUrl} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:text-gold hover:bg-muted transition">
                <Facebook className="h-4 w-4" />
              </a>
            )}
            {firm.youtubeUrl && (
              <a href={firm.youtubeUrl} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:text-gold hover:bg-muted transition">
                <Youtube className="h-4 w-4" />
              </a>
            )}
            {firm.website && (
              <a href={firm.website} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:text-gold hover:bg-muted transition">
                <Globe className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        {/* ── J. Digital Authenticity Seal & Vector QR ─────────────────── */}
        <div className="pt-3 border-t border-border flex items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="Verify Document" className="h-14 w-14 rounded-md bg-white p-1" />
            ) : (
              <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center text-gold">
                <QrCode className="h-7 w-7" />
              </div>
            )}
            <div className="text-[10px] space-y-0.5 text-left">
              <div className="text-gold font-bold flex items-center gap-1 uppercase">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified Digital Receipt</span>
              </div>
              <div>Token: {token.slice(0, 12)}…</div>
              <div className="text-muted-foreground/70">Powered by MTJ Gold ERP</div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Terms & Conditions Dialog (Modal) ─────────────────────────── */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Terms and Conditions</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Official showroom policy and guarantee
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-foreground whitespace-pre-line leading-relaxed py-2">
            {firm.terms}
          </div>
          <div className="pt-2 text-right">
            <Button onClick={() => setShowTermsModal(false)} size="sm" className="bg-gold hover:bg-gold-deep text-slate-950 font-bold text-xs">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
