/**
 * Unified Print Engine — seeded default templates & 10 Canonical Base Template Families.
 *
 * Master Reference: docs/DOCUMENT_TEMPLATE_ENGINE.md
 */
import type { PrintDocType, PrintTemplate, SectionConfig, TemplateFamily } from "./types";

const now = Date.now();

function builtin(
  t: Omit<PrintTemplate, "isBuiltin" | "version" | "versions" | "createdAt" | "updatedAt">,
): PrintTemplate {
  return { ...t, isBuiltin: true, version: 1, versions: [], createdAt: now, updatedAt: now };
}

// ── Reusable Section Components ──────────────────────────────────────────

const standardHeader: SectionConfig = { type: "header", id: "header" };

const partyCustomer: SectionConfig = {
  type: "party",
  id: "customer",
  title: "Customer / Billed To",
  namePath: "customerName",
  subFields: [
    { label: "Phone", valuePath: "customerPhone", showIf: "hasCustomerPhone" },
    { label: "GSTIN", valuePath: "customerGstin", showIf: "hasCustomerGstin" },
    {
      label: "Address",
      valuePath: "customerAddress",
      showIf: "hasCustomerAddress",
      fullWidth: true,
    },
    { label: "State", valuePath: "customerState", showIf: "hasCustomerState" },
  ],
};

const partyWorker: SectionConfig = {
  type: "party",
  id: "workerParty",
  title: "Artisan / Karigar Details",
  namePath: "workerName",
  subFields: [
    { label: "Phone", valuePath: "workerPhone", showIf: "hasWorkerPhone" },
    { label: "Specialization", valuePath: "workerSkill", showIf: "hasWorkerSkill" },
    { label: "Workshop Bench", valuePath: "workshopBench", showIf: "hasWorkshopBench" },
  ],
};

const standardSignatures: SectionConfig = {
  type: "signatureBlock",
  id: "signatures",
  leftLabel: "Customer / Receiver Signature",
  rightLabel: "Authorised Signatory",
  showStamp: false,
};

const dualWorkshopSignatures: SectionConfig = {
  type: "signatureBlock",
  id: "signatures",
  leftLabel: "Artisan / Karigar Sign",
  rightLabel: "Vault / Floor Supervisor",
  showStamp: false,
};

// ── 10 Canonical Template Families for GST / Retail Invoices ──────────────

// 1. Classic Business (Traditional bordered, double-rule header, gold summary box)
const classicBusinessSections: SectionConfig[] = [
  { type: "header", id: "header", showQr: false, qrLabel: "Verify Bill" },
  {
    type: "row",
    id: "partyRow",
    columnWidths: [1, 1],
    columns: [
      [partyCustomer],
      [
        {
          type: "fieldGrid",
          id: "invoiceMeta",
          title: "Invoice Details",
          columns: 1,
          fields: [
            { label: "Invoice No", valuePath: "invoiceNo", emphasis: true },
            { label: "Invoice Date", valuePath: "invoiceDate" },
            { label: "Place of Supply", valuePath: "placeOfSupply", showIf: "hasPlaceOfSupply" },
            { label: "Due Date", valuePath: "dueDate", showIf: "hasDueDate" },
          ],
        },
      ],
    ],
  },
  {
    type: "table",
    id: "items",
    title: "Particulars of Jewellery",
    rowsPath: "items",
    footerRowPath: "itemsTotals",
    columns: [
      { key: "description", header: "Item Description", align: "left", width: 3 },
      { key: "huid", header: "HUID / Tag", align: "center", width: 1, showIf: "hasHuid" },
      { key: "purity", header: "Purity", align: "center", width: 1 },
      { key: "grossWt", header: "Gross (g)", align: "right", width: 1 },
      { key: "netWt", header: "Net (g)", align: "right", width: 1 },
      { key: "fineWt", header: "Fine (g)", align: "right", width: 1 },
      { key: "rateLabel", header: "Rate/g", align: "right", width: 1 },
      { key: "makingLabel", header: "Making", align: "right", width: 1 },
      { key: "totalLabel", header: "Total Amount ₹", align: "right", width: 1.2 },
    ],
  },
  {
    type: "row",
    id: "summaryRow",
    columnWidths: [1, 1],
    columns: [
      [
        {
          type: "fieldGrid",
          id: "settlementBox",
          title: "Payment & Gold Adjustment",
          columns: 1,
          fields: [
            {
              label: "Cash Advance Applied",
              valuePath: "cashAdvanceLabel",
              showIf: "hasOrderAdjustmentCash",
            },
            {
              label: "Customer Gold Adjusted",
              valuePath: "oldGoldLabel",
              showIf: "hasOrderAdjustmentGold",
            },
            { label: "Payment Mode", valuePath: "paymentModeLabel", showIf: "hasPayments" },
            { label: "Bank Account", valuePath: "bankName", showIf: "hasBankDetails" },
            { label: "Account No / IFSC", valuePath: "bankAccountIfsc", showIf: "hasBankDetails" },
          ],
        },
      ],
      [
        {
          type: "fieldGrid",
          id: "taxTotals",
          theme: "bordered",
          columns: 1,
          fields: [
            { label: "Subtotal (Metal + Labour)", valuePath: "subtotalLabel" },
            { label: "CGST (1.5%)", valuePath: "cgstLabel", showIf: "hasCgstSgst" },
            { label: "SGST (1.5%)", valuePath: "sgstLabel", showIf: "hasCgstSgst" },
            { label: "IGST (3.0%)", valuePath: "igstLabel", showIf: "hasIgstOnly" },
            {
              label: "Discount",
              valuePath: "discountLabel",
              showIf: "hasDiscount",
              variant: "critical",
            },
            { label: "Grand Total", valuePath: "grandTotalLabel", emphasis: true },
            { label: "Amount Paid", valuePath: "paidLabel", variant: "success" },
            {
              label: "Balance Due",
              valuePath: "balanceLabel",
              variant: "critical",
              showIf: "hasBalance",
            },
          ],
        },
      ],
    ],
  },
  {
    type: "richText",
    id: "amountInWords",
    title: "Amount in words",
    emphasis: "inline",
    textPath: "amountInWordsText",
  },
  {
    type: "balanceCard",
    id: "customerHisab",
    title: "Customer Hisab (Metal + Cash)",
    goldKey: "gold",
    cashKey: "cash",
    labelMode: "jama_naam",
    showIf: "showCustomerHisab",
  },
  {
    type: "richText",
    id: "tnc",
    title: "Terms & Conditions",
    emphasis: "plain",
    staticText:
      "1. All jewellery purity certified under BIS Hallmark guidelines.\n" +
      "2. Weight discrepancy claims must be reported within 24 hours of delivery.\n" +
      "3. Subject to local jurisdiction of registered office.",
  },
  standardSignatures,
];

// 2. Modern Professional (Clean asymmetric, darkPanel tax box, purple/gold styling)
const modernProfessionalSections: SectionConfig[] = [
  {
    type: "premiumHeader",
    id: "header",
    variant: "premium",
    badgeTitlePath: "badgeTitle",
    showQr: false,
    qrLabel: "Secure E-Verify",
    qrSize: 42,
  },
  {
    type: "billedToStamp",
    id: "billedTo",
    namePath: "customerName",
    stampLabel: "ORIGINAL CLIENT COPY",
    subFields: [
      { label: "Phone", valuePath: "customerPhone", showIf: "hasCustomerPhone" },
      { label: "GSTIN", valuePath: "customerGstin", showIf: "hasCustomerGstin" },
      {
        label: "Address",
        valuePath: "customerAddress",
        showIf: "hasCustomerAddress",
        fullWidth: true,
      },
    ],
  },
  {
    type: "table",
    id: "items",
    title: "Billed Items",
    rowsPath: "items",
    footerRowPath: "itemsTotals",
    columns: [
      { key: "photoUrl", header: "Photo", align: "center", width: 1, renderAs: "image" },
      { key: "description", header: "Description", align: "left", width: 3 },
      { key: "purity", header: "Purity", align: "center", width: 1 },
      { key: "grossWt", header: "Gross", align: "right", width: 1 },
      { key: "netWt", header: "Net", align: "right", width: 1 },
      { key: "fineWt", header: "Fine", align: "right", width: 1 },
      { key: "rateLabel", header: "Rate/g", align: "right", width: 1 },
      { key: "makingLabel", header: "Labour", align: "right", width: 1 },
      { key: "stoneLabel", header: "Stone", align: "right", width: 1, showIf: "hasStoneCharges" },
      { key: "totalLabel", header: "Total ₹", align: "right", width: 1.2 },
    ],
  },
  {
    type: "row",
    id: "calcRow",
    columnWidths: [1, 1],
    columns: [
      [
        {
          type: "dataList",
          id: "payments",
          title: "Payment Summary",
          rowsPath: "payments",
          labelKey: "modeLabel",
          valueKey: "amountLabel",
          subKey: "reference",
          showIf: "hasPayments",
        },
        {
          type: "fieldGrid",
          id: "orderAdjustment",
          title: "Advance & Old Gold",
          showIf: "hasOrderAdjustment",
          fields: [
            {
              label: "Cash Advance",
              valuePath: "cashAdvanceLabel",
              showIf: "hasOrderAdjustmentCash",
              fullWidth: true,
            },
            {
              label: "Old Gold Settlement",
              valuePath: "oldGoldLabel",
              showIf: "hasOrderAdjustmentGold",
              fullWidth: true,
            },
          ],
        },
      ],
      [
        {
          type: "fieldGrid",
          id: "taxPanel",
          theme: "darkPanel",
          fields: [
            { label: "Gold Valuation", valuePath: "goldValueLabel" },
            { label: "Making / Crafting", valuePath: "makingLabel" },
            { label: "Stone Charges", valuePath: "stoneLabel", showIf: "hasStoneCharges" },
            {
              label: "Discount",
              valuePath: "discountLabel",
              showIf: "hasDiscount",
              variant: "critical",
            },
            { label: "Subtotal", valuePath: "subtotalLabel" },
            { label: "CGST (1.5%)", valuePath: "cgstLabel", showIf: "hasCgstSgst" },
            { label: "SGST (1.5%)", valuePath: "sgstLabel", showIf: "hasCgstSgst" },
            { label: "IGST (3.0%)", valuePath: "igstLabel", showIf: "hasIgstOnly" },
            { label: "Grand Net Total", valuePath: "grandTotalLabel", emphasis: true },
            { label: "Amount Paid", valuePath: "paidLabel", variant: "success" },
            {
              label: "Balance Outstanding",
              valuePath: "balanceLabel",
              variant: "critical",
              showIf: "hasBalance",
            },
          ],
        },
      ],
    ],
  },
  {
    type: "richText",
    id: "amountInWords",
    title: "Amount in words",
    emphasis: "inline",
    textPath: "amountInWordsText",
  },
  standardSignatures,
];

// 3. Premium Jewellery (Luxury styling, gemstone breakdown, certificate/HUID badges)
const premiumJewellerySections: SectionConfig[] = [
  {
    type: "premiumHeader",
    id: "header",
    variant: "centered",
    badgeTitlePath: "badgeTitle",
    showQr: false,
  },
  {
    type: "fieldGrid",
    id: "partyAndMeta",
    columns: 2,
    fields: [
      { label: "Customer Name", valuePath: "customerName", emphasis: true },
      { label: "Invoice Number", valuePath: "invoiceNo", emphasis: true },
      { label: "Contact Phone", valuePath: "customerPhone", showIf: "hasCustomerPhone" },
      { label: "Date of Sale", valuePath: "invoiceDate" },
      { label: "Client GSTIN", valuePath: "customerGstin", showIf: "hasCustomerGstin" },
      { label: "Place of Supply", valuePath: "placeOfSupply", showIf: "hasPlaceOfSupply" },
    ],
  },
  {
    type: "table",
    id: "items",
    title: "Handcrafted Jewellery & Precious Gems",
    rowsPath: "items",
    footerRowPath: "itemsTotals",
    columns: [
      { key: "photoUrl", header: "Preview", align: "center", width: 1, renderAs: "image" },
      { key: "description", header: "Ornament / Certificate", align: "left", width: 3 },
      { key: "huid", header: "BIS HUID", align: "center", width: 1, showIf: "hasHuid" },
      { key: "purity", header: "Carat / Purity", align: "center", width: 1 },
      { key: "grossWt", header: "Gross Wt", align: "right", width: 1 },
      { key: "netWt", header: "Net Wt", align: "right", width: 1 },
      {
        key: "stoneLabel",
        header: "Diamond / Gem ₹",
        align: "right",
        width: 1,
        showIf: "hasStoneCharges",
      },
      { key: "makingLabel", header: "Crafting Fee", align: "right", width: 1 },
      { key: "totalLabel", header: "Valuation ₹", align: "right", width: 1.2 },
    ],
  },
  {
    type: "row",
    id: "luxuryTotalsRow",
    columnWidths: [1, 1],
    columns: [
      [
        {
          type: "richText",
          id: "purityGuarantee",
          title: "Authenticity & Hallmark Certificate",
          emphasis: "callout",
          staticText:
            "Every piece is hallmarked in compliance with BIS standards. Precious stones and diamonds are individually graded for color, clarity, and certified cut.",
        },
      ],
      [
        {
          type: "fieldGrid",
          id: "goldSummaryTotals",
          theme: "goldSummary",
          columns: 1,
          fields: [
            { label: "Valuation Subtotal", valuePath: "subtotalLabel" },
            { label: "GST Tax Schedule", valuePath: "gstSummaryLabel", showIf: "hasGst" },
            { label: "Grand Invoice Total", valuePath: "grandTotalLabel", emphasis: true },
            { label: "Total Remittance Received", valuePath: "paidLabel", variant: "success" },
            {
              label: "Balance Payable",
              valuePath: "balanceLabel",
              variant: "critical",
              showIf: "hasBalance",
            },
          ],
        },
      ],
    ],
  },
  {
    type: "richText",
    id: "amountInWords",
    title: "Amount in words",
    emphasis: "inline",
    textPath: "amountInWordsText",
  },
  {
    type: "signatureBlock",
    id: "signatures",
    leftLabel: "Valued Client Acceptance",
    rightLabel: "Certified Master Jeweller",
    showStamp: false,
  },
];

// 4. Compact Accounting (Auditor-focused, detailed debit/credit/tax schedules, 15+ items)
const compactAccountingSections: SectionConfig[] = [
  { type: "header", id: "header" },
  {
    type: "fieldGrid",
    id: "compactHeaderGrid",
    columns: 3,
    fields: [
      { label: "Doc No", valuePath: "invoiceNo" },
      { label: "Date", valuePath: "invoiceDate" },
      { label: "Party", valuePath: "customerName" },
      { label: "GSTIN", valuePath: "customerGstin", showIf: "hasCustomerGstin" },
      { label: "State Code", valuePath: "customerStateCode", showIf: "hasStateCode" },
      { label: "Due Date", valuePath: "dueDate", showIf: "hasDueDate" },
    ],
  },
  {
    type: "table",
    id: "items",
    rowsPath: "items",
    footerRowPath: "itemsTotals",
    columns: [
      { key: "description", header: "HSN / Item Code / Particulars", align: "left", width: 3 },
      { key: "purity", header: "Touch", align: "center", width: 0.8 },
      { key: "grossWt", header: "Gross (g)", align: "right", width: 1 },
      { key: "netWt", header: "Net (g)", align: "right", width: 1 },
      { key: "fineWt", header: "Fine (g)", align: "right", width: 1 },
      { key: "rateLabel", header: "Metal Bhav", align: "right", width: 1 },
      { key: "makingLabel", header: "Labour", align: "right", width: 1 },
      { key: "taxableValue", header: "Taxable Value ₹", align: "right", width: 1.1 },
      { key: "totalLabel", header: "Total Amount ₹", align: "right", width: 1.1 },
    ],
  },
  {
    type: "fieldGrid",
    id: "auditTotals",
    columns: 4,
    fields: [
      { label: "Taxable Amount", valuePath: "subtotalLabel" },
      { label: "CGST", valuePath: "cgstLabel", showIf: "hasCgstSgst" },
      { label: "SGST", valuePath: "sgstLabel", showIf: "hasCgstSgst" },
      { label: "IGST", valuePath: "igstLabel", showIf: "hasIgstOnly" },
      { label: "Net Payable", valuePath: "grandTotalLabel", emphasis: true },
      { label: "Paid / Adjusted", valuePath: "paidLabel" },
      { label: "Closing Balance", valuePath: "balanceLabel", emphasis: true },
      { label: "Payment Status", valuePath: "statusText", variant: "neutral" },
    ],
  },
  standardSignatures,
];

// 5. Manufacturing / Workshop (Job card, metal purity custody, stage sign-offs, barcode)
const manufacturingWorkshopSections: SectionConfig[] = [
  { type: "header", id: "header", showQr: false, qrLabel: "Workshop Job" },
  {
    type: "fieldGrid",
    id: "jobCardMeta",
    columns: 3,
    fields: [
      { label: "Job Card No", valuePath: "jobCardNo", emphasis: true },
      { label: "Assigned Artisan", valuePath: "assignedWorkerName" },
      { label: "Order / Ref No", valuePath: "productionOrderNo" },
      { label: "Item Category", valuePath: "itemName" },
      { label: "Target Net Wt", valuePath: "targetNetWt" },
      { label: "Target Purity", valuePath: "purityLabel" },
      { label: "Delivery Target", valuePath: "expectedDeliveryLabel" },
      { label: "Priority", valuePath: "priorityLabel" },
      { label: "Gold Issued", valuePath: "goldReceivedLabel" },
    ],
  },
  {
    type: "images",
    id: "referenceImages",
    title: "CAD / Reference Design",
    imagesKey: "reference",
    showIf: "hasReferenceImages",
  },
  {
    type: "fieldGrid",
    id: "stageSignOffs",
    title: "Department Stage Sign-Offs",
    columns: 4,
    fields: [
      { label: "1. Melting & Ingot", valuePath: "stageMelting", showIf: "hasStageMelting" },
      { label: "2. Filing & Assembly", valuePath: "stageFiling", showIf: "hasStageFiling" },
      { label: "3. Stone Setting", valuePath: "stageSetting", showIf: "hasStageSetting" },
      { label: "4. Final Polish & QC", valuePath: "stagePolish", showIf: "hasStagePolish" },
    ],
  },
  { type: "richText", id: "remarks", title: "Workshop Instructions", textPath: "remarksText" },
  dualWorkshopSignatures,
];

// 6. Traditional Indian Business (Trade layout, Jama / Naam accounting columns, auspicious header)
const traditionalIndianSections: SectionConfig[] = [
  {
    type: "premiumHeader",
    id: "header",
    variant: "centered",
    titleText: "॥ श्री गणेशाय नमः ॥",
    badgeTitlePath: "badgeTitle",
    showQr: false,
  },
  {
    type: "fieldGrid",
    id: "traditionalParty",
    columns: 2,
    fields: [
      { label: "Grahak Name (Customer)", valuePath: "customerName", emphasis: true },
      { label: "Parchi / Bill No", valuePath: "invoiceNo", emphasis: true },
      { label: "Mobile No", valuePath: "customerPhone", showIf: "hasCustomerPhone" },
      { label: "Miti / Date", valuePath: "invoiceDate" },
      {
        label: "Address",
        valuePath: "customerAddress",
        showIf: "hasCustomerAddress",
        fullWidth: true,
      },
    ],
  },
  {
    type: "table",
    id: "items",
    title: "Gahana / Ornament Details",
    rowsPath: "items",
    footerRowPath: "itemsTotals",
    columns: [
      { key: "description", header: "Particulars / Vivaran", align: "left", width: 3 },
      { key: "purity", header: "Touch (Karat)", align: "center", width: 1 },
      { key: "grossWt", header: "Vajan (Gross)", align: "right", width: 1 },
      { key: "netWt", header: "Pakka Vajan (Net)", align: "right", width: 1 },
      { key: "fineWt", header: "Fine Gold", align: "right", width: 1 },
      { key: "rateLabel", header: "Bhav / Rate", align: "right", width: 1 },
      { key: "makingLabel", header: "Gadhai (Making)", align: "right", width: 1 },
      { key: "totalLabel", header: "Kul Rashi ₹", align: "right", width: 1.2 },
    ],
  },
  {
    type: "row",
    id: "jamaNaamRow",
    columnWidths: [1, 1],
    columns: [
      [
        {
          type: "fieldGrid",
          id: "jamaSide",
          title: "Jama (Credit / Advance Paid)",
          columns: 1,
          fields: [
            {
              label: "Jama Cash Advance",
              valuePath: "cashAdvanceLabel",
              showIf: "hasOrderAdjustmentCash",
            },
            {
              label: "Purana Sona (Old Gold)",
              valuePath: "oldGoldLabel",
              showIf: "hasOrderAdjustmentGold",
            },
            { label: "Aaj Ka Bhugtan (Today Paid)", valuePath: "paidLabel", variant: "success" },
          ],
        },
      ],
      [
        {
          type: "fieldGrid",
          id: "naamSide",
          title: "Naam (Debit / Total Due)",
          columns: 1,
          fields: [
            { label: "Bill Kul Rashi", valuePath: "subtotalLabel" },
            { label: "GST Tax", valuePath: "gstSummaryLabel", showIf: "hasGst" },
            { label: "Net Kul Rashi", valuePath: "grandTotalLabel", emphasis: true },
            {
              label: "Baki Rashi (Balance)",
              valuePath: "balanceLabel",
              variant: "critical",
              showIf: "hasBalance",
            },
          ],
        },
      ],
    ],
  },
  {
    type: "richText",
    id: "amountInWords",
    title: "Amount in words",
    emphasis: "inline",
    textPath: "amountInWordsText",
  },
  {
    type: "signatureBlock",
    id: "signatures",
    leftLabel: "Grahak Ke Hastakshar",
    rightLabel: "Vibhag Hastakshar / Mohar",
    showStamp: false,
  },
];

// 7. Minimal Clean (Borderless, generous whitespace, contemporary sans-serif)
const minimalCleanSections: SectionConfig[] = [
  { type: "header", id: "header", showQr: false },
  {
    type: "fieldGrid",
    id: "minimalPartyGrid",
    columns: 2,
    fields: [
      { label: "Client", valuePath: "customerName", emphasis: true },
      { label: "Reference", valuePath: "invoiceNo" },
      { label: "Date", valuePath: "invoiceDate" },
      { label: "Due", valuePath: "dueDate", showIf: "hasDueDate" },
    ],
  },
  {
    type: "table",
    id: "items",
    rowsPath: "items",
    footerRowPath: "itemsTotals",
    columns: [
      { key: "description", header: "Item", align: "left", width: 3 },
      { key: "purity", header: "Purity", align: "center", width: 1 },
      { key: "grossWt", header: "Gross", align: "right", width: 1 },
      { key: "netWt", header: "Net", align: "right", width: 1 },
      { key: "totalLabel", header: "Amount ₹", align: "right", width: 1.2 },
    ],
  },
  {
    type: "fieldGrid",
    id: "minimalTotals",
    columns: 1,
    fields: [
      { label: "Subtotal", valuePath: "subtotalLabel" },
      { label: "Taxes", valuePath: "gstSummaryLabel", showIf: "hasGst" },
      { label: "Total", valuePath: "grandTotalLabel", emphasis: true },
      { label: "Paid", valuePath: "paidLabel", variant: "success" },
      { label: "Balance", valuePath: "balanceLabel", showIf: "hasBalance" },
    ],
  },
  standardSignatures,
];

// 8. Elegant Corporate (Executive B2B layout, separate buyer/seller/ship-to panels)
const elegantCorporateSections: SectionConfig[] = [
  { type: "header", id: "header", showQr: false, qrLabel: "E-Invoice QR" },
  {
    type: "row",
    id: "b2bParties",
    columnWidths: [1, 1],
    columns: [
      [
        {
          type: "party",
          id: "billedToParty",
          title: "Details of Receiver (Billed To)",
          namePath: "customerName",
          subFields: [
            {
              label: "Address",
              valuePath: "customerAddress",
              showIf: "hasCustomerAddress",
              fullWidth: true,
            },
            { label: "GSTIN / UIN", valuePath: "customerGstin", showIf: "hasCustomerGstin" },
            { label: "State & Code", valuePath: "customerStateCode", showIf: "hasStateCode" },
          ],
        },
      ],
      [
        {
          type: "party",
          id: "shippedToParty",
          title: "Details of Consignee (Shipped To)",
          namePath: "shippingName",
          showIf: "hasShippingDetails",
          subFields: [
            { label: "Shipping Address", valuePath: "shippingAddress", fullWidth: true },
            { label: "Consignee State", valuePath: "shippingState" },
          ],
        },
      ],
    ],
  },
  {
    type: "table",
    id: "items",
    title: "Schedule of Goods Supplied",
    rowsPath: "items",
    footerRowPath: "itemsTotals",
    columns: [
      { key: "hsn", header: "HSN / SAC", align: "left", width: 1 },
      { key: "description", header: "Description of Goods", align: "left", width: 3 },
      { key: "purity", header: "Purity", align: "center", width: 0.8 },
      { key: "grossWt", header: "Gross (g)", align: "right", width: 1 },
      { key: "netWt", header: "Net (g)", align: "right", width: 1 },
      { key: "taxableValue", header: "Taxable Val ₹", align: "right", width: 1.1 },
      { key: "cgstAmount", header: "CGST ₹", align: "right", width: 1, showIf: "hasCgstSgst" },
      { key: "sgstAmount", header: "SGST ₹", align: "right", width: 1, showIf: "hasCgstSgst" },
      { key: "totalLabel", header: "Total Value ₹", align: "right", width: 1.2 },
    ],
  },
  {
    type: "row",
    id: "corporateTotalsRow",
    columnWidths: [1, 1],
    columns: [
      [
        {
          type: "fieldGrid",
          id: "bankAndDeclarations",
          title: "Electronic Remittance Details",
          columns: 1,
          fields: [
            { label: "Bank Name", valuePath: "bankName", showIf: "hasBankDetails" },
            { label: "Account Number", valuePath: "bankAccountNo", showIf: "hasBankDetails" },
            { label: "IFSC Code", valuePath: "bankIfsc", showIf: "hasBankDetails" },
            { label: "Terms of Payment", valuePath: "paymentTerms", showIf: "hasPaymentTerms" },
          ],
        },
      ],
      [
        {
          type: "fieldGrid",
          id: "grandTotalsGrid",
          theme: "bordered",
          columns: 1,
          fields: [
            { label: "Total Taxable Value", valuePath: "subtotalLabel" },
            { label: "Total CGST", valuePath: "cgstLabel", showIf: "hasCgstSgst" },
            { label: "Total SGST", valuePath: "sgstLabel", showIf: "hasCgstSgst" },
            { label: "Total IGST", valuePath: "igstLabel", showIf: "hasIgstOnly" },
            { label: "Invoice Total (INR)", valuePath: "grandTotalLabel", emphasis: true },
          ],
        },
      ],
    ],
  },
  {
    type: "richText",
    id: "amountInWords",
    title: "Amount in words",
    emphasis: "inline",
    textPath: "amountInWordsText",
  },
  standardSignatures,
];

// 9. Dense Ledger (Continuous statement, running balance columns, multi-page repeating headers)
const denseLedgerSections: SectionConfig[] = [
  { type: "header", id: "header" },
  {
    type: "fieldGrid",
    id: "ledgerPartyMeta",
    columns: 3,
    fields: [
      { label: "Account Name", valuePath: "customerName", emphasis: true },
      { label: "Account ID / Phone", valuePath: "customerPhone" },
      { label: "Statement Period", valuePath: "periodLabel", fullWidth: true },
    ],
  },
  {
    type: "table",
    id: "entries",
    title: "Transaction Ledger Register",
    rowsPath: "entries",
    repeatHeaderMeta: [
      { label: "Account", valuePath: "customerName" },
      { label: "Period", valuePath: "periodLabel" },
    ],
    columns: [
      { key: "date", header: "Date", align: "left", width: 1 },
      { key: "voucherNo", header: "Voucher", align: "left", width: 1 },
      { key: "description", header: "Description", align: "left", width: 2.5 },
      { key: "goldIn", header: "Gold In (g)", align: "right", width: 1 },
      { key: "goldOut", header: "Gold Out (g)", align: "right", width: 1 },
      { key: "debit", header: "Debit ₹", align: "right", width: 1 },
      { key: "credit", header: "Credit ₹", align: "right", width: 1 },
      { key: "goldBal", header: "Gold Bal (g)", align: "right", width: 1 },
      { key: "moneyBal", header: "Cash Bal ₹", align: "right", width: 1.1 },
    ],
  },
  {
    type: "fieldGrid",
    id: "closingSummary",
    title: "Closing Balances",
    columns: 2,
    fields: [
      { label: "Net Gold Balance", valuePath: "closingGoldText", emphasis: true },
      { label: "Net Cash Balance", valuePath: "closingCashText", emphasis: true },
    ],
  },
  standardSignatures,
];

// 10. Customer-Friendly Digital (Optimized for mobile viewing, PDF share, payment QR)
const customerDigitalSections: SectionConfig[] = [
  {
    type: "premiumHeader",
    id: "header",
    variant: "centered",
    badgeTitlePath: "badgeTitle",
    showQr: false,
    qrLabel: "UPI Pay",
  },
  {
    type: "fieldGrid",
    id: "digitalParty",
    columns: 1,
    fields: [
      { label: "Hello", valuePath: "customerName", emphasis: true },
      { label: "Your Invoice Number", valuePath: "invoiceNo" },
      { label: "Date", valuePath: "invoiceDate" },
    ],
  },
  {
    type: "table",
    id: "items",
    rowsPath: "items",
    columns: [
      { key: "description", header: "Jewellery Item", align: "left", width: 3 },
      { key: "netWt", header: "Net Wt", align: "right", width: 1 },
      { key: "totalLabel", header: "Amount", align: "right", width: 1.2 },
    ],
  },
  {
    type: "fieldGrid",
    id: "digitalPaySummary",
    theme: "goldSummary",
    columns: 1,
    fields: [
      { label: "Grand Total", valuePath: "grandTotalLabel", emphasis: true },
      { label: "Paid", valuePath: "paidLabel", variant: "success" },
      {
        label: "Balance Due",
        valuePath: "balanceLabel",
        variant: "critical",
        showIf: "hasBalance",
      },
    ],
  },
  {
    type: "qr",
    id: "paymentQr",
    position: "inline",
    label: "Scan to Pay via UPI / Instant Verification",
    size: 64,
  },
  {
    type: "richText",
    id: "digitalThankYou",
    emphasis: "plain",
    staticText: "Thank you for shopping with us! For assistance, contact our store customer desk.",
  },
];

// ── Family builder helpers ────────────────────────────────────────────────

function buildTemplatesForFamily(docType: "gst_invoice" | "retail_invoice"): PrintTemplate[] {
  const isGst = docType === "gst_invoice";
  const title = isGst ? "Tax Invoice" : "Retail Invoice";

  const families: { family: TemplateFamily; name: string; sections: SectionConfig[] }[] = [
    {
      family: "classic_business",
      name: `${title} (Classic Business)`,
      sections: classicBusinessSections,
    },
    {
      family: "modern_professional",
      name: `${title} (Modern Professional)`,
      sections: modernProfessionalSections,
    },
    {
      family: "premium_jewellery",
      name: `${title} (Premium Jewellery)`,
      sections: premiumJewellerySections,
    },
    {
      family: "compact_accounting",
      name: `${title} (Compact Accounting)`,
      sections: compactAccountingSections,
    },
    {
      family: "manufacturing_workshop",
      name: `${title} (Workshop Layout)`,
      sections: manufacturingWorkshopSections,
    },
    {
      family: "traditional_indian",
      name: `${title} (Traditional Indian Trade)`,
      sections: traditionalIndianSections,
    },
    { family: "minimal_clean", name: `${title} (Minimal Clean)`, sections: minimalCleanSections },
    {
      family: "elegant_corporate",
      name: `${title} (Elegant Corporate B2B)`,
      sections: elegantCorporateSections,
    },
    { family: "dense_ledger", name: `${title} (Dense Ledger)`, sections: denseLedgerSections },
    {
      family: "customer_digital",
      name: `${title} (Customer Digital)`,
      sections: customerDigitalSections,
    },
  ];

  const thermalSections: SectionConfig[] = [
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
    { type: "qr", id: "qr", position: "footer", label: "Scan to Verify", size: 48 },
    { type: "signatureBlock", id: "signatures", leftLabel: "Customer", rightLabel: "Auth Sign" },
  ];

  const tagSections: SectionConfig[] = [{ type: "tagCards", id: "tags", rowsPath: "items" }];

  return [
    ...families.map((f, idx) =>
      builtin({
        id: `tpl_${docType}_${f.family}`,
        docType,
        family: f.family,
        name: f.name,
        paperSize: "a4",
        shell: idx === 1 ? "custom" : "printLayout",
        sections: f.sections,
      }),
    ),
    builtin({
      id: `tpl_${docType}_a5`,
      docType,
      family: "modern_professional",
      name: `${title} (A5 Slip)`,
      paperSize: "a5",
      shell: "custom",
      sections: modernProfessionalSections,
    }),
    builtin({
      id: `tpl_${docType}_thermal`,
      docType,
      family: "customer_digital",
      name: `${title} (Thermal 80mm)`,
      paperSize: "thermal",
      shell: "custom",
      sections: thermalSections,
    }),
    builtin({
      id: `tpl_${docType}_thermal58`,
      docType,
      family: "customer_digital",
      name: `${title} (Thermal 58mm)`,
      paperSize: "thermal58",
      shell: "custom",
      sections: thermalSections,
    }),
    builtin({
      id: `tpl_${docType}_tag`,
      docType,
      family: "manufacturing_workshop",
      name: `${title} (Jewellery Tag)`,
      paperSize: "tag",
      shell: "custom",
      sections: tagSections,
    }),
  ];
}

// ── Operational & Manufacturing Templates ──────────────────────────────────

const jobCardTemplate = builtin({
  id: "default_job_card",
  docType: "job_card",
  name: "Job Card (Half A4 / A5 Landscape)",
  family: "manufacturing_workshop",
  paperSize: "a5l",
  sections: [
    { type: "header", id: "header", showQr: false, qrLabel: "Verify Job" },
    {
      type: "fieldGrid",
      id: "customerWorker",
      columns: 3,
      fields: [
        { label: "Customer / Dealer", valuePath: "customerLine", fullWidth: true },
        { label: "Assigned Artisan", valuePath: "assignedWorkerName" },
        { label: "Product Name", valuePath: "itemName" },
        { label: "Item Sequence", valuePath: "lineLabel" },
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
        { label: "Target Net Wt", valuePath: "targetNetWt" },
        { label: "Purity", valuePath: "purityLabel" },
        { label: "Gold Received", valuePath: "goldReceivedLabel" },
        { label: "Target Gross Wt", valuePath: "targetGrossWt" },
        { label: "Start Date", valuePath: "expectedStartLabel" },
        { label: "Delivery Target", valuePath: "expectedDeliveryLabel" },
        { label: "Priority", valuePath: "priorityLabel" },
      ],
    },
    {
      type: "images",
      id: "referenceImages",
      title: "Reference Design Images",
      imagesKey: "reference",
      showIf: "hasReferenceImages",
    },
    {
      type: "fieldGrid",
      id: "remarks",
      columns: 1,
      fields: [{ label: "Bench Instructions", valuePath: "remarksText", fullWidth: true }],
    },
    dualWorkshopSignatures,
  ],
});

const dailyMaterialSlipTemplate = builtin({
  id: "default_daily_material_slip",
  docType: "daily_material_slip",
  name: "Daily Material Custody Slip (A4)",
  family: "manufacturing_workshop",
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
        { label: "Worker / Karigar", valuePath: "workerName" },
        { label: "Total Transactions", valuePath: "transactionCount" },
        { label: "Total Gold Issued", valuePath: "totalIssued" },
        { label: "Total Gold Returned", valuePath: "totalReturned" },
      ],
    },
    {
      type: "table",
      id: "issues",
      title: "Gold Issued to Bench",
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
      title: "Gold Received from Bench",
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
            title: "Net Daily Movement",
            emphasis: "plain",
            textPath: "netMovement",
          },
        ],
        [
          {
            type: "richText",
            id: "closing",
            title: "Closing Bench Custody",
            emphasis: "box",
            textPath: "custodyBalance",
          },
        ],
      ],
    },
    dualWorkshopSignatures,
  ],
});

const karigarCustodyStatementTemplate = builtin({
  id: "default_karigar_custody_statement",
  docType: "karigar_custody_statement",
  name: "Worker Custody Statement (Worker Gold Book)",
  family: "dense_ledger",
  paperSize: "a4",
  sections: [
    { type: "header", id: "header" },
    {
      type: "fieldGrid",
      id: "statementMeta",
      columns: 3,
      fields: [
        { label: "Artisan Name", valuePath: "partyName" },
        { label: "Role / Specialization", valuePath: "partyRole" },
        { label: "Book Category", valuePath: "bookLabel" },
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
      repeatHeaderMeta: [
        { label: "Artisan", valuePath: "partyName" },
        { label: "Period", valuePath: "periodLabel" },
      ],
      columns: [
        { key: "date", header: "Date", align: "left", width: 0.8 },
        { key: "voucherNo", header: "Voucher", align: "left", width: 0.8 },
        { key: "particulars", header: "Description", align: "left", width: 3 },
        { key: "received", header: "Gold Received (g)", align: "right", width: 1 },
        { key: "issued", header: "Gold Issued (g)", align: "right", width: 1 },
        { key: "balance", header: "Running Balance (g)", align: "right", width: 1 },
      ],
    },
    dualWorkshopSignatures,
  ],
});

const customerLedgerStatementTemplate = builtin({
  id: "default_customer_ledger_statement",
  docType: "customer_ledger_statement",
  name: "Customer Account Ledger Statement",
  family: "dense_ledger",
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
            title: "Tax Identifiers",
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
            title: "Gold Credit Account",
            columns: 1,
            fields: [
              {
                label: "Gold Balance",
                valuePath: "goldBalanceLabel",
                fullWidth: true,
                emphasis: true,
              },
              { label: "Account Status", valuePath: "goldBalanceNarrative", fullWidth: true },
            ],
          },
        ],
        [
          {
            type: "fieldGrid",
            id: "moneyAccount",
            title: "Cash Account",
            columns: 1,
            fields: [
              {
                label: "Monetary Balance",
                valuePath: "moneyBalanceLabel",
                fullWidth: true,
                emphasis: true,
              },
              { label: "Account Status", valuePath: "moneyBalanceNarrative", fullWidth: true },
            ],
          },
        ],
      ],
    },
    {
      type: "table",
      id: "entries",
      title: "Ledger Entries Register",
      rowsPath: "entries",
      columns: [
        { key: "date", header: "Date", align: "left", width: 1 },
        { key: "voucherNo", header: "Ref / Voucher", align: "left", width: 1 },
        { key: "typeLabel", header: "Type", align: "center", width: 0.9, renderAs: "badge" },
        { key: "description", header: "Description", align: "left", width: 2.2 },
        { key: "purity", header: "Purity", align: "center", width: 0.8 },
        { key: "goldIn", header: "Gold In", align: "right", width: 1 },
        { key: "goldOut", header: "Gold Out", align: "right", width: 1 },
        { key: "debit", header: "Debit ₹", align: "right", width: 1 },
        { key: "credit", header: "Credit ₹", align: "right", width: 1 },
        { key: "goldBal", header: "Gold Bal", align: "right", width: 1 },
        { key: "moneyBal", header: "Cash Bal", align: "right", width: 1.1 },
      ],
    },
    {
      type: "fieldGrid",
      id: "closingBalance",
      title: "Closing Balances",
      columns: 3,
      fields: [
        {
          label: "Net Gold Balance",
          valuePath: "closingGoldText",
          fullWidth: true,
          emphasis: true,
        },
        {
          label: "Net Cash Balance",
          valuePath: "closingCashText",
          fullWidth: true,
          emphasis: true,
        },
        {
          label: "Total Outstanding",
          valuePath: "closingOutstandingText",
          fullWidth: true,
          emphasis: true,
        },
      ],
    },
    standardSignatures,
  ],
});

const orderSlipTemplate = builtin({
  id: "default_order_slip",
  docType: "order_slip",
  name: "Work Order Slip (A4 / A5)",
  family: "classic_business",
  paperSize: "a4",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "table",
      id: "items",
      title: "Order Items Schedule",
      rowsPath: "items",
      showFooterSums: true,
      columns: [
        { key: "description", header: "Description", align: "left", width: 3 },
        { key: "grossWt", header: "Gross (g)", align: "right" },
        { key: "netWt", header: "Net Wt (g)", align: "right" },
        { key: "purity", header: "Touch / Karat", align: "right" },
        { key: "fine", header: "Fine Gold", align: "right", footerSum: true },
        { key: "amount", header: "Estimated Amount ₹", align: "right", footerSum: true },
      ],
    },
    {
      type: "balanceCard",
      id: "balances",
      title: "Customer Account Balance",
      goldKey: "gold",
      cashKey: "cash",
      labelMode: "jama_naam",
    },
    {
      type: "richText",
      id: "notes",
      title: "Custom Design Notes",
      textPath: "notes",
      showIf: "hasNotes",
    },
    standardSignatures,
  ],
});

const estimateTemplate = builtin({
  id: "default_estimate_doc",
  docType: "estimate_doc",
  name: "Quotation / Estimate (Default)",
  family: "classic_business",
  paperSize: "a4",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "table",
      id: "items",
      title: "Estimated Items",
      rowsPath: "items",
      columns: [
        { key: "itemName", header: "Item Description", align: "left", width: 3 },
        { key: "fineWt", header: "Fine Gold (g)", align: "center", width: 1 },
        { key: "amountLabel", header: "Estimated Value ₹", align: "right", width: 1 },
      ],
    },
    {
      type: "fieldGrid",
      id: "totals",
      columns: 1,
      fields: [
        { label: "Subtotal", valuePath: "subtotalLabel", fullWidth: true },
        { label: "GST (3%)", valuePath: "gstLabel", showIf: "hasGst", fullWidth: true },
        {
          label: "Grand Estimate Total",
          valuePath: "grandTotalLabel",
          fullWidth: true,
          emphasis: true,
        },
      ],
    },
    {
      type: "richText",
      id: "validity",
      title: "Quotation Validity Clause",
      emphasis: "plain",
      staticText:
        "Valid for 15 days from date of issue. Prices subject to bullion market rate fluctuations.",
    },
    standardSignatures,
  ],
});

const deliveryChallanTemplate = builtin({
  id: "default_delivery_challan",
  docType: "delivery_challan",
  name: "Delivery Challan (Default)",
  family: "elegant_corporate",
  paperSize: "a4",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "table",
      id: "items",
      title: "Dispatch Schedule",
      rowsPath: "items",
      columns: [
        { key: "itemName", header: "Particulars", align: "left", width: 3 },
        { key: "qty", header: "Qty", align: "center", width: 1 },
        { key: "grossWt", header: "Gross (g)", align: "center", width: 1 },
        { key: "netWt", header: "Net (g)", align: "center", width: 1 },
        { key: "purity", header: "Purity", align: "center", width: 1 },
        { key: "fineWt", header: "Fine (g)", align: "center", width: 1 },
      ],
    },
    { type: "richText", id: "purposeFooter", textPath: "purposeText", emphasis: "callout" },
    standardSignatures,
  ],
});

const creditNoteTemplate = builtin({
  id: "default_credit_note",
  docType: "credit_note",
  name: "Credit Note (Default)",
  family: "compact_accounting",
  paperSize: "a4",
  sections: [
    standardHeader,
    {
      type: "fieldGrid",
      id: "summary",
      columns: 2,
      fields: [
        { label: "Customer", valuePath: "customerName" },
        { label: "Against Invoice", valuePath: "invoiceNo" },
        { label: "Credit Amount", valuePath: "amountLabel", emphasis: true },
        { label: "Status", valuePath: "statusText", variant: "neutral" },
      ],
    },
    { type: "richText", id: "reason", title: "Reason for Credit", textPath: "reasonText" },
    standardSignatures,
  ],
});

const debitNoteTemplate = builtin({
  id: "default_debit_note",
  docType: "debit_note",
  name: "Debit Note (Default)",
  family: "compact_accounting",
  paperSize: "a4",
  sections: [
    standardHeader,
    {
      type: "fieldGrid",
      id: "summary",
      columns: 2,
      fields: [
        { label: "Party Name", valuePath: "customerName" },
        { label: "Against Invoice / Bill", valuePath: "invoiceNo" },
        { label: "Debit Amount", valuePath: "amountLabel", emphasis: true },
        { label: "Status", valuePath: "statusText", variant: "neutral" },
      ],
    },
    { type: "richText", id: "reason", title: "Reason for Debit", textPath: "reasonText" },
    standardSignatures,
  ],
});

// Receipts & Slips
const advanceReceiptTemplate = builtin({
  id: "default_advance_receipt",
  docType: "advance_receipt",
  name: "Cash Advance Receipt (A5)",
  family: "modern_professional",
  paperSize: "a5",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "fieldGrid",
      id: "receiptDetails",
      columns: 2,
      fields: [
        { label: "Receipt No", valuePath: "receiptNo", emphasis: true },
        { label: "Order Reference", valuePath: "orderNo" },
        { label: "Payment Mode", valuePath: "cashMode" },
        { label: "Reference No", valuePath: "cashRef", showIf: "hasCashRef" },
        {
          label: "Advance Amount Received",
          valuePath: "amountLabel",
          fullWidth: true,
          emphasis: true,
        },
      ],
    },
    {
      type: "richText",
      id: "amountInWords",
      title: "Amount in words",
      emphasis: "inline",
      textPath: "amountInWordsText",
    },
    standardSignatures,
  ],
});

const goldReceiptTemplate = builtin({
  id: "default_gold_receipt",
  docType: "gold_receipt",
  name: "Customer Gold Receipt (A5)",
  family: "traditional_indian",
  paperSize: "a5",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "fieldGrid",
      id: "goldDetails",
      columns: 2,
      fields: [
        { label: "Receipt No", valuePath: "receiptNo", emphasis: true },
        { label: "Gold Category", valuePath: "goldKind" },
        { label: "Gross Weight", valuePath: "grossWt" },
        { label: "Assayed Purity", valuePath: "purityLabel" },
        { label: "Fine Pure Gold", valuePath: "fineWt", emphasis: true },
        { label: "Treatment", valuePath: "goldTreatment", fullWidth: true },
      ],
    },
    standardSignatures,
  ],
});

const repairReceiptTemplate = builtin({
  id: "default_repair_receipt",
  docType: "repair_receipt",
  name: "Jewellery Repair Intake Receipt (A5)",
  family: "classic_business",
  paperSize: "a5",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "fieldGrid",
      id: "repairMeta",
      columns: 2,
      fields: [
        { label: "Repair Job No", valuePath: "repairNo", emphasis: true },
        { label: "Item Description", valuePath: "itemDescription" },
        { label: "Intake Weight", valuePath: "grossWt" },
        { label: "Estimated Delivery", valuePath: "estimatedDelivery" },
        { label: "Estimated Repair Charges", valuePath: "chargesLabel" },
        { label: "Advance Received", valuePath: "advanceLabel" },
      ],
    },
    {
      type: "richText",
      id: "repairNotes",
      title: "Specific Repair Work Instructions",
      textPath: "workInstructions",
    },
    standardSignatures,
  ],
});

const manufacturingBillTemplate = builtin({
  id: "default_manufacturing_bill",
  docType: "manufacturing_bill",
  name: "Manufacturing Artisan Hisab Bill (A4)",
  family: "manufacturing_workshop",
  paperSize: "a4",
  sections: [
    standardHeader,
    partyWorker,
    {
      type: "table",
      id: "items",
      title: "Manufactured Pieces & Weight Loss Schedule",
      rowsPath: "items",
      columns: [
        { key: "jobNo", header: "Job No", align: "left", width: 1 },
        { key: "description", header: "Ornament", align: "left", width: 2 },
        { key: "goldIssued", header: "Issued (g)", align: "right", width: 1 },
        { key: "goldReceived", header: "Received (g)", align: "right", width: 1 },
        { key: "wastage", header: "Wastage (g)", align: "right", width: 1 },
        { key: "labour", header: "Labour ₹", align: "right", width: 1 },
      ],
    },
    {
      type: "fieldGrid",
      id: "billTotals",
      columns: 3,
      fields: [
        { label: "Total Pure Gold Due", valuePath: "netGoldBalance", emphasis: true },
        { label: "Total Labour Payable", valuePath: "totalLabour", emphasis: true },
        { label: "TDS / Deductions", valuePath: "deductions", showIf: "hasDeductions" },
      ],
    },
    dualWorkshopSignatures,
  ],
});

const goldSettlementTemplate = builtin({
  id: "default_gold_settlement",
  docType: "gold_settlement",
  name: "Gold & Cash Settlement Receipt",
  family: "traditional_indian",
  paperSize: "a4",
  sections: [
    standardHeader,
    partyCustomer,
    {
      type: "fieldGrid",
      id: "settlementDetails",
      columns: 2,
      fields: [
        { label: "Settlement Ref", valuePath: "settlementNo", emphasis: true },
        { label: "Settlement Date", valuePath: "date" },
        { label: "Gold Settled (Fine g)", valuePath: "goldSettledLabel", emphasis: true },
        { label: "Cash Settled (INR)", valuePath: "cashSettledLabel", emphasis: true },
        { label: "Current Market Rate", valuePath: "goldRateLabel" },
      ],
    },
    { type: "richText", id: "settlementNotes", title: "Settlement Memorandum", textPath: "notes" },
    standardSignatures,
  ],
});

const jewelleryTagTemplate = builtin({
  id: "default_jewellery_tag",
  docType: "jewellery_tag",
  name: "Jewellery Barcode Tag (50 × 25 mm)",
  family: "manufacturing_workshop",
  paperSize: "tag",
  sections: [{ type: "tagCards", id: "tags", rowsPath: "items" }],
});

const dailyCloseReportTemplate = builtin({
  id: "default_daily_close_report",
  docType: "daily_close_report",
  name: "Daily Shop Close & Balance Sheet (A4)",
  family: "compact_accounting",
  paperSize: "a4",
  sections: [
    standardHeader,
    {
      type: "fieldGrid",
      id: "closeMeta",
      columns: 3,
      fields: [
        { label: "Register Date", valuePath: "date" },
        { label: "Closed By", valuePath: "closedBy" },
        { label: "Branch", valuePath: "branchName" },
      ],
    },
    {
      type: "table",
      id: "cashMovements",
      title: "Cash Drawer Reconciliation",
      rowsPath: "cashMovements",
      columns: [
        { key: "particulars", header: "Particulars", align: "left", width: 2 },
        { key: "inAmount", header: "Cash In ₹", align: "right", width: 1 },
        { key: "outAmount", header: "Cash Out ₹", align: "right", width: 1 },
        { key: "balance", header: "Net Cash ₹", align: "right", width: 1 },
      ],
    },
    {
      type: "table",
      id: "goldMovements",
      title: "Daily Bullion & Vault Movements",
      rowsPath: "goldMovements",
      columns: [
        { key: "particulars", header: "Particulars", align: "left", width: 2 },
        { key: "inGrams", header: "Vault In (g)", align: "right", width: 1 },
        { key: "outGrams", header: "Vault Out (g)", align: "right", width: 1 },
        { key: "balanceGrams", header: "Closing Balance (g)", align: "right", width: 1 },
      ],
    },
    dualWorkshopSignatures,
  ],
});

const attendanceSheetTemplate = builtin({
  id: "default_attendance_sheet",
  docType: "attendance_sheet",
  name: "Monthly Artisan & Staff Attendance Register",
  family: "dense_ledger",
  paperSize: "a4",
  sections: [
    standardHeader,
    {
      type: "table",
      id: "attendanceEntries",
      title: "Staff & Artisan Attendance Log",
      rowsPath: "entries",
      columns: [
        { key: "staffName", header: "Staff Member", align: "left", width: 2 },
        { key: "role", header: "Department", align: "left", width: 1 },
        { key: "daysPresent", header: "Days Present", align: "center", width: 1 },
        { key: "overtimeHours", header: "Overtime (Hrs)", align: "center", width: 1 },
        { key: "wagesDue", header: "Wages Due ₹", align: "right", width: 1 },
      ],
    },
    dualWorkshopSignatures,
  ],
});

const workerKycTemplate = builtin({
  id: "default_worker_kyc",
  docType: "worker_kyc",
  name: "Artisan / Karigar Verification & KYC Document",
  family: "classic_business",
  paperSize: "a4",
  sections: [
    standardHeader,
    partyWorker,
    {
      type: "fieldGrid",
      id: "kycDetails",
      columns: 2,
      fields: [
        { label: "Aadhaar / National ID", valuePath: "idNumber" },
        { label: "Emergency Contact", valuePath: "emergencyContact" },
        { label: "Native Village / State", valuePath: "nativePlace" },
        { label: "Joining Date", valuePath: "joiningDate" },
      ],
    },
    {
      type: "images",
      id: "kycDocuments",
      title: "Identity & Address Proof Documents",
      imagesKey: "kyc",
      fullPagePerImage: false,
    },
    dualWorkshopSignatures,
  ],
});

// ── Complete Catalog of All Default Templates ────────────────────────────

export const DEFAULT_TEMPLATES: Record<PrintDocType, PrintTemplate[]> = {
  gst_invoice: buildTemplatesForFamily("gst_invoice"),
  retail_invoice: buildTemplatesForFamily("retail_invoice"),
  estimate_doc: [estimateTemplate],
  invoice_quote_preview: [estimateTemplate],
  delivery_challan: [deliveryChallanTemplate],
  credit_note: [creditNoteTemplate],
  debit_note: [debitNoteTemplate],
  order_slip: [orderSlipTemplate],
  gold_receipt: [goldReceiptTemplate],
  advance_receipt: [advanceReceiptTemplate],
  old_gold_receipt: [goldReceiptTemplate],
  payment_receipt: [advanceReceiptTemplate],
  ratecut_slip: [advanceReceiptTemplate],
  jewellery_tag: [jewelleryTagTemplate],
  job_card: [jobCardTemplate],
  daily_material_slip: [dailyMaterialSlipTemplate],
  worker_material_given: [dailyMaterialSlipTemplate],
  worker_material_return: [dailyMaterialSlipTemplate],
  karigar_custody_statement: [karigarCustodyStatementTemplate],
  worker_passbook: [karigarCustodyStatementTemplate],
  filings_receipt: [dailyMaterialSlipTemplate],
  polishing_receipt: [dailyMaterialSlipTemplate],
  wastage_return_receipt: [dailyMaterialSlipTemplate],
  manufacturing_bill: [manufacturingBillTemplate],
  gold_settlement: [goldSettlementTemplate],
  settlement_draft: [goldSettlementTemplate],
  home_settlement_slip: [goldSettlementTemplate],
  repair_receipt: [repairReceiptTemplate],
  repair_delivery_slip: [repairReceiptTemplate],
  repair_invoice: [repairReceiptTemplate],
  customer_ledger_statement: [customerLedgerStatementTemplate],
  daily_close_report: [dailyCloseReportTemplate],
  attendance_sheet: [attendanceSheetTemplate],
  worker_kyc: [workerKycTemplate],
  withdrawal_slip: [advanceReceiptTemplate],
  loan_slip: [advanceReceiptTemplate],
  gold_advance_slip: [goldReceiptTemplate],
  gold_issue_slip: [dailyMaterialSlipTemplate],
  gold_receive_slip: [dailyMaterialSlipTemplate],
};
