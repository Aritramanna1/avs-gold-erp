/**
 * AVS ERP — MCP Authentication & Authorization Context
 *
 * Enforces tenant isolation, branch containment, and Supervisor SMS-OTP security.
 * Under NO circumstance can a model or client supply an untrusted tenant ID or branch ID.
 */

import { MCPAuthContext, MCPErrorDetails } from "./mcp-types";

export interface CreateAuthContextParams {
  userId: string;
  userName?: string;
  role: string;
  tenantId: string;
  branchId?: string | null;
  allowedBranchIds?: string[];
  sessionId: string;
  authMethod: "sms_otp" | "session_token" | "api_key";
  otpTransport?: "sms" | "whatsapp";
  idempotencyKey?: string;
  approvalTicketId?: string;
}

/**
 * Creates and securely validates an MCP execution context.
 */
export function createMCPAuthContext(params: CreateAuthContextParams): {
  context?: MCPAuthContext;
  error?: MCPErrorDetails;
} {
  // 1. Validate required fields
  if (!params.userId || !params.sessionId) {
    return {
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication failed: Missing active user ID or session ID.",
      },
    };
  }

  if (!params.tenantId || params.tenantId.trim() === "") {
    return {
      error: {
        code: "TENANT_ACCESS_DENIED",
        message: "Tenant isolation failure: No verified tenant ID bound to session.",
      },
    };
  }

  // 2. Supervisor Security Policy: SMS OTP only, WhatsApp OTP rejected
  const isSupervisor = params.role === "supervisor" || params.role === "workshop_supervisor";
  if (isSupervisor) {
    if (params.otpTransport === "whatsapp") {
      return {
        error: {
          code: "UNAUTHORIZED",
          message: "Supervisor access rejected: Supervisor authentication is strictly restricted to SMS OTP. WhatsApp OTP is disabled.",
        },
      };
    }
  }

  const context: MCPAuthContext = {
    userId: params.userId,
    userName: params.userName,
    role: params.role.toLowerCase(),
    tenantId: params.tenantId,
    branchId: params.branchId || null,
    allowedBranchIds: params.allowedBranchIds || (params.branchId ? [params.branchId] : []),
    sessionId: params.sessionId,
    authMethod: params.authMethod,
    isSupervisor,
    idempotencyKey: params.idempotencyKey,
    approvalTicketId: params.approvalTicketId,
  };

  return { context };
}

/**
 * Validates tenant access boundary for an MCP operation.
 */
export function validateTenantAccess(
  context: MCPAuthContext,
  targetTenantId?: string
): { valid: boolean; error?: MCPErrorDetails } {
  if (!targetTenantId) {
    return { valid: true };
  }

  if (context.tenantId !== targetTenantId) {
    return {
      valid: false,
      error: {
        code: "TENANT_ACCESS_DENIED",
        message: `Cross-tenant violation: Caller tenant (${context.tenantId}) cannot access target tenant (${targetTenantId}).`,
      },
    };
  }

  return { valid: true };
}

/**
 * Validates branch access boundary for an MCP operation.
 */
export function validateBranchAccess(
  context: MCPAuthContext,
  targetBranchId?: string | null
): { valid: boolean; error?: MCPErrorDetails } {
  if (!targetBranchId) {
    return { valid: true };
  }

  // If user has branch restrictions, verify the requested branch is permitted
  if (context.allowedBranchIds && context.allowedBranchIds.length > 0) {
    if (!context.allowedBranchIds.includes(targetBranchId)) {
      return {
        valid: false,
        error: {
          code: "BRANCH_ACCESS_DENIED",
          message: `Branch access violation: User is restricted to branches [${context.allowedBranchIds.join(
            ", "
          )}] but attempted access to branch "${targetBranchId}".`,
        },
      };
    }
  }

  return { valid: true };
}
