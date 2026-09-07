/**
 * AVS ERP — Authoritative Workflow Engine & Universal AI Provider Suite
 *
 * Comprehensive Unit Tests verifying:
 * 1. Authoritative Workflow Configuration & Persistence (Manufacturing Only, Retail Only, Combined)
 * 2. Scope & Mode Enforcement
 * 3. Process Master CRUD & Enablement Toggles
 * 4. Physical Metal Books & Purity Standards (22K/916, 18K/750, 995 Standard Bullion)
 * 5. Workflow Step Sequence & State Machine Transition Validation
 * 6. Field Requirement & Visibility Policies
 * 7. Draft -> Validate -> Publish -> Active Versioning
 * 8. Universal AI Provider Abstraction & Adapters (Gemini, OpenAI, Anthropic, Azure, AWS Bedrock, Self-Hosted, Custom)
 * 9. AI Credential Protection & Capability Routing
 * 10. Supervisor Security Standard
 */

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  useWorkflowEngine,
  DEFAULT_WORKFLOW_MTJ,
  type BusinessMode,
} from "../../src/lib/workflow-engine";
import {
  AI_PROVIDERS,
  getAIConfig,
  saveAIConfig,
  testAIConnectivity,
  AIService,
  maskApiKey,
  sanitizeError,
  type AIProviderType,
} from "../../src/lib/ai-readiness/ai-service-interface";

// Setup localStorage mock for Vitest node environment
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  }
});

describe("Authoritative Workflow Engine", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useWorkflowEngine.getState().reset();
  });

  it("1. Initializes with MTJ manufacturing-first defaults", () => {
    const config = useWorkflowEngine.getState().config;
    expect(config.mode).toBe("manufacturing_only");
    expect(config.workflowScope).toBe("manufacturing");
    expect(config.mfgBillEnabled).toBe(true);
    expect(config.activeVersion).toBe("1.1.0");
    expect(config.processes.length).toBeGreaterThanOrEqual(8);
    expect(config.books.length).toBeGreaterThanOrEqual(4);
  });

  it("2. Retains workflow mode selection across patch and reload simulation", () => {
    const engine = useWorkflowEngine.getState();

    // Set to manufacturing_only
    engine.patch({ mode: "manufacturing_only" });
    expect(useWorkflowEngine.getState().config.mode).toBe("manufacturing_only");
    expect(useWorkflowEngine.getState().config.workflowScope).toBe("manufacturing");
    expect(localStorageMock.getItem("avs_workflow_mode_v2")).toBe("manufacturing_only");

    // Set to retail_only
    engine.patch({ mode: "retail_only" });
    expect(useWorkflowEngine.getState().config.mode).toBe("retail_only");
    expect(useWorkflowEngine.getState().config.workflowScope).toBe("retail");
    expect(localStorageMock.getItem("avs_workflow_mode_v2")).toBe("retail_only");

    // Set to combined
    engine.patch({ mode: "combined_commerce_manufacturing" });
    expect(useWorkflowEngine.getState().config.mode).toBe("combined_commerce_manufacturing");
    expect(useWorkflowEngine.getState().config.workflowScope).toBe("shared");
    expect(localStorageMock.getItem("avs_workflow_mode_v2")).toBe("combined_commerce_manufacturing");
  });

  it("3. Process Master supports adding, updating, toggling, and deleting custom processes", () => {
    const engine = useWorkflowEngine.getState();

    const added = engine.addProcess({
      name: "Enamel Laser Micro-Etching",
      processType: "laser_micro_etching",
      workflowScope: "manufacturing",
      applicableModule: "workshop",
      processRule: "Record laser pass count and pre/post microscopic weight",
      requiredFields: ["grossMg", "purity"],
      approvalRequired: true,
      ledgerMapping: "workshop_process_gold_issued",
      labourRatePaise: 4500,
      labourCalcMethod: "per_piece",
      active: true,
    });

    expect(added.id).toBeDefined();
    expect(engine.isProcessEnabled("laser_micro_etching")).toBe(true);

    // Toggle inactive
    engine.toggleProcess(added.id, false);
    expect(engine.isProcessEnabled("laser_micro_etching")).toBe(false);

    // Toggle active
    engine.toggleProcess(added.id, true);
    expect(engine.isProcessEnabled("laser_micro_etching")).toBe(true);

    // Delete
    engine.deleteProcess(added.id);
    const procFound = useWorkflowEngine.getState().config.processes.find((p) => p.id === added.id);
    expect(procFound).toBeUndefined();
  });

  it("4. Physical Books Master supports standard 916, 750, and 995 standard fineness", () => {
    const engine = useWorkflowEngine.getState();
    const books = engine.config.books;

    const book916 = books.find((b) => b.purity === 916);
    const book750 = books.find((b) => b.purity === 750);
    const book995 = books.find((b) => b.purity === 995);

    expect(book916).toBeDefined();
    expect(book916?.bookName).toContain("916");
    expect(book750).toBeDefined();
    expect(book750?.bookName).toContain("750");
    expect(book995).toBeDefined();
    expect(book995?.bookName).toContain("99.50%");

    // Add a custom purity book (e.g. 14K / 585)
    const customBook = engine.addBook({
      bookName: "14K / 585 Export Physical Book",
      purity: 585,
      unit: "mg",
      workflowScope: "manufacturing",
      active: true,
      openingBalanceBehavior: "carry_forward",
      applicableTransactionTypes: ["given", "return"],
      ledgerMapping: "karigar",
    });

    expect(customBook.id).toBeDefined();
    expect(engine.isBookEnabled(customBook.id)).toBe(true);

    engine.toggleBook(customBook.id, false);
    expect(engine.isBookEnabled(customBook.id)).toBe(false);
  });

  it("5. Sequential Steps and State Machine validate valid and illegal transitions", () => {
    const engine = useWorkflowEngine.getState();

    // Valid transitions
    expect(engine.validateStateTransition("draft", "awaiting_gold_issue").allowed).toBe(true);
    expect(engine.validateStateTransition("awaiting_gold_issue", "gold_issued").allowed).toBe(true);
    expect(engine.validateStateTransition("gold_issued", "in_progress").allowed).toBe(true);
    expect(engine.validateStateTransition("in_progress", "work_received").allowed).toBe(true);
    expect(engine.validateStateTransition("work_received", "ready_for_billing").allowed).toBe(true);
    expect(engine.validateStateTransition("ready_for_billing", "closed").allowed).toBe(true);

    // Illegal transitions
    expect(engine.validateStateTransition("draft", "closed").allowed).toBe(false);
    expect(engine.validateStateTransition("draft", "ready_for_billing").allowed).toBe(false);
    expect(engine.validateStateTransition("awaiting_gold_issue", "work_received").allowed).toBe(false);
  });

  it("6. Field requirement and visibility policies are enforced correctly", () => {
    const engine = useWorkflowEngine.getState();

    expect(engine.isFieldMandatory("grossMg")).toBe(true);
    expect(engine.isFieldMandatory("purity")).toBe(true);
    expect(engine.isFieldMandatory("wastagePct")).toBe(false);

    // Update field rule
    engine.updateFieldConfig("wastagePct", { requirement: "mandatory" });
    expect(engine.isFieldMandatory("wastagePct")).toBe(true);
  });

  it("7. Workflow Versioning: validates rules and creates immutable published versions", async () => {
    const engine = useWorkflowEngine.getState();

    const validation = engine.validateWorkflow();
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);

    const publishResult = await engine.publishWorkflow("Updated workshop bench loss rules and added 14K book");
    expect(publishResult.success).toBe(true);
    expect(publishResult.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(useWorkflowEngine.getState().config.activeVersion).toBe(publishResult.version);
    expect(useWorkflowEngine.getState().config.versions.length).toBeGreaterThanOrEqual(2);
  });

  it("8. AVS_OFFICIAL_DEFAULT_WORKFLOW is the immutable shop baseline", async () => {
    const { AVS_OFFICIAL_DEFAULT_WORKFLOW } = await import("../../src/lib/workflow-engine");
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW).toBeDefined();
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW.mode).toBe("manufacturing_only");
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW.mfgBillEnabled).toBe(true);
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW.mfgBillMandatoryBeforeDelivery).toBe(true);
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW.processes.length).toBeGreaterThanOrEqual(8);
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW.books.length).toBeGreaterThanOrEqual(4);
  });

  it("9. Multi-tenant inheritance & isolation: custom overrides on Tenant A do not mutate Tenant B or AVS Default", async () => {
    const {
      computeEffectiveWorkflow,
      AVS_OFFICIAL_DEFAULT_WORKFLOW,
      getTenantWorkflowConfig,
      saveTenantWorkflowConfig,
    } = await import("../../src/lib/workflow-engine");

    // Tenant A customizes: changes mode to retail_only and adds a custom process
    const tenantACfg = {
      tenantId: "tenant_jeweller_a",
      useOfficialDefault: false,
      activeVersion: "1.1.0",
      customOverrides: {
        mode: "retail_only" as BusinessMode,
        outsideWorkDefaultLabourMethod: "per_piece",
      },
    };
    saveTenantWorkflowConfig(tenantACfg);

    // Tenant B uses official default
    const tenantBCfg = getTenantWorkflowConfig("tenant_jeweller_b");
    expect(tenantBCfg.useOfficialDefault).toBe(true);

    const effectiveA = computeEffectiveWorkflow(tenantACfg);
    const effectiveB = computeEffectiveWorkflow(tenantBCfg);

    // Tenant A reflects overrides
    expect(effectiveA.mode).toBe("retail_only");
    expect(effectiveA.workflowScope).toBe("retail");
    expect(effectiveA.outsideWorkDefaultLabourMethod).toBe("per_piece");
    // Inherits base processes from AVS Default
    expect(effectiveA.processes.length).toBeGreaterThanOrEqual(8);

    // Tenant B remains on AVS Default
    expect(effectiveB.mode).toBe("manufacturing_only");
    expect(effectiveB.workflowScope).toBe("manufacturing");
    expect(effectiveB.outsideWorkDefaultLabourMethod).toBe("per_gram");

    // Master Default remains untouched
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW.mode).toBe("manufacturing_only");
    expect(AVS_OFFICIAL_DEFAULT_WORKFLOW.outsideWorkDefaultLabourMethod).toBe("per_gram");
  });

  it("10. Reset to AVS Default restores baseline while preserving historical audit versions", () => {
    const engine = useWorkflowEngine.getState();

    // Make custom changes
    engine.patch({ mode: "retail_only", outsideWorkDefaultLabourMethod: "fixed" });
    expect(useWorkflowEngine.getState().config.mode).toBe("retail_only");
    expect(useWorkflowEngine.getState().useOfficialDefault).toBe(false);

    // Reset to AVS default
    engine.resetToOfficialDefault();
    const restored = useWorkflowEngine.getState().config;
    expect(restored.mode).toBe("manufacturing_only");
    expect(restored.workflowScope).toBe("manufacturing");
    expect(restored.outsideWorkDefaultLabourMethod).toBe("per_gram");
    expect(useWorkflowEngine.getState().useOfficialDefault).toBe(true);
    expect(restored.versions.length).toBeGreaterThanOrEqual(2);
  });

  it("11. Historical transaction workflow version snapshot is recoverable", async () => {
    const engine = useWorkflowEngine.getState();

    await engine.publishWorkflow("Version 1.2.0 with custom hallmark policies");
    const snapshot = engine.getWorkflowVersionSnapshot("1.2.0");

    expect(snapshot).toBeDefined();
    expect(snapshot?.activeVersion).toBe("1.2.0");
    expect(snapshot?.processes.length).toBeGreaterThanOrEqual(8);
  });
});

describe("Universal AI Provider Abstraction", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("1. Registers all standard universal AI providers", () => {
    const providerKeys = Object.keys(AI_PROVIDERS) as AIProviderType[];
    expect(providerKeys.length).toBeGreaterThanOrEqual(7);

    expect(providerKeys).toContain("google_gemini");
    expect(providerKeys).toContain("openai");
    expect(providerKeys).toContain("anthropic");
    expect(providerKeys).toContain("azure_openai");
    expect(providerKeys).toContain("aws_bedrock");
    expect(providerKeys).toContain("self_hosted");
    expect(providerKeys).toContain("custom");
  });

  it("2. Masked API keys protect secrets and sanitize error logs", () => {
    const masked = maskApiKey("sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz");
    expect(masked).toBe("sk-p••••••••wxyz");

    const sanitized = sanitizeError("Error connecting with key AIzaSyD9876543210: 403 Forbidden");
    expect(sanitized).not.toContain("AIzaSyD9876543210");
  });

  it("3. Configures capability routing across different models and providers", () => {
    const initial = getAIConfig();
    const updated = {
      ...initial,
      capabilityRouting: {
        customer_summary: "anthropic" as AIProviderType,
        report_analysis: "google_gemini" as AIProviderType,
        private_local_inference: "self_hosted" as AIProviderType,
      },
    };
    saveAIConfig(updated);

    const loaded = getAIConfig();
    expect(loaded.capabilityRouting["customer_summary"]).toBe("anthropic");
    expect(loaded.capabilityRouting["report_analysis"]).toBe("google_gemini");
    expect(loaded.capabilityRouting["private_local_inference"]).toBe("self_hosted");
  });

  it("4. Connectivity test contract executes with latency measurement", async () => {
    const result = await testAIConnectivity("self_hosted", undefined, "llama3.2", "http://127.0.0.1:11434");
    expect(result).toBeDefined();
    expect(typeof result.latencyMs).toBe("number");
    expect(typeof result.message).toBe("string");
  });

  it("5. AIService generates structured response via ERP local heuristic fallback when offline", async () => {
    saveAIConfig({
      ...getAIConfig(),
      enabled: true,
      provider: "none",
    });

    const res = await AIService.generate({
      systemContext: "ERP System",
      userPrompt: "Give me the today summary and gold vault balance",
      capability: "summary",
    });

    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(res.content).toBeDefined();
  });
});
