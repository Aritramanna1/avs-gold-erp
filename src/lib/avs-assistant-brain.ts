/**
 * AVS / Ornexa ERP assistant brain.
 *
 * The assistant is intentionally tool-first. It never fabricates ERP facts from
 * prompt text: supported answers come from Supabase/RLS reads or from explicit
 * draft cards that still require user confirmation before posting.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fineGoldMg, mgToGrams } from "@/lib/gold";
import { searchRemote, type SearchResult } from "@/lib/global-search";
import {
  fetchCreditNotes,
  fetchDebitNotes,
  fetchDeliveryChallans,
  fetchEstimates,
} from "@/lib/billing-documents-query";

const supabaseAny = supabase as any;

export type AIProvider = "cloudflare_ai_gateway" | "openai" | "anthropic";

export interface AssistantMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  erpCard?: ERPActionCard;
  tokensUsed?: number;
  createdAt: string;
}

export interface ERPActionCard {
  type:
    | "customer_balance"
    | "gold_book"
    | "followup_list"
    | "voucher_draft"
    | "production_queue"
    | "inventory_exceptions"
    | "document_register"
    | "search_results";
  title: string;
  summary: string;
  actionRoute?: string;
  data: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ProviderAdapterConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

type PersonRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  type: string | null;
  data: Record<string, any> | null;
};

type OrderRow = {
  id: string;
  data: Record<string, any> | null;
};

type JobCardRow = {
  id: string;
  status: string | null;
  data: Record<string, any> | null;
};

type WorkerTransactionRow = {
  kind: string | null;
  data: Record<string, any> | null;
};

export const AUTHORIZED_ERP_TOOLS: ToolDefinition[] = [
  {
    name: "get_customer_gold_balance",
    description: "Fetches customer cash and gold context from authorized firm records.",
    parameters: { query: { type: "string", description: "Customer name, phone, or party text" } },
  },
  {
    name: "get_gold_book_summary",
    description: "Returns a karigar/worker gold book balance breakdown from worker transactions.",
    parameters: { query: { type: "string", description: "Karigar/worker name or phone" } },
  },
  {
    name: "prepare_gold_issue_draft",
    description: "Prepares a draft Gold Issue slip for confirmation.",
    parameters: {
      query: { type: "string" },
      grossWeightGrams: { type: "number" },
      purityKarat: { type: "number" },
    },
  },
  {
    name: "get_daily_followups",
    description:
      "Lists overdue orders, overdue karigar jobs, pending customer approvals, and open support tickets.",
    parameters: {},
  },
  {
    name: "get_production_queue",
    description:
      "Summarizes live manufacturing jobs by status, overdue date, karigar, and order context.",
    parameters: {},
  },
  {
    name: "get_inventory_exceptions",
    description:
      "Finds stock and metal-control exceptions such as missing rates, reserved stock, and ageing items.",
    parameters: {},
  },
  {
    name: "search_erp_records",
    description:
      "Searches authorized Supabase/RLS-visible ERP records such as parties, branches, invoices, documents, stock, and tags.",
    parameters: {
      query: {
        type: "string",
        description: "Name, phone, invoice number, tag, barcode, branch, or document text",
      },
    },
  },
  {
    name: "get_document_register_summary",
    description:
      "Summarizes authorized billing document registers for printing/document follow-up: credit notes, debit notes, estimates, and delivery challans.",
    parameters: {
      query: {
        type: "string",
        description: "Optional document number, customer, invoice, estimate, or challan text",
      },
    },
  },
];

function makeMessage(content: string, erpCard?: ERPActionCard): AssistantMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content,
    erpCard,
    tokensUsed: 0,
    createdAt: new Date().toISOString(),
  };
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function extractSearchText(message: string) {
  return message
    .replace(
      /\b(balance|gold book|gold|book|followups?|overdue|customer|karigar|worker|for|of|show|tell|what|is|the|today|daily|issue|draft|prepare|search|find|open|record|records|document|documents|invoice|tag|barcode|branch|party)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractIssueArgs(message: string) {
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

async function auditAssistantAction(args: {
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

async function findPerson(query: string, types: string[]): Promise<PersonRow | null> {
  const q = query.trim();
  let request = supabase
    .from("people")
    .select("id,full_name,phone,type,data")
    .in("type", types)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (q) {
    const safe = q.replace(/[%_,]/g, " ");
    request = request.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as PersonRow[])[0] ?? null;
}

async function customerBalanceCard(userMessage: string): Promise<ERPActionCard | null> {
  const query = extractSearchText(userMessage);
  const person = await findPerson(query, ["customer", "firm_customer"]);
  if (!person) return null;

  const [ordersRes, invoicesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id,data")
      .filter("data->>customerId", "eq", person.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("invoices")
      .select("id,grand_total_paise,paid_paise,data")
      .filter("data->>customerId", "eq", person.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (invoicesRes.error) throw invoicesRes.error;

  const orders = ((ordersRes.data ?? []) as OrderRow[]).map((row) => row.data ?? {});
  const invoices = (invoicesRes.data ?? []) as Array<{
    grand_total_paise: number | null;
    paid_paise: number | null;
    data: Record<string, any> | null;
  }>;
  const openOrders = orders.filter(
    (order) => !["delivered", "cancelled"].includes(String(order.status ?? "").toLowerCase()),
  );
  const invoiceValuePaise = invoices.reduce(
    (sum, row) => sum + Number(row.grand_total_paise ?? 0),
    0,
  );
  const paidPaise = invoices.reduce(
    (sum, row) => sum + Number(row.paid_paise ?? row.data?.paidPaise ?? 0),
    0,
  );
  const goldAdvanceFineMg = orders.reduce(
    (sum, order) => sum + Number(order.advance?.goldFineMg ?? 0),
    0,
  );
  const outstandingPaise = Math.max(0, invoiceValuePaise - paidPaise);

  const card: ERPActionCard = {
    type: "customer_balance",
    title: `Customer balance: ${person.full_name ?? "Customer"}`,
    summary: `${openOrders.length} open orders, ${mgToGrams(goldAdvanceFineMg)} g fine gold advance, Rs. ${(outstandingPaise / 100).toFixed(2)} cash outstanding.`,
    actionRoute: `/people?selected=${person.id}`,
    data: {
      personId: person.id,
      name: person.full_name,
      phone: person.phone,
      openOrders: openOrders.length,
      invoiceValuePaise,
      paidPaise,
      outstandingPaise,
      goldAdvanceFineMg,
    },
  };
  await auditAssistantAction({
    actionKey: "get_customer_gold_balance",
    targetType: "people",
    targetId: person.id,
    requestPayload: { query },
    resultPayload: card.data,
  });
  return card;
}

async function goldBookCard(userMessage: string): Promise<ERPActionCard | null> {
  const query = extractSearchText(userMessage);
  const worker = await findPerson(query, ["karigar", "worker", "outside_worker", "employee"]);
  if (!worker) return null;

  const { data, error } = await supabase
    .from("worker_transactions")
    .select("kind,data")
    .or(`data->>workerId.eq.${worker.id},data->>karigarId.eq.${worker.id}`)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  let givenFineMg = 0;
  let returnedFineMg = 0;
  let givenGrossMg = 0;
  let returnedGrossMg = 0;
  for (const row of (data ?? []) as WorkerTransactionRow[]) {
    const payload = row.data ?? {};
    const fineMgValue =
      Number(payload.fineMg ?? 0) ||
      fineGoldMg(Number(payload.netMg ?? 0), Number(payload.purity ?? 0));
    const grossMg = Number(payload.grossMg ?? 0);
    const type = String(payload.type ?? row.kind ?? "").toLowerCase();
    if (type.includes("return")) {
      returnedFineMg += fineMgValue;
      returnedGrossMg += grossMg;
    } else {
      givenFineMg += fineMgValue;
      givenGrossMg += grossMg;
    }
  }
  const pendingFineMg = givenFineMg - returnedFineMg;
  const card: ERPActionCard = {
    type: "gold_book",
    title: `Gold book: ${worker.full_name ?? "Worker"}`,
    summary: `Pending fine balance ${mgToGrams(pendingFineMg)} g from ${mgToGrams(givenFineMg)} g issued and ${mgToGrams(returnedFineMg)} g returned.`,
    actionRoute: `/workshop/worker-book/${worker.id}`,
    data: {
      workerId: worker.id,
      workerName: worker.full_name,
      givenGrossMg,
      returnedGrossMg,
      givenFineMg,
      returnedFineMg,
      pendingFineMg,
    },
  };
  await auditAssistantAction({
    actionKey: "get_gold_book_summary",
    targetType: "people",
    targetId: worker.id,
    requestPayload: { query },
    resultPayload: card.data,
  });
  return card;
}

async function followupCard(): Promise<ERPActionCard> {
  const today = todayYmd();
  const [ordersRes, jobsRes, ticketsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id,data")
      .lt("data->>expectedDelivery", today)
      .not("data->>status", "in", "(delivered,cancelled)")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("job_cards")
      .select("id,status,data")
      .lt("data->>expectedDelivery", today)
      .not("status", "in", "(completed,cancelled,delivered,closed)")
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAny
      .from("platform_support_tickets")
      .select("id,ticket_no,subject,status,severity,firm_id")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (jobsRes.error) throw jobsRes.error;
  if (ticketsRes.error) throw ticketsRes.error;

  const overdueOrders = ((ordersRes.data ?? []) as OrderRow[]).map((row) => ({
    id: row.id,
    orderNo: row.data?.orderNo,
    expectedDelivery: row.data?.expectedDelivery,
    customerId: row.data?.customerId,
  }));
  const overdueJobs = ((jobsRes.data ?? []) as JobCardRow[]).map((row) => ({
    id: row.id,
    jobNo: row.data?.jobNo,
    orderNo: row.data?.orderNo,
    expectedDelivery: row.data?.expectedDelivery,
    karigarId: row.data?.karigarId,
    status: row.status ?? row.data?.status,
  }));
  const tickets = (ticketsRes.data ?? []) as Array<Record<string, any>>;

  const card: ERPActionCard = {
    type: "followup_list",
    title: "Daily operational follow-ups",
    summary: `${overdueOrders.length} overdue orders, ${overdueJobs.length} overdue job cards, ${tickets.length} open support tickets.`,
    actionRoute: "/reports/reminders",
    data: { date: today, overdueOrders, overdueJobs, tickets },
  };
  await auditAssistantAction({
    actionKey: "get_daily_followups",
    requestPayload: { date: today },
    resultPayload: card.data,
  });
  return card;
}

async function productionQueueCard(): Promise<ERPActionCard> {
  const today = todayYmd();
  const { data, error } = await supabase
    .from("job_cards")
    .select("id,status,data")
    .not("status", "in", "(completed,cancelled,delivered,closed)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const jobs = ((data ?? []) as JobCardRow[]).map((row) => ({
    id: row.id,
    jobNo: row.data?.jobNo,
    orderNo: row.data?.orderNo,
    customerName: row.data?.customerName,
    karigarName: row.data?.karigarName,
    status: row.status ?? row.data?.status ?? "unknown",
    expectedDelivery: row.data?.expectedDelivery,
    targetFineMg: Number(row.data?.targetFineMg ?? 0),
  }));
  const byStatus = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});
  const overdue = jobs.filter(
    (job) => job.expectedDelivery && String(job.expectedDelivery) < today,
  );
  const openFineMg = jobs.reduce((sum, job) => sum + job.targetFineMg, 0);

  const card: ERPActionCard = {
    type: "production_queue",
    title: "Production queue",
    summary: `${jobs.length} open job cards, ${overdue.length} overdue, ${mgToGrams(openFineMg)} g target fine in visible WIP.`,
    actionRoute: "/workshop",
    data: {
      date: today,
      totalOpenJobs: jobs.length,
      overdueJobs: overdue.slice(0, 25),
      byStatus,
      openFineMg,
    },
  };
  await auditAssistantAction({
    actionKey: "get_production_queue",
    requestPayload: { date: today },
    resultPayload: card.data,
  });
  return card;
}

async function inventoryExceptionsCard(): Promise<ERPActionCard> {
  const { data, error } = await supabase
    .from("inventory")
    .select("id,item_name,status,gross_mg,net_mg,purity,data")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const items = (
    (data ?? []) as Array<{
      id: string;
      item_name: string | null;
      status: string | null;
      gross_mg: number | null;
      net_mg: number | null;
      purity: number | null;
      data: Record<string, any> | null;
    }>
  ).map((row) => {
    const netMg = Number(row.net_mg ?? row.data?.netMg ?? row.data?.netWeightMg ?? 0);
    const purity = Number(row.purity ?? row.data?.purity ?? 0);
    return {
      id: row.id,
      name:
        row.item_name ??
        row.data?.itemName ??
        row.data?.name ??
        row.data?.designName ??
        "Stock item",
      status: row.status ?? row.data?.status ?? "unknown",
      grossMg: Number(row.gross_mg ?? row.data?.grossMg ?? row.data?.grossWeightMg ?? 0),
      fineMg: Number(row.data?.fineMg ?? row.data?.fineWeightMg ?? 0) || fineGoldMg(netMg, purity),
      ratePerGram: Number(row.data?.ratePerGram ?? row.data?.goldRatePerGram ?? 0),
      updatedAt: row.data?.updatedAt ?? row.data?.createdAt,
    };
  });
  const missingRate = items.filter((item) => item.status !== "sold" && item.ratePerGram <= 0);
  const reserved = items.filter((item) => String(item.status).toLowerCase() === "reserved");
  const available = items.filter((item) => String(item.status).toLowerCase() === "available");
  const availableFineMg = available.reduce((sum, item) => sum + item.fineMg, 0);

  const card: ERPActionCard = {
    type: "inventory_exceptions",
    title: "Inventory exceptions",
    summary: `${missingRate.length} visible stock items have no rate, ${reserved.length} are reserved, ${mgToGrams(availableFineMg)} g fine is visible as available stock.`,
    actionRoute: "/stock",
    data: {
      missingRate: missingRate.slice(0, 25),
      reserved: reserved.slice(0, 25),
      availableCount: available.length,
      availableFineMg,
    },
  };
  await auditAssistantAction({
    actionKey: "get_inventory_exceptions",
    requestPayload: {},
    resultPayload: card.data,
  });
  return card;
}

async function searchRecordsCard(userMessage: string): Promise<ERPActionCard | null> {
  const query = extractSearchText(userMessage) || userMessage.trim();
  if (query.length < 2) return null;

  const results = await searchRemote(query, 6);
  const grouped = results.reduce<Record<SearchResult["type"], number>>(
    (acc, result) => {
      acc[result.type] = (acc[result.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<SearchResult["type"], number>,
  );

  const card: ERPActionCard = {
    type: "search_results",
    title: `ERP search: ${query}`,
    summary:
      results.length === 0
        ? "No authorized matching records were found."
        : `${results.length} authorized result${results.length === 1 ? "" : "s"} found across ${Object.keys(grouped).join(", ")}.`,
    actionRoute: results[0]?.route,
    data: {
      query,
      resultCount: results.length,
      grouped,
      results: results.slice(0, 25),
    },
  };
  await auditAssistantAction({
    actionKey: "search_erp_records",
    actionType: "read",
    requestPayload: { query },
    resultPayload: { resultCount: results.length, grouped },
  });
  return card;
}

async function documentRegisterCard(userMessage: string): Promise<ERPActionCard> {
  const query = extractSearchText(userMessage);
  const [creditNotes, debitNotes, estimates, challans] = await Promise.all([
    fetchCreditNotes(query),
    fetchDebitNotes(query),
    fetchEstimates(query),
    fetchDeliveryChallans(query),
  ]);
  const draftEstimates = estimates.filter((estimate) => estimate.status === "draft");
  const openChallans = challans.filter((challan) => challan.status === "issued");
  const activeCreditNotes = creditNotes.filter((note) => note.status === "issued");
  const activeDebitNotes = debitNotes.filter((note) => note.status === "issued");

  const card: ERPActionCard = {
    type: "document_register",
    title: query ? `Document register: ${query}` : "Document register summary",
    summary: `${activeCreditNotes.length} issued credit notes, ${activeDebitNotes.length} issued debit notes, ${draftEstimates.length} draft estimates, ${openChallans.length} open delivery challans visible to you.`,
    actionRoute: "/billing",
    data: {
      query,
      creditNotes: activeCreditNotes.slice(0, 10).map((note) => ({
        id: note.id,
        number: note.creditNoteNo,
        customerName: note.customerName,
        amountPaise: note.amountPaise,
        route: `/billing/credit-notes/${note.id}`,
      })),
      debitNotes: activeDebitNotes.slice(0, 10).map((note) => ({
        id: note.id,
        number: note.debitNoteNo,
        customerName: note.customerName,
        amountPaise: note.amountPaise,
        route: `/billing/debit-notes/${note.id}`,
      })),
      estimates: draftEstimates.slice(0, 10).map((estimate) => ({
        id: estimate.id,
        number: estimate.estimateNo,
        customerName: estimate.customerName,
        amountPaise: estimate.grandTotalPaise,
        validUntilIso: estimate.validUntilIso,
        route: `/billing/estimate/${estimate.id}`,
      })),
      deliveryChallans: openChallans.slice(0, 10).map((challan) => ({
        id: challan.id,
        number: challan.challanNo,
        customerName: challan.customerName,
        purpose: challan.purpose,
        route: `/billing/delivery-challans/${challan.id}`,
      })),
    },
  };
  await auditAssistantAction({
    actionKey: "get_document_register_summary",
    actionType: "read",
    requestPayload: { query },
    resultPayload: {
      creditNotes: activeCreditNotes.length,
      debitNotes: activeDebitNotes.length,
      estimates: draftEstimates.length,
      deliveryChallans: openChallans.length,
    },
  });
  return card;
}

async function goldIssueDraftCard(userMessage: string): Promise<ERPActionCard | null> {
  const query = extractSearchText(userMessage);
  const worker = await findPerson(query, ["karigar", "worker", "outside_worker", "employee"]);
  const { grossWeightGrams, purityPerMille } = extractIssueArgs(userMessage);
  if (!worker || !grossWeightGrams || !purityPerMille) return null;
  const grossMg = Math.round(grossWeightGrams * 1000);
  const fineMg = fineGoldMg(grossMg, purityPerMille);
  const card: ERPActionCard = {
    type: "voucher_draft",
    title: `Draft gold issue: ${worker.full_name ?? "Worker"}`,
    summary: `Draft only: issue ${grossWeightGrams.toFixed(3)} g at ${purityPerMille} purity (${mgToGrams(fineMg)} g fine). Review before posting.`,
    actionRoute: "/workshop/gold-book",
    data: {
      workerId: worker.id,
      workerName: worker.full_name,
      grossMg,
      purity: purityPerMille,
      fineMg,
      requiresConfirmation: true,
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

export class ReplaceableAssistantBrain {
  private config: ProviderAdapterConfig;

  constructor(config: ProviderAdapterConfig) {
    this.config = config;
  }

  public getSystemPrompt(): string {
    return `You are the AVS Gold ERP Assistant for a jewellery manufacturing ERP.

Rules:
1. ERP facts must come from authorized tools and Supabase/RLS-visible records.
2. Never invent balances, overdue counts, customer details, karigar balances, or document numbers.
3. High-risk actions such as gold issue, receive, invoicing, settlement, and rate cuts are draft-only until the user explicitly confirms.
4. Use jewellery business language: fine gold, gross weight, touch, purity, karigar, wastage, ledger, voucher.
5. If a request is outside the supported ERP tools, explain the supported next step briefly.`;
  }

  public async generateResponse(
    messages: AssistantMessage[],
    onToolCall?: (name: string, args: Record<string, any>) => Promise<ERPActionCard | null>,
  ): Promise<AssistantMessage> {
    const userMessage = messages[messages.length - 1]?.content || "";
    const lower = userMessage.toLowerCase();

    try {
      let toolName: string | null = null;
      let card: ERPActionCard | null = null;
      if (lower.includes("follow") || lower.includes("overdue") || lower.includes("pending")) {
        toolName = "get_daily_followups";
        card = (await onToolCall?.(toolName, {})) ?? (await followupCard());
      } else if (
        lower.includes("production") ||
        lower.includes("manufacturing queue") ||
        lower.includes("job queue") ||
        lower.includes("wip")
      ) {
        toolName = "get_production_queue";
        card = (await onToolCall?.(toolName, {})) ?? (await productionQueueCard());
      } else if (
        lower.includes("inventory exception") ||
        lower.includes("stock exception") ||
        lower.includes("missing rate") ||
        lower.includes("reserved stock")
      ) {
        toolName = "get_inventory_exceptions";
        card = (await onToolCall?.(toolName, {})) ?? (await inventoryExceptionsCard());
      } else if (
        lower.includes("print") ||
        lower.includes("printing") ||
        lower.includes("estimate") ||
        lower.includes("quotation") ||
        lower.includes("challan") ||
        lower.includes("credit note") ||
        lower.includes("debit note")
      ) {
        toolName = "get_document_register_summary";
        card =
          (await onToolCall?.(toolName, { query: extractSearchText(userMessage) })) ??
          (await documentRegisterCard(userMessage));
      } else if (
        lower.includes("search") ||
        lower.includes("find") ||
        lower.includes("open") ||
        lower.includes("document") ||
        lower.includes("invoice") ||
        lower.includes("tag") ||
        lower.includes("barcode") ||
        lower.includes("party") ||
        lower.includes("branch")
      ) {
        toolName = "search_erp_records";
        card =
          (await onToolCall?.(toolName, { query: extractSearchText(userMessage) })) ??
          (await searchRecordsCard(userMessage));
      } else if (lower.includes("issue") && lower.includes("gold")) {
        toolName = "prepare_gold_issue_draft";
        card =
          (await onToolCall?.(toolName, { query: extractSearchText(userMessage) })) ??
          (await goldIssueDraftCard(userMessage));
      } else if (lower.includes("gold book") || lower.includes("karigar balance")) {
        toolName = "get_gold_book_summary";
        card =
          (await onToolCall?.(toolName, { query: extractSearchText(userMessage) })) ??
          (await goldBookCard(userMessage));
      } else if (lower.includes("balance") || lower.includes("outstanding")) {
        toolName = "get_customer_gold_balance";
        card =
          (await onToolCall?.(toolName, { query: extractSearchText(userMessage) })) ??
          (await customerBalanceCard(userMessage));
      }

      if (card) {
        return makeMessage("I checked the authorized ERP records and prepared this result.", card);
      }

      await auditAssistantAction({
        actionKey: toolName ?? "assistant.unsupported_request",
        actionType: "message",
        status: "executed",
        requiresConfirmation: false,
        requestPayload: {
          message: userMessage,
          provider: this.config.provider,
          model: this.config.model,
        },
        resultPayload: { supported: false },
      });

      return makeMessage(
        "I can currently search authorized ERP records, check customer balances, karigar gold books, document/printing registers, daily follow-ups, production queues, inventory exceptions, and prepare draft gold issue cards. Ask using a customer, karigar, document, tag, barcode, or branch reference when the tool needs one.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assistant tool failed.";
      await auditAssistantAction({
        actionKey: "assistant.tool_error",
        actionType: "message",
        status: "failed",
        requiresConfirmation: false,
        requestPayload: { message: userMessage },
        errorMessage: message,
      });
      return makeMessage(`I could not complete that assistant check: ${message}`);
    }
  }
}
