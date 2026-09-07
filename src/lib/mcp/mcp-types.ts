/**
 * AVS ERP — Model Context Protocol (MCP) Foundation Types & Error Contracts
 *
 * Defines the strict, versioned schemas, namespaces, and structured errors for ERP MCP tools.
 * All tools strictly enforce tenant isolation, role-based authorization, and approval policies.
 */

export type MCPNamespace =
  | "core"
  | "customers"
  | "crm"
  | "retail"
  | "inventory"
  | "manufacturing"
  | "karigar"
  | "payroll"
  | "owner"
  | "finance"
  | "production"
  | "barcode"
  | "hallmark"
  | "documents"
  | "reports"
  | "system";

export type MCPReadWriteLevel = "READ" | "PREPARE" | "RECOMMEND" | "EXECUTE";

export type MCPErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "TENANT_ACCESS_DENIED"
  | "BRANCH_ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "APPROVAL_REQUIRED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface MCPErrorDetails {
  code: MCPErrorCode;
  message: string;
  field?: string;
  requiredRole?: string;
  approvalTicketId?: string;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
}

export interface MCPToolResult<T = unknown> {
  success: boolean;
  toolName: string;
  version: string;
  data?: T;
  error?: MCPErrorDetails;
  approvalRequired?: boolean;
  approvalTicketId?: string;
  auditId?: string;
  executionDurationMs: number;
  timestamp: string;
}

export interface JSONSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[] | number[];
  minimum?: number;
  maximum?: number;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface JSONSchemaObject {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface MCPRateLimitConfig {
  maxPerMinute: number;
  maxPerHour?: number;
}

export interface MCPToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  version: string;
  description: string;
  namespace: MCPNamespace;
  inputSchema: JSONSchemaObject;
  outputSchema: JSONSchemaObject;
  allowedRoles: string[];
  requiredPermissions: string[];
  tenantScoped: boolean;
  branchScoped: boolean;
  readWriteLevel: MCPReadWriteLevel;
  approvalRequired: boolean;
  auditRequired: boolean;
  rateLimit: MCPRateLimitConfig;
  enabled: boolean;
  handler: (params: TInput, context: MCPAuthContext) => Promise<TOutput>;
}

export interface MCPAuthContext {
  userId: string;
  userName?: string;
  role: string;
  tenantId: string;
  branchId: string | null;
  allowedBranchIds?: string[];
  sessionId: string;
  authMethod: "sms_otp" | "session_token" | "api_key";
  isSupervisor: boolean;
  ipAddress?: string;
  idempotencyKey?: string;
  approvalTicketId?: string;
}

export interface MCPAuditRecord {
  id: string;
  requestId: string;
  timestamp: string;
  userId: string;
  role: string;
  tenantId: string;
  branchId: string | null;
  toolName: string;
  namespace: MCPNamespace;
  readWriteLevel: MCPReadWriteLevel;
  status: "SUCCESS" | "FAILED" | "APPROVAL_PENDING" | "BLOCKED";
  errorCode?: MCPErrorCode;
  durationMs: number;
  inputParamsSanitized: Record<string, unknown>;
  idempotencyKey?: string;
  approvalTicketId?: string;
}
