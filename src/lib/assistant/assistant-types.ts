/**
 * Ornexa Assistant Type Definitions
 * Version: 3.2.0
 */

export type AIProvider = "local" | "cloudflare_ai_gateway" | "openai" | "anthropic" | "gemini";

export type CardType =
  | "kpi_stats"
  | "dense_table"
  | "visual_chart"
  | "milestone_timeline"
  | "document_preview"
  | "action_confirmation"
  | "customer_balance"
  | "gold_book"
  | "followup_list"
  | "voucher_draft"
  | "production_queue"
  | "inventory_exceptions"
  | "document_register"
  | "search_results"
  | "where_is_my_gold"
  | "gold_position"
  | "party_360"
  | "job_timeline"
  | "ready_stock"
  | "invoices_list"
  | "outstanding_ageing"
  | "offline_queue_status";

export interface KpiItem {
  label: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  variant?: "default" | "success" | "warning" | "destructive" | "gold";
}

export interface TableColumn {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  format?: "text" | "weight_grams" | "currency_inr" | "purity" | "date" | "badge";
}

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
}

export interface TimelineEvent {
  title: string;
  subtitle?: string;
  timestamp: string;
  status: "completed" | "in_progress" | "pending" | "failed";
  workerName?: string;
  details?: Record<string, any>;
}

export interface ActionPayload {
  actionId: string;
  actionType: "whatsapp_send" | "gold_issue" | "create_voucher" | "export_report";
  title: string;
  description: string;
  requiresConfirmation: boolean;
  isConfirmed?: boolean;
  isExecuted?: boolean;
  targetType?: string;
  targetId?: string;
  recipientPhone?: string;
  recipientName?: string;
  details: Record<string, any>;
}

export interface ERPActionCard {
  type: CardType;
  title: string;
  summary: string;
  actionRoute?: string;
  actionPayload?: ActionPayload;
  kpis?: KpiItem[];
  tableColumns?: TableColumn[];
  tableRows?: Array<Record<string, any>>;
  chartData?: ChartDataPoint[];
  chartType?: "bar" | "pie" | "line";
  timelineEvents?: TimelineEvent[];
  documentUrl?: string;
  documentMeta?: {
    docNumber: string;
    docType: string;
    date: string;
    amountFormatted?: string;
  };
  data: Record<string, any>;
}

export interface KnowledgeSourceRef {
  id: string;
  title: string;
  topic: string;
  knowledgeTier: string;
  sourceDoc?: string;
  relatedRoute?: string;
  lastReviewedAt: string;
}

export interface IntentNormalizationAudit {
  rawText: string;
  normalizedText: string;
  detectedLanguage?: string;
  corrections?: Array<{ from: string; to: string }>;
}

export interface AssistantMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  erpCard?: ERPActionCard;
  toolName?: string;
  tokensUsed?: number;
  provider?: AIProvider;
  createdAt: string;
  /** Knowledge articles cited in this response (not live ERP data) */
  knowledgeSources?: KnowledgeSourceRef[];
  /** Original vs normalized query for audit/debug */
  normalization?: IntentNormalizationAudit;
  /** True when answer is from knowledge base, not live ERP query */
  isKnowledgeAnswer?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  requiredPermissions: string[];
  parameters: Record<string, any>;
}

export interface ProviderAdapterConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokensPerDay?: number;
  dailyUsageCount?: number;
}

export interface IntentMatchResult {
  toolName: string;
  confidence: number;
  entities?: Record<string, any>;
}
