/**
 * Ornexa Knowledge & RAG Engine (Path A - Local / Standard Assistant)
 * Curated knowledge layer covering Jewellery Terminology, Workflows, Documentation, FAQs, and SOPs.
 */

export interface KnowledgeItem {
  id: string;
  category: "terminology" | "workflow" | "accounting" | "troubleshooting" | "settings" | "faq";
  title: string;
  keywords: string[];
  summary: string;
  content: string;
  sourceDoc: string;
  relatedRoute?: string;
}

export const ORNEXA_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: "kb_fine_gold",
    category: "terminology",
    title: "Fine Gold & Purity Touch Calculations",
    keywords: [
      "fine gold",
      "fine weight",
      "touch",
      "purity",
      "22k",
      "18k",
      "24k",
      "916",
      "750",
      "formula",
    ],
    summary: "Fine Gold represents pure 24K (99.9% / 1000 touch) gold content within an alloy.",
    content: `In Ornexa ERP, Fine Gold is calculated deterministically as:
Fine Weight (mg) = Net Weight (mg) * (Purity Touch / 1000)
For Karat inputs (e.g. 22K), Touch is converted as: (Karat / 24) * 1000 (e.g. 22K = 916.67 touch).
Under no circumstances does an LLM approximate or estimate gold purity conversions.`,
    sourceDoc: "ITEM_AND_MATERIAL_MASTER.md",
    relatedRoute: "/conversion",
  },
  {
    id: "kb_issue_gold",
    category: "workflow",
    title: "How to Issue Gold to a Karigar (Worker)",
    keywords: [
      "issue gold",
      "karigar issue",
      "worker gold",
      "give gold",
      "raw gold",
      "metal issue",
      "gold book",
    ],
    summary:
      "Gold issue transfers physical metal custody from Vault/Showroom to the Worker's active ledger.",
    content: `To issue gold to a Karigar in Ornexa:
1. Navigate to Manufacturing -> Worker Gold Book (or Workshop).
2. Click '+ Issue Metal' or select the worker's ledger.
3. Enter Gross Weight, Net Weight, and Purity (e.g. 22K / 916).
4. Select Job Card reference if issuing against a specific order.
5. Review the calculated Fine Weight and click Confirm.
The worker's custody balance will immediately reflect the issued fine gold.`,
    sourceDoc: "MANUFACTURING_LEDGER_MASTER.md",
    relatedRoute: "/workshop/gold-book",
  },
  {
    id: "kb_gold_receive",
    category: "workflow",
    title: "Receiving Finished Goods & Scrap from Karigar",
    keywords: [
      "receive gold",
      "receive finished item",
      "scrap return",
      "wastage",
      "ghat",
      "settlement",
    ],
    summary:
      "Receiving records the return of finished jewellery, unworked metal, and filing scrap to close custody.",
    content: `When receiving work from a Karigar:
1. Go to Workshop -> Receive Metal / Work.
2. Enter Finished Goods Gross Wt, Net Wt, and Scrap/Filings returned.
3. Ornexa calculates allowed wastage (Ghat) based on the Karigar rate agreement.
4. Any difference is settled against the Karigar metal balance ledger.`,
    sourceDoc: "MANUFACTURING_LEDGER_MASTER.md",
    relatedRoute: "/workshop",
  },
  {
    id: "kb_create_customer",
    category: "workflow",
    title: "How to Create a Customer or Party",
    keywords: [
      "create customer",
      "add customer",
      "new party",
      "kyc",
      "gstin",
      "dealer",
      "supplier",
    ],
    summary: "Add customers, dealers, suppliers, or karigars with GSTIN, PAN, and address details.",
    content: `To create a customer in Ornexa:
1. Go to People / KYC module (/people).
2. Click '+ New Party' / '+ Add Customer'.
3. Enter Full Name, Mobile Number, Address, and Type (Customer, Dealer, Supplier, Karigar).
4. Enter GSTIN and PAN if applicable (GSTIN auto-populates state and legal name).
5. Save record. The party is immediately available across Billing, Orders, and Ledgers.`,
    sourceDoc: "PARTY_360_MASTER.md",
    relatedRoute: "/people",
  },
  {
    id: "kb_invoice_terms",
    category: "settings",
    title: "Configuring Invoice Terms & Print Profiles",
    keywords: [
      "invoice terms",
      "terms and conditions",
      "print settings",
      "footer",
      "print profile",
      "invoice format",
    ],
    summary:
      "Customize invoice payment terms, GST declarations, and bank details on printed vouchers.",
    content: `To configure invoice terms and print options:
1. Open Settings -> Print Templates & Profiles (/settings/print-templates).
2. Select your active Invoice Template (Standard A4 / Thermal 3-inch / Delivery Slip).
3. Update Bank Details, Payment Terms, Hallmarking Declarations, and Return Policy.
4. Click Save Changes. All new invoices will render the updated terms.`,
    sourceDoc: "PRINT_PROFILE_MASTER.md",
    relatedRoute: "/settings",
  },
  {
    id: "kb_daily_close",
    category: "accounting",
    title: "Daily Close & Metal Reconciliation Process",
    keywords: [
      "daily close",
      "eod",
      "reconciliation",
      "cash tally",
      "gold tally",
      "vault reconciliation",
    ],
    summary: "Perform end-of-day cash and metal reconciliation before locking daily transactions.",
    content: `The Daily Close workflow ensures full balance integrity:
1. Navigate to Reports -> Daily Close (/reports/daily-close).
2. Review Total Sales, Cash in Drawer, Card/UPI payments, and Metal issued vs received.
3. Count physical cash and weigh closing tray gold.
4. Verify zero variance. If variance exists, add explanation remarks.
5. Click 'Finalize & Lock Daily Close'.`,
    sourceDoc: "ACCOUNTING_AND_PERIOD_CONTROL.md",
    relatedRoute: "/reports/daily-close",
  },
  {
    id: "kb_barcode_troubleshooting",
    category: "troubleshooting",
    title: "Barcode Scanner & Weight Scale Troubleshooting",
    keywords: [
      "barcode not scanning",
      "scanner issue",
      "weighing scale",
      "scale not connecting",
      "hardware",
      "printer",
    ],
    summary:
      "Diagnostics for USB/HID barcode scanners, thermal label printers, and RS232 weighing scales.",
    content: `Troubleshooting hardware in Ornexa:
- Barcode Scanner: Ensure scanner is set to USB HID POS mode with standard Enter (CR/LF) suffix.
- Weighing Scale: Open Hardware Integrations (/hardware) and verify Web Serial API permissions.
- Label Printer: Check 50x25mm or 38x25mm jewellery tag alignment in Print Engine settings.`,
    sourceDoc: "DEVICE_ACCESS_MASTER.md",
    relatedRoute: "/hardware",
  },
  {
    id: "kb_whatsapp_setup",
    category: "settings",
    title: "Setting up WhatsApp Cloud API Integration",
    keywords: ["whatsapp setup", "meta partner", "whatsapp invoice", "otp whatsapp", "templates"],
    summary:
      "Connect WhatsApp Business API to send automatic digital invoices, receipts, and order updates.",
    content: `To enable WhatsApp integration:
1. Go to Settings -> WhatsApp Integration (/settings/integrations/whatsapp).
2. Connect your Meta Business Account and verified WhatsApp Phone Number ID.
3. Select message templates for Invoices, Receipts, Job Completion, and Payment Reminders.
4. Test with a sample message. Requires active Communications Credits.`,
    sourceDoc: "WHATSAPP_META_PARTNER_MASTER.md",
    relatedRoute: "/settings/whatsapp",
  },
];

/**
 * Search Knowledge Base by keyword relevance and return matching chunks
 */
export function queryKnowledgeBase(query: string, limit: number = 3): KnowledgeItem[] {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 2);

  const scored = ORNEXA_KNOWLEDGE_BASE.map((item) => {
    let score = 0;
    const itemText =
      `${item.title} ${item.keywords.join(" ")} ${item.summary} ${item.content}`.toLowerCase();

    for (const word of words) {
      if (item.title.toLowerCase().includes(word)) score += 10;
      if (item.keywords.some((k) => k.includes(word))) score += 7;
      if (item.summary.toLowerCase().includes(word)) score += 4;
      if (item.content.toLowerCase().includes(word)) score += 2;
    }

    // Exact phrase bonus
    if (itemText.includes(q)) score += 15;

    return { item, score };
  });

  return scored
    .filter((s) => s.score > 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
