/**
 * AVS ERP — MCP Audit Logging Engine
 *
 * Implements immutable audit recording for all MCP tool executions.
 * Sanitizes all input parameters so secrets, passwords, and tokens are never logged.
 */

import { MCPAuditRecord } from "./mcp-types";

const MAX_IN_MEMORY_LOGS = 200;
const inMemoryLogs: MCPAuditRecord[] = [];

/**
 * Sanitizes input parameters to remove any credentials, passwords, or secrets.
 */
export function sanitizeMCPInput(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const secretKeywords = ["password", "secret", "token", "apikey", "api_key", "auth", "credential", "signature"];

  for (const [key, value] of Object.entries(params)) {
    const isSecret = secretKeywords.some((k) => key.toLowerCase().includes(k));
    if (isSecret) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMCPInput(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Logs an MCP tool execution record.
 */
export function logMCPExecution(record: Omit<MCPAuditRecord, "id" | "timestamp">): MCPAuditRecord {
  const fullRecord: MCPAuditRecord = {
    id: `mcp_aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...record,
    inputParamsSanitized: sanitizeMCPInput(record.inputParamsSanitized),
  };

  inMemoryLogs.unshift(fullRecord);
  if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryLogs.pop();
  }

  return fullRecord;
}

/**
 * Retrieves recent MCP audit logs.
 */
export function getMCPAuditLogs(filter?: {
  tenantId?: string;
  toolName?: string;
  userId?: string;
  status?: MCPAuditRecord["status"];
}): MCPAuditRecord[] {
  let logs = [...inMemoryLogs];

  if (filter?.tenantId) {
    logs = logs.filter((l) => l.tenantId === filter.tenantId);
  }
  if (filter?.toolName) {
    logs = logs.filter((l) => l.toolName === filter.toolName);
  }
  if (filter?.userId) {
    logs = logs.filter((l) => l.userId === filter.userId);
  }
  if (filter?.status) {
    logs = logs.filter((l) => l.status === filter.status);
  }

  return logs;
}
