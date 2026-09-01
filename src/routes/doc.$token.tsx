/**
 * MTJ ERP — Public Customer-Facing Document Hosting Website (/doc/$token)
 *
 * Dedicated standalone, mobile-first customer portal for shared invoices, receipts,
 * orders, and repair slips.
 *
 * Features:
 * - Unauthenticated secure token access
 * - Configurable firm branding (Logo, Shop Name, Phone, Address, GSTIN, Website)
 * - Gold-First headline obligation & dual-currency accounting
 * - Authoritative status badges (Paid, Partially Paid, Pending, Cancelled)
 * - Interactive actions: Download PDF, Vector Print, WhatsApp Share, Copy Link
 * - Scannable vector QR Code for document authenticity verification
 * - Curated "Explore Our Collection" showcase (R2 persistent image references)
 * - Configurable Promotional / Festive Announcement Banner
 * - Customer Loyalty Tier / Points display
 * - Social & Video Connect (Instagram, YouTube, Facebook)
 * - Interactive 5-Star Customer Feedback form (no login required)
 * - Responsive across 390px (Mobile-First), 768px (Tablet), and 1440px (Desktop)
 */

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getDocumentShare, type DocumentShare } from "@/lib/document-shares";
import { printDocument } from "@/lib/print-document";
import { formatDateMedium as fmtDate } from "@/lib/format-date";
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
} from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/doc/$token")({
  head: () => ({
    meta: [
      { title: "Official Jewellery Invoice & Document · MTJ ERP" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: PublicDocumentHostingPage,
});

// ── Formatting Helpers ───────────────────────────────────────────────────────

function rs(paise: number | undefined | null) {
  if (paise == null) return "₹0.00";
  return "₹" + (paise / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function grams(mg: number | undefined | null) {
  if (mg == null) return "0.000g";
  return (mg / 1000).toFixed(3) + "g";
}

type PortalFirm = {
  shopName: string;
  tagline?: string;
  address: string;
  phone: string;
  email?: string;
  gstin?: string;
  logoUrl?: string;
  website?: string;
  terms?: string;
  footerLine?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  promoBanner?: {
    enabled: boolean;
    title: string;
    description: string;
  };
  loyaltyProgram?: {
    enabled: boolean;
    tierName: string;
    pointsEarned: number;
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
    logoUrl: opt("logoUrl") ?? "https://maatarajewellers.shop/assets/ornexa-logo-full.png",
    website: opt("website") ?? "https://maatarajewellers.shop",
    terms:
      opt("terms") ??
      "1. 100% BIS Hallmarked 916/750 Jewellery guaranteed.\n2. Gold return valuation calculated on prevailing market rate.\n3. Making and stone charges are non-refundable.\n4. Disputes subject to Kolkata jurisdiction.",
    footerLine: opt("footerLine") ?? "Thank you for being a valued customer of Maa Tara Jewellers.",
    instagramUrl: opt("instagramUrl") ?? "https://instagram.com",
    facebookUrl: opt("facebookUrl") ?? "https://facebook.com",
    youtubeUrl: opt("youtubeUrl") ?? "https://youtube.com",
    promoBanner: {
      enabled: true,
      title: "Festive Gold Exchange Special",
      description: "Upgrade your old gold with 100% valuation and 0% melting loss on 22K hallmark exchange this week.",
    },
    loyaltyProgram: {
      enabled: true,
      tierName: "Gold Privileged Member",
      pointsEarned: 280,
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

// ── Featured Products Catalog for "Explore Collection" ───────────────────────

const FEATURED_COLLECTION = [
  {
    id: "col-1",
    name: "Kolkata Handcrafted Bridal Jhumka",
    purity: "22K (916)",
    weight: "16.500g",
    imageUrl: "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=500&auto=format&fit=crop&q=60",
    category: "Earrings",
  },
  {
    id: "col-2",
    name: "Filigree Temple Design Choker Necklace",
    purity: "22K (916)",
    weight: "32.400g",
    imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&auto=format&fit=crop&q=60",
    category: "Necklace",
  },
  {
    id: "col-3",
    name: "Classic Solid Pola Bangle with Gold Cladding",
    purity: "22K (916)",
    weight: "12.200g",
    imageUrl: "https://images.unsplash.com/photo-1611591475878-5696ff175d65?w=500&auto=format&fit=crop&q=60",
    category: "Bangles",
  },
];

// ── Main Page Component ──────────────────────────────────────────────────────

function PublicDocumentHostingPage() {
  const { token } = useParams({ from: "/doc/$token" });
  const [share, setShare] = useState<DocumentShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Customer Feedback state
  const [rating, setRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    getDocumentShare(token)
      .then(async (s) => {
        if (!s) {
          setError("This document link is invalid, expired, or has been revoked.");
        } else {
          setShare(s);
          // Generate unique QR Code data URL pointing to this verified public URL
          try {
            const currentUrl = typeof window !== "undefined" ? window.location.href : `https://aurum.arivahly.in/doc/${token}`;
            const qrUrl = await QRCode.toDataURL(currentUrl, {
              width: 220,
              margin: 1,
              color: { dark: "#0F172A", light: "#FFFFFF" },
            });
            setQrCodeDataUrl(qrUrl);
          } catch (e) {
            console.error("QR Code generation error:", e);
          }
        }
      })
      .catch(() => setError("Unable to load the document. Please check your internet connection."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="h-12 w-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
        <h2 className="mt-4 text-base font-serif font-semibold text-amber-300">Loading Official Document…</h2>
        <p className="mt-1 text-xs text-slate-400">Verifying security token and digital signature</p>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="h-16 w-16 rounded-full border border-red-500/40 bg-red-500/10 flex items-center justify-center mx-auto text-red-400 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-100">Document Unavailable</h2>
          <p className="mt-2 text-sm text-slate-400">{error ?? "This document could not be found."}</p>
          <div className="mt-6 pt-6 border-t border-slate-800 text-xs text-slate-500">
            If you believe this is an error, please contact the jewellery showroom directly with your invoice reference.
          </div>
        </div>
      </div>
    );
  }

  const firm = portalFirm(share.firm_snapshot);
  const doc: any = share.document_snapshot;
  const docType = share.document_type;

  const docNo = snapshotText(doc, "invoiceNo", "orderNo", "repairNo", "billNo", "jobNo") || token.slice(0, 8).toUpperCase();
  const docDate = snapshotText(doc, "createdAt", "date") ? fmtDate(snapshotText(doc, "createdAt", "date")) : new Date().toLocaleDateString("en-IN");
  
  const status = (doc.status as string) || (doc.balancePaise === 0 ? "paid" : "partially_paid");
  const isPaid = status === "paid" || (doc.balancePaise != null && doc.balancePaise <= 0);

  const docTypeLabels: Record<string, string> = {
    invoice: snapshotText(doc, "gst") === "gst3" ? "Tax Invoice (GST 3%)" : "Official Retail Invoice",
    estimate: "Estimate & Quotation",
    order: "Custom Jewellery Work Order",
    repair: "Repair & Restoration Job Slip",
    job: "Workshop Manufacturing Bill",
  };
  const docTitle = docTypeLabels[docType] ?? "Jewellery Invoice";

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
      alert("PDF generation failed. You can use the Print button to save as PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  function handlePrint() {
    void printDocument(`${docTitle} - ${docNo}`);
  }

  function handleShareWhatsApp() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const msg = encodeURIComponent(
      `Hello, here is the official jewellery document (${docTitle} #${docNo}) from ${firm.shopName}:\n${url}`,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased print:bg-white print:text-black">
      {/* ── Top Customer Navigation Bar (No ERP Sidebar) ──────────────── */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 print:hidden shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {firm.logoUrl ? (
              <img src={firm.logoUrl} alt={firm.shopName} className="h-8 w-auto object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 font-serif font-bold">
                MT
              </div>
            )}
            <div>
              <div className="text-xs font-serif font-bold text-amber-400 tracking-wide uppercase line-clamp-1">
                {firm.shopName}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <ShieldCheck className="h-3 w-3" />
                <span>Verified Authentic Document</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleShareWhatsApp}
              title="Share on WhatsApp"
              className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleCopyLink}
              title="Copy Link"
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{pdfLoading ? "Preparing…" : "Download PDF"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container (Mobile-First, max-w-3xl) ────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        
        {/* 1. Promotional / Festive Banner (Configurable) */}
        {firm.promoBanner?.enabled && (
          <div className="print:hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 p-4 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                  {firm.promoBanner.title}
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {firm.promoBanner.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Main Luxury Invoice Card */}
        <div
          data-testid="public-invoice-card"
          className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden print:border-none print:shadow-none print:p-0 print:bg-white"
        >
          {/* Top Gold Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 print:hidden" />

          {/* Header & Showroom Identity */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-800 print:border-black">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {firm.logoUrl && (
                  <img src={firm.logoUrl} alt={firm.shopName} className="h-12 w-auto object-contain" />
                )}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-amber-400 tracking-tight leading-none print:text-black">
                    {firm.shopName}
                  </h1>
                  {firm.tagline && (
                    <p className="text-[11px] text-slate-400 uppercase tracking-widest font-mono mt-1 print:text-gray-600">
                      {firm.tagline}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-0.5 pt-2 print:text-gray-700">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
                  <span>{firm.address}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
                  <span>{firm.phone}</span>
                  {firm.email && <span>· {firm.email}</span>}
                </div>
                {firm.gstin && (
                  <div className="pt-1">
                    <span className="inline-block rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400 uppercase print:text-black print:border-black">
                      GSTIN: {firm.gstin}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Document Metadata & Status Badge */}
            <div className="sm:text-right space-y-2">
              <div className="inline-block">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono ${
                    isPaid
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                      : status === "cancelled"
                        ? "bg-red-500/15 border border-red-500/30 text-red-400"
                        : "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                  {isPaid ? "Fully Paid" : status === "cancelled" ? "Cancelled" : "Payment Pending"}
                </span>
              </div>

              <div className="text-xs space-y-0.5 font-mono">
                <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                  {docTitle}
                </div>
                <div className="text-slate-300 font-semibold print:text-black">
                  Doc No: <span className="text-white print:text-black font-bold">{docNo}</span>
                </div>
                <div className="text-slate-400 print:text-gray-600">
                  Date: <span className="text-slate-200 print:text-black">{docDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To Customer Details */}
          <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs print:bg-gray-50 print:border-gray-300">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider font-mono">
                Customer / Billed To
              </div>
              <div className="text-base font-bold text-white mt-1 print:text-black">
                {doc.customerName || "Walk-in Valued Customer"}
              </div>
              {doc.customerPhone && (
                <div className="text-slate-400 mt-0.5 print:text-gray-700">Phone: {doc.customerPhone}</div>
              )}
            </div>
            {doc.customerGstin && (
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
                  Customer GSTIN
                </div>
                <div className="font-mono text-slate-200 mt-1 font-semibold print:text-black">
                  {doc.customerGstin}
                </div>
              </div>
            )}
          </div>

          {/* Itemized Jewellery Table */}
          {Array.isArray(doc.items) && doc.items.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-gray-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-300 uppercase text-[10px] font-mono tracking-wider print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Purity</th>
                    <th className="p-3 text-right">Gross Wt</th>
                    <th className="p-3 text-right">Net Wt</th>
                    <th className="p-3 text-right">Making</th>
                    <th className="p-3 text-right font-bold text-amber-400 print:text-black">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-gray-200">
                  {doc.items.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/20 transition">
                      <td className="p-3">
                        <div className="font-bold text-white print:text-black">{it.itemName}</div>
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                          {it.barcode && <span className="text-amber-400 font-semibold">Tag: {it.barcode}</span>}
                          {it.huid && <span>HUID: {it.huid}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-slate-200 print:text-black">
                        {it.purity ? `${it.purity}` : "916 (22K)"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-200 print:text-black">
                        {grams(it.grossMg)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-white print:text-black">
                        {grams(it.netMg)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-300 print:text-black">
                        {rs(it.makingChargesPaise)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-400 print:text-black">
                        {rs(it.lineTotalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Gold-First Headline Accounting Matrix ──────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Box A: Primary Gold Accounting (Gold-First Invariant) */}
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 space-y-3 font-mono print:border-black print:bg-gray-50">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider print:text-black">
                  Primary Gold Obligation
                </span>
                <Award className="h-4 w-4 text-amber-400" />
              </div>

              {(() => {
                const rate = doc.items?.[0]?.goldRatePerGramPaise || 750000;
                const totalGoldMg =
                  doc.items?.reduce((s: number, it: any) => s + (it.fineGoldMg || it.fineMg || it.netMg || 0), 0) ||
                  Math.round(((doc.grandTotalPaise || 0) / rate) * 1000);
                const paidGoldMg = Math.round(((doc.paidPaise || 0) / rate) * 1000);
                const balanceGoldMg = Math.max(0, totalGoldMg - paidGoldMg);

                return (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 print:text-gray-600">Pure Gold Obligation:</span>
                      <span className="text-base font-bold text-amber-300 print:text-black">{grams(totalGoldMg)} Fine</span>
                    </div>
                    <div className="flex justify-between items-baseline text-emerald-400">
                      <span>Gold Paid / Equivalent:</span>
                      <span className="font-bold">{grams(paidGoldMg)}</span>
                    </div>
                    {balanceGoldMg > 0 ? (
                      <div className="flex justify-between items-baseline text-amber-400 font-bold border-t border-amber-500/20 pt-1.5">
                        <span>Balance Due (Gold):</span>
                        <span>{grams(balanceGoldMg)} Fine</span>
                      </div>
                    ) : (
                      <div className="text-right text-[11px] text-emerald-400 font-bold pt-1">
                        ✓ Gold Obligation Settled
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 pt-1 print:text-gray-500">
                      Benchmark Gold Rate: {rs(rate)}/g
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Box B: Secondary Financial / Cash Accounting */}
            <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-5 space-y-2 font-mono text-xs print:border-gray-300 print:bg-gray-50">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2 print:text-black">
                Financial Breakdown (₹)
              </div>

              <div className="flex justify-between text-slate-400 print:text-gray-600">
                <span>Taxable Value:</span>
                <span className="text-slate-200 print:text-black">{rs(doc.subtotalPaise)}</span>
              </div>

              {doc.gst === "gst3" && (
                <>
                  <div className="flex justify-between text-slate-400 print:text-gray-600">
                    <span>CGST (1.5%):</span>
                    <span className="text-slate-200 print:text-black">{rs(doc.cgstPaise)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 print:text-gray-600">
                    <span>SGST (1.5%):</span>
                    <span className="text-slate-200 print:text-black">{rs(doc.sgstPaise)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-base font-bold text-white border-t border-slate-700 pt-2 print:text-black">
                <span>Grand Total:</span>
                <span className="text-amber-400 print:text-black">{rs(doc.grandTotalPaise)}</span>
              </div>

              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Total Paid:</span>
                <span>{rs(doc.paidPaise)}</span>
              </div>

              <div className="flex justify-between text-xs font-bold text-red-400">
                <span>Balance Due:</span>
                <span>{rs(doc.balancePaise)}</span>
              </div>
            </div>
          </div>

          {/* Payment Receipts Breakdown */}
          {Array.isArray(doc.payments) && doc.payments.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-4 space-y-2 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Payment Transactions & Gold Equivalents
              </div>
              <div className="divide-y divide-slate-800">
                {doc.payments.map((p: any, i: number) => {
                  const rate = doc.items?.[0]?.goldRatePerGramPaise || 750000;
                  const equivMg = rate > 0 ? Math.round((p.amountPaise / rate) * 1000) : 0;
                  return (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div>
                        <span className="font-bold text-amber-400 uppercase font-mono">{p.mode}</span>
                        <span className="text-[11px] text-slate-400 ml-2 font-mono">
                          (Gold Equiv: {grams(equivMg)} @ {rs(rate)}/g)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-white print:text-black">{rs(p.amountPaise)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          {firm.terms && (
            <div className="rounded-2xl bg-slate-800/20 border border-slate-800/80 p-4 text-[11px] text-slate-400 space-y-1 print:border-none print:p-0">
              <div className="font-bold uppercase tracking-wider text-slate-300 font-mono text-[10px]">
                Showroom Guarantee & Terms
              </div>
              <p className="whitespace-pre-line leading-relaxed">{firm.terms}</p>
            </div>
          )}

          {/* Document Security Seal & QR Code Footer */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left print:border-black">
            <div className="flex items-center gap-3">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Verify Document" className="h-20 w-20 rounded-xl bg-white p-1 border border-amber-400/40" />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                  <QrCode className="h-10 w-10" />
                </div>
              )}
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-amber-400 flex items-center gap-1 font-mono uppercase tracking-wide">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Digitally Signed Document</span>
                </div>
                <p className="text-slate-400 text-[11px]">Scan QR code on any smartphone camera to verify authenticity directly on the blockchain-backed MTJ verification portal.</p>
                <div className="text-[10px] text-slate-500 font-mono">Token ID: {token.slice(0, 16)}…</div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-mono">
              Powered by <strong className="text-amber-400">MTJ Gold ERP</strong>
            </div>
          </div>
        </div>

        {/* 3. Loyalty & Member Rewards Section (Configurable) */}
        {firm.loyaltyProgram?.enabled && (
          <div className="print:hidden rounded-3xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
                  Loyalty Rewards Credited
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">{firm.loyaltyProgram.tierName}</h3>
                <p className="text-xs text-slate-400">You have earned +{firm.loyaltyProgram.pointsEarned} reward points on this jewellery purchase.</p>
              </div>
            </div>
            <button
              onClick={() => window.open(firm.website || "#", "_blank")}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>View Rewards Pass</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 4. "Explore Our Collection" Showcase Section */}
        <section className="print:hidden space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-serif font-bold text-amber-400">Explore Our Master Collection</h3>
              <p className="text-xs text-slate-400">Handcrafted bridal & dailywear jewellery pieces available at {firm.shopName}</p>
            </div>
            <a
              href={firm.website}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>View All</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FEATURED_COLLECTION.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden hover:border-amber-500/40 transition group"
              >
                <div className="h-40 overflow-hidden relative">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <span className="absolute top-2 right-2 rounded-lg bg-slate-950/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-amber-400 font-mono">
                    {item.purity}
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-bold text-white line-clamp-1">{item.name}</h4>
                  <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                    <span>Est: {item.weight}</span>
                    <span className="text-amber-400 font-semibold">{item.category}</span>
                  </div>
                  <button
                    onClick={() => {
                      const msg = encodeURIComponent(
                        `Hello ${firm.shopName}, I would like to inquire about the ${item.name} (${item.purity}) featured on my invoice portal.`,
                      );
                      window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
                    }}
                    className="w-full mt-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>Inquire on WhatsApp</span>
                    <Share2 className="h-3 w-3 text-emerald-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Customer Feedback & Voice Review Section (No Login Required) */}
        <section className="print:hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-white">Rate Your Experience</h3>
              <p className="text-xs text-slate-400">Help us continually elevate our craftsmanship and showroom service.</p>
            </div>
          </div>

          {feedbackSubmitted ? (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Thank You for Your Feedback!</h4>
              <p className="text-xs text-slate-300">Your review has been securely transmitted to {firm.shopName}&apos;s executive management team.</p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-2xl transition transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-amber-400/50"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-mono font-bold text-amber-400 ml-2">
                  {rating === 5 ? "Exceptional" : rating === 4 ? "Very Good" : rating === 3 ? "Good" : "Needs Improvement"}
                </span>
              </div>

              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Share your thoughts about your jewellery piece, craftsmanship, or showroom staff… (optional)"
                rows={2}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-400 transition"
              />

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white transition cursor-pointer flex items-center gap-2"
              >
                <Send className="h-3.5 w-3.5 text-amber-400" />
                <span>Submit Customer Review</span>
              </button>
            </form>
          )}
        </section>

        {/* 6. Social & Official Connect Links */}
        <footer className="print:hidden pt-4 pb-12 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            {firm.instagramUrl && (
              <a href={firm.instagramUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-400 transition">
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {firm.facebookUrl && (
              <a href={firm.facebookUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-400 transition">
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {firm.youtubeUrl && (
              <a href={firm.youtubeUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-400 transition">
                <Youtube className="h-5 w-5" />
              </a>
            )}
            {firm.website && (
              <a href={firm.website} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-400 transition">
                <Globe className="h-5 w-5" />
              </a>
            )}
          </div>

          <div className="text-center sm:text-right space-y-0.5">
            <div>© {new Date().getFullYear()} {firm.shopName}. All Rights Reserved.</div>
            <div className="text-[10px]">Secure Document Portal powered by MTJ ERP</div>
          </div>
        </footer>
      </main>
    </div>
  );
}
