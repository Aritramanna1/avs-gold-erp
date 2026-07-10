/**
 * Unified Print Engine — seeded default templates.
 *
 * `DEFAULT_TEMPLATES` maps a doc type to every paper-size variant it has a
 * shipped default for (most doc types have exactly one; the GST/retail
 * invoice has four structurally distinct layouts — premium A4/A5, thermal
 * 80/58mm, and per-item tag cards — so it needs an array).
 * `template-store.ts`'s `getForDocType(docType, paperSize)` picks the
 * right variant; `getAvailablePaperSizes()` drives whether PrintEngine
 * shows a size switcher at all.
 */
import type { PrintDocType, PrintTemplate, SectionConfig } from "./types";

const now = Date.now();

function builtin(
  t: Omit<PrintTemplate, "isBuiltin" | "version" | "versions" | "createdAt" | "updatedAt">,
): PrintTemplate {
  return { ...t, isBuiltin: true, version: 1, versions: [], createdAt: now, updatedAt: now };
}

const creditNoteTemplate = builtin({
  id: "default_credit_note",
  docType: "credit_note",
  name: "Credit Note (Default)",
  paperSize: "a4",
  sections: [
    // No showQr override, no separate "qr" section — PrintLayout's own
    // default (header position, "Verify" label) already matches the
    // legacy billing.credit-note-print.$id.tsx route exactly.
    { type: "header", id: "header" },
    {
      type: "fieldGrid",
      id: "status",
      fields: [
        {
          label: "Status",
          valuePath: "statusText",
          showIf: "isIssued",
          variant: "neutral",
          fullWidth: true,
        },
        {
          label: "Status",
          valuePath: "statusText",
          showIf: "isCancelled",
          variant: "critical",
          fullWidth: true,
        },
      ],
    },
    {
      // 2 columns, matching legacy's `grid-cols-2` exactly (3 fields ->
      // Customer/Invoice on row 1, Amount alone on row 2), not 3.
      type: "fieldGrid",
      id: "summary",
      columns: 2,
      fields: [
        { label: "Customer", valuePath: "customerName" },
        { label: "Against Invoice", valuePath: "invoiceNo" },
        { label: "Amount", valuePath: "amountLabel" },
      ],
    },
    { type: "richText", id: "reason", title: "Reason", textPath: "reasonText" },
    { type: "signatureBlock", id: "signatures" },
  ],
});

const orderSlipTemplate = builtin({
  id: "default_order_slip",
  docType: "order_slip",
  name: "Order Slip (Default)",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header", showQr: false },
    {
      type: "party",
      id: "customer",
      title: "Customer",
      namePath: "customerName",
      subFields: [
        { label: "Phone", valuePath: "customerPhone" },
        { label: "GSTIN", valuePath: "customerGstin", showIf: "hasCustomerGstin" },
      ],
    },
    {
      type: "table",
      id: "items",
      title: "Items",
      rowsPath: "items",
      showFooterSums: true,
      columns: [
        { key: "description", header: "Description", align: "left", width: 3 },
        { key: "grossWt", header: "G.Wt", align: "right" },
        { key: "netWt", header: "Net Wt", align: "right" },
        { key: "purity", header: "Touch", align: "right" },
        { key: "fine", header: "Fine", align: "right", footerSum: true },
        { key: "amount", header: "Amount", align: "right", footerSum: true },
      ],
    },
    {
      type: "balanceCard",
      id: "balances",
      title: "Balance Summary",
      goldKey: "gold",
      cashKey: "cash",
      labelMode: "jama_naam",
    },
    { type: "richText", id: "notes", title: "Notes", textPath: "notes", showIf: "hasNotes" },
    { type: "signatureBlock", id: "signatures" },
    { type: "qr", id: "qr", position: "footer", label: "Verify" },
  ],
});

// ── GST / Retail Invoice ────────────────────────────────────────────────
// Legacy billing.print.$id.tsx never used PrintLayout — its own bespoke
// "purple & gold" A4/A5 design, a separate thermal receipt layout, and
// per-item 50×30mm tag cards, switched by a local layoutSize toggle. Same
// section content serves both `gst_invoice` and `retail_invoice` — the
// title-badge text and GST math branch on the *data* (inv.gst), not on
// which docType key looked the template up.

const invoiceItemsTable: SectionConfig = {
  type: "table",
  id: "items",
  title: "Items",
  rowsPath: "items",
  footerRowPath: "itemsTotals",
  columns: [
    { key: "photoUrl", header: "Photo", align: "center", width: 1, renderAs: "image" },
    { key: "description", header: "Item Code & Descr.", align: "left", width: 3 },
    { key: "purity", header: "Purity", align: "center", width: 1 },
    { key: "grossWt", header: "Gross", align: "right", width: 1 },
    { key: "netWt", header: "Net", align: "right", width: 1 },
    { key: "fineWt", header: "Fine", align: "right", width: 1 },
    { key: "rateLabel", header: "Rate/g", align: "right", width: 1 },
    { key: "goldValueLabel", header: "Gold ₹", align: "right", width: 1 },
    { key: "makingLabel", header: "Making", align: "right", width: 1 },
    { key: "stoneLabel", header: "Stone", align: "right", width: 1 },
    {
      key: "hallmarkLabel",
      header: "Hallmark",
      align: "right",
      width: 1,
      showIf: "hasHallmarkCharges",
    },
    { key: "otherLabel", header: "Other", align: "right", width: 1, showIf: "hasOtherCharges" },
    { key: "discountLabel", header: "Disc", align: "right", width: 1 },
    { key: "totalLabel", header: "Total ₹", align: "right", width: 1 },
  ],
};

const invoicePaymentsAndAdjustment: SectionConfig[] = [
  {
    type: "dataList",
    id: "payments",
    title: "Mixed Payment Summary",
    rowsPath: "payments",
    labelKey: "modeLabel",
    valueKey: "amountLabel",
    subKey: "reference",
    showIf: "hasPayments",
  },
  {
    type: "fieldGrid",
    id: "orderAdjustment",
    title: "Applied Advance & Old Gold",
    showIf: "hasOrderAdjustment",
    fields: [
      {
        label: "Order Cash Advance",
        valuePath: "cashAdvanceLabel",
        showIf: "hasOrderAdjustmentCash",
        fullWidth: true,
      },
      {
        label: "Old Gold Exchange",
        valuePath: "oldGoldLabel",
        showIf: "hasOrderAdjustmentGold",
        fullWidth: true,
      },
    ],
  },
];

const invoiceTaxPanel: SectionConfig = {
  type: "fieldGrid",
  id: "taxPanel",
  theme: "darkPanel",
  fields: [
    { label: "Gold Value Amount", valuePath: "goldValueLabel" },
    { label: "Labour / Making", valuePath: "makingLabel" },
    { label: "Stone Valuation", valuePath: "stoneLabel", showIf: "hasStoneCharges" },
    {
      label: "Discount Reduction",
      valuePath: "discountLabel",
      showIf: "hasDiscount",
      variant: "critical",
    },
    { label: "Subtotal", valuePath: "subtotalLabel" },
    { label: "CGST", valuePath: "cgstLabel", showIf: "hasCgstSgst" },
    { label: "SGST", valuePath: "sgstLabel", showIf: "hasCgstSgst" },
    { label: "IGST", valuePath: "igstLabel", showIf: "hasIgstOnly" },
    { label: "GST Allocation", valuePath: "gstExemptText", showIf: "isNotGst3" },
    {
      label: "Applied Reductions",
      valuePath: "adjustmentLabel",
      showIf: "hasAdjustment",
      variant: "critical",
    },
    { label: "Grand Net Amount", valuePath: "grandTotalLabel", emphasis: true },
    { label: "Total Amount Received", valuePath: "paidLabel", variant: "success" },
    { label: "Balance Outstanding", valuePath: "balanceLabel", variant: "critical" },
  ],
};

const invoiceTermsAndSignature: SectionConfig = {
  type: "row",
  id: "tncAndSignature",
  columnWidths: [1, 2],
  columns: [
    [
      {
        type: "richText",
        id: "tnc",
        title: "Terms & Conditions",
        emphasis: "plain",
        staticText:
          "1. Handcrafted jewelry weights and fine purity certified under BIS standards.\n" +
          "2. Subject to local jurisdiction of West Bengal courts. Goods once sold are not returnable.\n" +
          "3. Authentic valuation matches the current market gold index dynamically.",
      },
    ],
    [
      {
        type: "signatureBlock",
        id: "signatures",
        leftCaptionPath: "customerName",
        rightCaptionPath: "ownerName",
        showStamp: true,
      },
    ],
  ],
};

const invoicePremiumSections: SectionConfig[] = [
  {
    type: "premiumHeader",
    id: "header",
    variant: "premium",
    badgeTitlePath: "badgeTitle",
    showQr: true,
    qrLabel: "Secure Receipt",
    qrSize: 40,
  },
  {
    type: "billedToStamp",
    id: "billedTo",
    namePath: "customerName",
    stampLabel: "ORIGINAL TRANS-REC",
    subFields: [
      { label: "Phone", valuePath: "customerPhone", showIf: "hasCustomerPhone" },
      { label: "Cust GSTIN", valuePath: "customerGstin", showIf: "hasCustomerGstin" },
    ],
  },
  invoiceItemsTable,
  {
    type: "row",
    id: "calcRow",
    columnWidths: [1, 1],
    columns: [invoicePaymentsAndAdjustment, [invoiceTaxPanel]],
  },
  {
    type: "richText",
    id: "amountInWords",
    title: "Amount in words",
    emphasis: "inline",
    textPath: "amountInWordsText",
  },
  invoiceTermsAndSignature,
];

const invoiceThermalSections: SectionConfig[] = [
  { type: "premiumHeader", id: "header", variant: "compact", badgeTitlePath: "badgeTitle" },
  {
    type: "dataList",
    id: "ticketInfo",
    rowsPath: "ticketInfo",
    labelKey: "label",
    valueKey: "value",
  },
  { type: "thermalItemList", id: "items", rowsPath: "items" },
  {
    type: "dataList",
    id: "thermalTotals",
    rowsPath: "thermalTotals",
    labelKey: "label",
    valueKey: "value",
  },
  {
    type: "dataList",
    id: "thermalPayments",
    title: "PAYMENTS",
    rowsPath: "payments",
    labelKey: "modeLabel",
    valueKey: "amountLabel",
    subKey: "reference",
    showIf: "hasPayments",
  },
  { type: "qr", id: "qr", position: "footer", label: "Scan to Verify Authentic Receipt", size: 48 },
  {
    type: "signatureBlock",
    id: "signatures",
    leftLabel: "Customer Sign",
    rightLabel: "Auth Signatory",
  },
  {
    type: "richText",
    id: "footerTagline",
    emphasis: "plain",
    staticText: "Handcrafted with Pure Quality · MTJ",
  },
];

const invoiceTagSections: SectionConfig[] = [{ type: "tagCards", id: "tags", rowsPath: "items" }];

function invoiceTemplatesFor(
  docType: "gst_invoice" | "retail_invoice",
  label: string,
): PrintTemplate[] {
  return [
    builtin({
      id: `default_${docType}_a4`,
      docType,
      name: `${label} — A4 (Default)`,
      paperSize: "a4",
      shell: "custom",
      sections: invoicePremiumSections,
    }),
    builtin({
      id: `default_${docType}_a5`,
      docType,
      name: `${label} — A5 (Default)`,
      paperSize: "a5",
      shell: "custom",
      sections: invoicePremiumSections,
    }),
    builtin({
      id: `default_${docType}_thermal`,
      docType,
      name: `${label} — Thermal 80mm (Default)`,
      paperSize: "thermal",
      shell: "custom",
      sections: invoiceThermalSections,
    }),
    builtin({
      id: `default_${docType}_thermal58`,
      docType,
      name: `${label} — Thermal 58mm (Default)`,
      paperSize: "thermal58",
      shell: "custom",
      sections: invoiceThermalSections,
    }),
    builtin({
      id: `default_${docType}_tag`,
      docType,
      name: `${label} — Jewellery Tag (Default)`,
      paperSize: "tag",
      shell: "custom",
      sections: invoiceTagSections,
    }),
  ];
}

/**
 * Phase 0 seeded only credit_note/order_slip as illustrative examples;
 * `getForDocType()` falls back to a placeholder "Unconfigured" template
 * for any doc type not listed here, so every call site stays total
 * without pretending migration is further along than it is.
 */
export const DEFAULT_TEMPLATES: Partial<Record<PrintDocType, PrintTemplate[]>> = {
  credit_note: [creditNoteTemplate],
  order_slip: [orderSlipTemplate],
  gst_invoice: invoiceTemplatesFor("gst_invoice", "Tax Invoice"),
  retail_invoice: invoiceTemplatesFor("retail_invoice", "Retail Invoice"),
};
