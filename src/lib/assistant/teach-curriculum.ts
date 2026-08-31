/**
 * Full AVS ERP teach-me curriculum — Layer-1 guided path with real routes.
 */

export type CurriculumStep = {
  id: string;
  title: string;
  blurb: string;
  route: string;
  /** Optional guided-tour chapter id when available */
  tourId?: string;
};

export const ORNEXA_ERP_CURRICULUM: CurriculumStep[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    blurb: "Home dashboard, branches, and daily overview. Confirm your workspace and role first.",
    route: "/",
    tourId: "getting-started",
  },
  {
    id: "parties",
    title: "Parties",
    blurb: "Customers, firms, suppliers, and karigars live in People. Full KYC and opening balances matter.",
    route: "/people",
  },
  {
    id: "gold",
    title: "Gold",
    blurb: "Gold Vault and Worker Gold Book are the accounting source of truth — issue and return only through approved flows.",
    route: "/workshop/gold-book",
    tourId: "gold-control",
  },
  {
    id: "orders",
    title: "Orders",
    blurb: "Customer orders drive manufacturing. Create, track status, and link to jobs.",
    route: "/orders",
  },
  {
    id: "manufacturing",
    title: "Manufacturing",
    blurb: "Workshop jobs, process steps, and queue. Keep custody on every hand-off.",
    route: "/workshop",
    tourId: "manufacturing",
  },
  {
    id: "karigar",
    title: "Karigar",
    blurb: "Issue gold, receive returns, wastage, and worker balances — always against the gold book.",
    route: "/workshop/gold-book",
  },
  {
    id: "stock",
    title: "Stock",
    blurb: "Ready / tagged stock for showroom and delivery. Weights stay in milligrams.",
    route: "/stock",
  },
  {
    id: "billing",
    title: "Billing",
    blurb: "Invoices, receipts, and settlements. Use Universal Print for documents.",
    route: "/billing",
    tourId: "billing",
  },
  {
    id: "accounts",
    title: "Accounts",
    blurb: "Party ledgers and receivables. Gold and money stay integer-safe (mg / paise).",
    route: "/ledger",
  },
  {
    id: "reports",
    title: "Reports",
    blurb: "Operational and gold reports for owners. Export through Universal Export.",
    route: "/reports",
    tourId: "reports",
  },
  {
    id: "customization",
    title: "Customization",
    blurb: "Branding, masters, terminology, and forms under Settings / Customization.",
    route: "/settings",
    tourId: "customization",
  },
  {
    id: "documents",
    title: "Documents",
    blurb: "Print profiles and document templates — same engine on web, desktop, and mobile.",
    route: "/settings",
    tourId: "documents-printing",
  },
  {
    id: "assistant",
    title: "Assistant",
    blurb: "Ask in your language. Drafts need Edit / Cancel / Confirm — nothing posts until you confirm.",
    route: "/assistant",
    tourId: "assistant",
  },
];

const TEACH_RE =
  /\b(teach\s+me|full\s+erp|how\s+to\s+use\s+(ornexa|the\s+app|erp)|ornexa\s+tutorial|guide\s+me|मुझे\s*सिखा|पूर्ण\s*ईआरपी|শেখাও|শিক্ষা|मला\s*शिकव)\b/i;

export function isTeachCurriculumQuery(text: string): boolean {
  return TEACH_RE.test(text.trim());
}

export function buildTeachCurriculumReply(): {
  content: string;
  steps: CurriculumStep[];
} {
  const lines = [
    "I’ll teach you AVS ERP end-to-end. Same ERP as desktop — mobile only changes layout.",
    "",
    "Curriculum:",
    ...ORNEXA_ERP_CURRICULUM.map(
      (s, i) => `${i + 1}. **${s.title}** — ${s.blurb} → Open \`${s.route}\``,
    ),
    "",
    "Tap a step below to open that screen. Say “next lesson” anytime, or open **Teach me AVS ERP** again to restart.",
  ];
  return { content: lines.join("\n"), steps: ORNEXA_ERP_CURRICULUM };
}

export function resolveCurriculumStep(text: string): CurriculumStep | null {
  const lower = text.toLowerCase();
  if (/\bnext\s+(lesson|step)\b/i.test(lower)) {
    return ORNEXA_ERP_CURRICULUM[0];
  }
  for (const step of ORNEXA_ERP_CURRICULUM) {
    if (lower.includes(step.id) || lower.includes(step.title.toLowerCase())) {
      return step;
    }
    if (/\blesson\s+(\d+)\b/i.test(lower)) {
      const n = Number(RegExp.$1);
      if (n >= 1 && n <= ORNEXA_ERP_CURRICULUM.length) {
        return ORNEXA_ERP_CURRICULUM[n - 1];
      }
    }
  }
  return null;
}
