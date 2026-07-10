/**
 * Unified Print Engine — core types.
 *
 * A template is DATA (this file's shapes), not code: customizing a
 * document's layout means editing a `PrintTemplate` row (section order,
 * visibility, labels, paper size, colors), never touching a renderer.
 * The section set below is closed and declarative on purpose — it's
 * derived from an inventory of every recurring shape across the 18
 * existing print routes, not a general-purpose layout DSL. `showIf`
 * references a named boolean already computed by a document's data
 * builder (see PrintDocumentData.flags) — never evaluated code — so a
 * template can never execute arbitrary logic.
 */
import type { PrintDocType } from "@/lib/printlog-store";
import type { PrintSize } from "@/components/print/PrintLayout";

export type { PrintDocType, PrintSize };

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
  /** "image" reads row[key] as a URL and renders a thumbnail instead of text. */
  renderAs?: "text" | "image";
}

export interface HeaderSectionConfig {
  type: "header";
  id: string;
  showQr?: boolean;
  qrLabel?: string;
}

export interface PartySectionConfig {
  type: "party";
  id: string;
  title?: string;
  namePath: string;
  subFields: FieldGridItem[];
  showPhoto?: boolean;
  showIf?: string;
}

export interface FieldGridSectionConfig {
  type: "fieldGrid";
  id: string;
  title?: string;
  columns?: 1 | 2 | 3;
  fields: FieldGridItem[];
  showIf?: string;
  /** "darkPanel" renders the themed dark/accent box used for tax-calculation summaries. */
  theme?: "plain" | "darkPanel";
}

export interface TableSectionConfig {
  type: "table";
  id: string;
  title?: string;
  columns: TableColumnConfig[];
  /** Key into PrintDocumentData.tables. */
  rowsPath: string;
  /** Auto-sums each footerSum column's raw numeric row values — only correct when row values are actual numbers, not pre-formatted currency/weight strings. */
  showFooterSums?: boolean;
  /**
   * Key into PrintDocumentData.tables for a single precomputed footer row
   * (same column keys as the body), rendered bold instead of auto-summed.
   * Use this whenever body rows hold pre-formatted strings (₹, g) —
   * showFooterSums's Number(row[key]) would just read NaN from those.
   */
  footerRowPath?: string;
  showIf?: string;
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
  emphasis?: "box" | "inline" | "plain";
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
  /** Dot-path caption printed under the left/right label, e.g. "(customer name)". */
  leftCaptionPath?: string;
  rightCaptionPath?: string;
  /** Renders a simulated firm-name stamp above the right signature column. */
  showStamp?: boolean;
  showIf?: string;
}

/**
 * Generic side-by-side layout wrapper — each entry in `columns` is a list
 * of ordinary sections stacked vertically within that column. Used where a
 * document's approved format genuinely places two blocks side by side
 * (T&Cs beside signatures, a payment summary beside a tax panel) rather
 * than the default top-to-bottom stack every other section renders as.
 */
export interface RowSectionConfig {
  type: "row";
  id: string;
  /** Relative flex weight per column, e.g. [1, 2] for a narrow-left/wide-right split. Defaults to equal widths. */
  columnWidths?: number[];
  columns: SectionConfig[][];
  showIf?: string;
}

export interface PremiumHeaderSectionConfig {
  type: "premiumHeader";
  id: string;
  /** Dot-path for the badge text, e.g. "Tax Invoice (3% GST)" vs "Retail Cash Memo". */
  badgeTitlePath: string;
  /** "compact" drops the logo/badge/QR-inline layout for a small centered thermal-style header. */
  variant?: "premium" | "compact";
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

/** A compact, two-line-per-row item list for thermal receipts — visually distinct from `table`'s bordered grid. */
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
  /** Key into PrintDocumentData.tables — a runtime-variable-length list, unlike fieldGrid's fixed fields. */
  rowsPath: string;
  labelKey: string;
  valueKey: string;
  /** Optional bracketed sub-label next to the label, e.g. a payment reference. */
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
  | RowSectionConfig;

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
  /** Seeded, ships with the app — cannot be deleted, only edited/reset. */
  isBuiltin: boolean;
  paperSize: PrintSize;
  margins?: { top: number; right: number; bottom: number; left: number };
  fontFamily?: string;
  fontSize?: "xs" | "sm" | "base" | "lg";
  primaryColor?: string;
  accentColor?: string;
  /**
   * "printLayout" (default) mounts sections inside the shared PrintLayout
   * chrome, same as every other migrated document. "custom" is for a
   * document whose approved format is its own bespoke shell (the GST/
   * retail invoice never used PrintLayout even before migration) — see
   * CustomShell.tsx. Still ONE PrintEngine, ONE section registry, ONE
   * PDF/audit/queue path either way; only the outer wrapper differs.
   */
  shell?: "printLayout" | "custom";
  sections: SectionConfig[];
  version: number;
  /** History, most recent first. Capped — see TEMPLATE_VERSION_HISTORY_LIMIT. */
  versions: TemplateVersion[];
  createdAt: number;
  updatedAt: number;
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
