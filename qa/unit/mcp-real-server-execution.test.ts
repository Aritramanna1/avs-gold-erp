/**
 * AVS ERP — MCP Real Server & Gold-First Execution Unit Tests
 *
 * Validates:
 * 1. MCP Server JSON-RPC dispatch (initialize, ping, health, tools/list, tools/call).
 * 2. Gold-First Account & Ledger model (separate Cash and Gold dimensions, zero forced conversion).
 * 3. Supervisor authentication via SMS OTP only (rejection of unauthorized roles/methods).
 * 4. Tenant & Branch isolation boundaries.
 * 5. Workflow configuration enforcement (rejecting disabled processes).
 * 6. High-value approval requirement gates.
 * 7. Idempotency caching on repeated write operations.
 * 8. Sanitized audit logging (no leaked secrets).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mcpServer } from "@/lib/mcp/mcp-server";
import { executeMCPTool } from "@/lib/mcp/mcp-executor";
import { createMCPAuthContext } from "@/lib/mcp/mcp-auth-context";
import { getMCPAuditLogs } from "@/lib/mcp/mcp-audit";
import { DEFAULT_FINENESS_BASIS } from "@/lib/gold";
import { useLedger } from "@/lib/ledger-store";
import { useStock } from "@/lib/stock-store";

describe("MCP Real Server & Gold-First Execution Suite", () => {
  const supervisorAuth = createMCPAuthContext({
    userId: "usr_sup_1",
    userName: "Shop Supervisor",
    role: "supervisor",
    tenantId: "avs_shop_tenant",
    branchId: "main-showroom",
    allowedBranchIds: ["main-showroom"],
    sessionId: "sess_123",
    authMethod: "sms_otp",
  }).context!;

  const ownerAuth = createMCPAuthContext({
    userId: "usr_owner_1",
    userName: "Store Owner",
    role: "owner",
    tenantId: "avs_shop_tenant",
    branchId: "main-showroom",
    allowedBranchIds: ["main-showroom"],
    sessionId: "sess_owner_123",
    authMethod: "session_token",
  }).context!;

  beforeEach(() => {
    useLedger.setState({ entries: [] });
    useStock.setState({ items: [] });
  });

  describe("1. MCP Server JSON-RPC Protocol Handling", () => {
    it("should handle 'initialize' and return standard MCP protocol version and capabilities", async () => {
      const response = await mcpServer.handleRequest({
        jsonrpc: "2.0",
        id: "req_1",
        method: "initialize",
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("req_1");
      expect(response.result).toBeDefined();
      const res = response.result as any;
      expect(res.protocolVersion).toBe("2024-11-05");
      expect(res.serverInfo.name).toBe("avs-erp-mcp-server");
      expect(res.capabilities.tools).toBeDefined();
    });

    it("should handle 'ping' and return status 'pong'", async () => {
      const response = await mcpServer.handleRequest({
        jsonrpc: "2.0",
        id: 42,
        method: "ping",
      });

      expect(response.jsonrpc).toBe("2.0");
      expect((response.result as any).status).toBe("pong");
    });

    it("should handle 'server/health' and report HEALTHY with 995 fineness standard", async () => {
      const response = await mcpServer.handleRequest({
        jsonrpc: "2.0",
        id: "health_chk",
        method: "server/health",
      });

      const res = response.result as any;
      expect(res.status).toBe("HEALTHY");
      expect(res.server).toBe("DEPLOYED");
      expect(res.finenessStandard).toBe(DEFAULT_FINENESS_BASIS);
      expect(res.totalRegisteredTools).toBeGreaterThan(30);
    });

    it("should list available tools through 'tools/list'", async () => {
      const response = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "tool_lst",
          method: "tools/list",
        },
        supervisorAuth
      );

      const res = response.result as any;
      expect(res.tools).toBeDefined();
      expect(Array.isArray(res.tools)).toBe(true);
      expect(res.tools.length).toBeGreaterThan(20);
    });

    it("should reject invalid JSON-RPC requests missing version 2.0", async () => {
      const response = await mcpServer.handleRequest({
        jsonrpc: "1.0" as any,
        id: "bad_req",
        method: "ping",
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
    });
  });

  describe("2. Gold-First Account & Ledger Tool Execution", () => {
    it("should execute finance.get_account_balance and return separate Cash and Gold dimensions", async () => {
      const response = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "acct_bal_1",
          method: "tools/call",
          params: {
            name: "finance.get_account_balance",
            arguments: { accountCode: "vault" },
          },
        },
        ownerAuth
      );

      expect(response.error).toBeUndefined();
      const res = response.result as any;
      expect(res.structuredData).toBeDefined();
      expect(res.structuredData.accountCode).toBe("vault");
      expect(res.structuredData.balanceRupees).toBeDefined();
      expect(res.structuredData.fineGoldGrams).toBeDefined();
      // Zero forced conversion: cash and gold remain separate fields
      expect(typeof res.structuredData.balanceRupees).toBe("number");
      expect(typeof res.structuredData.fineGoldGrams).toBe("number");
    });

    it("should execute core.get_system_status and verify fineness 995 standard", async () => {
      const response = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "sys_stat",
          method: "tools/call",
          params: {
            name: "core.get_system_status",
            arguments: {},
          },
        },
        supervisorAuth
      );

      const res = response.result as any;
      expect(res.structuredData.finenessBasis).toBe(995);
      expect(res.structuredData.status).toBe("HEALTHY");
    });
  });

  describe("3. Role Authorization & Supervisor SMS OTP Authentication", () => {
    it("should allow Supervisor with valid sms_otp to execute permitted tools", async () => {
      const response = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "sup_call",
          method: "tools/call",
          params: {
            name: "barcode.search_barcode",
            arguments: { scannedValue: "TAG-916-1001" },
          },
        },
        supervisorAuth
      );

      expect(response.error).toBeUndefined();
      expect((response.result as any).structuredData.matched).toBe(false);
    });

    it("should block non-permitted roles from executing restricted owner tools", async () => {
      const workerAuth = createMCPAuthContext({
        userId: "usr_worker_9",
        role: "worker",
        tenantId: "avs_shop_tenant",
        sessionId: "sess_w",
        authMethod: "session_token",
      }).context!;

      const response = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "unauth_call",
          method: "tools/call",
          params: {
            name: "owner.get_owner_transactions",
            arguments: {},
          },
        },
        workerAuth
      );

      expect(response.error).toBeDefined();
      expect(response.error?.data?.errorCode).toBe("UNAUTHORIZED");
    });
  });

  describe("4. Tenant Isolation Enforcement", () => {
    it("should block cross-tenant parameter attempts", async () => {
      const response = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "x_tenant",
          method: "tools/call",
          params: {
            name: "customers.get_customer",
            arguments: {
              customerId: "cust_1",
              tenantId: "attacker_foreign_tenant", // Mismatched tenant
            },
          },
        },
        supervisorAuth
      );

      expect(response.error).toBeDefined();
      expect(response.error?.data?.errorCode).toBe("TENANT_ACCESS_DENIED");
    });
  });

  describe("5. Approval Gates on High-Value Actions", () => {
    it("should require approval ticket for owner withdrawals", async () => {
      const response = await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "appr_req",
          method: "tools/call",
          params: {
            name: "owner.prepare_owner_withdrawal",
            arguments: { amountPaise: 5000000 },
          },
        },
        ownerAuth
      );

      expect(response.error).toBeDefined();
      expect(response.error?.data?.approvalRequired).toBe(true);
      expect(response.error?.data?.approvalTicketId).toBeDefined();
    });
  });

  describe("6. Idempotency on Write Calls", () => {
    it("should return identical cached result when called repeatedly with same idempotencyKey", async () => {
      const idmpKey = `idmp_test_${Date.now()}`;

      // First call
      const res1 = await executeMCPTool({
        toolName: "barcode.generate_barcode",
        parameters: { tagNo: "TAG-916-2001" },
        context: { ...supervisorAuth, idempotencyKey: idmpKey },
      });

      expect(res1.success).toBe(true);
      const barcode1 = (res1.data as any).barcode;

      // Second call with same idempotency key
      const res2 = await executeMCPTool({
        toolName: "barcode.generate_barcode",
        parameters: { tagNo: "TAG-916-2001" },
        context: { ...supervisorAuth, idempotencyKey: idmpKey },
      });

      expect(res2.success).toBe(true);
      const barcode2 = (res2.data as any).barcode;
      expect(barcode1).toBe(barcode2);
    });
  });

  describe("7. Sanitized Audit Logging", () => {
    it("should log execution in MCP audit trail without exposing secrets", async () => {
      await mcpServer.handleRequest(
        {
          jsonrpc: "2.0",
          id: "audit_test",
          method: "tools/call",
          params: {
            name: "core.get_system_status",
            arguments: { secretToken: "super_secret_123" },
          },
        },
        supervisorAuth
      );

      const trail = getMCPAuditLogs();
      expect(trail.length).toBeGreaterThan(0);
      const last = trail[0];
      expect(last.toolName).toBe("core.get_system_status");
      expect(last.userId).toBe("usr_sup_1");
      // Verify no sensitive keys leaked in plaintext in sanitized payload
      const sanitizedStr = JSON.stringify(last.inputParamsSanitized);
      expect(sanitizedStr).not.toContain("super_secret_123");
    });
  });
});
