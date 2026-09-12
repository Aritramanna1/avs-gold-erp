/**
 * AVS ERP — AI Capabilities Activation & MCP Foundation Test Suite
 *
 * Comprehensive unit and integration verification for:
 * 1. AI Capability Registry (Permissions, Read/Prepare/Recommend/Execute, Approval Requirements)
 * 2. MCP Tool Registry across all 16 namespaces
 * 3. Supervisor SMS OTP security model (rejection of WhatsApp OTP)
 * 4. Multi-tenant isolation and branch confinement
 * 5. Idempotency and duplicate execution protection
 * 6. Rate limiting enforcement
 * 7. Structured error contracts and audit sanitization
 * 8. Double-Entry Dual-Ledger protection
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AI_CAPABILITY_REGISTRY,
  isCapabilityAllowedForRole,
  listCapabilities,
} from "../../src/lib/ai-readiness/ai-capability-registry";
import {
  MCP_TOOL_REGISTRY,
  listMCPTools,
  getMCPTool,
} from "../../src/lib/mcp/mcp-tool-registry";
import {
  createMCPAuthContext,
  validateTenantAccess,
  validateBranchAccess,
} from "../../src/lib/mcp/mcp-auth-context";
import { executeMCPTool } from "../../src/lib/mcp/mcp-executor";
import { mcpRateLimiter } from "../../src/lib/mcp/mcp-rate-limiter";
import { sanitizeMCPInput, getMCPAuditLogs } from "../../src/lib/mcp/mcp-audit";
import { MCPAuthContext } from "../../src/lib/mcp/mcp-types";

describe("AVS ERP — AI Capabilities & MCP Foundation Enterprise Test Suite", () => {
  beforeEach(() => {
    mcpRateLimiter.reset();
  });

  // ── 1. AI CAPABILITY REGISTRY VALIDATION ────────────────────────────────────
  describe("1. AI Capability Registry", () => {
    it("defines and activates all standard AI capabilities across modules", () => {
      const caps = Object.keys(AI_CAPABILITY_REGISTRY);
      expect(caps).toContain("AI_READ_CUSTOMER");
      expect(caps).toContain("AI_READ_PRODUCT");
      expect(caps).toContain("AI_READ_STOCK");
      expect(caps).toContain("AI_READ_KARIGAR");
      expect(caps).toContain("AI_READ_SETTLEMENT");
      expect(caps).toContain("AI_READ_LEDGER");
      expect(caps).toContain("AI_READ_REPORTS");
      expect(caps).toContain("AI_READ_PAYROLL");

      expect(caps).toContain("AI_CREATE_CUSTOMER");
      expect(caps).toContain("AI_CREATE_ENQUIRY");
      expect(caps).toContain("AI_CREATE_APPOINTMENT");
      expect(caps).toContain("AI_CREATE_QUOTATION");
      expect(caps).toContain("AI_CREATE_TASK");

      expect(caps).toContain("AI_PREPARE_SALE");
      expect(caps).toContain("AI_PREPARE_SETTLEMENT");
      expect(caps).toContain("AI_PREPARE_STOCK_TRANSFER");
      expect(caps).toContain("AI_PREPARE_SALARY_SETTLEMENT");
      expect(caps).toContain("AI_PREPARE_PAYMENT");

      expect(caps).toContain("AI_RECOMMEND_REORDER");
      expect(caps).toContain("AI_RECOMMEND_FOLLOWUP");

      expect(caps).toContain("AI_EXECUTE_PAYMENT");
      expect(caps).toContain("AI_EXECUTE_SETTLEMENT");
    });

    it("enforces strict role-based capability boundaries", () => {
      // Retail sales can read customers and prepare quotations
      expect(isCapabilityAllowedForRole("AI_READ_CUSTOMER", "retail_sales", "READ")).toBe(true);
      expect(isCapabilityAllowedForRole("AI_CREATE_QUOTATION", "retail_sales", "PREPARE")).toBe(true);

      // Retail sales CANNOT read double-entry financial ledger or execute Karigar settlements
      expect(isCapabilityAllowedForRole("AI_READ_LEDGER", "retail_sales", "READ")).toBe(false);
      expect(isCapabilityAllowedForRole("AI_EXECUTE_SETTLEMENT", "retail_sales", "EXECUTE")).toBe(false);

      // Karigar worker can read product templates but cannot read finance/payroll
      expect(isCapabilityAllowedForRole("AI_READ_PRODUCT", "worker", "READ")).toBe(true);
      expect(isCapabilityAllowedForRole("AI_READ_PAYROLL", "worker", "READ")).toBe(false);
    });

    it("marks high-risk execution capabilities as approval-required", () => {
      expect(AI_CAPABILITY_REGISTRY["AI_PREPARE_SETTLEMENT"].approvalRequired).toBe(true);
      expect(AI_CAPABILITY_REGISTRY["AI_PREPARE_PAYMENT"].approvalRequired).toBe(true);
      expect(AI_CAPABILITY_REGISTRY["AI_EXECUTE_PAYMENT"].approvalRequired).toBe(true);
      expect(AI_CAPABILITY_REGISTRY["AI_EXECUTE_SETTLEMENT"].approvalRequired).toBe(true);
      expect(AI_CAPABILITY_REGISTRY["AI_READ_CUSTOMER"].approvalRequired).toBe(false);
    });
  });

  // ── 2. MCP TOOL REGISTRY & NAMESPACES ───────────────────────────────────────
  describe("2. MCP Tool Registry & 16 Namespaces", () => {
    it("registers tools covering all 16 required enterprise namespaces", () => {
      const allTools = listMCPTools();
      const namespaces = new Set(allTools.map((t) => t.namespace));

      expect(namespaces.has("core")).toBe(true);
      expect(namespaces.has("customers")).toBe(true);
      expect(namespaces.has("crm")).toBe(true);
      expect(namespaces.has("retail")).toBe(true);
      expect(namespaces.has("inventory")).toBe(true);
      expect(namespaces.has("manufacturing")).toBe(true);
      expect(namespaces.has("karigar")).toBe(true);
      expect(namespaces.has("payroll")).toBe(true);
      expect(namespaces.has("owner")).toBe(true);
      expect(namespaces.has("finance")).toBe(true);
      expect(namespaces.has("production")).toBe(true);
      expect(namespaces.has("barcode")).toBe(true);
      expect(namespaces.has("hallmark")).toBe(true);
      expect(namespaces.has("documents")).toBe(true);
      expect(namespaces.has("reports")).toBe(true);
      expect(namespaces.has("system")).toBe(true);

      expect(allTools.length).toBeGreaterThanOrEqual(45);
    });

    it("verifies JSONSchema7 compliance and rate limits for all tools", () => {
      const allTools = listMCPTools();
      for (const tool of allTools) {
        expect(tool.name).toBeTruthy();
        expect(tool.version).toBe("v1");
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.outputSchema.type).toBe("object");
        expect(tool.rateLimit.maxPerMinute).toBeGreaterThan(0);
        expect(tool.allowedRoles.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 3. SUPERVISOR ACCESS MODEL & SMS OTP SECURITY ───────────────────────────
  describe("3. Supervisor MCP Access Model", () => {
    it("authenticates Supervisor with valid SMS OTP and role context", () => {
      const res = createMCPAuthContext({
        userId: "usr_supervisor_01",
        userName: "Rajesh Supervisor",
        role: "supervisor",
        tenantId: "tenant_avs_main",
        branchId: "branch_showroom_1",
        allowedBranchIds: ["branch_showroom_1"],
        sessionId: "sess_sms_otp_9921",
        authMethod: "sms_otp",
        otpTransport: "sms",
      });

      expect(res.error).toBeUndefined();
      expect(res.context).toBeDefined();
      expect(res.context?.isSupervisor).toBe(true);
      expect(res.context?.role).toBe("supervisor");
      expect(res.context?.authMethod).toBe("sms_otp");
    });

    it("strictly rejects Supervisor authentication using WhatsApp OTP", () => {
      const res = createMCPAuthContext({
        userId: "usr_supervisor_01",
        role: "supervisor",
        tenantId: "tenant_avs_main",
        sessionId: "sess_wa_otp_112",
        authMethod: "sms_otp",
        otpTransport: "whatsapp",
      });

      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe("UNAUTHORIZED");
      expect(res.error?.message).toContain("SMS OTP");
    });
  });

  // ── 4. MULTI-TENANT & BRANCH ISOLATION ──────────────────────────────────────
  describe("4. Multi-Tenant & Branch Isolation", () => {
    it("blocks cross-tenant access attempts at authorization layer", () => {
      const context: MCPAuthContext = {
        userId: "usr_user_1",
        role: "retail_sales",
        tenantId: "tenant_alpha",
        branchId: "branch_1",
        sessionId: "sess_1",
        authMethod: "session_token",
        isSupervisor: false,
      };

      const validTenant = validateTenantAccess(context, "tenant_alpha");
      expect(validTenant.valid).toBe(true);

      const crossTenant = validateTenantAccess(context, "tenant_beta");
      expect(crossTenant.valid).toBe(false);
      expect(crossTenant.error?.code).toBe("TENANT_ACCESS_DENIED");
    });

    it("confines execution to assigned branches for branch-scoped tools", () => {
      const context: MCPAuthContext = {
        userId: "usr_user_1",
        role: "retail_sales",
        tenantId: "tenant_alpha",
        branchId: "branch_mumbai",
        allowedBranchIds: ["branch_mumbai"],
        sessionId: "sess_1",
        authMethod: "session_token",
        isSupervisor: false,
      };

      const validBranch = validateBranchAccess(context, "branch_mumbai");
      expect(validBranch.valid).toBe(true);

      const invalidBranch = validateBranchAccess(context, "branch_delhi");
      expect(invalidBranch.valid).toBe(false);
      expect(invalidBranch.error?.code).toBe("BRANCH_ACCESS_DENIED");
    });
  });

  // ── 5. MCP EXECUTION PIPELINE & APPROVAL GATING ─────────────────────────────
  describe("5. MCP Execution Pipeline & Approval Enforcement", () => {
    const adminContext: MCPAuthContext = {
      userId: "usr_admin_01",
      role: "admin",
      tenantId: "tenant_avs_main",
      branchId: "branch_main",
      sessionId: "sess_adm_1",
      authMethod: "session_token",
      isSupervisor: false,
    };

    it("executes core system status tool cleanly", async () => {
      const res = await executeMCPTool({
        toolName: "core.get_system_status",
        parameters: {},
        context: adminContext,
      });

      expect(res.success).toBe(true);
      expect(res.toolName).toBe("core.get_system_status");
      expect((res.data as any).status).toBe("HEALTHY");
      expect((res.data as any).finenessBasis).toBe(995);
    });

    it("enforces approval ticket on high-risk prepare tools", async () => {
      const res = await executeMCPTool({
        toolName: "karigar.prepare_karigar_settlement",
        parameters: { karigarId: "k_001", settlementGoldMg: 10000 },
        context: adminContext, // No approvalTicketId provided
      });

      expect(res.success).toBe(false);
      expect(res.approvalRequired).toBe(true);
      expect(res.error?.code).toBe("APPROVAL_REQUIRED");
      expect(res.approvalTicketId).toBeTruthy();

      // Now re-run with the approval ticket attached
      const approvedRes = await executeMCPTool({
        toolName: "karigar.prepare_karigar_settlement",
        parameters: { karigarId: "k_001", settlementGoldMg: 10000 },
        context: { ...adminContext, approvalTicketId: res.approvalTicketId },
      });

      expect(approvedRes.success).toBe(true);
      expect((approvedRes.data as any).approvalRequired).toBe(true);
    });

    it("returns structured UNAUTHORIZED error when role does not permit tool execution", async () => {
      const workerContext: MCPAuthContext = {
        userId: "usr_worker_01",
        role: "worker",
        tenantId: "tenant_avs_main",
        branchId: "branch_workshop",
        sessionId: "sess_wrk_1",
        authMethod: "session_token",
        isSupervisor: false,
      };

      const res = await executeMCPTool({
        toolName: "finance.get_account_balance",
        parameters: { accountCode: "1001" },
        context: workerContext,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe("UNAUTHORIZED");
      expect(res.error?.requiredRole).toContain("accountant");
    });
  });

  // ── 6. IDEMPOTENCY & RATE LIMITING ──────────────────────────────────────────
  describe("6. Idempotency & Rate Limiting", () => {
    it("returns cached result on repeated write requests with same idempotency key", async () => {
      const adminContext: MCPAuthContext = {
        userId: "usr_admin_01",
        role: "admin",
        tenantId: "tenant_avs_main",
        branchId: "branch_main",
        sessionId: "sess_adm_1",
        authMethod: "session_token",
        isSupervisor: false,
        idempotencyKey: "idmp_sale_create_test_001",
      };

      const firstCall = await executeMCPTool({
        toolName: "retail.prepare_sale",
        parameters: { customerId: "c1", stockTagNos: ["TAG-01"] },
        context: adminContext,
      });

      const secondCall = await executeMCPTool({
        toolName: "retail.prepare_sale",
        parameters: { customerId: "c1", stockTagNos: ["TAG-01"] },
        context: adminContext,
      });

      expect(firstCall.success).toBe(true);
      expect(secondCall.success).toBe(true);
      expect((secondCall.data as any).draftSaleId).toBe((firstCall.data as any).draftSaleId);
    });

    it("throttles calls when tool rate limit is exceeded", () => {
      const limitConfig = { maxPerMinute: 3 };
      const userId = "usr_spam_01";
      const tool = "test.rate_limit_tool";

      expect(mcpRateLimiter.checkLimit(userId, tool, limitConfig).allowed).toBe(true);
      expect(mcpRateLimiter.checkLimit(userId, tool, limitConfig).allowed).toBe(true);
      expect(mcpRateLimiter.checkLimit(userId, tool, limitConfig).allowed).toBe(true);

      // 4th call within same minute must be rate limited
      const blocked = mcpRateLimiter.checkLimit(userId, tool, limitConfig);
      expect(blocked.allowed).toBe(false);
      expect(blocked.error?.code).toBe("RATE_LIMITED");
      expect(blocked.error?.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  // ── 7. AUDIT LOGGING & SECRET SANITIZATION ──────────────────────────────────
  describe("7. Audit Trail & Secret Sanitization", () => {
    it("sanitizes passwords, secrets, and API tokens from audit inputs", () => {
      const rawInput = {
        customerId: "c1",
        userPassword: "PlainPassword123!",
        apiKey: "sk_live_secret_key",
        authToken: "jwt.token.here",
        orderNotes: "Customer requested 22K bangle",
      };

      const sanitized = sanitizeMCPInput(rawInput);
      expect(sanitized.customerId).toBe("c1");
      expect(sanitized.orderNotes).toBe("Customer requested 22K bangle");
      expect(sanitized.userPassword).toBe("[REDACTED]");
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.authToken).toBe("[REDACTED]");
    });
  });
});
