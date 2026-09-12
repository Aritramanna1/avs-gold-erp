/**
 * Ornexa AI Provider Service
 * Compliant with AI_RUNTIME_ARCHITECTURE.md (Layer 1 Local + Layer 2 Cloud LLM + Metering + Fallbacks)
 */

import type {
  AIProvider,
  AssistantMessage,
  ERPActionCard,
  ProviderAdapterConfig,
  IntentMatchResult,
} from "./assistant-types";
import {
  toolGetWhereIsMyGold,
  toolGetGoldPosition,
  toolGetKarigarGoldBalance,
  toolGetCustomerGoldBalance,
  toolSearchParty,
  toolGetParty360,
  toolSearchJobs,
  toolGetJobTimeline,
  toolSearchReadyStock,
  toolSearchInvoices,
  toolGetOutstanding,
  toolGetDocument,
  toolSearchCatalogue,
  toolPrepareGoldIssueDraft,
  toolPreparePaymentDraft,
  toolPrepareSettlementDraft,
  toolPrepareWhatsAppInvoiceAction,
  toolCreateSupportTicket,
  toolQueryKnowledgeBase,
  auditAssistantAction,
  extractSearchQuery,
} from "./assistant-tool-registry";
import { toolOpenRoute, looksLikeNavigateIntent } from "./tool-open-route";
import { deductCredits, checkServiceCreditAvailability } from "./credit-engine";
import { prepareMultimodalDraftCard } from "./multimodal-service";

import {
  getGreeting,
  getAcknowledgement,
  getHowAreYouResponse,
  getCapabilityExplanation,
  getInsufficientKnowledgeResponse,
  getExplainSimplyPrompt,
} from "./conversation-library/responses";

import {
  getActiveDraft,
  processDraftInput,
  startActionDraft,
} from "./conversational-action-engine";

import {
  getContextBudget,
  answerGeneralQuestion,
  resolvePronouns,
  updateEntityMemory,
  getPendingDisambiguation,
  setPendingDisambiguation,
  clearPendingDisambiguation,
} from "./assistant-context-engine";

import { normalizeIntent, auditIntentNormalization } from "./intent-normalization";
import {
  formatKnowledgeAnswer,
  hydrateKnowledgeRepository,
  toKnowledgeSourceRef,
} from "./knowledge-repository";
import { ensureLanguageAliasesLoaded } from "./language-aliases-store";
import {
  formatDisambiguationPrompt,
  resolveDisambiguationChoice,
  type EntityResolutionResult,
} from "./entity-resolver";
import type { KnowledgeSourceRef } from "./assistant-types";

const USAGE_STORAGE_KEY = "ornexa_assistant_daily_usage";

export interface AssistantUsageMetrics {
  date: string;
  queryCount: number;
  tokensUsed: number;
  costInr: number;
}

export function getTodayUsageMetrics(): AssistantUsageMetrics {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    const today = new Date().toISOString().split("T")[0];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) return parsed;
    }
    return { date: today, queryCount: 0, tokensUsed: 0, costInr: 0 };
  } catch {
    return {
      date: new Date().toISOString().split("T")[0],
      queryCount: 0,
      tokensUsed: 0,
      costInr: 0,
    };
  }
}

export function incrementUsageMetrics(tokens: number = 0, costInr: number = 0) {
  try {
    const current = getTodayUsageMetrics();
    current.queryCount += 1;
    current.tokensUsed += tokens;
    current.costInr += costInr;
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage issues
  }
}

/**
 * Fast Query Router & Intent Classifier
 * Categorizes queries into: Navigation, Help/Knowledge, Search, Read Data, Draft Action, or Complex Reasoning.
 */
export function matchLocalIntent(userQuery: string): IntentMatchResult {
  const q = userQuery.toLowerCase().trim();

  // 0. Natural Conversation & Small Talk
  if (
    q === "hi" ||
    q === "hello" ||
    q === "hey" ||
    q === "good morning" ||
    q === "good afternoon"
  ) {
    return { toolName: "conversation_greeting", confidence: 1.0 };
  }

  if (q === "how are you" || q === "how are you doing") {
    return { toolName: "conversation_how_are_you", confidence: 1.0 };
  }

  if (q.includes("what can you do") || q.includes("who are you") || q.includes("help")) {
    return { toolName: "conversation_capabilities", confidence: 0.9 };
  }

  if (q === "ok" || q === "okay" || q === "thanks" || q === "thank you" || q === "got it") {
    return { toolName: "conversation_acknowledgement", confidence: 1.0 };
  }


  // AVS-67 — NL navigate / openRoute (AVS-4 hubs only)
  if (looksLikeNavigateIntent(q)) {
    return {
      toolName: "openRoute",
      confidence: 0.97,
      entities: { query: userQuery },
    };
  }

  // 0.5. Universal Action Engine Triggers
  if (
    q.includes("create customer") ||
    q.includes("add customer") ||
    q.includes("new customer") ||
    q.includes("create a customer")
  ) {
    return { toolName: "action_create_party", confidence: 1.0 };
  }
  if (
    q.includes("create order") ||
    q.includes("add order") ||
    q.includes("new order") ||
    q.includes("create an order")
  ) {
    return { toolName: "action_create_order", confidence: 1.0 };
  }
  if (
    q.includes("create ready stock") ||
    q.includes("add stock") ||
    q.includes("inward stock") ||
    q.includes("new stock")
  ) {
    return { toolName: "action_create_ready_stock", confidence: 1.0 };
  }
  if (
    q.includes("create expense") ||
    q.includes("add expense") ||
    q.includes("book expense") ||
    q.includes("new expense")
  ) {
    return { toolName: "action_create_expense", confidence: 1.0 };
  }
  if (q.includes("create job") || q.includes("assign job") || q.includes("new job")) {
    return { toolName: "action_create_job", confidence: 1.0 };
  }
  if (
    q.includes("prepare payment") ||
    q.includes("draft payment") ||
    q.includes("record payment") ||
    (q.includes("pay") && (q.includes("rs") || q.includes("rupee") || q.includes("inr") || q.includes("₹")))
  ) {
    return { toolName: "prepare_payment_draft", confidence: 0.94, entities: { query: userQuery } };
  }
  if (
    q.includes("prepare settlement") ||
    q.includes("draft settlement") ||
    q.includes("karigar settlement") ||
    q.includes("karigar hisab")
  ) {
    return { toolName: "prepare_settlement_draft", confidence: 0.94, entities: { query: userQuery } };
  }

  if (q.includes("issue gold") || q.includes("transfer gold") || q.includes("give gold")) {
    return { toolName: "action_issue_gold", confidence: 1.0 };
  }
  if (q.includes("receive gold") || q.includes("take gold") || q.includes("get gold back")) {
    return { toolName: "action_receive_gold", confidence: 1.0 };
  }
  if (
    q.includes("create invoice") ||
    q.includes("make invoice") ||
    q.includes("generate invoice") ||
    q.includes("new bill")
  ) {
    return { toolName: "action_create_invoice", confidence: 1.0 };
  }

  // 1. Knowledge / SOP / How-to / Terminology questions
  if (
    q.startsWith("how to") ||
    q.startsWith("how do i") ||
    q.startsWith("what is") ||
    q.startsWith("what does") ||
    q.startsWith("where can i configure") ||
    q.includes("explain") ||
    q.includes("meaning of") ||
    q.includes("definition") ||
    q.includes("sop") ||
    q.includes("faq")
  ) {
    return { toolName: "query_knowledge_base", confidence: 0.98, entities: { query: userQuery } };
  }

  // 2. Support Ticket
  if (
    q.includes("create ticket") ||
    q.includes("report issue") ||
    q.includes("create a ticket") ||
    q.includes("report a bug") ||
    q.includes("support ticket")
  ) {
    return {
      toolName: "create_support_ticket",
      confidence: 0.96,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 3. Where is my gold
  if (
    q.includes("where is my gold") ||
    q.includes("gold breakdown") ||
    q.includes("gold location") ||
    q.includes("gold distribution") ||
    q.includes("total gold") ||
    (q.includes("where") && q.includes("gold"))
  ) {
    return { toolName: "GetWhereIsMyGold", confidence: 0.98, entities: {} };
  }

  // 4. Net Gold Position
  if (
    q.includes("gold position") ||
    q.includes("net gold") ||
    q.includes("gold exposure") ||
    q.includes("firm gold balance")
  ) {
    return { toolName: "GetGoldPosition", confidence: 0.95, entities: {} };
  }

  // 5. Karigar Gold Balance
  if (
    q.includes("karigar") ||
    q.includes("worker gold") ||
    q.includes("gold book") ||
    q.includes("worker custody") ||
    q.includes("bench gold")
  ) {
    return {
      toolName: "GetKarigarGoldBalance",
      confidence: 0.95,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 6. Safe Gold Issue Draft
  if (
    (q.includes("issue") || q.includes("give") || q.includes("draft issue")) &&
    (q.includes("gold") || q.includes("gm") || q.includes("gram") || q.includes("k"))
  ) {
    return {
      toolName: "prepare_gold_issue_draft",
      confidence: 0.92,
      entities: { query: userQuery },
    };
  }

  // 7. WhatsApp Invoice Send
  if (
    (q.includes("whatsapp") || q.includes("send invoice") || q.includes("share bill")) &&
    (q.includes("invoice") || q.includes("bill") || q.includes("customer"))
  ) {
    return {
      toolName: "prepare_whatsapp_invoice_action",
      confidence: 0.92,
      entities: { query: userQuery },
    };
  }

  // 8. Job Timeline
  if (
    q.includes("timeline") ||
    q.includes("job stage") ||
    q.includes("production progress") ||
    (q.includes("history") && q.includes("job"))
  ) {
    return {
      toolName: "GetJobTimeline",
      confidence: 0.94,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 9. Search Jobs / Production Queue
  if (
    q.includes("job") ||
    q.includes("production") ||
    q.includes("manufacturing") ||
    q.includes("wip") ||
    q.includes("overdue job")
  ) {
    return {
      toolName: "SearchJobs",
      confidence: 0.92,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 10. Outstanding Receivables / Ageing
  if (
    q.includes("outstanding") ||
    q.includes("ageing") ||
    q.includes("receivable") ||
    q.includes("due payment") ||
    q.includes("pending payment") ||
    q.includes("unpaid")
  ) {
    return {
      toolName: "GetOutstanding",
      confidence: 0.96,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 11. Search Ready Stock
  if (
    q.includes("stock") ||
    q.includes("ready") ||
    q.includes("inventory") ||
    q.includes("bangles") ||
    q.includes("necklace") ||
    q.includes("ring") ||
    q.includes("chain") ||
    q.includes("earring")
  ) {
    return {
      toolName: "SearchReadyStock",
      confidence: 0.9,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 12. Search Invoices
  if (q.includes("invoice") || q.includes("bill") || q.includes("challan") || q.includes("sales")) {
    return {
      toolName: "SearchInvoices",
      confidence: 0.9,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 13a. Party 360 dossier
  if (
    q.includes("party 360") ||
    q.includes("party360") ||
    q.includes("360") ||
    q.includes("dossier") ||
    q.includes("party overview") ||
    q.includes("party profile") ||
    (q.includes("khata") && (q.includes("full") || q.includes("party") || q.includes("customer")))
  ) {
    return {
      toolName: "GetParty360",
      confidence: 0.96,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 13. Customer Balance / Dossier
  if (
    q.includes("customer") ||
    q.includes("balance") ||
    q.includes("party") ||
    q.includes("dealer") ||
    q.includes("client")
  ) {
    return {
      toolName: "GetCustomerGoldBalance",
      confidence: 0.88,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 14. Catalogue
  if (
    q.includes("catalogue") ||
    q.includes("catalog") ||
    q.includes("design") ||
    q.includes("collection")
  ) {
    return {
      toolName: "SearchCatalogue",
      confidence: 0.88,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 15. General Search Fallback
  if (q.includes("search") || q.includes("find")) {
    return {
      toolName: "SearchParty",
      confidence: 0.75,
      entities: { query: extractSearchQuery(userQuery) },
    };
  }

  // 16. Unsupported / Unknown
  return { toolName: "fallback_unsupported", confidence: 0.1, entities: { query: userQuery } };
}

/**
 * Execute ERP Tool by Identifier with RBAC & Context
 */
export async function executeERPTool(
  toolName: string,
  userMessage: string,
  userRole: string = "Owner",
): Promise<ERPActionCard | null> {
  const isWorker =
    userRole.toLowerCase().includes("karigar") || userRole.toLowerCase().includes("worker");
  if (isWorker && ["GetGoldPosition", "GetOutstanding"].includes(toolName)) {
    throw new Error("You do not have permission to view firm financial and net exposure records.");
  }

  switch (toolName) {
    case "GetWhereIsMyGold":
      return toolGetWhereIsMyGold();
    case "GetGoldPosition":
      return toolGetGoldPosition();
    case "GetKarigarGoldBalance":
      return toolGetKarigarGoldBalance(userMessage);
    case "GetCustomerGoldBalance":
      return toolGetCustomerGoldBalance(userMessage);
    case "SearchParty":
      return toolSearchParty(userMessage);
    case "GetParty360":
      return toolGetParty360(userMessage);
    case "SearchJobs":
      return toolSearchJobs(userMessage);
    case "GetJobTimeline":
      return toolGetJobTimeline(userMessage);
    case "SearchReadyStock":
      return toolSearchReadyStock(userMessage);
    case "SearchInvoices":
      return toolSearchInvoices(userMessage);
    case "GetOutstanding":
      return toolGetOutstanding(userMessage);
    case "GetDocument":
      return toolGetDocument(userMessage);
    case "SearchCatalogue":
      return toolSearchCatalogue(userMessage);
    case "create_support_ticket":
      return toolCreateSupportTicket(userMessage);
    case "query_knowledge_base":
      return toolQueryKnowledgeBase(userMessage);
    case "prepare_gold_issue_draft":
      return toolPrepareGoldIssueDraft(userMessage);
    case "prepare_whatsapp_invoice_action":
      return toolPrepareWhatsAppInvoiceAction(userMessage);
    case "openRoute":
      return toolOpenRoute(userMessage);
    case "prepare_payment_draft":
      return toolPreparePaymentDraft(userMessage);
    case "prepare_settlement_draft":
      return toolPrepareSettlementDraft(userMessage);
    default:
      return toolSearchParty(userMessage);
  }
}

/**
 * Process Assistant Query (Supports Text, Attached Files, Screen Context, Credits, Fallbacks)
 * Pipeline: Raw Text → Language Detection → Typo Normalization → Terminology → Entity Resolution → Intent → Tool
 */
export async function processAssistantQuery(
  userQuery: string,
  config: ProviderAdapterConfig,
  userRole: string = "Owner",
  attachmentFileName?: string,
  activeRouteContext?: string,
): Promise<AssistantMessage> {
  // Pre-load knowledge + aliases (lazy, cached)
  void hydrateKnowledgeRepository();
  void ensureLanguageAliasesLoaded();

  const todayMetrics = getTodayUsageMetrics();

  // If user attached a file (multimodal flow)
  if (attachmentFileName) {
    const card = await prepareMultimodalDraftCard(attachmentFileName, userQuery);
    return {
      id: `msg_${Date.now()}_mm`,
      role: "assistant",
      content: card.summary,
      erpCard: card,
      toolName: "multimodal_action",
      tokensUsed: 0,
      provider: config.provider,
      createdAt: new Date().toISOString(),
    };
  }

  // Inject Context Engine
  const activeContext = getContextBudget({ role: userRole });
  const resolvedQuery = resolvePronouns(userQuery);

  // Check Local Intelligence for General Questions (Date/Time/Identity)
  const generalAnswer = answerGeneralQuestion(resolvedQuery, activeContext);
  if (generalAnswer) {
    return {
      id: `msg_${Date.now()}_general`,
      role: "assistant",
      content: generalAnswer,
      toolName: "general_intelligence",
      tokensUsed: 0,
      provider: "local",
      createdAt: new Date().toISOString(),
    };
  }

  // Active Draft Flow
  if (getActiveDraft()) {
    const draftResult = processDraftInput(resolvedQuery);
    if (draftResult.executePayload) {
      const { executeConfirmedAction } = await import("./assistant-tool-registry");
      const exec = await executeConfirmedAction(draftResult.executePayload);
      return {
        id: `msg_${Date.now()}_draft_exec`,
        role: "assistant",
        content: exec.message,
        toolName: "execute_draft",
        tokensUsed: 0,
        provider: config.provider,
        createdAt: new Date().toISOString(),
      };
    }
    return {
      id: `msg_${Date.now()}_draft`,
      role: "assistant",
      content: draftResult.reply,
      erpCard: draftResult.card,
      toolName: "process_draft",
      tokensUsed: 0,
      provider: config.provider,
      createdAt: new Date().toISOString(),
    };
  }

  // Continue pending party disambiguation (user replied with number or name)
  const pending = getPendingDisambiguation();
  if (pending) {
    const chosen = resolveDisambiguationChoice(resolvedQuery, pending.candidates);
    if (chosen) {
      clearPendingDisambiguation();
      updateEntityMemory("lastMentionedParty", chosen.name);
      const queryWithParty = `${chosen.name} ${pending.originalQuery}`.trim();
      try {
        const card = await executeERPTool(pending.pendingToolName, queryWithParty, userRole);
        const responseContent = card?.summary ?? `Here are the records for **${chosen.name}**.`;
        return buildAssistantMessage({
          content: card?.data?.primaryContent
            ? `${responseContent}\n\n${card.data.primaryContent}`
            : responseContent,
          card: card ?? undefined,
          toolName: pending.pendingToolName,
          config,
          normalization: {
            rawText: userQuery,
            normalizedText: queryWithParty,
            corrections: [{ from: pending.originalQuery, to: chosen.name }],
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Query execution failed.";
        return {
          id: `msg_${Date.now()}_disamb_err`,
          role: "assistant",
          content: `I could not complete that query for ${chosen.name}: ${errorMsg}`,
          tokensUsed: 0,
          provider: config.provider,
          createdAt: new Date().toISOString(),
        };
      }
    }
    // User moved on — clear stale disambiguation after a non-selection reply
    if (!/^[1-4]$/.test(resolvedQuery.trim())) {
      clearPendingDisambiguation();
    }
  }

  // Check if Cloud AI is requested and verify credit wallet
  if (config.provider !== "local") {
    const creditCheck = checkServiceCreditAvailability("cloud_ai");
    if (!creditCheck.available) {
      // Graceful fallback to Path A Local Assistant
      config.provider = "local";
    } else {
      // Deduct metered credits
      deductCredits("cloud_ai", 5, "Cloud AI Query", undefined);
    }
  }

  try {
    // Intent Normalization Layer
    const normalized = await normalizeIntent(resolvedQuery);
    void auditIntentNormalization(normalized);

    const intent = normalized.intent;
    const queryForTools = normalized.normalizedText || resolvedQuery;

    const normalizationAudit = {
      rawText: normalized.rawText,
      normalizedText: normalized.normalizedText,
      detectedLanguage: normalized.detectedLanguage,
      corrections: normalized.corrections.length > 0 ? normalized.corrections : undefined,
    };

    let responseContent = "";
    let card: ERPActionCard | null = null;
    let knowledgeSources: KnowledgeSourceRef[] | undefined;
    let isKnowledgeAnswer = false;

    // Entity disambiguation — multiple close party matches
    if (
      normalized.entityResolution?.needsDisambiguation &&
      normalized.entityResolution.candidates.length > 1
    ) {
      responseContent = formatDisambiguationPrompt(
        normalized.entityResolution.candidates,
        normalized.entityResolution.query,
      );
      card = buildDisambiguationCard(normalized.entityResolution);
      setPendingDisambiguation({
        candidates: normalized.entityResolution.candidates,
        originalQuery: normalized.normalizedText,
        pendingToolName: intent.toolName,
        createdAt: new Date().toISOString(),
      });
      return buildAssistantMessage({
        content: responseContent,
        card,
        toolName: "entity_disambiguation",
        config,
        normalization: normalizationAudit,
      });
    }

    // Track resolved party in session memory
    if (normalized.entityResolution?.bestMatch) {
      updateEntityMemory("lastMentionedParty", normalized.entityResolution.bestMatch.name);
    }

    if (intent.toolName.startsWith("conversation_")) {
      switch (intent.toolName) {
        case "conversation_greeting":
          responseContent = getGreeting(activeContext.user.preferredName);
          break;
        case "conversation_acknowledgement":
          responseContent = getAcknowledgement();
          break;
        case "conversation_how_are_you":
          responseContent = getHowAreYouResponse();
          break;
        case "conversation_capabilities":
          responseContent = getCapabilityExplanation();
          break;
        case "conversation_explain_simply":
          responseContent = getExplainSimplyPrompt();
          break;
        default:
          responseContent = getGreeting();
      }
    } else if (intent.toolName.startsWith("action_")) {
      const actionKey = intent.toolName.replace("action_", "");
      responseContent = startActionDraft(actionKey);
    } else if (intent.toolName === "query_knowledge_base") {
      const knowledgeResult = formatKnowledgeAnswer(normalized.knowledgeHits);
      if (knowledgeResult.confidence === "low" || !knowledgeResult.content) {
        // Try broader search with original query
        const { searchKnowledgeRepository } = await import("./knowledge-repository");
        const retry = searchKnowledgeRepository(resolvedQuery, { limit: 2 });
        const retryFormatted = formatKnowledgeAnswer(retry);
        if (retryFormatted.content) {
          responseContent = retryFormatted.content;
          knowledgeSources = retry.map(toKnowledgeSourceRef);
          isKnowledgeAnswer = true;
        } else {
          responseContent = getInsufficientKnowledgeResponse();
        }
      } else {
        responseContent = knowledgeResult.content;
        knowledgeSources = knowledgeResult.sources;
        isKnowledgeAnswer = true;
        card = await toolQueryKnowledgeBase(queryForTools);
      }
    } else if (intent.toolName === "fallback_unsupported") {
      // Last attempt: knowledge search before giving up
      if (normalized.knowledgeHits.length > 0 && normalized.knowledgeHits[0].score >= 8) {
        const kr = formatKnowledgeAnswer(normalized.knowledgeHits);
        responseContent = kr.content;
        knowledgeSources = kr.sources;
        isKnowledgeAnswer = true;
      } else if (config.provider !== "local") {
        responseContent = `I couldn't find a direct ERP tool for that. Please try rephrasing or ask a specific question like "what is fine gold?" or "show outstanding for [party name]".`;
      } else {
        responseContent = getInsufficientKnowledgeResponse();
      }
    } else {
      card = await executeERPTool(intent.toolName, queryForTools, userRole);

      responseContent = "Here are the authoritative ERP records you requested:";
      if (card) {
        responseContent = card.summary;
        if (card.data?.primaryContent) {
          responseContent = `${card.summary}\n\n${card.data.primaryContent}`;
        }
      } else {
        responseContent = `I searched live ERP records for "${extractSearchQuery(queryForTools)}" but could not find a direct match. I don't invent balances — please check the spelling or try a more specific name.`;
      }
    }

    incrementUsageMetrics(0, 0);

    return buildAssistantMessage({
      content: responseContent,
      card: card ?? undefined,
      toolName: intent.toolName,
      config,
      knowledgeSources,
      isKnowledgeAnswer,
      normalization: normalizationAudit,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Query execution failed.";
    await auditAssistantAction({
      actionKey: "assistant.query_error",
      actionType: "message",
      status: "failed",
      errorMessage: errorMsg,
      requestPayload: { query: userQuery },
    });

    return {
      id: `msg_${Date.now()}_err`,
      role: "assistant",
      content: `I could not complete that query: ${errorMsg}`,
      tokensUsed: 0,
      provider: config.provider,
      createdAt: new Date().toISOString(),
    };
  }
}

function buildAssistantMessage(opts: {
  content: string;
  card?: ERPActionCard;
  toolName: string;
  config: ProviderAdapterConfig;
  knowledgeSources?: KnowledgeSourceRef[];
  isKnowledgeAnswer?: boolean;
  normalization?: {
    rawText: string;
    normalizedText: string;
    detectedLanguage?: string;
    corrections?: Array<{ from: string; to: string }>;
  };
}): AssistantMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: opts.content,
    erpCard: opts.card,
    toolName: opts.toolName,
    tokensUsed: opts.config.provider === "local" ? 0 : 350,
    provider: opts.config.provider,
    createdAt: new Date().toISOString(),
    knowledgeSources: opts.knowledgeSources,
    isKnowledgeAnswer: opts.isKnowledgeAnswer,
    normalization: opts.normalization,
  };
}

function buildDisambiguationCard(resolution: EntityResolutionResult): ERPActionCard {
  return {
    type: "search_results",
    title: "Multiple Parties Found",
    summary: `Found ${resolution.candidates.length} parties matching "${resolution.query}". Please select the correct one.`,
    tableColumns: [
      { key: "name", header: "Party Name", align: "left" },
      { key: "type", header: "Type", align: "left" },
      { key: "phone", header: "Phone", align: "left" },
      { key: "match", header: "Match", align: "right" },
    ],
    tableRows: resolution.candidates.map((c) => ({
      name: c.name,
      type: c.type,
      phone: c.phone ?? "—",
      match: `${Math.round(c.score * 100)}%`,
    })),
    data: { candidates: resolution.candidates, needsDisambiguation: true },
  };
}
