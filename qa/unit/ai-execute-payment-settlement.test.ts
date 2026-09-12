/**
 * AVS-70 — AI EXECUTE payment + settlement (confirm → commit gate)
 * Stubs never invent ledger / money movement. Never auto-execute.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  gateHighRiskExecute,
  isExplicitHumanConfirm,
  PAYMENT_EXECUTE_REQUIRED,
  SETTLEMENT_EXECUTE_REQUIRED,
} from "../../src/lib/ai-execute/high-risk-execute-gate";
import { AI_CAPABILITY_REGISTRY } from "../../src/lib/ai-readiness/ai-capability-registry";
import { getMCPTool, listMCPTools } from "../../src/lib/mcp/mcp-tool-registry";
import { executeMCPTool } from "../../src/lib/mcp/mcp-executor";
import { mcpRateLimiter } from "../../src/lib/mcp/mcp-rate-limiter";
import type { MCPAuthContext } from "../../src/lib/mcp/mcp-types";
import { classifyIntent } from "../../src/lib/assistant/intent-normalization";
import {
  executeConfirmedAction,
  extractPaymentArgs,
  extractSettlementArgs,
} from "../../src/lib/assistant/assistant-tool-registry";
import {
  startActionDraft,
  processDraftInput,
  clearDraft,
} from "../../src/lib/assistant/conversational-action-engine";

const adminContext: MCPAuthContext = {
  userId: "usr_admin_01",
  role: "admin",
  tenantId: "tenant_avs_main",
  branchId: "branch_main",
  sessionId: "sess_adm_1",
  authMethod: "session_token",
  isSupervisor: false,
};

describe("AVS-70 high-risk execute gate", () => {
  it("never treats missing or stringy confirm as explicit human confirm", () => {
    expect(isExplicitHumanConfirm(undefined)).toBe(false);
    expect(isExplicitHumanConfirm(false)).toBe(false);
    expect(isExplicitHumanConfirm("true")).toBe(false);
    expect(isExplicitHumanConfirm(1)).toBe(false);
    expect(isExplicitHumanConfirm(true)).toBe(true);
  });

  it("refuses payment EXECUTE without isConfirmed", () => {
    const gate = gateHighRiskExecute({
      kind: "payment",
      isConfirmed: false,
      fields: { partyId: "p1", amountPaise: 10000, paymentType: "outward" },
      requiredKeys: [...PAYMENT_EXECUTE_REQUIRED],
    });
    expect(gate.ok).toBe(false);
    expect(gate.committed).toBe(false);
    expect(gate.refused).toBe(true);
    expect(gate.reason).toBe("NOT_CONFIRMED");
  });

  it("refuses confirmed payment with missing fields and does not invent amounts", () => {
    const gate = gateHighRiskExecute({
      kind: "payment",
      isConfirmed: true,
      fields: { partyId: "p1", amountPaise: null, paymentType: "outward" },
      requiredKeys: [...PAYMENT_EXECUTE_REQUIRED],
    });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe("MISSING_FIELDS");
    expect(gate.missingFields).toContain("amountPaise");
    expect(gate.committed).toBe(false);
  });

  it("accepts confirm but still does not commit / auto-post", () => {
    const gate = gateHighRiskExecute({
      kind: "payment",
      isConfirmed: true,
      fields: { partyId: "p1", amountPaise: 50000, paymentType: "inward" },
      requiredKeys: [...PAYMENT_EXECUTE_REQUIRED],
    });
    expect(gate.ok).toBe(true);
    expect(gate.committed).toBe(false);
    expect(gate.status).toBe("confirm_accepted_no_auto_post");
  });

  it("refuses settlement without metal or cash amount", () => {
    const gate = gateHighRiskExecute({
      kind: "settlement",
      isConfirmed: true,
      fields: { karigarId: "k1" },
      requiredKeys: [...SETTLEMENT_EXECUTE_REQUIRED],
    });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe("MISSING_FIELDS");
  });
});

describe("AVS-70 capability + MCP EXECUTE stubs", () => {
  beforeEach(() => {
    mcpRateLimiter.reset();
  });

  it("keeps EXECUTE capabilities approvalRequired", () => {
    expect(AI_CAPABILITY_REGISTRY.AI_EXECUTE_PAYMENT.approvalRequired).toBe(true);
    expect(AI_CAPABILITY_REGISTRY.AI_EXECUTE_PAYMENT.classification).toBe("EXECUTE");
    expect(AI_CAPABILITY_REGISTRY.AI_EXECUTE_SETTLEMENT.approvalRequired).toBe(true);
    expect(AI_CAPABILITY_REGISTRY.AI_EXECUTE_SETTLEMENT.classification).toBe("EXECUTE");
    expect(AI_CAPABILITY_REGISTRY.AI_PREPARE_PAYMENT.approvalRequired).toBe(true);
    expect(AI_CAPABILITY_REGISTRY.AI_PREPARE_SETTLEMENT.approvalRequired).toBe(true);
  });

  it("registers MCP EXECUTE twins with approvalRequired", () => {
    const pay = getMCPTool("finance.execute_payment");
    const settle = getMCPTool("karigar.execute_karigar_settlement");
    expect(pay?.readWriteLevel).toBe("EXECUTE");
    expect(pay?.approvalRequired).toBe(true);
    expect(settle?.readWriteLevel).toBe("EXECUTE");
    expect(settle?.approvalRequired).toBe(true);
    const executeTools = listMCPTools({ readWriteLevel: "EXECUTE" });
    expect(executeTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["finance.execute_payment", "karigar.execute_karigar_settlement"]),
    );
  });

  it("blocks MCP EXECUTE without approval ticket (never auto)", async () => {
    const res = await executeMCPTool({
      toolName: "finance.execute_payment",
      parameters: {
        partyId: "p1",
        amountPaise: 10000,
        paymentType: "outward",
        isConfirmed: true,
      },
      context: adminContext,
    });
    expect(res.success).toBe(false);
    expect(res.approvalRequired).toBe(true);
    expect(res.error?.code).toBe("APPROVAL_REQUIRED");
  });

  it("refuses MCP EXECUTE even with ticket if isConfirmed is false", async () => {
    const res = await executeMCPTool({
      toolName: "finance.execute_payment",
      parameters: {
        partyId: "p1",
        amountPaise: 10000,
        paymentType: "outward",
        isConfirmed: false,
      },
      context: { ...adminContext, approvalTicketId: "appr_test" },
    });
    expect(res.success).toBe(true);
    expect((res.data as any).refused).toBe(true);
    expect((res.data as any).committed).toBe(false);
    expect((res.data as any).reason).toBe("NOT_CONFIRMED");
  });

  it("accepted confirm still does not post money", async () => {
    const res = await executeMCPTool({
      toolName: "karigar.execute_karigar_settlement",
      parameters: {
        karigarId: "k1",
        settlementGoldMg: 2500,
        isConfirmed: true,
      },
      context: { ...adminContext, approvalTicketId: "appr_test_2" },
    });
    expect(res.success).toBe(true);
    expect((res.data as any).committed).toBe(false);
    expect((res.data as any).status).toBe("confirm_accepted_no_auto_post");
  });
});

describe("AVS-70 assistant PREPARE + confirm path", () => {
  it("classifies prepare payment / settlement intents", () => {
    expect(classifyIntent("prepare payment to ramesh rs 5000", "prepare payment to ramesh rs 5000").toolName).toBe(
      "prepare_payment_draft",
    );
    expect(classifyIntent("prepare karigar settlement", "prepare karigar settlement").toolName).toBe(
      "prepare_settlement_draft",
    );
  });

  it("extracts payment and settlement args without inventing values", () => {
    const pay = extractPaymentArgs("pay ramesh ₹1,250 outward upi");
    expect(pay.amountPaise).toBe(125000);
    expect(pay.paymentType).toBe("outward");
    expect(pay.paymentMode).toBe("upi");
    const empty = extractPaymentArgs("prepare payment draft");
    expect(empty.amountPaise).toBeNull();
    const settle = extractSettlementArgs("settle gopal 12.5 g and rs 800");
    expect(settle.settlementGoldMg).toBe(12500);
    expect(settle.settlementCashPaise).toBe(80000);
  });

  it("never auto-executes payment/settlement drafts from chat yes", () => {
    clearDraft();
    startActionDraft("prepare_payment", {
      partyId: "p1",
      amountPaise: 10000,
      paymentType: "outward",
    });
    const result = processDraftInput("yes confirm");
    expect(result.executePayload).toBeUndefined();
    expect(result.card?.actionPayload?.actionType).toBe("execute_payment");
    expect(result.card?.actionPayload?.isConfirmed).toBe(false);
    expect(result.reply).toMatch(/never auto-posts/i);
    clearDraft();
  });

  it("executeConfirmedAction refuses payment without isConfirmed", async () => {
    const res = await executeConfirmedAction({
      actionId: "t1",
      actionType: "execute_payment",
      title: "pay",
      description: "pay",
      requiresConfirmation: true,
      isConfirmed: false,
      details: { partyId: "p1", amountPaise: 10000, paymentType: "outward" },
    });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/isConfirmed/);
  });

  it("executeConfirmedAction accepts confirm but does not post", async () => {
    const res = await executeConfirmedAction({
      actionId: "t2",
      actionType: "execute_settlement",
      title: "settle",
      description: "settle",
      requiresConfirmation: true,
      isConfirmed: true,
      details: { karigarId: "k1", settlementGoldMg: 1000 },
    });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/NOT auto-posted/i);
  });
});
