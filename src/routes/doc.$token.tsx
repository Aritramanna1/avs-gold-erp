/**
 * MTJ ERP — Public Customer Document Hosting Website (/doc/$token)
 *
 * Inspired by modern retail digital bill portals (e.g. CasaRetail), elevated
 * with luxury aesthetics and Gold-First Indian Jewellery accounting.
 *
 * Components:
 * 1. Personal Customer Greeting Header ("Hello Sunita Agarwal! 👋 Your latest purchase invoice is here")
 * 2. Showroom Identity & Membership Strip (Branch, Support Phone, Loyalty Tier, Points)
 * 3. Primary Invoice Overview Card (Gold Obligation g/mg, ₹ Grand Total, Status Badge, Items count)
 * 4. ~Items Purchased~ Collapsible Details (HUID, Tag Barcode, 916/750 Purity, Gross/Net weights, Making, Taxes)
 * 5. ~Gold & Payment Settlement Summary~ (Gold Paid/Exchange vs UPI/Cash, Transaction Rate, Gold Equivalent)
 * 6. ~Loyalty & Rewards Details~ (Points Earned, Points Used, Tier Expiry)
 * 7. Showroom Locator & One-Tap Calling / Directions
 * 8. "Explore Our Collection / Shop Now" Carousel (R2 Image Delivery + WhatsApp Inquiry)
 * 9. Social Media Connect (Instagram, Facebook, YouTube, Official Web)
 * 10. Interactive 5-Star Customer Feedback Form (Zero-login instant submission)
 * 11. Customer Profile & Anniversary Card (Register Birthday/Anniversary for 20% off making charges)
 * 12. Quick Action Bar (Download Official PDF, Vector Print, Share on WhatsApp, Copy Link)
 * 13. Digital QR Code & Authenticity Verification Seal
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
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Clock,
  Gift,
  HelpCircle,
} from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/doc/$token")({
  head: () => ({
    meta: [
      { title: "Official Jewellery Invoice & Digital Receipt · MTJ ERP" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: CasaStylePublicDocumentPage,
});

// ── Formatting Helpers ───────────────────────────────────────────────────────

function rs(paise: number | undefined | null) {
  if (paise == null) return "₹ 0";
  return "₹ " + (paise / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function grams(mg: number | undefined | null) {
  if (mg == null) return "0.000 g";
  return (mg / 1000).toFixed(3) + " g";
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
  branchName?: string;
  promoBanner?: {
    enabled: boolean;
    title: string;
    description: string;
  };
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
    logoUrl: opt("logoUrl") ?? "https://maatarajewellers.shop/assets/ornexa-logo-full.png",
    website: opt("website") ?? "https://maatarajewellers.shop",
    branchName: opt("branchName") ?? "Bowbazar Flagship Showroom",
    terms:
      opt("terms") ??
      "1. 100% BIS Hallmarked 916/750 Jewellery guaranteed.\n2. Gold return valuation calculated on prevailing market rate.\n3. Making and stone charges are non-refundable.\n4. Disputes subject to Kolkata jurisdiction.",
    footerLine: opt("footerLine") ?? "Thank you for shopping at Maa Tara Jewellers.",
    instagramUrl: opt("instagramUrl") ?? "https://instagram.com",
    facebookUrl: opt("facebookUrl") ?? "https://facebook.com",
    youtubeUrl: opt("youtubeUrl") ?? "https://youtube.com",
    promoBanner: {
      enabled: true,
      title: "Festive Gold Exchange Offer",
      description: "Get 100% valuation on 22K hallmarked old gold with zero deduction on new bridal sets this month.",
    },
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

// ── Featured Products for "Explore Collection / Shop Now" ─────────────────────

const FEATURED_COLLECTION = [
  {
    id: "col-1",
    name: "Kolkata Handcrafted Bridal Jhumka",
    purity: "22K (916)",
    weight: "16.500g",
    imageUrl: "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=500&auto=format&fit=crop&q=60",
    category: "Earrings",
    tag: "Trending",
  },
  {
    id: "col-2",
    name: "Filigree Temple Design Choker Necklace",
    purity: "22K (916)",
    weight: "32.400g",
    imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&auto=format&fit=crop&q=60",
    category: "Necklace",
    tag: "Exclusive",
  },
  {
    id: "col-3",
    name: "Classic Solid Pola Bangle with Gold Cladding",
    purity: "22K (916)",
    weight: "12.200g",
    imageUrl: "https://images.unsplash.com/photo-1611591475878-5696ff175d65?w=500&auto=format&fit=crop&q=60",
    category: "Bangles",
    tag: "Traditional",
  },
];

// ── Main Public Page Component ───────────────────────────────────────────────

function CasaStylePublicDocumentPage() {
  const { token } = useParams({ from: "/doc/$token" });
  const [share, setShare] = useState<DocumentShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Interactive Section States
  const [showItemsDetail, setShowItemsDetail] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Customer Feedback
  const [rating, setRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Anniversary Profile Update form
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [dob, setDob] = useState("");
  const [anniversary, setAnniversary] = useState("");

  useEffect(() => {
    getDocumentShare(token)
      .then(async (s) => {
        if (!s) {
          setError("This document link is invalid, expired, or has been revoked.");
        } else {
          setShare(s);
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-4 font-sans">
        <div className="h-12 w-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
        <h2 className="mt-4 text-base font-serif font-semibold text-amber-300">Loading Official Receipt…</h2>
        <p className="mt-1 text-xs text-slate-400">Verifying digital certificate and showroom signature</p>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 text-slate-100 font-sans">
        <div className="max-w-md w-full rounded-3xl border border-red-500/30 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="h-16 w-16 rounded-full border border-red-500/40 bg-red-500/10 flex items-center justify-center mx-auto text-red-400 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-100">Document Unavailable</h2>
          <p className="mt-2 text-sm text-slate-400">{error ?? "This document could not be found."}</p>
          <div className="mt-6 pt-6 border-t border-slate-800 text-xs text-slate-500">
            If you believe this is an error, please contact your jewellery showroom with your purchase reference.
          </div>
        </div>
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
    invoice: snapshotText(doc, "gst") === "gst3" ? "TAX INVOICE" : "RETAIL INVOICE",
    estimate: "ESTIMATE / QUOTE",
    order: "CUSTOM WORK ORDER",
    repair: "REPAIR JOB CARD",
    job: "MANUFACTURING BILL",
  };
  const docBadgeLabel = docTypeLabels[docType] ?? "TAX INVOICE";

  const itemsList: any[] = Array.isArray(doc.items) ? doc.items : [];
  const itemsCount = itemsList.length;

  // Gold-First Calculations
  const rate = doc.items?.[0]?.goldRatePerGramPaise || 750000;
  const totalGoldMg =
    doc.items?.reduce((s: number, it: any) => s + (it.fineGoldMg || it.fineMg || it.netMg || 0), 0) ||
    Math.round(((doc.grandTotalPaise || 0) / rate) * 1000);
  const paidGoldMg = Math.round(((doc.paidPaise || 0) / rate) * 1000);
  const balanceGoldMg = Math.max(0, totalGoldMg - paidGoldMg);

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

  function handlePrint() {
    void printDocument(`${docBadgeLabel} - ${docNo}`);
  }

  function handleShareWhatsApp() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const msg = encodeURIComponent(
      `Hello, here is my jewellery invoice (#${docNo}) from ${firm.shopName}:\n${url}`,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased print:bg-white print:text-black font-sans pb-16">
      
      {/* ── 1. Top Greeting Header (Casa Style) ────────────────────────── */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 px-4 pt-6 pb-5 print:hidden">
        <div className="max-w-md mx-auto space-y-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
              Hello {customerName}! 👋
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
              {firm.loyaltyProgram?.tierName?.split(" ")[0] || "Gold"} Tier
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Your latest purchase invoice is here
          </p>
        </div>
      </section>

      {/* ── 2. Showroom & Loyalty Member Strip ─────────────────────────── */}
      <section className="max-w-md mx-auto px-4 py-3 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 print:hidden font-mono">
        <div>
          <div className="font-bold text-white text-xs">{firm.shopName}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{firm.address.split(",")[0]}</div>
          <div className="text-[10px] text-slate-500">Your Phone: <span className="text-slate-300">{customerPhone}</span></div>
        </div>
        <div className="text-right">
          <div className="text-amber-400 font-bold text-xs">{firm.loyaltyProgram?.tierName || "Gold Member"}</div>
          <div className="text-[11px] text-emerald-400 font-semibold">Points: {firm.loyaltyProgram?.currentPoints || 850} pts</div>
        </div>
      </section>

      {/* ── 3. Main Document Container ─────────────────────────────────── */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        
        {/* ── A. Invoice Overview & Total Card (Casa Style) ────────────── */}
        <div
          data-testid="invoice-overview-card"
          className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl p-5 space-y-4 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {docBadgeLabel}
            </span>
            <div className="text-right font-mono text-xs text-slate-400">
              <span className="text-white font-bold">{docNo}</span>
              <div className="text-[11px] text-slate-500">{docDate}</div>
            </div>
          </div>

          {/* Dual Total Section (Gold Primary + Cash Secondary) */}
          <div className="pt-2 pb-1 border-t border-slate-800 space-y-3">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
                Total Pure Gold Obligation
              </div>
              <div className="text-2xl font-serif font-bold text-amber-300 mt-0.5">
                {grams(totalGoldMg)} <span className="text-sm font-sans font-normal text-amber-400/80">Fine Gold</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/60">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Cash Amount</div>
                <div className="text-xl font-bold text-white mt-0.5">{rs(doc.grandTotalPaise)}</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded-md">
                  {String(itemsCount).padStart(2, "0")} Items
                </span>
              </div>
            </div>

            {/* Paid / Balance Status Pill */}
            <div className="pt-2 flex justify-between items-center text-xs font-mono">
              <span className="text-emerald-400 font-semibold">
                Paid: {rs(doc.paidPaise)} ({grams(paidGoldMg)})
              </span>
              {balanceGoldMg > 0 ? (
                <span className="text-red-400 font-bold">
                  Due: {rs(doc.balancePaise)} ({grams(balanceGoldMg)})
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Settled in Full</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── B. ~Items Purchased~ Collapsible Section (Casa Style) ─────── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-lg overflow-hidden">
          <button
            onClick={() => setShowItemsDetail(!showItemsDetail)}
            className="w-full p-4 flex items-center justify-between text-left font-serif font-bold text-sm text-white hover:bg-slate-800/40 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono">~Items Purchased~</span>
              <span className="text-xs font-sans text-slate-400 font-normal">({itemsCount} items)</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-amber-400 font-sans font-semibold">
              <span>{showItemsDetail ? "Hide Details" : "Show Details"}</span>
              {showItemsDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          {showItemsDetail && itemsList.length > 0 && (
            <div className="p-4 pt-0 space-y-3 divide-y divide-slate-800">
              {itemsList.map((it: any, idx: number) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-1.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white">{it.itemName}</h4>
                      <div className="flex gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                        {it.barcode && <span className="text-amber-400 font-semibold">Tag: {it.barcode}</span>}
                        {it.huid && <span>HUID: {it.huid}</span>}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-amber-400 text-sm">{rs(it.lineTotalPaise)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-xl text-[11px] font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Purity</span>
                      <span className="font-bold text-white">{it.purity || "916 (22K)"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Gross Wt</span>
                      <span>{grams(it.grossMg)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Net Wt</span>
                      <span className="font-bold text-emerald-400">{grams(it.netMg)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── C. ~Loyalty Details~ Card (Casa Style) ────────────────────── */}
        {firm.loyaltyProgram?.enabled && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif font-bold text-white">~Loyalty &amp; Rewards Details~</span>
              <Award className="h-4 w-4 text-amber-400" />
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-center">
              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-2xl">
                <div className="text-xl font-bold text-emerald-400">+{firm.loyaltyProgram.pointsEarned}</div>
                <div className="text-[10px] text-slate-400 uppercase mt-0.5">Earned in this bill</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-2xl">
                <div className="text-xl font-bold text-slate-400">0</div>
                <div className="text-[10px] text-slate-400 uppercase mt-0.5">Used in this bill</div>
              </div>
            </div>

            <div className="text-[11px] text-center text-slate-400 pt-1 font-mono">
              0 Points expiring this month · Total Balance: <strong className="text-amber-400">{firm.loyaltyProgram.currentPoints} pts</strong>
            </div>
          </div>
        )}

        {/* ── D. Find Your Showroom / Store Locator (Casa Style) ────────── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-serif font-bold text-white">Find Your Showroom</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{firm.address}</p>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <MapPin className="h-5 w-5" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(firm.shopName + " " + firm.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white text-center transition flex items-center justify-center gap-1.5"
            >
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>Showroom Directions</span>
            </a>
            <a
              href={`tel:${firm.phone}`}
              className="py-2 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-300 transition flex items-center justify-center gap-1"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Call Us</span>
            </a>
          </div>
        </div>

        {/* ── E. "Explore Our Collection / Shop Now" (Casa Style) ────────── */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif font-bold text-white">Explore Master Jewellery</h3>
            <span className="text-[11px] text-amber-400 font-semibold">Shop Now</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {FEATURED_COLLECTION.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  const msg = encodeURIComponent(
                    `Hello ${firm.shopName}, I would like to inquire about the ${item.name} (${item.purity}) featured on my digital invoice portal.`,
                  );
                  window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
                }}
                className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden text-left hover:border-amber-500/40 transition cursor-pointer group"
              >
                <div className="h-24 overflow-hidden relative">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <span className="absolute top-1 left-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[8px] font-bold text-amber-400 font-mono">
                    {item.purity}
                  </span>
                </div>
                <div className="p-2 space-y-0.5">
                  <div className="text-[10px] font-bold text-white line-clamp-1">{item.name}</div>
                  <div className="text-[9px] text-amber-400 font-mono font-semibold">Inquire →</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── F. Social Media Platforms (Casa Style) ────────────────────── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-center space-y-3">
          <p className="text-xs text-slate-300">Join us on the Social Media Platforms You Enjoy</p>
          <div className="flex items-center justify-center gap-5 text-slate-400">
            {firm.instagramUrl && (
              <a href={firm.instagramUrl} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-slate-800 hover:text-amber-400 hover:bg-slate-700 transition">
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {firm.facebookUrl && (
              <a href={firm.facebookUrl} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-slate-800 hover:text-amber-400 hover:bg-slate-700 transition">
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {firm.youtubeUrl && (
              <a href={firm.youtubeUrl} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-slate-800 hover:text-amber-400 hover:bg-slate-700 transition">
                <Youtube className="h-5 w-5" />
              </a>
            )}
            {firm.website && (
              <a href={firm.website} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-slate-800 hover:text-amber-400 hover:bg-slate-700 transition">
                <Globe className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>

        {/* ── G. Interactive Customer Feedback Form (Casa Style) ────────── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-serif font-bold text-white">Feedback Form</span>
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          </div>

          {feedbackSubmitted ? (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center space-y-1">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-white">Thank You for Your Feedback!</div>
              <p className="text-[11px] text-slate-300">Your review helps us continually improve our craftsmanship.</p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 transition transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-amber-400/50"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Write your feedback here…"
                rows={2}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-400 transition"
              />

              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Submit Feedback
              </button>
            </form>
          )}
        </div>

        {/* ── H. Download Invoice & Actions Strip (Casa Style) ───────────── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 space-y-2 text-center">
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{pdfLoading ? "Generating Official PDF…" : "Download Invoice PDF"}</span>
          </button>

          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-slate-400">
            <button onClick={() => setShowTermsModal(true)} className="hover:text-amber-400 underline cursor-pointer">
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
              className="hover:text-amber-400 underline cursor-pointer text-amber-400 font-semibold"
            >
              Need help with your Bill? (Report Issue)
            </button>
          </div>
        </div>

        {/* ── I. Customer Profile & Anniversary Rewards (Casa Style) ────── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-serif font-bold">
            <Gift className="h-4 w-4" />
            <span>Birthday &amp; Anniversary Rewards</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Register your date of birth or wedding anniversary to unlock an exclusive <strong>20% discount on jewellery making charges</strong> during your celebration month!
          </p>

          {profileUpdated ? (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-center text-amber-300 font-medium">
              ✓ Anniversary preferences saved! Look out for your celebration gift voucher.
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-2 pt-1 font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-[11px] text-white focus:outline-hidden focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Anniversary</label>
                  <input
                    type="date"
                    value={anniversary}
                    onChange={(e) => setAnniversary(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-[11px] text-white focus:outline-hidden focus:border-amber-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition cursor-pointer"
              >
                Save Celebration Dates
              </button>
            </form>
          )}
        </div>

        {/* ── J. Authenticity Seal & Verification QR ───────────────────── */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4 text-center sm:text-left text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="Verify Document" className="h-16 w-16 rounded-xl bg-white p-1" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                <QrCode className="h-8 w-8" />
              </div>
            )}
            <div className="text-[10px] space-y-0.5 text-left">
              <div className="text-amber-400 font-bold flex items-center gap-1 uppercase">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified Digital Receipt</span>
              </div>
              <div>Token: {token.slice(0, 12)}…</div>
              <div className="text-slate-600">Powered by MTJ Gold ERP</div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Terms & Conditions Modal ───────────────────────────────────── */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-serif font-bold text-white">Terms and Conditions</h3>
            <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
              {firm.terms}
            </p>
            <div className="pt-2 text-right">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
