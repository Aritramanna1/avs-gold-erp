/**
 * Unified Print Engine — core types.
 *
 * Authoritative type definitions for Ornexa Document & Print Engine.
 * Master Reference: docs/DOCUMENT_TEMPLATE_ENGINE.md & docs/PRINT_PROFILE_MASTER.md
 */
import type { PrintDocType } from "@/lib/printlog-store";
import type { PrintSize } from "@/components/print/PrintLayout";

export type { PrintDocType, PrintSize };

// ── 10 Canonical Template Families ───────────────────────────────────────

export type TemplateFamily =
  | "classic_business"
  | "modern_professional"
  | "premium_jewellery"
  | "compact_accounting"
  | "manufacturing_workshop"
  | "traditional_indian"
  | "minimal_clean"
  | "elegant_corporate"
  | "dense_ledger"
  | "customer_digital";

export const TEMPLATE_FAMILY_LABELS: Record<TemplateFamily, { name: string; description: string }> =
  {
    classic_business: {
      name: "Classic Business",
      description:
        "Traditional bordered layout, double-rule header, distinct gold weight summary boxes, formal dual signatures.",
    },
    modern_professional: {
      name: "Modern Professional",
      description:
        "Clean asymmetric layout, structured tax & banking panels, high-contrast dark accents.",
    },
    premium_jewellery: {
      name: "Premium Jewellery",
      description:
        "Luxury serif typography, gemstone/diamond breakdown table, HUID certificate badges, ornate stamp box.",
    },
    compact_accounting: {
      name: "Compact Accounting",
      description:
        "Auditor-focused dense format (15+ line items per sheet), detailed debit/credit schedules, compact tax grid.",
    },
    manufacturing_workshop: {
      name: "Manufacturing / Workshop",
      description:
        "Bench-ready job card & custody voucher, metal purity ledger, stage sign-offs, barcode / HUID tag.",
    },
    traditional_indian: {
      name: "Traditional Indian Business",
      description:
        "Vernacular-friendly trade bill format, Jama (Credit) / Naam (Debit) columns, auspicious traditional header.",
    },
    minimal_clean: {
      name: "Minimal Clean",
      description:
        "Borderless contemporary sans-serif layout, generous whitespace, understated divider lines.",
    },
    elegant_corporate: {
      name: "Elegant Corporate",
      description:
        "Executive B2B layout with distinct Seller, Buyer & Ship-To panels, HSN/SAC breakdown schedule.",
    },
    dense_ledger: {
      name: "Dense Ledger",
      description:
        "High-density multi-page ledger statement, running balances, repeating table headers across pages.",
    },
    customer_digital: {
      name: "Customer-Friendly Digital",
      description:
        "Mobile-responsive card hierarchy, digital payment UPI QR code, clean summary with one-click download action.",
    },
  };

// ── Section configs ─────────────────────────────────────────────────────

export interface FieldGridItem {
  label: string;
  /** Dot-path into PrintDocumentData.fields, e.g. "customer.phone". */
  valuePath: string;
  fullWidth?: boolean;
  /** Named key into PrintDocumentData.flags — section/field hidden when falsy. */
  showIf?: string;
  /**
   * neutral/warning/critical/success render as a colored badge pill in a
   * plain fieldGrid (status fields), or as colored text in a darkPanel
   * fieldGrid (tax/balance panels) — see FieldGridSectionConfig.theme.
   */
  variant?: "neutral" | "warning" | "critical" | "success";
  /** Bold, larger text — the "Grand Total" row treatment. */
  emphasis?: boolean;
}

export interface TableColumnConfig {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  /** Relative flex weight on screen; mm width when drawn into a PDF. */
  width?: number;
  /** Column hidden entirely (not just blank) when this named flag is falsy. */
  showIf?: string;
  footerSum?: boolean;
  /**
   * "image" reads row[key] as a URL and renders a thumbnail instead of
   * text. "badge" reads row[key] as label text and row[`${key}Variant`]
   * (a "neutral"|"warning"|"critical"|"success" string, set per-row by the
   * data builder) as its color — for a status/type pill that varies row
   * to row, e.g. an "Issued"/"Returned" ledger-entry type column.
   */
  renderAs?: "text" | "image" | "badge";
}

export interface HeaderSectionConfig {
  type: "header";
  id: string;
  showQr?: boolean;
  qrLabel?: string;
  titleOverride?: string;
  subtitleOverride?: string;
  alignment?: "left" | "center" | "split";
}

export interface PartySectionConfig {
  type: "party";
  id: string;
  title?: string;
  namePath: string;
  subFields: FieldGridItem[];
  showPhoto?: boolean;
  showIf?: string;
  badgeLabel?: string;
}

export interface FieldGridSectionConfig {
  type: "fieldGrid";
  id: string;
  title?: string;
  columns?: 1 | 2 | 3 | 4;
  fields: FieldGridItem[];
  showIf?: string;
  /** "darkPanel" renders the themed dark/accent box used for tax-calculation summaries. */
  theme?: "plain" | "darkPanel" | "bordered" | "goldSummary";
}

export interface TableSectionConfig {
  type: "table";
  id: string;
  title?: string;
  columns: TableColumnConfig[];
  /** Key into PrintDocumentData.tables. */
  rowsPath: string;
  /** Auto-sums each footerSum column's raw numeric row values */
  showFooterSums?: boolean;
  /**
   * Key into PrintDocumentData.tables for a single precomputed footer row
   */
  footerRowPath?: string;
  /**
   * When set, an extra full-width row is drawn INSIDE the table's <thead>.
   */
  repeatHeaderMeta?: { label: string; valuePath: string }[];
  showIf?: string;
  tableStyle?: "grid" | "banded" | "minimal" | "classic";
}

export interface BalanceCardSectionConfig {
  type: "balanceCard";
  id: string;
  title?: string;
  /** Keys into PrintDocumentData.balances. */
  goldKey?: string;
  cashKey?: string;
  labelMode?: "jama_naam" | "credit_debit";
  showIf?: string;
}

export interface RichTextSectionConfig {
  type: "richText";
  id: string;
  title?: string;
  /** Dot-path into PrintDocumentData.fields for dynamic content. */
  textPath?: string;
  /** Fixed template copy (T&Cs, disclaimers) — used when textPath is absent. */
  staticText?: string;
  showIf?: string;
  /** "box" = bordered box (default); "inline" = single-line label:value strip (amount-in-words); "plain" = heading + text, no border/background (T&Cs). */
  emphasis?: "box" | "inline" | "plain" | "callout";
}

export interface ImagesSectionConfig {
  type: "images";
  id: string;
  title?: string;
  /** Key into PrintDocumentData.images. */
  imagesKey: string;
  maxThumbnails?: number;
  /** KYC-style: one full page per image instead of a thumbnail row. */
  fullPagePerImage?: boolean;
  showIf?: string;
}

export interface SignatureBlockSectionConfig {
  type: "signatureBlock";
  id: string;
  /** Falls back to firm.signatureLabelLeft/Right when absent. */
  leftLabel?: string;
  rightLabel?: string;
  centerLabel?: string;
  /** Dot-path caption printed under the left/right label, e.g. "(customer name)". */
  leftCaptionPath?: string;
  rightCaptionPath?: string;
  centerCaptionPath?: string;
  /** When true, render the tenant's uploaded stamp image (never a fake text stamp). */
  showStamp?: boolean;
  showIf?: string;
}

/** Side-by-side layout wrapper */
export interface RowSectionConfig {
  type: "row";
  id: string;
  /** Relative flex weight per column, e.g. [1, 2]. Defaults to equal widths. */
  columnWidths?: number[];
  columns: SectionConfig[][];
  showIf?: string;
}

export interface PremiumHeaderSectionConfig {
  type: "premiumHeader";
  id: string;
  /** Dot-path for the badge text, e.g. "Tax Invoice (3% GST)" vs "Retail Cash Memo". */
  badgeTitlePath?: string;
  titleText?: string;
  /** "compact" drops the logo/badge/QR-inline layout for a small centered thermal-style header. */
  variant?: "premium" | "compact" | "centered" | "split" | "minimal";
  showQr?: boolean;
  qrLabel?: string;
  qrSize?: number;
}

export interface BilledToStampSectionConfig {
  type: "billedToStamp";
  id: string;
  namePath: string;
  subFields: FieldGridItem[];
  stampLabel?: string;
  showIf?: string;
}

export interface TagCardsSectionConfig {
  type: "tagCards";
  id: string;
  /** Key into PrintDocumentData.tables — one card rendered per row. */
  rowsPath: string;
  showIf?: string;
}

/** A compact, two-line-per-row item list for thermal receipts */
export interface ThermalItemListSectionConfig {
  type: "thermalItemList";
  id: string;
  rowsPath: string;
  showIf?: string;
}

export interface DataListSectionConfig {
  type: "dataList";
  id: string;
  title?: string;
  /** Key into PrintDocumentData.tables */
  rowsPath: string;
  labelKey: string;
  valueKey: string;
  /** Optional bracketed sub-label next to the label */
  subKey?: string;
  showIf?: string;
}

export interface QrSectionConfig {
  type: "qr";
  id: string;
  position: "header" | "footer" | "inline";
  label?: string;
  size?: number;
  showIf?: string;
}

export interface PageBreakSectionConfig {
  type: "pageBreak";
  id: string;
}

export interface WeightSummarySectionConfig {
  type: "weightSummary";
  id: string;
  title?: string;
  showIf?: string;
  grossPath?: string;
  lessPath?: string;
  netPath?: string;
  purityPath?: string;
  finePath?: string;
  wastagePath?: string;
  scrapPath?: string;
}

export interface TaxBreakdownSectionConfig {
  type: "taxBreakdown";
  id: string;
  title?: string;
  showIf?: string;
  taxableValuePath: string;
  cgstPath?: string;
  sgstPath?: string;
  igstPath?: string;
  totalTaxPath: string;
  amountInWordsPath?: string;
}

export interface BankDetailsSectionConfig {
  type: "bankDetails";
  id: string;
  title?: string;
  showIf?: string;
  showUpiQr?: boolean;
}

export interface BarcodeSectionConfig {
  type: "barcode";
  id: string;
  valuePath: string;
  format?: "CODE128" | "QR" | "EAN13";
  height?: number;
  showHumanReadable?: boolean;
  showIf?: string;
}

export interface CustomFieldSectionConfig {
  type: "customField";
  id: string;
  label: string;
  valuePath: string;
  showIf?: string;
  variant?: "inline" | "badge" | "box";
}

export interface PageFooterSectionConfig {
  type: "pageFooter";
  id: string;
  showPageNumbers?: boolean;
  showTimestamp?: boolean;
  showMicroAuditHash?: boolean;
  customText?: string;
}

export type SectionConfig =
  | HeaderSectionConfig
  | PartySectionConfig
  | FieldGridSectionConfig
  | TableSectionConfig
  | BalanceCardSectionConfig
  | RichTextSectionConfig
  | ImagesSectionConfig
  | SignatureBlockSectionConfig
  | QrSectionConfig
  | PageBreakSectionConfig
  | PremiumHeaderSectionConfig
  | BilledToStampSectionConfig
  | TagCardsSectionConfig
  | DataListSectionConfig
  | ThermalItemListSectionConfig
  | RowSectionConfig
  | WeightSummarySectionConfig
  | TaxBreakdownSectionConfig
  | BankDetailsSectionConfig
  | BarcodeSectionConfig
  | CustomFieldSectionConfig
  | PageFooterSectionConfig;

export type SectionType = SectionConfig["type"];

// ── Template ─────────────────────────────────────────────────────────────

export interface TemplateVersion {
  version: number;
  savedAt: number;
  savedBy?: string;
  snapshot: Omit<PrintTemplate, "versions">;
}

export interface PrintTemplate {
  id: string;
  docType: PrintDocType;
  name: string;
  family?: TemplateFamily;
  /** Seeded, ships with the app — cannot be deleted, only edited/reset. */
  isBuiltin: boolean;
  paperSize: PrintSize;
  margins?: { top: number; right: number; bottom: number; left: number };
  fontFamily?: string;
  fontSize?: "xs" | "sm" | "base" | "lg";
  primaryColor?: string;
  accentColor?: string;
  borderStyle?: "grid" | "clean" | "classic" | "minimal";
  watermark?: string;
  /**
   * "printLayout" (default) mounts sections inside the shared PrintLayout chrome.
   * "custom" is for a document whose format is its own bespoke shell.
   */
  shell?: "printLayout" | "custom";
  sections: SectionConfig[];
  version: number;
  /** History, most recent first. Capped. */
  versions: TemplateVersion[];
  createdAt: number;
  updatedAt: number;
}

// ── Print Profile ─────────────────────────────────────────────────────────

export interface PrintProfile {
  id: string;
  name: string;
  isDefault: boolean;
  paperSize: PrintSize;
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  scale: number; // 25 to 200
  copies: number;
  printerClass?: "laser" | "thermal" | "tag" | "label" | "dotmatrix" | "dot_matrix";
  colorMode: "color" | "grayscale" | "monochrome";
  headerFooterRepeat: "all_pages" | "first_page_only" | "last_page_only";
  fitToPage: boolean;
  labelDimensions?: { widthMm: number; heightMm: number };
  labelWidthMm?: number;
  labelHeightMm?: number;
  watermarkText?: string;
  targetDocTypes?: PrintDocType[];
  branchId?: string;
  createdAt: number;
  updatedAt: number;
}

// ── Template Package (.ornexa-template JSON) ──────────────────────────────

export interface OrnexaTemplatePackage {
  format: "ornexa-template";
  schemaVersion: "3.1.0";
  exportedAt: number;
  exportedBy?: string;
  template: Omit<PrintTemplate, "id" | "isBuiltin" | "versions">;
}

// ── Document data — what a docType's data builder produces ────────────────

export interface BalanceFigures {
  previous: number;
  in: number;
  out: number;
  closing: number;
}

export interface PrintDocumentData {
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  createdAt?: number;
  title: string;
  /** Flat, dot-path-addressable field bag for fieldGrid/party sections. */
  fields: Record<string, unknown>;
  /** Named row-sets for table sections. */
  tables: Record<string, Record<string, unknown>[]>;
  /** Named booleans a template's showIf can reference. */
  flags: Record<string, boolean>;
  /** Named image-URL arrays for images sections. */
  images: Record<string, string[]>;
  /** Named balance figures for balanceCard sections. */
  balances: Record<string, BalanceFigures>;
}

export type PrintContextBuilder = (recordId: string) => PrintDocumentData | null;
