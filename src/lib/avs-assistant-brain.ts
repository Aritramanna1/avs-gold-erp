/**
 * AVS / Ornexa ERP Assistant Brain.
 *
 * The assistant is intentionally tool-first. It never fabricates ERP facts from
 * prompt text: supported answers come from Supabase/RLS reads or from explicit
 * draft cards that still require user confirmation before posting.
 *
 * Compliant with ASSISTANT_MASTER.md and AI_RUNTIME_ARCHITECTURE.md
 */

export * from "./assistant/assistant-types";
export * from "./assistant/assistant-tool-registry";
export * from "./assistant/ai-provider-service";
export * from "./assistant/voice-service";

import type {
  AssistantMessage,
  ERPActionCard,
  ProviderAdapterConfig,
} from "./assistant/assistant-types";
import { processAssistantQuery } from "./assistant/ai-provider-service";

export class ReplaceableAssistantBrain {
  private config: ProviderAdapterConfig;

  constructor(config: ProviderAdapterConfig) {
    this.config = config;
  }

  public getSystemPrompt(): string {
    return `You are the AVS Assistant for jewellery manufacturing and retail ERP.

Rules:
1. All ERP facts must come from authorized tools and Supabase/RLS-visible records.
2. All gold math, fine gold conversion, inventory, GST, and double-entry ledgers are 100% deterministic.
3. High-risk actions (gold issues, invoicing, rate cuts, WhatsApp messages) require explicit preview & user confirmation before posting.
4. Use jewellery terminology: fine gold, gross weight, touch, purity, karigar, wastage, ledger, voucher.
5. If outside supported ERP tools, provide clear next steps.`;
  }

  public async generateResponse(
    messages: AssistantMessage[],
    onToolCall?: (name: string, args: Record<string, any>) => Promise<ERPActionCard | null>,
    userRole: string = "Owner",
  ): Promise<AssistantMessage> {
    const userMessage = messages[messages.length - 1]?.content || "";
    return processAssistantQuery(userMessage, this.config, userRole);
  }
}
