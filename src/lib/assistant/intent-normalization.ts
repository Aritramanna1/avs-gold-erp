/**
 * Intent Normalization Pipeline
 * Raw User Text → Language → Typo Normalization → Terminology → Entity Resolution → Intent
 */
import { detectLanguage, normalizeUserText, type DetectedLanguage } from "./language-understanding";
import { resolvePartyEntities, type EntityResolutionResult } from "./entity-resolver";
import { searchKnowledgeRepository, type KnowledgeSearchResult } from "./knowledge-repository";
import { getTenantAliasMap } from "./language-aliases-store";
import { resolveTenantTerminology } from "./tenant-terminology-resolver";
import type { IntentMatchResult } from "./assistant-types";

export interface NormalizedQuery {
  rawText: string;
  normalizedText: string;
  detectedLanguage: DetectedLanguage;
  corrections: Array<{ from: string; to: string }>;
  entityResolution: EntityResolutionResult | null;
  knowledgeHits: KnowledgeSearchResult[];
  intent: IntentMatchResult;
  isConversational: boolean;
  isKnowledgeQuery: boolean;
  isLiveDataQuery: boolean;
}

const CONVERSATIONAL_PATTERNS: RegExp[] = [
  /^(hi|hello|hey|good\s+(morning|afternoon|evening)|namaste|namaskar)\b/i,
  /^how are you/i,
  /^(ok|okay|thanks|thank you|got it|theek hai|thik hai)\b/i,
  /^what can you do/i,
  /^who are you/i,
  /^explain (this|that) simply/i,
  /^my name is /i,
  /^call me /i,
  /what is (the )?(date|time|day)/i,
  /what('s| is) my name/i,
  /where am i/i,
  /current screen/i,
];

const KNOWLEDGE_PATTERNS: RegExp[] = [
  /^what (is|does|are)\b/i,
  /^how (do|does|can|to)\b/i,
  /^where (can|do)\b/i,
  /^explain\b/i,
  /\bmeaning of\b/i,
  /\bdefinition of\b/i,
  /\bdifference between\b/i,
  /\btell me about\b/i,
  /\bwhat does .+ mean\b/i,
];

const LIVE_DATA_PATTERNS: RegExp[] = [
  /\b(show|find|search|get|tell me|display|list)\b/i,
  /\b(balance|outstanding|position|gold book|ledger)\b/i,
  /\bwhere is my gold\b/i,
  /\bhow much\b/i,
  /\boverdue\b/i,
  /\binvoice\s*#?\s*\d/i,
];

function classifyConversational(text: string): boolean {
  return CONVERSATIONAL_PATTERNS.some((p) => p.test(text.trim()));
}

function classifyKnowledgeQuery(text: string): boolean {
  return KNOWLEDGE_PATTERNS.some((p) => p.test(text.trim()));
}

function classifyLiveDataQuery(text: string): boolean {
  return LIVE_DATA_PATTERNS.some((p) => p.test(text.trim()));
}

/**
 * Resolve jewellery terminology using canonical term keys from terminology engine.
 * Maps display terms back to canonical intent tokens.
 */
function resolveJewelleryTerms(text: string): string {
  const termMap: Record<string, string> = {
    bhav: "metal rate",
    karigar: "karigar",
    jama: "metal receipt",
    udhar: "outstanding",
    hisab: "settlement",
    ghat: "wastage",
    nikasi: "issue",
    sona: "gold",
    khata: "party ledger",
    mahajan: "supplier",
    grahak: "customer",
    dhalai: "melting",
    saaf: "refining",
    halmark: "hallmark",
    hallmark: "hallmark",
    "purana sona": "old gold",
    purana: "old gold",
  };

  let result = text;
  for (const [term, canonical] of Object.entries(termMap)) {
    const re = new RegExp(`\\b${term}\\b`, "gi");
    result = result.replace(re, canonical);
  }
  return result;
}

/** Core intent classifier — operates on normalized text */
export function classifyIntent(normalizedText: string, rawText: string): IntentMatchResult {
  const q = normalizedText.toLowerCase().trim();

  // Conversational
  if (/^(hi|hello|hey|good morning|good afternoon|namaste)\b/.test(q)) {
    return { toolName: "conversation_greeting", confidence: 1.0 };
  }
  if (q === "how are you" || q === "how are you doing" || q === "kaise ho") {
    return { toolName: "conversation_how_are_you", confidence: 1.0 };
  }
  if (q.includes("what can you do") || q === "help" || q.includes("who are you")) {
    return { toolName: "conversation_capabilities", confidence: 0.95 };
  }
  if (/^(ok|okay|thanks|thank you|got it|theek hai)\b/.test(q)) {
    return { toolName: "conversation_acknowledgement", confidence: 1.0 };
  }
  if (q.includes("explain") && (q.includes("simply") || q.includes("simple"))) {
    return {
      toolName: "conversation_explain_simply",
      confidence: 0.9,
      entities: { query: rawText },
    };
  }

  // Knowledge / FAQ — prefer knowledge base for definitional questions
  if (classifyKnowledgeQuery(q)) {
    return {
      toolName: "query_knowledge_base",
      confidence: 0.97,
      entities: { query: normalizedText },
    };
  }

  // Action drafts
  if (/\b(create|add|new)\b.*\b(customer|party)\b/.test(q)) {
    return { toolName: "action_create_party", confidence: 0.95 };
  }
  if (/\b(create|add|new)\b.*\border\b/.test(q)) {
    return { toolName: "action_create_order", confidence: 0.95 };
  }
  if (/\b(create|add|new)\b.*\b(invoice|bill)\b/.test(q)) {
    return { toolName: "action_create_invoice", confidence: 0.95 };
  }
  if (/\b(create|add|new)\b.*\b(job|job card)\b/.test(q)) {
    return { toolName: "action_create_job", confidence: 0.95 };
  }
  if (/\b(create|add|book)\b.*\bexpense\b/.test(q)) {
    return { toolName: "action_create_expense", confidence: 0.95 };
  }


  // HIGH-RISK payment / settlement PREPARE (never auto EXECUTE)
  if (
    /\b(prepare|draft|make)\b.*\bpayment\b/.test(q) ||
    /\b(pay|receive)\b.*\b(rs|rupees|inr|₹)\b/.test(q) ||
    /\brecord\s+payment\b/.test(q) ||
    /\bprepare\s+payment\b/.test(q)
  ) {
    return { toolName: "prepare_payment_draft", confidence: 0.94, entities: { query: normalizedText } };
  }
  if (
    /\b(prepare|draft|make|finalize)\b.*\bsettlement\b/.test(q) ||
    /\bkarigar\s+(hisab|settlement)\b/.test(q) ||
    /\bprepare\s+settlement\b/.test(q)
  ) {
    return { toolName: "prepare_settlement_draft", confidence: 0.94, entities: { query: normalizedText } };
  }

  // Gold issue/receive (typo-tolerant after normalization)
  if (/\b(issue|give|transfer)\b.*\b(gold|metal)\b/.test(q) || q.includes("issue gold")) {
    return {
      toolName: "prepare_gold_issue_draft",
      confidence: 0.92,
      entities: { query: normalizedText },
    };
  }
  if (/\b(receive|return|get back)\b.*\b(gold|metal)\b/.test(q) || q.includes("receive gold")) {
    return { toolName: "action_receive_gold", confidence: 0.92 };
  }

  // Support
  if (/\b(create|open|report)\b.*\b(ticket|support|bug)\b/.test(q)) {
    return {
      toolName: "create_support_ticket",
      confidence: 0.96,
      entities: { query: normalizedText },
    };
  }

  // Where is my gold
  if (
    q.includes("where is my gold") ||
    q.includes("gold breakdown") ||
    q.includes("gold location") ||
    q.includes("gold distribution") ||
    (q.includes("where") && q.includes("gold") && !q.includes("karigar"))
  ) {
    return { toolName: "GetWhereIsMyGold", confidence: 0.98 };
  }

  // Net gold position
  if (q.includes("gold position") || q.includes("net gold") || q.includes("gold exposure")) {
    return { toolName: "GetGoldPosition", confidence: 0.95 };
  }

  // Party 360 dossier (full ledger + orders + outstanding)
  if (
    q.includes("party 360") ||
    q.includes("party360") ||
    q.includes("360") ||
    q.includes("dossier") ||
    q.includes("party overview") ||
    q.includes("party profile") ||
    (q.includes("khata") && (q.includes("party") || q.includes("customer") || q.includes("full")))
  ) {
    return {
      toolName: "GetParty360",
      confidence: 0.96,
      entities: { query: normalizedText },
    };
  }

  // Party-specific gold (with entity name)
  if (
    (q.includes("gold") || q.includes("balance") || q.includes("ledger")) &&
    (q.includes("customer") ||
      q.includes("party") ||
      q.includes("jeweller") ||
      q.includes("dealer") ||
      /\b\w+\s+\w+/.test(q))
  ) {
    // If mentions karigar specifically
    if (q.includes("karigar") || q.includes("worker")) {
      return {
        toolName: "GetKarigarGoldBalance",
        confidence: 0.93,
        entities: { query: normalizedText },
      };
    }
    return {
      toolName: "GetCustomerGoldBalance",
      confidence: 0.9,
      entities: { query: normalizedText },
    };
  }

  // Karigar gold book
  if (
    q.includes("karigar") ||
    q.includes("worker gold") ||
    q.includes("gold book") ||
    q.includes("bench gold")
  ) {
    return {
      toolName: "GetKarigarGoldBalance",
      confidence: 0.93,
      entities: { query: normalizedText },
    };
  }

  // Job timeline
  if (q.includes("timeline") || q.includes("job stage") || q.includes("production progress")) {
    return { toolName: "GetJobTimeline", confidence: 0.94, entities: { query: normalizedText } };
  }

  // Jobs
  if (
    q.includes("job") ||
    q.includes("production") ||
    q.includes("manufacturing") ||
    q.includes("wip")
  ) {
    return { toolName: "SearchJobs", confidence: 0.9, entities: { query: normalizedText } };
  }

  // Outstanding
  if (
    q.includes("outstanding") ||
    q.includes("ageing") ||
    q.includes("receivable") ||
    q.includes("unpaid") ||
    q.includes("udhar")
  ) {
    return { toolName: "GetOutstanding", confidence: 0.96, entities: { query: normalizedText } };
  }

  // Stock
  if (
    q.includes("stock") ||
    q.includes("ready") ||
    q.includes("inventory") ||
    q.includes("bangle") ||
    q.includes("necklace")
  ) {
    return { toolName: "SearchReadyStock", confidence: 0.88, entities: { query: normalizedText } };
  }

  // Invoices
  if (q.includes("invoice") || q.includes("bill") || q.includes("challan")) {
    return { toolName: "SearchInvoices", confidence: 0.88, entities: { query: normalizedText } };
  }

  // Catalogue
  if (q.includes("catalogue") || q.includes("catalog") || q.includes("design")) {
    return { toolName: "SearchCatalogue", confidence: 0.88, entities: { query: normalizedText } };
  }

  // WhatsApp
  if ((q.includes("whatsapp") || q.includes("send invoice")) && q.includes("invoice")) {
    return {
      toolName: "prepare_whatsapp_invoice_action",
      confidence: 0.9,
      entities: { query: normalizedText },
    };
  }

  // General search
  if (q.includes("search") || q.includes("find") || q.includes("show")) {
    return { toolName: "SearchParty", confidence: 0.75, entities: { query: normalizedText } };
  }

  // Try knowledge as fallback for unrecognized queries
  const knowledgeHits = searchKnowledgeRepository(normalizedText, { limit: 1 });
  if (knowledgeHits.length > 0 && knowledgeHits[0].score >= 10) {
    return {
      toolName: "query_knowledge_base",
      confidence: 0.7,
      entities: { query: normalizedText },
    };
  }

  return { toolName: "fallback_unsupported", confidence: 0.1, entities: { query: rawText } };
}

export async function normalizeIntent(rawText: string): Promise<NormalizedQuery> {
  const tenantAliases = await getTenantAliasMap();
  const detectedLanguage = detectLanguage(rawText);
  const { normalized: typoNormalized, corrections } = normalizeUserText(rawText, { tenantAliases });
  const jewelleryResolved = resolveJewelleryTerms(typoNormalized);
  const normalizedText = resolveTenantTerminology(jewelleryResolved);

  const knowledgeHits = searchKnowledgeRepository(normalizedText, {
    limit: 3,
    tenantAliases,
    language: detectedLanguage,
  });

  const isConversational =
    classifyConversational(rawText) || classifyConversational(normalizedText);
  const isKnowledgeQuery =
    classifyKnowledgeQuery(normalizedText) ||
    (knowledgeHits.length > 0 &&
      knowledgeHits[0].score >= 12 &&
      !classifyLiveDataQuery(normalizedText));
  const isLiveDataQuery = classifyLiveDataQuery(normalizedText);

  let entityResolution: EntityResolutionResult | null = null;
  if (isLiveDataQuery || /\b(show|find|gold|balance|ledger)\b/i.test(normalizedText)) {
    entityResolution = await resolvePartyEntities(normalizedText);
  }

  const intent = classifyIntent(normalizedText, rawText);

  return {
    rawText,
    normalizedText,
    detectedLanguage,
    corrections,
    entityResolution,
    knowledgeHits,
    intent,
    isConversational,
    isKnowledgeQuery,
    isLiveDataQuery,
  };
}

export async function auditIntentNormalization(normalized: NormalizedQuery): Promise<void> {
  try {
    const { dataProvider: supabase } = await import("@/lib/providers/data-provider");
    await supabase.from("assistant_intent_audit" as never).insert({
      raw_text: normalized.rawText,
      normalized_text: normalized.normalizedText,
      detected_language: normalized.detectedLanguage,
      resolved_intent: normalized.intent.toolName,
      resolved_tool: normalized.intent.toolName,
      entity_candidates: normalized.entityResolution?.candidates ?? [],
      knowledge_hits: normalized.knowledgeHits.map((h) => ({
        id: h.article.id,
        title: h.article.title,
        score: h.score,
      })),
    } as never);
  } catch {
    // Best-effort audit
  }
}
