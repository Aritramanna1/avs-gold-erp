/**
 * AVS ERP — MCP Tool Execution Engine
 *
 * Implements the security, authorization, rate-limiting, idempotency, and audit pipeline for MCP tools.
 * Under NO circumstances does MCP bypass ERP authorization, tenant boundaries, or the double-entry ledger.
 */

import { MCPToolResult, MCPErrorDetails, MCPAuthContext } from "./mcp-types";
import { getMCPTool } from "./mcp-tool-registry";
import { validateTenantAccess, validateBranchAccess } from "./mcp-auth-context";
import { mcpRateLimiter } from "./mcp-rate-limiter";
import { logMCPExecution } from "./mcp-audit";

// In-memory idempotency cache (keeps processed write event hashes for 2 hours)
const idempotencyRecords = new Map<string, { result: any; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 2 * 60 * 60 * 1000;

export interface ExecuteMCPToolParams {
  toolName: string;
  parameters: Record<string, unknown>;
  context: MCPAuthContext;
}

/**
 * Executes a registered MCP tool through the full ERP security and audit pipeline.
 */
export async function executeMCPTool<T = unknown>(
  params: ExecuteMCPToolParams
): Promise<MCPToolResult<T>> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // 1. Tool Lookup
  const tool = getMCPTool(params.toolName);
  if (!tool) {
    const duration = Date.now() - startTime;
    const error: MCPErrorDetails = {
      code: "NOT_FOUND",
      message: `MCP Tool "${params.toolName}" is not registered in the ERP Tool Registry.`,
    };

    logMCPExecution({
      requestId: `req_${Date.now()}`,
      userId: params.context.userId,
      role: params.context.role,
      tenantId: params.context.tenantId,
      branchId: params.context.branchId,
      toolName: params.toolName,
      namespace: "system",
      readWriteLevel: "READ",
      status: "FAILED",
      errorCode: error.code,
      durationMs: duration,
      inputParamsSanitized: params.parameters,
    });

    return {
      success: false,
      toolName: params.toolName,
      version: "v1",
      error,
      executionDurationMs: duration,
      timestamp,
    };
  }

  // 2. Check if Tool is Enabled
  if (!tool.enabled) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      toolName: tool.name,
      version: tool.version,
      error: {
        code: "UNAUTHORIZED",
        message: `MCP Tool "${tool.name}" is currently disabled by system policy.`,
      },
      executionDurationMs: duration,
      timestamp,
    };
  }

  // 3. Role-Based Authorization
  const callerRole = params.context.role.toLowerCase();
  const isRolePermitted =
    tool.allowedRoles.includes("*") ||
    tool.allowedRoles.map((r) => r.toLowerCase()).includes(callerRole);

  if (!isRolePermitted) {
    const duration = Date.now() - startTime;
    const error: MCPErrorDetails = {
      code: "UNAUTHORIZED",
      message: `Access Denied: Role "${params.context.role}" is not authorized to execute tool "${tool.name}".`,
      requiredRole: tool.allowedRoles.join(" | "),
    };

    logMCPExecution({
      requestId: `req_${Date.now()}`,
      userId: params.context.userId,
      role: params.context.role,
      tenantId: params.context.tenantId,
      branchId: params.context.branchId,
      toolName: tool.name,
      namespace: tool.namespace,
      readWriteLevel: tool.readWriteLevel,
      status: "BLOCKED",
      errorCode: error.code,
      durationMs: duration,
      inputParamsSanitized: params.parameters,
    });

    return {
      success: false,
      toolName: tool.name,
      version: tool.version,
      error,
      executionDurationMs: duration,
      timestamp,
    };
  }

  // 4. Tenant Boundary Enforcement
  const tenantCheck = validateTenantAccess(params.context, params.parameters.tenantId as string | undefined);
  if (!tenantCheck.valid) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      toolName: tool.name,
      version: tool.version,
      error: tenantCheck.error,
      executionDurationMs: duration,
      timestamp,
    };
  }

  // 5. Branch Boundary Enforcement
  if (tool.branchScoped) {
    const branchCheck = validateBranchAccess(params.context, (params.parameters.branchId as string) || params.context.branchId);
    if (!branchCheck.valid) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        toolName: tool.name,
        version: tool.version,
        error: branchCheck.error,
        executionDurationMs: duration,
        timestamp,
      };
    }
  }

  // 6. Rate Limiting Check
  const rateLimitCheck = mcpRateLimiter.checkLimit(params.context.userId, tool.name, tool.rateLimit);
  if (!rateLimitCheck.allowed) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      toolName: tool.name,
      version: tool.version,
      error: rateLimitCheck.error,
      executionDurationMs: duration,
      timestamp,
    };
  }

  // 7. Idempotency Check for Write Operations
  if (params.context.idempotencyKey) {
    const idmpKey = `${params.context.tenantId}:${tool.name}:${params.context.idempotencyKey}`;
    const cached = idempotencyRecords.get(idmpKey);
    if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
      const duration = Date.now() - startTime;
      return {
        success: true,
        toolName: tool.name,
        version: tool.version,
        data: cached.result as T,
        executionDurationMs: duration,
        timestamp,
      };
    }
  }

  // 8. Approval Gate Enforcement
  if (tool.approvalRequired && !params.context.approvalTicketId) {
    const duration = Date.now() - startTime;
    const ticketId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    logMCPExecution({
      requestId: `req_${Date.now()}`,
      userId: params.context.userId,
      role: params.context.role,
      tenantId: params.context.tenantId,
      branchId: params.context.branchId,
      toolName: tool.name,
      namespace: tool.namespace,
      readWriteLevel: tool.readWriteLevel,
      status: "APPROVAL_PENDING",
      durationMs: duration,
      inputParamsSanitized: params.parameters,
      approvalTicketId: ticketId,
    });

    return {
      success: false,
      toolName: tool.name,
      version: tool.version,
      approvalRequired: true,
      approvalTicketId: ticketId,
      error: {
        code: "APPROVAL_REQUIRED",
        message: `High-risk operation requires manager approval. Approval ticket #${ticketId} created.`,
        approvalTicketId: ticketId,
      },
      executionDurationMs: duration,
      timestamp,
    };
  }

  // 9. Execute Tool Handler
  try {
    const result = await tool.handler(params.parameters, params.context);
    const duration = Date.now() - startTime;

    // Record idempotency
    if (params.context.idempotencyKey) {
      const idmpKey = `${params.context.tenantId}:${tool.name}:${params.context.idempotencyKey}`;
      idempotencyRecords.set(idmpKey, { result, timestamp: Date.now() });
    }

    // Record audit
    const audit = logMCPExecution({
      requestId: `req_${Date.now()}`,
      userId: params.context.userId,
      role: params.context.role,
      tenantId: params.context.tenantId,
      branchId: params.context.branchId,
      toolName: tool.name,
      namespace: tool.namespace,
      readWriteLevel: tool.readWriteLevel,
      status: "SUCCESS",
      durationMs: duration,
      inputParamsSanitized: params.parameters,
      idempotencyKey: params.context.idempotencyKey,
      approvalTicketId: params.context.approvalTicketId,
    });

    return {
      success: true,
      toolName: tool.name,
      version: tool.version,
      data: result as T,
      auditId: audit.id,
      executionDurationMs: duration,
      timestamp,
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const error: MCPErrorDetails = {
      code: "INTERNAL_ERROR",
      message: err?.message || "An unexpected error occurred during MCP tool execution.",
    };

    logMCPExecution({
      requestId: `req_${Date.now()}`,
      userId: params.context.userId,
      role: params.context.role,
      tenantId: params.context.tenantId,
      branchId: params.context.branchId,
      toolName: tool.name,
      namespace: tool.namespace,
      readWriteLevel: tool.readWriteLevel,
      status: "FAILED",
      errorCode: error.code,
      durationMs: duration,
      inputParamsSanitized: params.parameters,
    });

    return {
      success: false,
      toolName: tool.name,
      version: tool.version,
      error,
      executionDurationMs: duration,
      timestamp,
    };
  }
}
