import type { PublicPricingPlan, WebsitePage, WebsiteSection } from "./types";

export const HOME_FALLBACK_SECTIONS: WebsiteSection[] = [
  {
    id: "hero",
    type: "hero",
    heading: "Jewellery manufacturing ERP with gold custody you can audit",
    subheading:
      "AVS ERP is the jewellery manufacturing ERP from Arivahly Venture Sphere. Gold Vault is the source of truth: milligram accounting, karigar issue and return, GST documents, and customer, karigar, and supplier portals — one Supabase-backed system for web, desktop, and mobile.",
    primary_cta: { label: "Request Access", href: "/request-access" },
    secondary_cta: { label: "Book a Demo", href: "/contact?intent=demo" },
  },
  {
    id: "pillars",
    type: "pillars",
    items: [
      {
        title: "Gold you can trace",
        body: "Integer milligram accounting, vault-led balances, and job-level custody. Fine metal is never a floating spreadsheet.",
      },
      {
        title: "Factory operations",
        body: "Job cards, melting, bench WIP, outside work, Daily Material Slips, QC, hallmark, and scrap recovery on one ledger.",
      },
      {
        title: "One platform",
        body: "People, billing, print and export, email-first communication, and optional portals — web, desktop, and Android.",
      },
    ],
  },
  {
    id: "capabilities",
    type: "feature_grid",
    heading: "Built for jewellery manufacturing",
    items: [
      { title: "Gold Vault", body: "Authoritative fine metal ledger. Opening vault is the write path; balances are derived, not edited." },
      { title: "Karigar Gold Book", body: "Issue, return, Daily Material Slip (MTS), and running custody per worker." },
      { title: "Job cards", body: "Manufacturing orders to bench WIP, receive, QC notes, and settlement." },
      { title: "Billing & GST", body: "Invoices, credit notes, estimates, delivery challans, and gold-first settlement." },
      { title: "Print & Export", body: "Universal Print Engine and Export Engine for slips, invoices, and reports." },
      { title: "Portals", body: "Customer, karigar, and supplier workspaces when licensed — same data plane." },
    ],
  },
];

/** Features page modules — each has a screenshot placeholder (title + description + image slot). */
export const FEATURE_FALLBACK_SECTIONS: WebsiteSection[] = [
  {
    id: "grid",
    type: "feature_grid",
    heading: "Core modules in AVS ERP",
    items: [
      {
        id: "gold-vault",
        title: "Gold Vault",
        body: "Fine metal custody in milligrams. Vault-led balances, purity per-mille, no shadow balance fields. Upload a Gold Vault screenshot here.",
      },
      {
        id: "dashboard",
        title: "Dashboard",
        body: "Operations overview: vault position, open issues, orders, and alerts — one place to see the factory day. Upload a dashboard screenshot here.",
      },
      {
        id: "worker-gold-book",
        title: "Worker Gold Book",
        body: "Karigar issue and return, Daily Material Slip numbering, and running worker custody.",
      },
      {
        id: "manufacturing-books",
        title: "Manufacturing books",
        body: "Jeweller, worker, outside, and polishing books compiled from posted movements.",
      },
      {
        id: "orders-job-cards",
        title: "Orders & job cards",
        body: "Customer manufacturing orders, multi-item lines, status workflow, and job cards.",
      },
      {
        id: "billing",
        title: "Billing",
        body: "Manufacturing invoices, GST documents, estimates, challans, and gold settlement.",
      },
      {
        id: "people-kyc",
        title: "People & KYC",
        body: "Customers, jewellers, karigars, vendors, employees, and party gold/cash ledgers.",
      },
      {
        id: "catalog",
        title: "Catalog",
        body: "Design library with weights, attachments, and CSV export. Catalog never owns gold.",
      },
      {
        id: "ready-stock",
        title: "Ready stock & barcode",
        body: "Finished jewellery register, tagging, and manufacturing tag print paths.",
      },
      {
        id: "melt-conversion",
        title: "Melt & conversion",
        body: "Melt account and metal conversion on the same vault — not a second gold book.",
      },
      {
        id: "reports",
        title: "Reports",
        body: "Daily close, gold position, vault reconciliation, ageing, and communication analytics.",
      },
      {
        id: "communication",
        title: "Communication",
        body: "Email is the default automatic channel. Native Share for PDFs. Official WhatsApp API is optional.",
      },
      {
        id: "assistant",
        title: "Assistant",
        body: "Operational help on web, desktop, and Android, with credit-gated AI tools.",
      },
      {
        id: "customization",
        title: "Customization",
        body: "Terminology, document templates, and gold calculation rules (Hisob, /999, touch) frozen on post.",
      },
      {
        id: "surfaces",
        title: "Web, Desktop, Mobile",
        body: "Same authenticated Supabase data plane on browser, Windows desktop, and Android.",
      },
    ],
  },
];

export const MANUFACTURING_FALLBACK_SECTIONS: WebsiteSection[] = [
  {
    id: "mfg",
    type: "feature_grid",
    heading: "Factory workflows",
    items: [
      { title: "Job cards", body: "Issue gold to the bench, track WIP, receive, QC from job notes, and settle." },
      { title: "Gold Vault", body: "Every issue and return posts to the vault. Fine metal stays auditable." },
      { title: "Daily Material Slip", body: "One consolidated slip per worker per day (MTS-YYYYMMDD-NNN) across ledgers." },
      { title: "Loss & wastage", body: "Stage-wise accountability with named calculation methods frozen when posted." },
      { title: "Melt", body: "Melt account on the same vault — scrap in, fine out, no parallel balance." },
      { title: "Documents", body: "Receive slips, filings slips, and vouchers through the Universal Print Engine." },
    ],
  },
];

export const WHOLESALE_FALLBACK_SECTIONS: WebsiteSection[] = [
  {
    id: "ws",
    type: "feature_grid",
    heading: "Jeweller-account wholesale",
    items: [
      { title: "Party 360", body: "Customers and jewellers with gold and cash ledgers on the same master." },
      { title: "Orders & dispatch", body: "Booking, allocation, delivery challans, and GST invoices." },
      { title: "Gold settlement", body: "Gold-first settlement against invoices — vault remains the source of truth." },
      { title: "Customer portal", body: "Invited customers see their orders and invoices for this firm only." },
      { title: "Catalog sharing", body: "Design library links for customers without giving away gold balances." },
      { title: "Email documents", body: "Invoices and statements go out by email; Share is available for WhatsApp." },
    ],
  },
];

export const ABOUT_FALLBACK_SECTIONS: WebsiteSection[] = [
  {
    id: "story",
    type: "rich_text",
    heading: "About Arivahly Venture Sphere",
    body_md:
      "Arivahly Venture Sphere (AVS) is a premium technology firm that engineers websites, custom software, and ERP systems for businesses that outgrew spreadsheets and disconnected tools.\n\nAVS ERP is our jewellery manufacturing ERP. It is built for factories and wholesale jewellers — gold custody, karigar issue and return, manufacturing books, GST billing, and portals — not a retail jewellery POS.\n\nAritra Manna, Founder & CEO, leads AVS. Software should serve the workshop: efficiency, auditability, and revenue — not a second set of books.",
  },
  {
    id: "values",
    type: "pillars",
    items: [
      { title: "Excellence", body: "Uncompromising standards in design, code, and gold accounting." },
      { title: "Integrity", body: "Transparent communication. Gold Vault is the only source of truth." },
      { title: "Partnership", body: "Long-term support beyond the first deployment — trial, onboarding, and AMC." },
    ],
  },
];

export const FAQ_FALLBACK_SECTIONS: WebsiteSection[] = [
  {
    id: "faq",
    type: "faq",
    items: [
      {
        question: "Is AVS ERP a retail POS or a manufacturing ERP?",
        answer:
          "AVS ERP is manufacturing-first jewellery ERP. It handles factory gold, karigar issue and return, manufacturing books, stock, orders, billing, and portals. It is not a retail jewellery POS.",
      },
      {
        question: "How do I get access to AVS ERP?",
        answer:
          "AVS ERP is invitation-only. Your jeweller or AVS sends a secure invitation link, or you can request access from our team. There is no public self-sign-up or self-service trial.",
      },
      {
        question: "Where does gold live in the system?",
        answer:
          "Gold Vault is the accounting source of truth. Balances are derived from approved vault and ledger flows. Gold is stored as integer milligrams; purity as per-mille. There is no independent editable balance field.",
      },
      {
        question: "Can karigars, customers, and suppliers log in?",
        answer:
          "Yes, when licensed. Each portal is invitation-only and sees only that firm's work. A Google or email account cannot open another jeweller's books.",
      },
      {
        question: "Do you send WhatsApp automatically?",
        answer:
          "Email is the default automatic channel. Staff can Share PDFs to WhatsApp from the device. Official WhatsApp API is optional and off until the Platform Owner enables it.",
      },
      {
        question: "Who builds AVS ERP?",
        answer:
          "Arivahly Venture Sphere (AVS). Contact sales@arivahly.in or use the contact form. Company site: arivahly.in.",
      },
    ],
  },
];

export const FALLBACK_WEBSITE_PAGES: WebsitePage[] = [
  {
    page_key: "home",
    title: "AVS ERP — Jewellery Manufacturing ERP",
    sections: HOME_FALLBACK_SECTIONS,
    seo: {
      title: "AVS ERP — Jewellery Manufacturing ERP",
      description:
        "Manufacturing-first jewellery ERP with Gold Vault custody, karigar management, GST documents, and portals. Built by Arivahly Venture Sphere.",
    },
  },
  { page_key: "features", title: "Features", sections: FEATURE_FALLBACK_SECTIONS, seo: {} },
  { page_key: "manufacturing", title: "Manufacturing", sections: MANUFACTURING_FALLBACK_SECTIONS, seo: {} },
  { page_key: "wholesale", title: "Wholesale", sections: WHOLESALE_FALLBACK_SECTIONS, seo: {} },
  { page_key: "about", title: "About", sections: ABOUT_FALLBACK_SECTIONS, seo: {} },
  { page_key: "faq", title: "FAQ", sections: FAQ_FALLBACK_SECTIONS, seo: {} },
];

export const FALLBACK_PUBLIC_PLANS: PublicPricingPlan[] = [
  {
    id: "trial-14d",
    code: "trial-14d",
    name: "Request Access",
    description: "Contact AVS to discuss onboarding for your workshop. Public self-sign-up is not available.",
    billing_cycle: "trial",
    price_minor: 0,
    pricing_display_mode: "show_price",
    feature_limits: null,
    commercial_config: null,
    branch_limit: 1,
    user_limit: 3,
  },
  {
    id: "manufacturing-editions",
    code: "manufacturing",
    name: "Manufacturing editions",
    description:
      "Starter through Enterprise for jewellery factories and wholesale jewellers. Licensed per business — contact sales for a quotation.",
    billing_cycle: "annual",
    price_minor: null,
    pricing_display_mode: "contact_sales",
    feature_limits: null,
    commercial_config: null,
    branch_limit: null,
    user_limit: null,
  },
];

export function sectionsForPage(
  page: WebsitePage | null | undefined,
  fallback: WebsiteSection[],
): WebsiteSection[] {
  return page?.sections?.length ? page.sections : fallback;
}
