/**
 * Native ERP Automation Engine — Core Types & Contracts
 */

import type { ERPEvent, ERPEventType, ERPEventCategory } from "./events";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "contains"
  | "in"
  | "not_in"
  | "is_true"
  | "is_false"
  | "is_empty"
  | "is_not_empty";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export type ActionType =
  | "update_inventory"
  | "generate_barcode"
  | "post_customer_ledger"
  | "post_karigar_purity_book"
  | "post_accounting_journal"
  | "calculate_karigar_settlement"
  | "post_weekly_allowance"
  | "update_worker_stay"
  | "dispatch_notification"
  | "create_review_task"
  | "require_approval"
  | "create_system_incident"
  | "record_security_alert"
  | "run_reconciliation"
  | "execute_eod_closing"
  | "execute_custom_routine";

export interface AutomationActionDefinition {
  type: ActionType;
  name: string;
  config: Record<string, unknown>;
  isAsync?: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: ERPEventCategory;
  triggerEvent: ERPEventType;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: AutomationActionDefinition[];
  priority?: number;
  tenantId?: string;
  branchId?: string;
  requireApproval?: boolean;
  approvalRoleRequired?: "manager" | "admin" | "owner";
  createdAt: string;
  updatedAt: string;
}

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "retrying"
  | "dead_letter";

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
}

export interface JobQueueItem {
  id: string;
  ruleId: string;
  ruleName: string;
  event: ERPEvent;
  action: AutomationActionDefinition;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  nextRunAt: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  idempotencyKey: string;
  correlationId: string;
  result?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  branchId?: string;
  eventId: string;
  eventType: ERPEventType;
  sourceTransactionId?: string;
  ruleId: string;
  ruleName: string;
  actionType: ActionType;
  actionName: string;
  status: "success" | "failed" | "skipped" | "approval_pending";
  actor: string;
  durationMs: number;
  idempotencyKey?: string;
  errorDetails?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ScheduledTaskDefinition {
  id: string;
  name: string;
  description: string;
  frequency: "hourly" | "daily" | "weekly" | "monthly";
  targetTime?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  handlerName: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  type: "large_discount" | "high_value_expense" | "stock_variance" | "gold_adjustment" | "manual_ledger" | "period_lock_override";
  title: string;
  description: string;
  sourceTransactionId?: string;
  requestedBy: string;
  thresholdValue?: number;
  actualValue?: number;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ReconciliationMismatch {
  category: "sales_vs_payments" | "inventory_movement" | "gold_balance" | "karigar_custody" | "cash_drawer";
  expected: number | string;
  actual: number | string;
  variance: number | string;
  severity: "info" | "warning" | "critical";
  description: string;
}

export interface ReconciliationReport {
  id: string;
  tenantId: string;
  date: string;
  generatedAt: string;
  mismatches: ReconciliationMismatch[];
  isClean: boolean;
  totalSalesPaise: number;
  totalCollectionsPaise: number;
  totalGoldMovementG: number;
}

export type ExceptionSeverity = "low" | "medium" | "high" | "critical";

export interface ExceptionRecord {
  id: string;
  tenantId: string;
  category: "payment_mismatch" | "stock_variance" | "karigar_overloss" | "missing_attendance" | "failed_automation" | "security_alert";
  title: string;
  description: string;
  severity: ExceptionSeverity;
  status: "open" | "investigating" | "resolved" | "dismissed";
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface EODClosingSummary {
  date: string;
  tenantId: string;
  totalSalesCount: number;
  totalSalesPaise: number;
  totalGoldIssuedG: number;
  totalGoldReceivedG: number;
  unpaidInvoicesCount: number;
  pendingApprovalsCount: number;
  openExceptionsCount: number;
  status: "ready_for_review" | "completed";
  generatedAt: string;
}

export interface AutomationEngineStats {
  totalEventsProcessed: number;
  totalJobsExecuted: number;
  successfulJobs: number;
  failedJobs: number;
  pendingJobs: number;
  activeRulesCount: number;
  pendingApprovalsCount: number;
  openExceptionsCount: number;
  lastHeartbeat: string;
}
