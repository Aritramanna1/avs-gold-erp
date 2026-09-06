/**
 * Native ERP Automation Engine — AI Integration Architecture (Contracts & Gateways)
 *
 * IMPORTANT:
 * DO NOT IMPLEMENT AI WORKFLOWS YET.
 * This file specifies clean, decoupled interfaces and policy gateways so that
 * future AI models, LLM assistants, or automated voice calling services can be attached
 * seamlessly without altering deterministic business rules, tenant boundaries, or accounting safety.
 */

import type { ERPEvent } from "./events";
import type { AutomationActionDefinition } from "./types";

export interface AiEvaluationContext {
  tenantId: string;
  branchId?: string;
  actorId: string;
  sourceEvent: ERPEvent;
  scope: "sales_suggestion" | "customer_segmentation" | "stock_optimization" | "karigar_efficiency" | "report_insight" | "voice_call_intent";
  metadata?: Record<string, unknown>;
}

export interface AiSuggestionResult {
  suggestionId: string;
  confidenceScore: number; // 0.0 to 1.0
  recommendedAction?: AutomationActionDefinition;
  reasoningNotes: string;
  requiresHumanApproval: boolean;
  generatedAt: string;
}

/**
 * Contract for future AI Suggestion Provider.
 * Deterministic engine calls evaluateSuggestion() ONLY when explicitly enabled by tenant policy.
 */
export interface AiSuggestionProvider {
  providerId: string;
  providerName: string;
  version: string;
  isEnabled(tenantId: string): boolean;
  evaluateSuggestion(ctx: AiEvaluationContext): Promise<AiSuggestionResult | null>;
}

/**
 * AI Decision Gateway & Approval Policy
 * Enforces that no AI output can execute directly without passing security, permission,
 * financial limits, and explicit human/admin authorization.
 */
export interface AiApprovalGateway {
  validateAiAction(action: AutomationActionDefinition, ctx: AiEvaluationContext): {
    permitted: boolean;
    reason?: string;
    requiresAdminConfirmation: boolean;
  };
}

export const AI_EXTENSION_POLICY: {
  aiExecutionEnabled: boolean;
  strictApprovalRequired: boolean;
  readOnlyInspectionAllowed: boolean;
} = {
  aiExecutionEnabled: false, // Explicitly false — Deterministic ERP engine is primary
  strictApprovalRequired: true,
  readOnlyInspectionAllowed: true,
};
