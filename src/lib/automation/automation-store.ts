/**
 * Native ERP Automation Engine — Zustand Store & Public Dispatcher
 */

import { create } from "zustand";
import type {
  AutomationRule,
  JobQueueItem,
  AuditLogEntry,
  ScheduledTaskDefinition,
  AutomationEngineStats,
  ApprovalRequest,
  ReconciliationReport,
  ExceptionRecord,
  EODClosingSummary,
} from "./types";
import {
  type ERPEventType,
  createERPEvent,
} from "./events";
import { automationRuleEngine } from "./rule-engine";
import { automationQueue } from "./queue";
import { automationAudit } from "./audit";
import { automationScheduler } from "./scheduler";
import { approvalEngine } from "./approval-engine";
import { reconciliationEngine } from "./reconciliation-engine";
import { exceptionsManager } from "./exceptions-manager";
import { eodAutomationRunner } from "./eod-eom-automation";
import { createRepository } from "@/lib/repositories/base-repository";

const rulesRepo = createRepository<{ id: string; rules: AutomationRule[] }>("automation_rules");

interface AutomationStoreState {
  rules: AutomationRule[];
  jobs: JobQueueItem[];
  auditLogs: AuditLogEntry[];
  scheduledTasks: ScheduledTaskDefinition[];
  approvalRequests: ApprovalRequest[];
  reconciliationReports: ReconciliationReport[];
  exceptions: ExceptionRecord[];
  eodSummary?: EODClosingSummary;
  stats: AutomationEngineStats;
  isInitialized: boolean;

  // Actions
  initialize(tenantId?: string): Promise<void>;
  emitEvent<T = Record<string, unknown>>(
    type: ERPEventType,
    payload: T,
    context?: { tenantId?: string; branchId?: string; actorId?: string; idempotencyKey?: string },
  ): Promise<{ matchedRules: string[]; actionsQueued: number }>;
  toggleRule(ruleId: string, enabled: boolean): Promise<void>;
  toggleScheduledTask(taskId: string, enabled: boolean): void;
  runScheduledTaskManually(taskId: string): Promise<{ success: boolean; message: string }>;
  retryJob(jobId: string): boolean;
  refreshLogs(tenantId?: string): Promise<void>;

  // Approvals & Exceptions
  resolveApproval(requestId: string, action: "approve" | "reject", reviewer: string, notes?: string): Promise<boolean>;
  resolveException(exceptionId: string, action: "resolved" | "dismissed", reviewer: string): Promise<boolean>;
  runReconciliation(tenantId?: string): Promise<ReconciliationReport>;
  runEODClosing(tenantId?: string): Promise<EODClosingSummary>;
}

export const useAutomationEngine = create<AutomationStoreState>()((set, get) => ({
  rules: automationRuleEngine.getRules(),
  jobs: [],
  auditLogs: [],
  scheduledTasks: automationScheduler.getTasks(),
  approvalRequests: [],
  reconciliationReports: [],
  exceptions: [],
  eodSummary: undefined,
  stats: {
    totalEventsProcessed: 0,
    totalJobsExecuted: 0,
    successfulJobs: 0,
    failedJobs: 0,
    pendingJobs: 0,
    activeRulesCount: automationRuleEngine.getRules().filter((r) => r.enabled).length,
    pendingApprovalsCount: 0,
    openExceptionsCount: 0,
    lastHeartbeat: new Date().toISOString(),
  },
  isInitialized: false,

  async initialize(tenantId = "default_tenant") {
    if (get().isInitialized) return;

    // Load custom persisted rules
    try {
      const saved = await rulesRepo.read("rules_config");
      if (saved && Array.isArray(saved.rules)) {
        automationRuleEngine.setRules(saved.rules);
      }
    } catch {
      // Keep default rules
    }

    // Load audit logs, approvals, exceptions
    const logs = await automationAudit.loadPersistedLogs(tenantId);
    const approvals = await approvalEngine.loadPersisted(tenantId);
    const exceptions = await exceptionsManager.loadPersisted(tenantId);

    // Initialize scheduler with event dispatcher
    automationScheduler.init(async (event) => {
      await get().emitEvent(event.type, event.payload, {
        tenantId: event.context.tenantId,
        actorId: event.context.actorId,
        idempotencyKey: event.context.idempotencyKey,
      });
    });

    const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
    const openExceptions = exceptions.filter((e) => e.status === "open").length;

    set({
      rules: automationRuleEngine.getRules(),
      auditLogs: logs,
      approvalRequests: approvals,
      exceptions,
      jobs: automationQueue.getAllJobs(100, tenantId),
      scheduledTasks: automationScheduler.getTasks(),
      stats: {
        totalEventsProcessed: logs.length,
        totalJobsExecuted: logs.filter((l) => l.status === "success").length,
        successfulJobs: logs.filter((l) => l.status === "success").length,
        failedJobs: logs.filter((l) => l.status === "failed").length,
        pendingJobs: 0,
        activeRulesCount: automationRuleEngine.getRules().filter((r) => r.enabled).length,
        pendingApprovalsCount: pendingApprovals,
        openExceptionsCount: openExceptions,
        lastHeartbeat: new Date().toISOString(),
      },
      isInitialized: true,
    });
  },

  async emitEvent(type, payload, context = {}) {
    const tenantId = context.tenantId || "default_tenant";
    const event = createERPEvent(type, payload as Record<string, unknown>, {
      tenantId,
      branchId: context.branchId,
      actorId: context.actorId || "system",
      idempotencyKey: context.idempotencyKey,
    });

    const result = await automationRuleEngine.processEvent(event);

    // Update in-memory reactive state
    const currentJobs = automationQueue.getAllJobs(100, tenantId);
    const recentLogs = automationAudit.getRecentLogs(100, { tenantId });
    const approvals = approvalEngine.getAllRequests(tenantId);
    const exceptions = exceptionsManager.getAllExceptions(tenantId);

    set((state) => ({
      jobs: currentJobs,
      auditLogs: recentLogs,
      approvalRequests: approvals,
      exceptions,
      stats: {
        ...state.stats,
        totalEventsProcessed: state.stats.totalEventsProcessed + 1,
        activeRulesCount: state.rules.filter((r) => r.enabled).length,
        pendingApprovalsCount: approvals.filter((a) => a.status === "pending").length,
        openExceptionsCount: exceptions.filter((e) => e.status === "open").length,
        lastHeartbeat: new Date().toISOString(),
      },
    }));

    return result;
  },

  async toggleRule(ruleId, enabled) {
    automationRuleEngine.toggleRule(ruleId, enabled);
    const updated = [...automationRuleEngine.getRules()];
    set((state) => ({
      rules: updated,
      stats: {
        ...state.stats,
        activeRulesCount: updated.filter((r) => r.enabled).length,
      },
    }));

    rulesRepo
      .saveAs("rules_config", {
        id: "rules_config",
        rules: updated,
      })
      .catch(() => {
        // Saved in memory
      });
  },

  toggleScheduledTask(taskId, enabled) {
    automationScheduler.toggleTask(taskId, enabled);
    set({ scheduledTasks: [...automationScheduler.getTasks()] });
  },

  async runScheduledTaskManually(taskId) {
    const res = await automationScheduler.runTask(taskId);
    await get().refreshLogs();
    return res;
  },

  retryJob(jobId) {
    const ok = automationQueue.retryJob(jobId);
    if (ok) {
      set({ jobs: automationQueue.getAllJobs() });
    }
    return ok;
  },

  async resolveApproval(requestId, action, reviewer, notes) {
    const res = await approvalEngine.resolveRequest(requestId, action, reviewer, notes);
    if (res.success) {
      set({
        approvalRequests: approvalEngine.getAllRequests(),
        stats: {
          ...get().stats,
          pendingApprovalsCount: approvalEngine.getPendingRequests().length,
        },
      });
      await get().refreshLogs();
      return true;
    }
    return false;
  },

  async resolveException(exceptionId, action, reviewer) {
    const ok = await exceptionsManager.resolveException(exceptionId, action, reviewer);
    if (ok) {
      set({
        exceptions: exceptionsManager.getAllExceptions(),
        stats: {
          ...get().stats,
          openExceptionsCount: exceptionsManager.getOpenExceptions().length,
        },
      });
      await get().refreshLogs();
    }
    return ok;
  },

  async runReconciliation(tenantId = "default_tenant") {
    const report = await reconciliationEngine.runReconciliation(tenantId);
    set((state) => ({
      reconciliationReports: [report, ...state.reconciliationReports],
    }));
    await get().refreshLogs(tenantId);
    return report;
  },

  async runEODClosing(tenantId = "default_tenant") {
    const summary = await eodAutomationRunner.runEODClosing(tenantId);
    set({ eodSummary: summary });
    await get().refreshLogs(tenantId);
    return summary;
  },

  async refreshLogs(tenantId) {
    const logs = await automationAudit.loadPersistedLogs(tenantId || "default_tenant");
    const approvals = approvalEngine.getAllRequests(tenantId);
    const exceptions = exceptionsManager.getAllExceptions(tenantId);

    set({
      auditLogs: logs,
      approvalRequests: approvals,
      exceptions,
      jobs: automationQueue.getAllJobs(100, tenantId),
      stats: {
        totalEventsProcessed: logs.length,
        totalJobsExecuted: logs.filter((l) => l.status === "success").length,
        successfulJobs: logs.filter((l) => l.status === "success").length,
        failedJobs: logs.filter((l) => l.status === "failed").length,
        pendingJobs: 0,
        activeRulesCount: get().rules.filter((r) => r.enabled).length,
        pendingApprovalsCount: approvals.filter((a) => a.status === "pending").length,
        openExceptionsCount: exceptions.filter((e) => e.status === "open").length,
        lastHeartbeat: new Date().toISOString(),
      },
    });
  },
}));
