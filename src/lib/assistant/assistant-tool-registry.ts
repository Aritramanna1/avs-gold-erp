/**
 * Ornexa Assistant Tool Registry
 * Universal ERP Tool Registry across 12 Domains & 4 Risk Levels
 * Compliant with ASSISTANT_MASTER.md & AI_RUNTIME_ARCHITECTURE.md
 */

import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fineGoldMg, mgToGrams } from "@/lib/gold";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";
import { searchRemote, type SearchResult } from "@/lib/global-search";
import {
  fetchCreditNotes,
  fetchDebitNotes,
  fetchDeliveryChallans,
  fetchEstimates,
} from "@/lib/billing-documents-query";
import {
  queryKnowledgeBase,
  formatKnowledgeAnswer,
  searchKnowledgeRepository,
} from "./knowledge-repository";
import { resolvePartyEntities } from "./entity-resolver";
import type {
  ERPActionCard,
  ToolDefinition,
  ActionPayload,
  ProviderAdapterConfig,
} from "./assistant-types";
import { getContextBudget } from "./assistant-context-engine";
import {
  executeAssistantGoldIssue,
  executeAssistantCreateParty,
  executeAssistantCreateStock,
  executeAssistantCreateExpense,
} from "./assistant-action-executor";

const supabaseAny = supabase as any;

export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export interface ToolRegistryItem extends ToolDefinition {
  riskLevel: RiskLevel;
  domain:
    | "parties"
    | "manufacturing"
    | "gold"
    | "inventory"
    | "accounts"
    | "documents"
    | "catalogue"
    | "communication"
    | "support"
    | "reports"
    | "settings"
    | "knowledge";
}

export const AUTHORIZED_ERP_TOOLS: ToolRegistryItem[] = [
  // Gold Domain (Risk Level 0 / 3)
  {
    name: "GetWhereIsMyGold",
    domain: "gold",
    riskLevel: 0,
    description:
      "Resolves total gold breakdown across Vaults, Benches, Outside Mina, Refinery, and Trays.",
    requiredPermissions: ["inventory.view", "workshop.view"],
    parameters: {},
  },
  {
    name: "GetGoldPosition",
    domain: "gold",
    riskLevel: 0,
    description:
      "Real-time firm net gold exposure (Bullion, Scrap, Customer Advance, Karigar Custody).",
    requiredPermissions: ["accounts.view", "owner"],
    parameters: {},
  },
  {
    name: "GetKarigarGoldBalance",
    domain: "gold",
    riskLevel: 0,
    description: "Fetches specific worker's active metal custody, issued jobs, and pending scrap.",
    requiredPermissions: ["workshop.view", "accounts.view"],
    parameters: { query: { type: "string" } },
  },
  {
    name: "GetCustomerGoldBalance",
    domain: "gold",
    riskLevel: 0,
    description: "Fetches customer's advance metal deposits and pending custom order requirements.",
    requiredPermissions: ["billing.view", "sales.view"],
    parameters: { query: { type: "string" } },
  },
  // Parties Domain (Risk Level 0 / 1)
  {
    name: "SearchParty",
    domain: "parties",
    riskLevel: 0,
    description:
      "Finds customers, dealers, suppliers, or karigars by name, phone, GSTIN, or alias.",
    requiredPermissions: ["party.view"],
    parameters: { query: { type: "string" } },
  },
  {
    name: "GetParty360",
    domain: "parties",
    riskLevel: 0,
    description:
      "Full 360-degree party dossier: financial ledger, gold ledger, active orders, bills.",
    requiredPermissions: ["party.view"],
    parameters: { query: { type: "string" } },
  },
  // Manufacturing Domain (Risk Level 0 / 1 / 3)
  {
    name: "SearchJobs",
    domain: "manufacturing",
    riskLevel: 0,
    description: "Queries manufacturing jobs by status, karigar, product category, or due date.",
    requiredPermissions: ["production.view"],
    parameters: { query: { type: "string" } },
  },
  {
    name: "GetJobTimeline",
    domain: "manufacturing",
    riskLevel: 0,
    description:
      "Chronological production history for a specific Job Card (Issue -> Melting -> QC).",
    requiredPermissions: ["production.view"],
    parameters: { query: { type: "string" } },
  },
  // Inventory Domain (Risk Level 0 / 1 / 3)
  {
    name: "SearchReadyStock",
    domain: "inventory",
    riskLevel: 0,
    description:
      "Queries showroom tagged stock by category, karat, weight range, and tray location.",
    requiredPermissions: ["stock.view"],
    parameters: { query: { type: "string" } },
  },
  // Accounts Domain (Risk Level 0 / 1 / 3)
  {
    name: "SearchInvoices",
    domain: "accounts",
    riskLevel: 0,
    description:
      "Finds sales invoices, estimates, or purchase bills by invoice number or date range.",
    requiredPermissions: ["billing.view"],
    parameters: { query: { type: "string" } },
  },
  {
    name: "GetOutstanding",
    domain: "accounts",
    riskLevel: 0,
    description: "Outstanding receivables/payables ageing analysis (<30, 31–60, 61–90, >90 days).",
    requiredPermissions: ["accounts.view"],
    parameters: { query: { type: "string" } },
  },
  {
    name: "create_expense_draft",
    domain: "accounts",
    riskLevel: 1,
    description: "Prepares a draft expense voucher with category, GST, and vendor details.",
    requiredPermissions: ["accounts.view"],
    parameters: {
      payee: { type: "string" },
      amount: { type: "number" },
      category: { type: "string" },
    },
  },
  // Documents Domain
  {
    name: "GetDocument",
    domain: "documents",
    riskLevel: 0,
    description:
      "Generates secure preview and action details for a PDF invoice, voucher, or job card.",
    requiredPermissions: ["document.view"],
    parameters: { query: { type: "string" } },
  },
  // Catalogue Domain
  {
    name: "SearchCatalogue",
    domain: "catalogue",
    riskLevel: 0,
    description: "Queries B2B/B2C design catalogue by collection, metal purity, and gross weight.",
    requiredPermissions: ["sales.view"],
    parameters: { query: { type: "string" } },
  },
  // Support Domain
  {
    name: "create_support_ticket",
    domain: "support",
    riskLevel: 2,
    description: "Creates an official platform support ticket with technical and business context.",
    requiredPermissions: [],
    parameters: {
      subject: { type: "string" },
      description: { type: "string" },
      severity: { type: "string" },
    },
  },
  // Knowledge / Help Domain
  {
    name: "query_knowledge_base",
    domain: "knowledge",
    riskLevel: 0,
    description:
      "Answers user questions about Ornexa workflows, settings, gold terminology, and FAQs.",
    requiredPermissions: [],
    parameters: { query: { type: "string" } },
  },
  // Action Drafts (Risk Level 1 / 3)
  {
    name: "prepare_gold_issue_draft",
    domain: "manufacturing",
    riskLevel: 3,
    description: "Prepares a draft Gold Issue slip for confirmation.",
    requiredPermissions: ["workshop.view"],
    parameters: {
      query: { type: "string" },
      grossWeightGrams: { type: "number" },
      purityKarat: { type: "number" },
    },
  },
  {
    name: "prepare_whatsapp_invoice_action",
    domain: "communication",
    riskLevel: 2,
    description: "Prepares a safe WhatsApp invoice dispatch preview requiring confirmation.",
    requiredPermissions: ["billing.view"],
    parameters: { query: { type: "string" } },
  },
];

export async function auditAssistantAction(args: {
  actionKey: string;
  actionType?: "read" | "suggest" | "mutate" | "export" | "message";
  targetType?: string;
  targetId?: string;
  status?: "requested" | "confirmed" | "executed" | "rejected" | "failed";
  requiresConfirmation?: boolean;
  requestPayload?: Record<string, any>;
  resultPayload?: Record<string, any>;
  errorMessage?: string;
}) {
  try {
    await supabaseAny.from("assistant_action_audit").insert({
      action_key: args.actionKey,
      action_type: args.actionType ?? "read",
      target_type: args.targetType,
      target_id: args.targetId,
      status: args.status ?? "executed",
      requires_confirmation: args.requiresConfirmation ?? false,
      request_payload: args.requestPayload ?? {},
      result_payload: args.resultPayload ?? {},
      error_message: args.errorMessage,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Assistant audit write failed", error);
  }
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function extractSearchQuery(userMessage: string): string {
  return userMessage
    .replace(
      /\b(balance|gold position|gold book|where is my gold|gold|book|followups?|overdue|customer|karigar|worker|for|of|show|tell|what|is|the|today|daily|issue|draft|prepare|search|find|open|record|records|document|documents|invoice|tag|barcode|branch|party|timeline|stock|ready|catalogue|outstanding|ageing|expense|ticket|help|how to)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractIssueArgs(message: string) {
  const gramsMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams)\b/i);
  const purityMatch =
    message.match(/\b(24|23|22|21|20|18|14)\s*(?:k|kt|karat)\b/i) ??
    message.match(/\b(999|995|958|916|875|750|585)\b/);
  const grossWeightGrams = gramsMatch ? Number(gramsMatch[1]) : null;
  const purityValue = purityMatch ? Number(purityMatch[1]) : null;
  const purityPerMille =
    purityValue == null
      ? null
      : purityValue <= 24
        ? Math.round((purityValue / 24) * 1000)
        : purityValue;
  return { grossWeightGrams, purityPerMille };
}

async function findPerson(query: string, types?: string[]): Promise<any | null> {
  const q = query.trim();
  if (!q) return null;

  const firmId = await resolveFirmIdForQuery();

  const resolution = await resolvePartyEntities(q, { types, limit: 1 });
  if (resolution.bestMatch) {
    let personQ = supabase
      .from("people")
      .select("id,full_name,phone,type,data,updated_at")
      .eq("id", resolution.bestMatch.id);
    if (firmId) personQ = withFirmScope(personQ, firmId);
    const { data } = await personQ.maybeSingle();
    return data ?? null;
  }

  // Fallback: direct ilike search
  let request = supabase
    .from("people")
    .select("id,full_name,phone,type,data,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (firmId) request = withFirmScope(request, firmId);

  if (types && types.length > 0) {
    request = request.in("type", types);
  }

  const safe = q.replace(/[%_,]/g, " ");
  request = request.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);

  const { data, error } = await request;
  if (error) throw error;
  return data?.[0] ?? null;
}

async function requireFirmScopedTable(table: string) {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) throw new Error(`Firm scope unavailable for ${table} query.`);
  return {
    firmId,
    from: (columns: string) =>
      withFirmScope(supabaseAny.from(table).select(columns), firmId) as ReturnType<
        typeof supabaseAny.from
      >,
  };
}

// 1. GetWhereIsMyGold
export async function toolGetWhereIsMyGold(): Promise<ERPActionCard> {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) {
    throw new Error("Firm scope unavailable for gold position query.");
  }

  const ASSISTANT_ROW_LIMIT = 250;
  const [invRes, workerRes] = await Promise.all([
    withFirmScope(
      supabase
        .from("inventory")
        .select("id,status,gross_mg,net_mg,purity,data")
        .not("status", "eq", "sold")
        .limit(ASSISTANT_ROW_LIMIT),
      firmId,
    ),
    withFirmScope(
      supabase
        .from("worker_transactions")
        .select("kind,data")
        .order("ts", { ascending: false })
        .limit(ASSISTANT_ROW_LIMIT),
      firmId,
    ),
  ]);

  if (invRes.error) throw invRes.error;
  if (workerRes.error) throw workerRes.error;

  let showroomGrossMg = 0;
  let showroomFineMg = 0;
  let vaultGrossMg = 0;
  let vaultFineMg = 0;

  for (const item of (invRes.data ?? []) as any[]) {
    const grossMg = Number(item.gross_mg ?? item.data?.grossMg ?? 0);
    const netMg = Number(item.net_mg ?? item.data?.netMg ?? grossMg);
    const purity = Number(item.purity ?? item.data?.purity ?? 916);
    const fineMg = fineGoldMg(netMg, purity);

    const location = String(item.data?.location ?? item.data?.trayNumber ?? "").toLowerCase();
    if (location.includes("vault") || location.includes("safe")) {
      vaultGrossMg += grossMg;
      vaultFineMg += fineMg;
    } else {
      showroomGrossMg += grossMg;
      showroomFineMg += fineMg;
    }
  }

  let karigarIssuedFineMg = 0;
  let karigarReturnedFineMg = 0;
  for (const tx of (workerRes.data ?? []) as any[]) {
    const payload = tx.data ?? {};
    const fineVal =
      Number(payload.fineMg ?? 0) ||
      fineGoldMg(Number(payload.netMg ?? 0), Number(payload.purity ?? 916));
    const type = String(payload.type ?? tx.kind ?? "").toLowerCase();
    if (type.includes("return")) {
      karigarReturnedFineMg += fineVal;
    } else {
      karigarIssuedFineMg += fineVal;
    }
  }
  const karigarCustodyFineMg = Math.max(0, karigarIssuedFineMg - karigarReturnedFineMg);
  const karigarCustodyGrossMg = Math.round(karigarCustodyFineMg / 0.916);

  const totalFineMg = showroomFineMg + vaultFineMg + karigarCustodyFineMg;
  const totalGrossMg = showroomGrossMg + vaultGrossMg + karigarCustodyGrossMg;

  const locations = [
    {
      location: "Showroom Trays / Display",
      grossGrams: mgToGrams(showroomGrossMg),
      fineGrams: mgToGrams(showroomFineMg),
      share: totalFineMg > 0 ? ((showroomFineMg / totalFineMg) * 100).toFixed(1) + "%" : "0%",
    },
    {
      location: "Main Metal Vault",
      grossGrams: mgToGrams(vaultGrossMg),
      fineGrams: mgToGrams(vaultFineMg),
      share: totalFineMg > 0 ? ((vaultFineMg / totalFineMg) * 100).toFixed(1) + "%" : "0%",
    },
    {
      location: "Karigar Custody (Benches / WIP)",
      grossGrams: mgToGrams(karigarCustodyGrossMg),
      fineGrams: mgToGrams(karigarCustodyFineMg),
      share: totalFineMg > 0 ? ((karigarCustodyFineMg / totalFineMg) * 100).toFixed(1) + "%" : "0%",
    },
  ];

  const card: ERPActionCard = {
    type: "where_is_my_gold",
    title: "Gold Breakdown Across Locations",
    summary: `Total Firm Gold: ${mgToGrams(totalFineMg)} g Fine (${mgToGrams(totalGrossMg)} g Gross). ${mgToGrams(karigarCustodyFineMg)} g currently in Karigar WIP.`,
    actionRoute: "/reports/daily-gold-flow",
    kpis: [
      { label: "Total Fine Gold", value: `${mgToGrams(totalFineMg)} g`, variant: "gold" },
      {
        label: "Showroom Stock",
        value: `${mgToGrams(showroomFineMg)} g`,
        subtitle: "Display Trays",
      },
      { label: "Vault Reserve", value: `${mgToGrams(vaultFineMg)} g`, subtitle: "Main Vault" },
      {
        label: "Karigar Custody",
        value: `${mgToGrams(karigarCustodyFineMg)} g`,
        variant: "warning",
        subtitle: "Active WIP",
      },
    ],
    tableColumns: [
      { key: "location", header: "Location / Custody", align: "left" },
      { key: "grossGrams", header: "Gross Wt (g)", align: "right" },
      { key: "fineGrams", header: "Fine Gold (g)", align: "right" },
      { key: "share", header: "Share %", align: "center" },
    ],
    tableRows: locations,
    chartType: "pie",
    chartData: [
      { label: "Showroom", value: Number(mgToGrams(showroomFineMg)), color: "#f59e0b" },
      { label: "Vault", value: Number(mgToGrams(vaultFineMg)), color: "#3b82f6" },
      { label: "Karigar WIP", value: Number(mgToGrams(karigarCustodyFineMg)), color: "#ef4444" },
    ],
    data: { totalFineMg, totalGrossMg, locations },
  };

  await auditAssistantAction({
    actionKey: "GetWhereIsMyGold",
    actionType: "read",
    resultPayload: { totalFineGrams: mgToGrams(totalFineMg), locationsCount: locations.length },
  });

  return card;
}

// 2. GetGoldPosition
export async function toolGetGoldPosition(): Promise<ERPActionCard> {
  const whereIsGold = await toolGetWhereIsMyGold();
  const totalFineMg = Number(whereIsGold.data.totalFineMg ?? 0);

  const { from: ordersFrom } = await requireFirmScopedTable("orders");
  const { data: ordersData } = await ordersFrom("id,data")
    .not("data->>status", "in", "(delivered,cancelled)")
    .limit(200);

  const customerAdvanceFineMg = (ordersData ?? []).reduce(
    (sum: number, row: any) => sum + Number(row.data?.advance?.goldFineMg ?? 0),
    0,
  );

  const netExposureFineMg = totalFineMg - customerAdvanceFineMg;
  const netGrams = Number(mgToGrams(netExposureFineMg));

  const card: ERPActionCard = {
    type: "gold_position",
    title: "Firm Net Gold Exposure Position",
    summary: `Net firm gold exposure is ${mgToGrams(netExposureFineMg)} g Fine. Total inventory & custody: ${mgToGrams(totalFineMg)} g, Customer advance obligation: ${mgToGrams(customerAdvanceFineMg)} g.`,
    actionRoute: "/reports/daily-close",
    kpis: [
      {
        label: "Net Gold Exposure",
        value: `${mgToGrams(netExposureFineMg)} g`,
        variant: netGrams >= 0 ? "gold" : "destructive",
      },
      {
        label: "Total Physical Gold",
        value: `${mgToGrams(totalFineMg)} g`,
        subtitle: "Showroom + Vault + WIP",
      },
      {
        label: "Customer Advance Gold",
        value: `${mgToGrams(customerAdvanceFineMg)} g`,
        variant: "warning",
        subtitle: "Advance Liability",
      },
      {
        label: "Exposure Status",
        value: netGrams > 500 ? "Long (Hedging OK)" : "Balanced",
        variant: "success",
      },
    ],
    data: {
      totalFineMg,
      customerAdvanceFineMg,
      netExposureFineMg,
    },
  };

  await auditAssistantAction({
    actionKey: "GetGoldPosition",
    actionType: "read",
    resultPayload: { netExposureGrams: mgToGrams(netExposureFineMg) },
  });

  return card;
}

// 3. GetKarigarGoldBalance
export async function toolGetKarigarGoldBalance(
  userMessage: string,
): Promise<ERPActionCard | null> {
  const query = extractSearchQuery(userMessage);
  const worker = await findPerson(query, ["karigar", "worker", "outside_worker", "employee"]);
  if (!worker) return null;

  const { from: txFrom } = await requireFirmScopedTable("worker_transactions");
  const { from: jobsFrom } = await requireFirmScopedTable("job_cards");
  const [txRes, jobsRes] = await Promise.all([
    txFrom("kind,data,created_at")
      .or(`data->>workerId.eq.${worker.id},data->>karigarId.eq.${worker.id}`)
      .order("created_at", { ascending: false })
      .limit(250),
    jobsFrom("id,status,data")
      .or(`data->>karigarId.eq.${worker.id},data->>workerId.eq.${worker.id}`)
      .not("status", "in", "(completed,delivered,cancelled,closed)")
      .limit(50),
  ]);

  if (txRes.error) throw txRes.error;
  if (jobsRes.error) throw jobsRes.error;

  let issuedFineMg = 0;
  let returnedFineMg = 0;
  let issuedGrossMg = 0;
  let returnedGrossMg = 0;

  for (const row of (txRes.data ?? []) as any[]) {
    const payload = row.data ?? {};
    const fineVal =
      Number(payload.fineMg ?? 0) ||
      fineGoldMg(Number(payload.netMg ?? 0), Number(payload.purity ?? 916));
    const grossMg = Number(payload.grossMg ?? 0);
    const type = String(payload.type ?? row.kind ?? "").toLowerCase();

    if (type.includes("return")) {
      returnedFineMg += fineVal;
      returnedGrossMg += grossMg;
    } else {
      issuedFineMg += fineVal;
      issuedGrossMg += grossMg;
    }
  }

  const pendingFineMg = issuedFineMg - returnedFineMg;
  const activeJobs = (jobsRes.data ?? []).map((j: any) => ({
    id: j.id,
    jobNo: j.data?.jobNo || j.id.slice(0, 8),
    orderNo: j.data?.orderNo || "Direct",
    targetFineGrams: mgToGrams(Number(j.data?.targetFineMg ?? 0)),
    status: j.status ?? j.data?.status ?? "active",
    dueDate: j.data?.expectedDelivery || "-",
  }));

  const card: ERPActionCard = {
    type: "gold_book",
    title: `Karigar Gold Book: ${worker.full_name ?? "Karigar"}`,
    summary: `Pending fine balance is ${mgToGrams(pendingFineMg)} g Fine across ${activeJobs.length} active job cards.`,
    actionRoute: `/workshop/worker-book/${worker.id}`,
    kpis: [
      {
        label: "Pending Fine Balance",
        value: `${mgToGrams(pendingFineMg)} g`,
        variant: pendingFineMg > 0 ? "warning" : "success",
      },
      {
        label: "Total Issued Fine",
        value: `${mgToGrams(issuedFineMg)} g`,
        subtitle: `${mgToGrams(issuedGrossMg)} g Gross`,
      },
      {
        label: "Total Returned Fine",
        value: `${mgToGrams(returnedFineMg)} g`,
        subtitle: `${mgToGrams(returnedGrossMg)} g Gross`,
      },
      { label: "Active Jobs", value: activeJobs.length, subtitle: "In Progress" },
    ],
    tableColumns: [
      { key: "jobNo", header: "Job No", align: "left" },
      { key: "orderNo", header: "Order No", align: "left" },
      { key: "targetFineGrams", header: "Target Fine (g)", align: "right" },
      { key: "status", header: "Status", align: "center", format: "badge" },
      { key: "dueDate", header: "Due Date", align: "right" },
    ],
    tableRows: activeJobs.slice(0, 10),
    data: {
      workerId: worker.id,
      workerName: worker.full_name,
      phone: worker.phone,
      pendingFineMg,
      issuedFineMg,
      returnedFineMg,
      activeJobs,
    },
  };

  await auditAssistantAction({
    actionKey: "GetKarigarGoldBalance",
    actionType: "read",
    targetType: "people",
    targetId: worker.id,
    resultPayload: {
      pendingFineGrams: mgToGrams(pendingFineMg),
      activeJobsCount: activeJobs.length,
    },
  });

  return card;
}

// 4. GetCustomerGoldBalance
export async function toolGetCustomerGoldBalance(
  userMessage: string,
): Promise<ERPActionCard | null> {
  const query = extractSearchQuery(userMessage);
  const person = await findPerson(query, ["customer", "firm_customer"]);
  if (!person) return null;

  const { from: ordersFrom } = await requireFirmScopedTable("orders");
  const { from: invoicesFrom } = await requireFirmScopedTable("invoices");
  const [ordersRes, invoicesRes] = await Promise.all([
    ordersFrom("id,data")
      .filter("data->>customerId", "eq", person.id)
      .order("created_at", { ascending: false })
      .limit(50),
    invoicesFrom("id,grand_total_paise,paid_paise,data,invoice_number,created_at")
      .filter("data->>customerId", "eq", person.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (invoicesRes.error) throw invoicesRes.error;

  const orders = ((ordersRes.data ?? []) as any[]).map((r) => r.data ?? {});
  const invoices = (invoicesRes.data ?? []) as any[];

  const openOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(String(o.status ?? "").toLowerCase()),
  );

  const totalInvoicePaise = invoices.reduce((sum, r) => sum + Number(r.grand_total_paise ?? 0), 0);
  const paidPaise = invoices.reduce(
    (sum, r) => sum + Number(r.paid_paise ?? r.data?.paidPaise ?? 0),
    0,
  );
  const outstandingPaise = Math.max(0, totalInvoicePaise - paidPaise);
  const goldAdvanceFineMg = orders.reduce((sum, o) => sum + Number(o.advance?.goldFineMg ?? 0), 0);

  const card: ERPActionCard = {
    type: "customer_balance",
    title: `Customer Dossier: ${person.full_name ?? "Customer"}`,
    summary: `${openOrders.length} active orders, ${mgToGrams(goldAdvanceFineMg)} g gold advance, Rs. ${(outstandingPaise / 100).toLocaleString("en-IN")} cash balance.`,
    actionRoute: `/people?selected=${person.id}`,
    kpis: [
      {
        label: "Cash Outstanding",
        value: `Rs. ${(outstandingPaise / 100).toLocaleString("en-IN")}`,
        variant: outstandingPaise > 0 ? "destructive" : "success",
      },
      {
        label: "Gold Advance",
        value: `${mgToGrams(goldAdvanceFineMg)} g`,
        variant: "gold",
        subtitle: "Fine Gold",
      },
      { label: "Active Orders", value: openOrders.length, subtitle: "In Production" },
      {
        label: "Total Invoices",
        value: invoices.length,
        subtitle: `Rs. ${(totalInvoicePaise / 100).toLocaleString("en-IN")}`,
      },
    ],
    tableColumns: [
      { key: "invoiceNo", header: "Invoice No", align: "left" },
      { key: "amount", header: "Amount", align: "right" },
      { key: "status", header: "Status", align: "center", format: "badge" },
      { key: "date", header: "Date", align: "right" },
    ],
    tableRows: invoices.slice(0, 5).map((inv) => ({
      invoiceNo: inv.invoice_number || inv.data?.invoiceNumber || inv.id.slice(0, 8),
      amount: `Rs. ${(Number(inv.grand_total_paise ?? 0) / 100).toLocaleString("en-IN")}`,
      status: (inv.paid_paise ?? 0) >= (inv.grand_total_paise ?? 0) ? "Paid" : "Pending",
      date: inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "-",
    })),
    data: {
      personId: person.id,
      name: person.full_name,
      phone: person.phone,
      openOrdersCount: openOrders.length,
      outstandingPaise,
      goldAdvanceFineMg,
    },
  };

  await auditAssistantAction({
    actionKey: "GetCustomerGoldBalance",
    actionType: "read",
    targetType: "people",
    targetId: person.id,
    resultPayload: {
      outstandingInr: outstandingPaise / 100,
      goldAdvanceGrams: mgToGrams(goldAdvanceFineMg),
    },
  });

  return card;
}

// 5. SearchParty
export async function toolSearchParty(userMessage: string): Promise<ERPActionCard | null> {
  const query = extractSearchQuery(userMessage) || userMessage.trim();
  if (query.length < 2) return null;

  const safe = query.replace(/[%_,]/g, " ");
  const { from: peopleFrom } = await requireFirmScopedTable("people");
  const { data, error } = await peopleFrom("id,full_name,phone,type,data,updated_at")
    .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`)
    .limit(20);

  if (error) throw error;
  const rows = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.full_name || "Unnamed",
    type: p.type || "Customer",
    phone: p.phone || p.data?.phone || "-",
    city: p.data?.city || p.data?.address?.city || "-",
    route: `/people?selected=${p.id}`,
  }));

  const card: ERPActionCard = {
    type: "search_results",
    title: `Parties matching "${query}"`,
    summary: `Found ${rows.length} matching parties.`,
    actionRoute: rows[0]?.route || "/people",
    tableColumns: [
      { key: "name", header: "Party Name", align: "left" },
      { key: "type", header: "Category", align: "center", format: "badge" },
      { key: "phone", header: "Phone", align: "left" },
      { key: "city", header: "City", align: "right" },
    ],
    tableRows: rows,
    data: { query, results: rows },
  };

  await auditAssistantAction({
    actionKey: "SearchParty",
    actionType: "read",
    requestPayload: { query },
    resultPayload: { count: rows.length },
  });

  return card;
}

// 6. GetParty360
export async function toolGetParty360(userMessage: string): Promise<ERPActionCard | null> {
  return toolGetCustomerGoldBalance(userMessage);
}

// 7. SearchJobs
export async function toolSearchJobs(userMessage: string): Promise<ERPActionCard> {
  const query = extractSearchQuery(userMessage);
  const { from: jobsFrom } = await requireFirmScopedTable("job_cards");
  let request = jobsFrom("id,status,data,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (query) {
    const safe = query.replace(/[%_,]/g, " ");
    request = request.or(
      `data->>jobNo.ilike.%${safe}%,data->>orderNo.ilike.%${safe}%,data->>karigarName.ilike.%${safe}%,status.ilike.%${safe}%`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;

  const today = todayYmd();
  const jobs = ((data ?? []) as any[]).map((row) => {
    const isOverdue = row.data?.expectedDelivery && String(row.data.expectedDelivery) < today;
    return {
      id: row.id,
      jobNo: row.data?.jobNo || row.id.slice(0, 8),
      orderNo: row.data?.orderNo || "Direct",
      karigar: row.data?.karigarName || "Unassigned",
      category: row.data?.category || row.data?.productType || "Jewellery",
      targetFineGrams: mgToGrams(Number(row.data?.targetFineMg ?? 0)),
      status: isOverdue ? "Overdue" : (row.status ?? "in_progress"),
      dueDate: row.data?.expectedDelivery || "-",
      route: `/workshop/jobcards`,
    };
  });

  const openCount = jobs.filter(
    (j) => !["completed", "delivered", "closed"].includes(j.status.toLowerCase()),
  ).length;

  const card: ERPActionCard = {
    type: "production_queue",
    title: query ? `Jobs Matching "${query}"` : "Production Job Cards",
    summary: `${jobs.length} job cards listed (${openCount} active WIP).`,
    actionRoute: "/workshop",
    kpis: [
      { label: "Total Matching Jobs", value: jobs.length },
      { label: "Active WIP", value: openCount, variant: "gold" },
      {
        label: "Overdue",
        value: jobs.filter((j) => j.status === "Overdue").length,
        variant: "destructive",
      },
    ],
    tableColumns: [
      { key: "jobNo", header: "Job No", align: "left" },
      { key: "karigar", header: "Karigar", align: "left" },
      { key: "targetFineGrams", header: "Fine Wt (g)", align: "right" },
      { key: "status", header: "Status", align: "center", format: "badge" },
      { key: "dueDate", header: "Due Date", align: "right" },
    ],
    tableRows: jobs.slice(0, 15),
    data: { jobs },
  };

  await auditAssistantAction({
    actionKey: "SearchJobs",
    actionType: "read",
    requestPayload: { query },
    resultPayload: { totalJobs: jobs.length },
  });

  return card;
}

// 8. GetJobTimeline
export async function toolGetJobTimeline(userMessage: string): Promise<ERPActionCard | null> {
  const query = extractSearchQuery(userMessage);
  const { from: jobsFrom } = await requireFirmScopedTable("job_cards");
  let request = jobsFrom("id,status,data,created_at,updated_at").limit(1);

  if (query) {
    const safe = query.replace(/[%_,]/g, " ");
    request = request.or(`data->>jobNo.ilike.%${safe}%,id.ilike.%${safe}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  const job = data?.[0];
  if (!job) return null;

  const jobData = job.data as any;
  const jobNo = jobData?.jobNo || job.id.slice(0, 8);
  const events = [
    {
      title: "Job Card Created",
      subtitle: `Order #${jobData?.orderNo || "Direct"}`,
      timestamp: new Date(job.created_at).toLocaleString("en-IN"),
      status: "completed" as const,
      workerName: "Admin",
    },
    {
      title: "Metal Issued to Karigar",
      subtitle: `${mgToGrams(Number(jobData?.targetFineMg ?? 0))} g Fine`,
      timestamp: new Date(job.created_at).toLocaleString("en-IN"),
      status: "completed" as const,
      workerName: jobData?.karigarName || "Karigar",
    },
    {
      title: "Manufacturing & Setting",
      subtitle: "Filing & Stone Setting",
      timestamp: "In Progress",
      status: "in_progress" as const,
      workerName: jobData?.karigarName || "Karigar",
    },
    {
      title: "Polishing & Quality Check",
      subtitle: "Laser Hallmark & Final Weighing",
      timestamp: "Pending",
      status: "pending" as const,
      workerName: "QC Team",
    },
    {
      title: "Ready for Delivery",
      subtitle: "Tagged & Moved to Showroom",
      timestamp: jobData?.expectedDelivery || "Awaiting completion",
      status: "pending" as const,
    },
  ];

  const card: ERPActionCard = {
    type: "job_timeline",
    title: `Production Timeline: Job #${jobNo}`,
    summary: `Current Stage: Manufacturing & Setting (${jobData?.karigarName || "Karigar"}). Expected Due: ${jobData?.expectedDelivery || "TBD"}.`,
    actionRoute: `/workshop/jobcards`,
    timelineEvents: events,
    data: { jobId: job.id, jobNo, events },
  };

  await auditAssistantAction({
    actionKey: "GetJobTimeline",
    actionType: "read",
    targetType: "job_cards",
    targetId: job.id,
    resultPayload: { jobNo, stage: "in_progress" },
  });

  return card;
}

// 9. SearchReadyStock
export async function toolSearchReadyStock(userMessage: string): Promise<ERPActionCard> {
  const query = extractSearchQuery(userMessage);
  const { from: invFrom } = await requireFirmScopedTable("inventory");
  let request = invFrom("id,item_name,status,gross_mg,net_mg,purity,data,created_at")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(50);

  if (query) {
    const safe = query.replace(/[%_,]/g, " ");
    request = request.or(
      `item_name.ilike.%${safe}%,data->>tagNumber.ilike.%${safe}%,data->>category.ilike.%${safe}%`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;

  let totalFineMg = 0;
  let totalGrossMg = 0;
  const items = ((data ?? []) as any[]).map((r) => {
    const grossMg = Number(r.gross_mg ?? r.data?.grossMg ?? 0);
    const netMg = Number(r.net_mg ?? r.data?.netMg ?? grossMg);
    const purity = Number(r.purity ?? r.data?.purity ?? 916);
    const fineMg = fineGoldMg(netMg, purity);

    totalGrossMg += grossMg;
    totalFineMg += fineMg;

    return {
      tag: r.data?.tagNumber || r.id.slice(0, 8),
      name: r.item_name || r.data?.itemName || "Stock Item",
      purity: `${purity >= 900 ? "22K" : purity >= 750 ? "18K" : "Gold"} (${purity})`,
      grossGrams: mgToGrams(grossMg),
      netGrams: mgToGrams(netMg),
      fineGrams: mgToGrams(fineMg),
      location: r.data?.trayNumber || r.data?.location || "Showroom Tray",
      route: `/stock`,
    };
  });

  const card: ERPActionCard = {
    type: "ready_stock",
    title: query ? `Ready Stock: "${query}"` : "Ready Showroom Stock",
    summary: `Found ${items.length} items totaling ${mgToGrams(totalFineMg)} g Fine (${mgToGrams(totalGrossMg)} g Gross).`,
    actionRoute: "/stock",
    kpis: [
      { label: "Available Items", value: items.length, variant: "gold" },
      { label: "Total Gross Wt", value: `${mgToGrams(totalGrossMg)} g` },
      { label: "Total Fine Gold", value: `${mgToGrams(totalFineMg)} g`, variant: "gold" },
    ],
    tableColumns: [
      { key: "tag", header: "Tag No", align: "left" },
      { key: "name", header: "Item Name", align: "left" },
      { key: "purity", header: "Purity", align: "center", format: "badge" },
      { key: "grossGrams", header: "Gross (g)", align: "right" },
      { key: "fineGrams", header: "Fine (g)", align: "right" },
      { key: "location", header: "Tray / Loc", align: "right" },
    ],
    tableRows: items.slice(0, 15),
    data: { items, totalFineMg, totalGrossMg },
  };

  await auditAssistantAction({
    actionKey: "SearchReadyStock",
    actionType: "read",
    requestPayload: { query },
    resultPayload: { count: items.length, fineGrams: mgToGrams(totalFineMg) },
  });

  return card;
}

// 10. SearchInvoices
export async function toolSearchInvoices(userMessage: string): Promise<ERPActionCard> {
  const query = extractSearchQuery(userMessage);
  const { from: invoicesFrom } = await requireFirmScopedTable("invoices");
  let request = invoicesFrom("id,invoice_number,grand_total_paise,paid_paise,data,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (query) {
    const safe = query.replace(/[%_,]/g, " ");
    request = request.or(
      `invoice_number.ilike.%${safe}%,data->>customerName.ilike.%${safe}%,data->>phone.ilike.%${safe}%`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;

  let totalPaise = 0;
  let paidSumPaise = 0;
  const rows = ((data ?? []) as any[]).map((inv) => {
    const grandPaise = Number(inv.grand_total_paise ?? 0);
    const paidPaise = Number(inv.paid_paise ?? inv.data?.paidPaise ?? 0);
    totalPaise += grandPaise;
    paidSumPaise += paidPaise;

    return {
      id: inv.id,
      invoiceNo: inv.invoice_number || inv.data?.invoiceNumber || inv.id.slice(0, 8),
      customer: inv.data?.customerName || "Walk-in Customer",
      amount: `Rs. ${(grandPaise / 100).toLocaleString("en-IN")}`,
      status: paidPaise >= grandPaise ? "Paid" : paidPaise > 0 ? "Partial" : "Pending",
      date: inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "-",
      route: `/billing/invoices/${inv.id}`,
    };
  });

  const card: ERPActionCard = {
    type: "invoices_list",
    title: query ? `Invoices: "${query}"` : "Recent Sales Invoices",
    summary: `${rows.length} invoices. Total Billed: Rs. ${(totalPaise / 100).toLocaleString("en-IN")}.`,
    actionRoute: "/billing",
    kpis: [
      { label: "Total Invoices", value: rows.length },
      {
        label: "Billed Total",
        value: `Rs. ${(totalPaise / 100).toLocaleString("en-IN")}`,
        variant: "gold",
      },
      {
        label: "Pending Collection",
        value: `Rs. ${((totalPaise - paidSumPaise) / 100).toLocaleString("en-IN")}`,
        variant: "destructive",
      },
    ],
    tableColumns: [
      { key: "invoiceNo", header: "Invoice No", align: "left" },
      { key: "customer", header: "Customer", align: "left" },
      { key: "amount", header: "Amount", align: "right" },
      { key: "status", header: "Status", align: "center", format: "badge" },
      { key: "date", header: "Date", align: "right" },
    ],
    tableRows: rows.slice(0, 15),
    data: { invoices: rows, totalPaise, paidSumPaise },
  };

  await auditAssistantAction({
    actionKey: "SearchInvoices",
    actionType: "read",
    requestPayload: { query },
    resultPayload: { count: rows.length, totalInr: totalPaise / 100 },
  });

  return card;
}

// 11. GetOutstanding
export async function toolGetOutstanding(userMessage: string): Promise<ERPActionCard> {
  const query = extractSearchQuery(userMessage);
  const { from: invoicesFrom } = await requireFirmScopedTable("invoices");
  let request = invoicesFrom("id,invoice_number,grand_total_paise,paid_paise,data,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (query) {
    const safe = query.replace(/[%_,]/g, " ");
    request = request.or(`invoice_number.ilike.%${safe}%,data->>customerName.ilike.%${safe}%`);
  }

  const { data, error } = await request;
  if (error) throw error;

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  let bucketUnder30 = 0;
  let bucket31To60 = 0;
  let bucket61To90 = 0;
  let bucketAbove90 = 0;

  const outstandingList: any[] = [];

  for (const inv of (data ?? []) as any[]) {
    const totalPaise = Number(inv.grand_total_paise ?? 0);
    const paidPaise = Number(inv.paid_paise ?? inv.data?.paidPaise ?? 0);
    const duePaise = Math.max(0, totalPaise - paidPaise);
    if (duePaise <= 0) continue;

    const ageDays = inv.created_at
      ? Math.floor((now - new Date(inv.created_at).getTime()) / DAY_MS)
      : 0;
    const dueInr = duePaise / 100;

    if (ageDays <= 30) bucketUnder30 += dueInr;
    else if (ageDays <= 60) bucket31To60 += dueInr;
    else if (ageDays <= 90) bucket61To90 += dueInr;
    else bucketAbove90 += dueInr;

    outstandingList.push({
      invoiceNo: inv.invoice_number || inv.data?.invoiceNumber || inv.id.slice(0, 8),
      customer: inv.data?.customerName || "Customer",
      dueAmount: `Rs. ${dueInr.toLocaleString("en-IN")}`,
      ageDays: `${ageDays} d`,
      ageCategory:
        ageDays > 90
          ? ">90 Days"
          : ageDays > 60
            ? "61-90 Days"
            : ageDays > 30
              ? "31-60 Days"
              : "<30 Days",
      route: `/billing/invoices/${inv.id}`,
    });
  }

  const totalOutstandingInr = bucketUnder30 + bucket31To60 + bucket61To90 + bucketAbove90;

  const card: ERPActionCard = {
    type: "outstanding_ageing",
    title: "Outstanding Receivables Ageing",
    summary: `Total Outstanding: Rs. ${totalOutstandingInr.toLocaleString("en-IN")} across ${outstandingList.length} pending bills.`,
    actionRoute: "/reports/ledger",
    kpis: [
      {
        label: "Total Receivables",
        value: `Rs. ${totalOutstandingInr.toLocaleString("en-IN")}`,
        variant: "destructive",
      },
      {
        label: "< 30 Days",
        value: `Rs. ${bucketUnder30.toLocaleString("en-IN")}`,
        variant: "default",
      },
      {
        label: "31-60 Days",
        value: `Rs. ${bucket31To60.toLocaleString("en-IN")}`,
        variant: "warning",
      },
      {
        label: "> 90 Days (Critical)",
        value: `Rs. ${bucketAbove90.toLocaleString("en-IN")}`,
        variant: "destructive",
      },
    ],
    chartType: "bar",
    chartData: [
      { label: "< 30 Days", value: bucketUnder30, color: "#10b981" },
      { label: "31-60 Days", value: bucket31To60, color: "#f59e0b" },
      { label: "61-90 Days", value: bucket61To90, color: "#f97316" },
      { label: "> 90 Days", value: bucketAbove90, color: "#ef4444" },
    ],
    tableColumns: [
      { key: "invoiceNo", header: "Invoice", align: "left" },
      { key: "customer", header: "Customer / Dealer", align: "left" },
      { key: "dueAmount", header: "Due Amount", align: "right" },
      { key: "ageDays", header: "Age", align: "center" },
      { key: "ageCategory", header: "Bracket", align: "center", format: "badge" },
    ],
    tableRows: outstandingList.slice(0, 10),
    data: {
      totalOutstandingInr,
      bucketUnder30,
      bucket31To60,
      bucket61To90,
      bucketAbove90,
      outstandingList,
    },
  };

  await auditAssistantAction({
    actionKey: "GetOutstanding",
    actionType: "read",
    resultPayload: { totalDueInr: totalOutstandingInr, count: outstandingList.length },
  });

  return card;
}

// 12. GetDocument
export async function toolGetDocument(userMessage: string): Promise<ERPActionCard | null> {
  const query = extractSearchQuery(userMessage);
  const safe = query.replace(/[%_,]/g, " ");

  const { from: invoicesFrom } = await requireFirmScopedTable("invoices");
  const { data, error } = await invoicesFrom("id,invoice_no,grand_total_paise,paid_paise,data,created_at")
    .or(`invoice_no.ilike.%${safe}%,id.ilike.%${safe}%`)
    .limit(1);

  if (error) throw error;
  const inv = data?.[0];
  if (!inv) return null;

  const invData = (inv.data || {}) as Record<string, any>;
  const invNo = inv.invoice_no || invData?.invoiceNumber || inv.id.slice(0, 8);
  const amountFormatted = `Rs. ${(Number(inv.grand_total_paise ?? 0) / 100).toLocaleString("en-IN")}`;

  const card: ERPActionCard = {
    type: "document_preview",
    title: `Document: Invoice #${invNo}`,
    summary: `Invoice #${invNo} for ${invData?.customerName || "Customer"} (${amountFormatted}).`,
    actionRoute: `/billing/invoices/${inv.id}`,
    documentUrl: `/billing/invoices/${inv.id}`,
    documentMeta: {
      docNumber: invNo,
      docType: "Sales Tax Invoice",
      date: inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "-",
      amountFormatted,
    },
    actionPayload: {
      actionId: `act_wa_${Date.now()}`,
      actionType: "whatsapp_send",
      title: "Send Invoice on WhatsApp",
      description: `Send official tax invoice #${invNo} to ${invData?.customerName || "Customer"} (${invData?.phone || "Phone on file"}). Requires 10 Communications Credits.`,
      requiresConfirmation: true,
      targetType: "invoices",
      targetId: inv.id,
      recipientPhone: invData?.phone,
      recipientName: invData?.customerName,
      details: {
        invoiceNo: invNo,
        amount: amountFormatted,
      },
    },
    data: { invoice: inv },
  };

  await auditAssistantAction({
    actionKey: "GetDocument",
    actionType: "read",
    targetType: "invoices",
    targetId: inv.id,
    resultPayload: { invoiceNo: invNo },
  });

  return card;
}

// 13. SearchCatalogue
export async function toolSearchCatalogue(userMessage: string): Promise<ERPActionCard> {
  const query = extractSearchQuery(userMessage);
  const searchCard = await toolSearchReadyStock(userMessage);
  return {
    ...searchCard,
    type: "search_results",
    title: query ? `Design Catalogue: "${query}"` : "Design Catalogue",
  };
}

// 14. Create Support Ticket (Level 2 Low-Risk Write)
export async function toolCreateSupportTicket(userMessage: string): Promise<ERPActionCard> {
  const query = extractSearchQuery(userMessage) || "General ERP Assistance";
  const ticketNo = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
  const context = getContextBudget();
  const currentRoute = context.route.currentPath;

  const card: ERPActionCard = {
    type: "action_confirmation",
    title: `Draft Support Ticket: ${ticketNo}`,
    summary: `Ready to create official support ticket for "${query}". Our support engineering team will receive this with technical diagnosis context including your active route (${currentRoute}).`,
    actionRoute: context.support.ticketRoute,
    actionPayload: {
      actionId: `act_tkt_${Date.now()}`,
      actionType: "create_voucher",
      title: "Submit Support Ticket",
      description: `Submit ticket "${query}" to Ornexa Platform Support.`,
      requiresConfirmation: true,
      targetType: "platform_support_tickets",
      details: {
        ticketNo,
        subject: query,
        severity: "medium",
        reportedRoute: currentRoute,
      },
    },
    kpis: [
      { label: "Ticket Number", value: ticketNo, variant: "gold" },
      { label: "Subject", value: query.slice(0, 24) },
      { label: "Priority", value: "Normal (SLA < 4 hrs)", variant: "success" },
    ],
    data: { ticketNo, subject: query },
  };

  await auditAssistantAction({
    actionKey: "create_support_ticket",
    actionType: "suggest",
    status: "requested",
    requiresConfirmation: true,
    requestPayload: { userMessage },
    resultPayload: card.data,
  });

  return card;
}

// 15. Query Knowledge Base / SOPs / FAQ (Path A Local RAG)
export async function toolQueryKnowledgeBase(userMessage: string): Promise<ERPActionCard> {
  const scored = searchKnowledgeRepository(userMessage, { limit: 3 });
  const formatted = formatKnowledgeAnswer(scored);

  if (scored.length === 0 || !formatted.content) {
    return {
      type: "search_results",
      title: "Help & Knowledge Centre",
      summary:
        "I don't have enough information to answer that confidently. Browse the Help Centre or ask a more specific jewellery/Ornexa question.",
      actionRoute: "/help",
      data: { query: userMessage, isKnowledge: true },
    };
  }

  const primary = scored[0].article;
  const tierLabel: Record<string, string> = {
    product: "Ornexa Product",
    industry: "Jewellery Industry",
    india: "India Knowledge",
    tenant: "Your Business",
    faq: "FAQ",
  };

  const card: ERPActionCard = {
    type: "search_results",
    title: primary.title,
    summary: formatted.content.slice(0, 600) + (formatted.content.length > 600 ? "…" : ""),
    actionRoute: primary.relatedRoute || "/help",
    tableColumns: [
      { key: "topic", header: "Related Topic", align: "left" },
      { key: "tier", header: "Knowledge Type", align: "left" },
      { key: "source", header: "Source", align: "right" },
    ],
    tableRows: scored.map((r) => ({
      topic: r.article.title,
      tier: tierLabel[r.article.knowledgeTier] ?? r.article.knowledgeTier,
      source: r.article.sourceDoc ?? "Ornexa Knowledge Base",
    })),
    data: {
      primaryContent: formatted.content,
      sourceDoc: primary.sourceDoc,
      knowledgeTier: primary.knowledgeTier,
      knowledgeSources: scored.map((r) => ({
        id: r.article.id,
        title: r.article.title,
        topic: r.article.topic,
        knowledgeTier: r.article.knowledgeTier,
        sourceDoc: r.article.sourceDoc,
        relatedRoute: r.article.relatedRoute,
        lastReviewedAt: r.article.lastReviewedAt,
      })),
      isKnowledge: true,
      confidence: formatted.confidence,
      results: scored.map((r) => r.article),
    },
  };

  await auditAssistantAction({
    actionKey: "query_knowledge_base",
    actionType: "read",
    requestPayload: { query: userMessage },
    resultPayload: {
      matchedId: primary.id,
      sourceDoc: primary.sourceDoc,
      confidence: formatted.confidence,
      tier: primary.knowledgeTier,
    },
  });

  return card;
}

// 16. prepare_gold_issue_draft (Safe write draft)
export async function toolPrepareGoldIssueDraft(
  userMessage: string,
): Promise<ERPActionCard | null> {
  const query = extractSearchQuery(userMessage);
  const worker = await findPerson(query, ["karigar", "worker", "outside_worker", "employee"]);
  const { grossWeightGrams, purityPerMille } = extractIssueArgs(userMessage);
  if (!worker || !grossWeightGrams || !purityPerMille) return null;

  const grossMg = Math.round(grossWeightGrams * 1000);
  const fineMg = fineGoldMg(grossMg, purityPerMille);

  const card: ERPActionCard = {
    type: "action_confirmation",
    title: `Draft Gold Issue Slip: ${worker.full_name ?? "Worker"}`,
    summary: `Review & Confirm: Issue ${grossWeightGrams.toFixed(3)} g at ${purityPerMille} Purity (${mgToGrams(fineMg)} g Fine Gold).`,
    actionRoute: "/workshop/gold-book",
    actionPayload: {
      actionId: `act_issue_${Date.now()}`,
      actionType: "gold_issue",
      title: "Confirm Gold Issue to Karigar",
      description: `Issue ${grossWeightGrams.toFixed(3)} g gold (${purityPerMille} touch) to ${worker.full_name}. This will update worker custody.`,
      requiresConfirmation: true,
      targetType: "people",
      targetId: worker.id,
      recipientName: worker.full_name,
      details: {
        workerId: worker.id,
        workerName: worker.full_name,
        grossGrams: grossWeightGrams,
        purity: purityPerMille,
        fineGrams: Number(mgToGrams(fineMg)),
      },
    },
    kpis: [
      { label: "Gross Weight", value: `${grossWeightGrams.toFixed(3)} g` },
      {
        label: "Purity Touch",
        value: `${purityPerMille}`,
        subtitle: `${purityPerMille >= 916 ? "22K" : "18K"}`,
      },
      { label: "Calculated Fine Gold", value: `${mgToGrams(fineMg)} g`, variant: "gold" },
      { label: "Recipient Karigar", value: worker.full_name || "Worker", variant: "default" },
    ],
    data: {
      workerId: worker.id,
      grossMg,
      purity: purityPerMille,
      fineMg,
    },
  };

  await auditAssistantAction({
    actionKey: "prepare_gold_issue_draft",
    actionType: "suggest",
    targetType: "people",
    targetId: worker.id,
    status: "requested",
    requiresConfirmation: true,
    requestPayload: { query, grossWeightGrams, purityPerMille },
    resultPayload: card.data,
  });

  return card;
}

// 17. prepare_whatsapp_invoice_action (Safe write draft)
export async function toolPrepareWhatsAppInvoiceAction(
  userMessage: string,
): Promise<ERPActionCard | null> {
  const docCard = await toolGetDocument(userMessage);
  if (!docCard || !docCard.actionPayload) return null;
  return {
    ...docCard,
    type: "action_confirmation",
    title: `WhatsApp Share Preview: ${docCard.title}`,
  };
}

// Execute confirmed action with audit log and real database mutations
export async function executeConfirmedAction(
  payload: ActionPayload,
): Promise<{ success: boolean; message: string }> {
  try {
    const details = payload.details || {};

    // 1. Gold Issue
    // AVS-64: Help / support tickets never burn credits
    if (
      payload.targetType === "platform_support_tickets" ||
      payload.actionKey === "create_support_ticket" ||
      String(payload.details?.ticketNo ?? "").startsWith("TKT-") ||
      String(payload.details?.ticketNo ?? "").startsWith("STF-")
    ) {
      return {
        success: false,
        message: "Support tickets must use the Help desk path and never deduct tenant credits.",
      };
    }

    if (payload.actionType === "gold_issue") {
      const result = await executeAssistantGoldIssue(payload);
      if (!result.success) return result;

      await auditAssistantAction({
        actionKey: "execute_gold_issue",
        actionType: "mutate",
        targetType: "people",
        targetId: payload.targetId,
        status: "executed",
        requiresConfirmation: true,
        requestPayload: payload.details,
        resultPayload: { success: true },
      });

      void (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: "ai_action_exec",
        p_units: 1,
        p_description: `Assistant gold issue to ${payload.recipientName || "Worker"}`,
      });

      return result;
    }

    // 2. Create Party
    if (payload.actionType === "create_voucher" && details.partyType) {
      const result = await executeAssistantCreateParty(payload);
      if (!result.success) return result;

      await auditAssistantAction({
        actionKey: "execute_create_party",
        actionType: "mutate",
        targetType: "people",
        targetId: result.partyId,
        status: "executed",
        requiresConfirmation: true,
        requestPayload: details,
        resultPayload: { success: true, partyId: result.partyId },
      });

      void (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: "ai_action_exec",
        p_units: 1,
        p_description: `Assistant party creation: ${details.fullName}`,
      });

      return { success: true, message: result.message };
    }

    // 3. Create Ready Stock
    if (payload.actionType === "create_voucher" && details.itemType && details.grossWeight) {
      const result = await executeAssistantCreateStock(payload);
      if (!result.success) return result;

      await auditAssistantAction({
        actionKey: "execute_create_stock",
        actionType: "mutate",
        targetType: "inventory",
        targetId: result.tagId,
        status: "executed",
        requiresConfirmation: true,
        requestPayload: details,
        resultPayload: { success: true, tagId: result.tagId },
      });

      void (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: "ai_action_exec",
        p_units: 1,
        p_description: `Assistant inventory stock addition: ${result.tagId}`,
      });

      return { success: true, message: result.message };
    }

    // 4. Create Expense
    if (payload.actionType === "create_voucher" && details.expenseCategory && details.amount) {
      const result = await executeAssistantCreateExpense(payload);
      if (!result.success) return result;

      await auditAssistantAction({
        actionKey: "execute_create_expense",
        actionType: "mutate",
        targetType: "payments",
        targetId: result.expenseId,
        status: "executed",
        requiresConfirmation: true,
        requestPayload: details,
        resultPayload: { success: true, expenseId: result.expenseId },
      });

      void (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: "ai_action_exec",
        p_units: 1,
        p_description: `Assistant expense booking: ₹${details.amount}`,
      });

      return { success: true, message: result.message };
    }

    // 5. WhatsApp Send
    if (payload.actionType === "whatsapp_send") {
      const { notifyInvoiceReady } = await import("@/lib/comm/platform/avs-communication-platform");
      const phone = String(payload.recipientPhone ?? payload.details?.recipientPhone ?? "").trim();
      const result = await notifyInvoiceReady({
        branchId: String(payload.details?.branchId ?? "MAIN"),
        recipient: {
          name: String(payload.recipientName ?? payload.details?.recipientName ?? "Customer"),
          phone,
        },
        invoiceId: String(
          payload.details?.invoiceId ?? payload.targetId ?? `assistant_${Date.now()}`,
        ),
        invoiceNumber: String(payload.details?.invoiceNo ?? ""),
        amount: String(payload.details?.amount ?? ""),
        documentUrl: payload.details?.documentUrl ? String(payload.details.documentUrl) : undefined,
        channels: ["whatsapp"],
      });

      await auditAssistantAction({
        actionKey: "execute_whatsapp_send",
        actionType: "mutate",
        targetType: payload.targetType,
        targetId: payload.targetId,
        status: result.success ? "executed" : "failed",
        requiresConfirmation: true,
        requestPayload: payload.details,
        resultPayload: result,
        errorMessage: result.success ? undefined : result.errors.join("; "),
      });

      if (!result.success) {
        return {
          success: false,
          message:
            result.errors.join("; ") || "WhatsApp dispatch failed. Check communication settings.",
        };
      }

      void (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: "wa_utility",
        p_units: 1,
        p_description: `Assistant WhatsApp share to ${phone}`,
      });

      return {
        success: true,
        message: `WhatsApp message queued for ${payload.recipientName || "customer"} (${phone}).`,
      };
    }

    // Unwired action types must not report fake success.
    return {
      success: false,
      message: `Action "${payload.actionType}" is not wired for automatic execution. Open the relevant ERP screen or use the confirmation card.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Execution failed";
    await auditAssistantAction({
      actionKey: "execute_action_failed",
      actionType: "mutate",
      status: "failed",
      errorMessage: msg,
    });
    return { success: false, message: `Action failed: ${msg}` };
  }
}
