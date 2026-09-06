/**
 * Native ERP Automation Engine — Exception-First Operations & Attention Center
 *
 * Surfacing actionable operational discrepancies to the store owner:
 * - Payment Mismatches
 * - Stock Count Variances
 * - Karigar Over-Loss Anomalies
 * - Missing Attendance / Stay discrepancies
 * - Failed Automations & Unhandled Webhooks
 */

import type { ExceptionRecord, ExceptionSeverity } from "./types";
import { createRepository } from "@/lib/repositories/base-repository";
import { automationAudit } from "./audit";

const exceptionRepo = createRepository<ExceptionRecord & { id: string }>("automation_exceptions");

export class ExceptionsManager {
  private exceptions: ExceptionRecord[] = [];
  private maxInMemory = 200;

  async raiseException(data: {
    tenantId: string;
    category: ExceptionRecord["category"];
    title: string;
    description: string;
    severity?: ExceptionSeverity;
    sourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ExceptionRecord> {
    const record: ExceptionRecord = {
      id: `exc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId: data.tenantId,
      category: data.category,
      title: data.title,
      description: data.description,
      severity: data.severity || "medium",
      status: "open",
      sourceId: data.sourceId,
      metadata: data.metadata,
      createdAt: new Date().toISOString(),
    };

    this.exceptions.unshift(record);
    if (this.exceptions.length > this.maxInMemory) {
      this.exceptions.pop();
    }

    exceptionRepo.save(record).catch(() => {});

    await automationAudit.log({
      tenantId: record.tenantId,
      eventId: `evt_${record.id}`,
      eventType: "UNUSUAL_ACTIVITY",
      sourceTransactionId: record.sourceId,
      ruleId: "rule_exceptions_manager",
      ruleName: "Exception Detected",
      actionType: "create_review_task",
      actionName: `Attention Required: ${record.title}`,
      status: "failed",
      actor: "system",
      durationMs: 0,
      metadata: { category: record.category, severity: record.severity },
    });

    return record;
  }

  async resolveException(
    exceptionId: string,
    action: "resolved" | "dismissed",
    resolvedBy: string,
  ): Promise<boolean> {
    const item = this.exceptions.find((e) => e.id === exceptionId);
    if (!item) return false;

    item.status = action;
    item.resolvedAt = new Date().toISOString();
    item.resolvedBy = resolvedBy;

    exceptionRepo.save(item).catch(() => {});

    await automationAudit.log({
      tenantId: item.tenantId,
      eventId: `evt_res_${item.id}`,
      eventType: "SYSTEM_HEALTH_RECOVERED",
      sourceTransactionId: item.sourceId,
      ruleId: "rule_exceptions_manager",
      ruleName: "Exception Resolved",
      actionType: "create_review_task",
      actionName: `Exception ${action.toUpperCase()}: ${item.title}`,
      status: "success",
      actor: resolvedBy,
      durationMs: 0,
    });

    return true;
  }

  getOpenExceptions(tenantId?: string): ExceptionRecord[] {
    let list = this.exceptions.filter((e) => e.status === "open" || e.status === "investigating");
    if (tenantId) {
      list = list.filter((e) => e.tenantId === tenantId);
    }
    return list;
  }

  getAllExceptions(tenantId?: string, limit = 100): ExceptionRecord[] {
    let list = this.exceptions;
    if (tenantId) {
      list = list.filter((e) => e.tenantId === tenantId);
    }
    return list.slice(0, limit);
  }

  async loadPersisted(tenantId?: string): Promise<ExceptionRecord[]> {
    try {
      const records = await exceptionRepo.readAll();
      if (Array.isArray(records) && records.length > 0) {
        const filtered = records.filter((r) => !tenantId || r.tenantId === tenantId);
        this.exceptions = [...filtered, ...this.exceptions]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, this.maxInMemory);
      }
    } catch {
      // Continue with in-memory
    }
    return this.exceptions;
  }
}

export const exceptionsManager = new ExceptionsManager();
