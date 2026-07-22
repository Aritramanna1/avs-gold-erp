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

// Debit Note's legacy route (billing.debit-note-print.$id.tsx) is
// byte-for-byte the same layout as Credit Note's, just a different title
// and store — same section list, not a copy-paste-and-drift risk since
// both are declared here rather than duplicated as JSX.
const debitNoteTemplate = builtin({
  id: "default_debit_note",
  docType: "debit_note",
  name: "Debit Note (Default)",
  paperSize: "a4",
  sections: [
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

const estimateTemplate = builtin({
  id: "default_estimate_doc",
  docType: "estimate_doc",
  name: "Estimate (Default)",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header" },
    {
      type: "fieldGrid",
      id: "status",
      fields: [{ label: "Status", valuePath: "statusText", fullWidth: true, variant: "neutral" }],
    },
    {
      type: "fieldGrid",
      id: "customer",
      columns: 1,
      fields: [
        { label: "Customer", valuePath: "customerName", fullWidth: true },
        { label: "Phone", valuePath: "customerPhone", showIf: "hasCustomerPhone", fullWidth: true },
      ],
    },
    {
      type: "table",
      id: "items",
      rowsPath: "items",
      columns: [
        { key: "itemName", header: "Item", align: "left", width: 3 },
        { key: "fineWt", header: "Fine (g)", align: "center", width: 1 },
        { key: "amountLabel", header: "Amount", align: "right", width: 1 },
      ],
    },
    {
      type: "fieldGrid",
      id: "totals",
      columns: 1,
      fields: [
        { label: "Subtotal", valuePath: "subtotalLabel", fullWidth: true },
        { label: "GST", valuePath: "gstLabel", showIf: "hasGst", fullWidth: true },
        { label: "Grand Total", valuePath: "grandTotalLabel", fullWidth: true, emphasis: true },
      ],
    },
    { type: "richText", id: "notes", textPath: "notesText", emphasis: "plain", showIf: "hasNotes" },
    { type: "richText", id: "validity", textPath: "validityText", emphasis: "plain" },
  ],
});

const deliveryChallanTemplate = builtin({
  id: "default_delivery_challan",
  docType: "delivery_challan",
  name: "Delivery Challan (Default)",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header" },
    {
      type: "fieldGrid",
      id: "status",
      fields: [{ label: "Status", valuePath: "statusText", fullWidth: true, variant: "neutral" }],
    },
    {
      type: "fieldGrid",
      id: "customer",
      columns: 1,
      fields: [{ label: "Customer", valuePath: "customerName", fullWidth: true }],
    },
    {
      type: "table",
      id: "items",
      rowsPath: "items",
      columns: [
        { key: "itemName", header: "Item", align: "left", width: 3 },
        { key: "qty", header: "Qty", align: "center", width: 1 },
        { key: "grossWt", header: "Gross (g)", align: "center", width: 1 },
        { key: "netWt", header: "Net (g)", align: "center", width: 1 },
        { key: "purity", header: "Purity", align: "center", width: 1 },
        { key: "fineWt", header: "Fine (g)", align: "center", width: 1 },
      ],
    },
    { type: "richText", id: "notes", textPath: "notesText", showIf: "hasNotes" },
    { type: "richText", id: "purposeFooter", textPath: "purposeText", emphasis: "plain" },
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

// ── Karigar Custody Statement (Worker Gold Book) ──────────────────────────
// Legacy workshop.gold-book-print.$workerId.tsx: 3-col profile+summary card
// (Worker / Cumulative Fine Gold / Closing Balance), a 9-col running-ledger
// table, plain worker/supervisor signatures.

const karigarCustodyStatementTemplate = builtin({
  id: "default_karigar_custody_statement",
  docType: "karigar_custody_statement",
  name: "Worker Custody Statement (Default)",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header" },
    // Report header: who, which book, which period — every field the owner
    // needs to identify the printed statement at a glance.
    {
      type: "fieldGrid",
      id: "statementMeta",
      columns: 3,
      fields: [
        { label: "Name", valuePath: "partyName" },
        { label: "Role", valuePath: "partyRole" },
        { label: "Book", valuePath: "bookLabel" },
        { label: "Report Period", valuePath: "periodLabel", fullWidth: true },
      ],
    },
    {
      type: "row",
      id: "summaryRow",
      columnWidths: [1, 1, 1],
      columns: [
        [
          {
            type: "richText",
            id: "openingBalance",
            title: "Opening Balance",
            emphasis: "plain",
            textPath: "openingBalanceText",
          },
        ],
        [
          {
            type: "richText",
            id: "movement",
            title: "Period Movement",
            emphasis: "plain",
            textPath: "movementText",
          },
        ],
        [
          {
            type: "richText",
            id: "closingBalance",
            title: "Closing Balance",
            emphasis: "box",
            textPath: "closingBalanceText",
          },
        ],
      ],
    },
    {
      type: "table",
      id: "entries",
      rowsPath: "entries",
      // Repeated on every printed page (drawn in <thead>) so a multi-page
      // ledger stays identified — shop name is added by the renderer.
      repeatHeaderMeta: [
        { label: "Name", valuePath: "partyName" },
        { label: "Book", valuePath: "bookLabel" },
        { label: "Period", valuePath: "periodLabel" },
      ],
      columns: [
        { key: "date", header: "Date", align: "left", width: 0.8 },
        { key: "voucherNo", header: "Voucher", align: "left", width: 0.8 },
        { key: "particulars", header: "Description", align: "left", width: 3 },
        { key: "received", header: "Gold Received (g)", align: "right", width: 1 },
        { key: "issued", header: "Gold Issued (g)", align: "right", width: 1 },
        { key: "balance", header: "Balance (g)", align: "right", width: 1 },
      ],
    },
    {
      type: "signatureBlock",
      id: "signatures",
      leftLabel: "Party Signature",
      rightLabel: "Authorized Supervisor",
    },
  ],
});

// ── Job Card ────────────────────────────────────────────────────────────
// Legacy workshop.print.job-card.$orderId.tsx: A5, 2-col customer/worker
// grid (customer full-width), conditional description, 3-col specs grid,
// conditional reference-image row, remarks, "Issued By"/"Worker
// Acknowledgement" signature labels (not the firm-generic ones).

// Half A4 (A5 landscape): two cards per A4 sheet, and the card sits flat on the
// bench beside the piece. Landscape because the specs a karigar reads at a
// glance — weight, purity, quantity, delivery — fit one row across, instead of
// running down a narrow portrait column.
const jobCardTemplate = builtin({
  id: "default_job_card",
  docType: "job_card",
  name: "Job Card (Half A4 / A5 Landscape)",
  paperSize: "a5l",
  sections: [
    { type: "header", id: "header", showQr: true, qrLabel: "Verify Job" },
    {
      type: "fieldGrid",
      id: "customerWorker",
      columns: 3,
      fields: [
        { label: "Customer / Dealer", valuePath: "customerLine", fullWidth: true },
        { label: "Assigned Worker", valuePath: "assignedWorkerName" },
        { label: "Product Name", valuePath: "itemName" },
        // Which piece of a multi-item order this card is for. Without it, a
        // karigar handed two cards from the same order cannot tell them apart.
        { label: "Item", valuePath: "lineLabel" },
      ],
    },
    {
      type: "fieldGrid",
      id: "description",
      columns: 1,
      showIf: "hasItemDescription",
      fields: [{ label: "Product Description", valuePath: "itemDescription", fullWidth: true }],
    },
    {
      type: "fieldGrid",
      id: "specs",
      columns: 3,
      fields: [
        { label: "Pieces", valuePath: "quantityLabel" },
        { label: "Target Weight (Net)", valuePath: "targetNetWt" },
        { label: "Purity", valuePath: "purityLabel" },
        { label: "Gold Received", valuePath: "goldReceivedLabel" },
        { label: "Target Gross Wt", valuePath: "targetGrossWt" },
        { label: "Work Starts", valuePath: "expectedStartLabel" },
        { label: "Delivery Deadline", valuePath: "expectedDeliveryLabel" },
        { label: "Priority", valuePath: "priorityLabel" },
      ],
    },
    {
      type: "images",
      id: "referenceImages",
      title: "Reference Images",
      imagesKey: "reference",
      showIf: "hasReferenceImages",
    },
    {
      type: "fieldGrid",
      id: "remarks",
      columns: 1,
      fields: [{ label: "Remarks", valuePath: "remarksText", fullWidth: true }],
    },
    {
      type: "signatureBlock",
      id: "signatures",
      leftLabel: "Issued By",
      rightLabel: "Worker Acknowledgement",
    },
  ],
});

// ── Customer Ledger Statement ──────────────────────────────────────────────
// Legacy people.ledger-print.$id.tsx: 2-col profile+identifiers card,
// 2-col gold/money account summary cards, a 10-col running-ledger table.

const customerLedgerStatementTemplate = builtin({
  id: "default_customer_ledger_statement",
  docType: "customer_ledger_statement",
  name: "Customer Ledger Statement (Default)",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header" },
    {
      type: "row",
      id: "profileRow",
      columnWidths: [1, 1],
      columns: [
        [
          {
            type: "fieldGrid",
            id: "profile",
            title: "Customer Profile",
            columns: 1,
            fields: [
              { label: "Name", valuePath: "customerName", fullWidth: true, emphasis: true },
              { label: "Phone", valuePath: "customerPhone", fullWidth: true },
              { label: "Email", valuePath: "customerEmail", fullWidth: true, showIf: "hasEmail" },
              {
                label: "Address",
                valuePath: "customerAddress",
                fullWidth: true,
                showIf: "hasAddress",
              },
            ],
          },
        ],
        [
          {
            type: "fieldGrid",
            id: "identifiers",
            title: "Tax / Identifiers",
            columns: 1,
            fields: [
              { label: "GSTIN", valuePath: "customerGstin", fullWidth: true, showIf: "hasGstin" },
              { label: "PAN", valuePath: "customerPan", fullWidth: true, showIf: "hasPan" },
              { label: "Status", valuePath: "statusText", fullWidth: true },
            ],
          },
        ],
      ],
    },
    {
      type: "row",
      id: "accountsRow",
      columnWidths: [1, 1],
      columns: [
        [
          {
            type: "fieldGrid",
            id: "goldAccount",
            title: "Gold Credit Account Balance",
            columns: 1,
            fields: [
              { label: "Balance", valuePath: "goldBalanceLabel", fullWidth: true, emphasis: true },
              { label: "Detail", valuePath: "goldBalanceNarrative", fullWidth: true },
              { label: "Movement", valuePath: "goldMovementText", fullWidth: true },
            ],
          },
        ],
        [
          {
            type: "fieldGrid",
            id: "moneyAccount",
            title: "Monetary Ledger Balance",
            columns: 1,
            fields: [
              { label: "Balance", valuePath: "moneyBalanceLabel", fullWidth: true, emphasis: true },
              { label: "Detail", valuePath: "moneyBalanceNarrative", fullWidth: true },
              { label: "Movement", valuePath: "moneyMovementText", fullWidth: true },
            ],
          },
        ],
      ],
    },
    {
      type: "table",
      id: "entries",
      title: "Ledger Entries Log",
      rowsPath: "entries",
      columns: [
        { key: "date", header: "Date", align: "left", width: 1.1 },
        { key: "voucherNo", header: "Ref/Voucher", align: "left", width: 1.1 },
        { key: "typeLabel", header: "Type", align: "center", width: 1, renderAs: "badge" },
        { key: "description", header: "Description", align: "left", width: 2.4 },
        { key: "purity", header: "Purity", align: "center", width: 0.9 },
        { key: "goldIn", header: "Gold In", align: "right", width: 1 },
        { key: "goldOut", header: "Gold Out", align: "right", width: 1 },
        { key: "debit", header: "Debit (Dr)", align: "right", width: 1 },
        { key: "credit", header: "Credit (Cr)", align: "right", width: 1.3 },
        { key: "goldBal", header: "Gold Bal", align: "right", width: 1.1 },
        { key: "moneyBal", header: "Cash Bal", align: "right", width: 1.1 },
      ],
    },
    {
      type: "fieldGrid",
      id: "closingBalance",
      title: "Closing Balance",
      columns: 3,
      fields: [
        { label: "Gold Balance", valuePath: "closingGoldText", fullWidth: true, emphasis: true },
        { label: "Cash Balance", valuePath: "closingCashText", fullWidth: true, emphasis: true },
        {
          label: "Outstanding Balance",
          valuePath: "closingOutstandingText",
          fullWidth: true,
          emphasis: true,
        },
      ],
    },
    {
      type: "signatureBlock",
      id: "signatures",
      leftLabel: "Customer's Acknowledgement Signature",
      rightLabel: "Authorized Signature",
    },
    {
      type: "richText",
      id: "footerNote",
      emphasis: "plain",
      staticText:
        "This statement is computer-generated and reflects real-time independent running balances of gold and money accounts.",
    },
  ],
});

/**
 * Phase 0 seeded only credit_note/order_slip as illustrative examples;
 * `getForDocType()` falls back to a placeholder "Unconfigured" template
 * for any doc type not listed here, so every call site stays total
 * without pretending migration is further along than it is.
 */
// ── Daily Material Slip ────────────────────────────────────────────────────
// One consolidated slip per worker per day: all Issues and Returns under one
// Slip Number, opening/net/closing custody, worker + company signatures.
const dailyMaterialSlipTemplate = builtin({
  id: "default_daily_material_slip",
  docType: "daily_material_slip",
  name: "Daily Material Slip (A4)",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header" },
    {
      type: "fieldGrid",
      id: "slipMeta",
      columns: 3,
      fields: [
        { label: "Slip Number", valuePath: "slipNumber" },
        { label: "Date", valuePath: "dateLabel" },
        { label: "Worker", valuePath: "workerName" },
        { label: "Total Transactions", valuePath: "transactionCount" },
        { label: "Total Issued", valuePath: "totalIssued" },
        { label: "Total Returned", valuePath: "totalReturned" },
      ],
    },
    {
      type: "table",
      id: "issues",
      rowsPath: "issues",
      columns: [
        { key: "voucher", header: "Voucher", align: "left", width: 1 },
        { key: "time", header: "Time", align: "left", width: 0.8 },
        { key: "particulars", header: "Particulars", align: "left", width: 2 },
        { key: "net", header: "Net (g)", align: "right", width: 1 },
        { key: "purity", header: "Purity", align: "right", width: 0.8 },
        { key: "fine", header: "Fine (g)", align: "right", width: 1 },
        { key: "qty", header: "Qty", align: "right", width: 0.6 },
      ],
    },
    {
      type: "table",
      id: "returns",
      rowsPath: "returns",
      columns: [
        { key: "voucher", header: "Voucher", align: "left", width: 1 },
        { key: "time", header: "Time", align: "left", width: 0.8 },
        { key: "particulars", header: "Particulars", align: "left", width: 2 },
        { key: "net", header: "Net (g)", align: "right", width: 1 },
        { key: "purity", header: "Purity", align: "right", width: 0.8 },
        { key: "fine", header: "Fine (g)", align: "right", width: 1 },
        { key: "qty", header: "Qty", align: "right", width: 0.6 },
      ],
    },
    {
      type: "row",
      id: "custodyRow",
      columnWidths: [1, 1, 1],
      columns: [
        [
          {
            type: "richText",
            id: "opening",
            title: "Opening Custody",
            emphasis: "plain",
            textPath: "openingBalance",
          },
        ],
        [
          {
            type: "richText",
            id: "net",
            title: "Net Movement",
            emphasis: "plain",
            textPath: "netMovement",
          },
        ],
        [
          {
            type: "richText",
            id: "closing",
            title: "Running Custody Balance",
            emphasis: "box",
            textPath: "custodyBalance",
          },
        ],
      ],
    },
    {
      type: "signatureBlock",
      id: "signatures",
      leftLabel: "Worker Signature",
      rightLabel: "Company Signature",
    },
  ],
});

export const DEFAULT_TEMPLATES: Partial<Record<PrintDocType, PrintTemplate[]>> = {
  daily_material_slip: [dailyMaterialSlipTemplate],
  credit_note: [creditNoteTemplate],
  debit_note: [debitNoteTemplate],
  estimate_doc: [estimateTemplate],
  delivery_challan: [deliveryChallanTemplate],
  order_slip: [orderSlipTemplate],
  job_card: [jobCardTemplate],
  karigar_custody_statement: [karigarCustodyStatementTemplate],
  customer_ledger_statement: [customerLedgerStatementTemplate],
  gst_invoice: invoiceTemplatesFor("gst_invoice", "Tax Invoice"),
  retail_invoice: invoiceTemplatesFor("retail_invoice", "Retail Invoice"),
};
