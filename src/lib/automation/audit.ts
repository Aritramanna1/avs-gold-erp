/**
 * Native ERP Automation Engine — Immutable Audit Logger
 */

import type { AuditLogEntry } from "./types";
import { createRepository } from "@/lib/repositories/base-repository";

const auditRepository = createRepository<AuditLogEntry & { id: string }>("automation_audit_logs");

class AutomationAuditLogger {
  private inMemoryLogs: AuditLogEntry[] = [];
  private maxInMemory = 500;

  async log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<AuditLogEntry> {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    // Prepend in-memory for immediate UI reactivity
    this.inMemoryLogs.unshift(fullEntry);
    if (this.inMemoryLogs.length > this.maxInMemory) {
      this.inMemoryLogs.pop();
    }

    // Persist asynchronously without blocking execution
    auditRepository.save(fullEntry).catch(() => {
      // Keep in-memory even if offline/egress quarantined
    });

    return fullEntry;
  }

  getRecentLogs(limit = 100, filter?: { tenantId?: string; eventType?: string; status?: string }): AuditLogEntry[] {
    let result = this.inMemoryLogs;
    if (filter?.tenantId) {
      result = result.filter((l) => l.tenantId === filter.tenantId);
    }
    if (filter?.eventType) {
      result = result.filter((l) => l.eventType === filter.eventType);
    }
    if (filter?.status) {
      result = result.filter((l) => l.status === filter.status);
    }
    return result.slice(0, limit);
  }

  async loadPersistedLogs(tenantId: string): Promise<AuditLogEntry[]> {
    try {
      const records = await auditRepository.readAll();
      if (Array.isArray(records) && records.length > 0) {
        const filtered = records.filter((r) => !tenantId || r.tenantId === tenantId);
        this.inMemoryLogs = [...filtered, ...this.inMemoryLogs]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, this.maxInMemory);
      }
    } catch {
      // Continue with in-memory logs
    }
    return this.inMemoryLogs;
  }
}

export const automationAudit = new AutomationAuditLogger();
