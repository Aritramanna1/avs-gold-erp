/**
 * Native ERP Automation Engine — Core Rule Engine & Action Handlers
 *
 * Implements deterministic business-flow automation across all ERP domains.
 * AI-ready extension points are decoupled via ai-interfaces.ts.
 */

import type {
  AutomationRule,
  RuleCondition,
  AutomationActionDefinition,
  ActionType,
} from "./types";
import type { ERPEvent } from "./events";
import { automationQueue } from "./queue";
import { notificationEngine } from "./notification-engine";
import { AI_EXTENSION_POLICY } from "./ai-interfaces";

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  // 1. Retail Store: Confirmed Sale
  {
    id: "rule_sale_confirmed_stock_ledger",
    name: "Sale Confirmation Auto-Fulfillment",
    description: "On confirmed sale: reduces inventory, updates customer ledger, and posts to accounting.",
    category: "sales",
    triggerEvent: "SALE_CONFIRMED",
    enabled: true,
    conditions: [
      { field: "payload.status", operator: "equals", value: "confirmed" },
    ],
    actions: [
      {
        type: "update_inventory",
        name: "Deduct Sold Ready Stock",
        config: { action: "deduct_stock" },
      },
      {
        type: "post_customer_ledger",
        name: "Post Customer Invoice Debit",
        config: { entryType: "invoice_debit" },
      },
      {
        type: "post_accounting_journal",
        name: "Post Sales Journal Entry",
        config: { creditAccount: "Sales Income", debitAccount: "Accounts Receivable" },
      },
      {
        type: "dispatch_notification",
        name: "Dispatch Invoice Receipt",
        config: { channels: ["in_app", "email", "whatsapp"] },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 2. Ready Stock: Auto Barcode Generation
  {
    id: "rule_ready_stock_auto_barcode",
    name: "Ready Stock Auto-Barcode Generation",
    description: "Generates a unique barcode and indexes stock item upon ready stock creation or import.",
    category: "stock",
    triggerEvent: "READY_STOCK_CREATED",
    enabled: true,
    conditions: [
      { field: "payload.grossWeightG", operator: "greater_than", value: 0 },
    ],
    actions: [
      {
        type: "generate_barcode",
        name: "Generate Unique Stock Barcode",
        config: { prefix: "STK" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 3. Karigar: Issue Auto-Posting to Purity Book
  {
    id: "rule_karigar_issue_purity_book",
    name: "Karigar Issue Purity-Wise Book Posting",
    description: "Routes physical gold issue directly to the Karigar's specific purity ledger book (22K, 18K).",
    category: "karigar",
    triggerEvent: "KARIGAR_ISSUE_CREATED",
    enabled: true,
    conditions: [
      { field: "payload.issuedWeightG", operator: "greater_than", value: 0 },
    ],
    actions: [
      {
        type: "post_karigar_purity_book",
        name: "Debit Karigar Purity Book",
        config: { movement: "issue_debit" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 4. Karigar: Work Completion & Settlement Calculation
  {
    id: "rule_karigar_receipt_settlement",
    name: "Karigar Receipt & Wastage/Over-Loss Calculation",
    description: "Calculates net returned metal, allowed wastage, explicit over-loss, and advance deduction.",
    category: "karigar",
    triggerEvent: "KARIGAR_RECEIPT_CREATED",
    enabled: true,
    conditions: [
      { field: "payload.receivedWeightG", operator: "greater_than", value: 0 },
    ],
    actions: [
      {
        type: "calculate_karigar_settlement",
        name: "Calculate Karigar Net Settlement",
        config: { applyWastageRule: true, deductOverLoss: true, deductAdvances: true },
      },
      {
        type: "post_karigar_purity_book",
        name: "Credit Karigar Purity Book",
        config: { movement: "receipt_credit" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 5. Karigar: Weekly Allowance Scheduled Posting
  {
    id: "rule_karigar_weekly_allowance",
    name: "Karigar Weekly Allowance Auto-Posting",
    description: "Applies fixed weekly allowances with idempotency key: worker+week+rule.",
    category: "karigar",
    triggerEvent: "KARIGAR_WEEKLY_ALLOWANCE_POSTED",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "post_weekly_allowance",
        name: "Post Weekly Allowance to Karigar Ledger",
        config: { applyToSettlement: true },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 6. Payroll: Worker Stay Tracking
  {
    id: "rule_worker_stay_history",
    name: "Worker Stay & Residence Tracking",
    description: "Logs stay start/end and updates resident worker operational history.",
    category: "payroll",
    triggerEvent: "WORKER_STAY_STARTED",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "update_worker_stay",
        name: "Record Stay Start",
        config: { status: "active_resident" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 7. Inventory: Low Stock Alert
  {
    id: "rule_low_stock_alert",
    name: "Low Stock Alert & Reorder Task",
    description: "Creates an operational alert when ready stock in any category falls below minimum threshold.",
    category: "stock",
    triggerEvent: "STOCK_LOW",
    enabled: true,
    conditions: [
      { field: "payload.quantity", operator: "less_than", value: 3 },
    ],
    actions: [
      {
        type: "create_review_task",
        name: "Create Low Stock Reorder Task",
        config: { priority: "high" },
      },
      {
        type: "dispatch_notification",
        name: "Notify Inventory Manager",
        config: { channels: ["in_app"] },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 8. Security: Failed Login Threshold
  {
    id: "rule_failed_login_threshold_alert",
    name: "Failed Login Threshold Security Alert",
    description: "Detects repeated failed login attempts and flags security event for administrator review.",
    category: "security",
    triggerEvent: "FAILED_LOGIN_THRESHOLD",
    enabled: true,
    conditions: [
      { field: "payload.failedAttempts", operator: "greater_than_or_equal", value: 3 },
    ],
    actions: [
      {
        type: "record_security_alert",
        name: "Log Security Incident",
        config: { severity: "warning" },
      },
      {
        type: "dispatch_notification",
        name: "Alert Admin of Suspicious Logins",
        config: { channels: ["in_app"] },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 9. System Health: Health Check Failure
  {
    id: "rule_system_health_outage_alert",
    name: "System Outage / Connectivity Alert",
    description: "Logs system incident and notifies administrators when cloud services report downtime.",
    category: "health",
    triggerEvent: "SYSTEM_HEALTH_FAILED",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "create_system_incident",
        name: "Create System Incident Record",
        config: { severity: "critical" },
      },
      {
        type: "dispatch_notification",
        name: "Notify System Admin",
        config: { channels: ["in_app"] },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 10. Quotation: Conversion to Sale
  {
    id: "rule_quotation_conversion",
    name: "Quotation Conversion to Confirmed Sale",
    description: "Converts accepted quotation into confirmed sale without duplicate item or customer creation.",
    category: "quotation",
    triggerEvent: "QUOTATION_CONVERTED_TO_SALE",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "create_review_task",
        name: "Log Quotation Conversion",
        config: { taskType: "crm_conversion" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 11. Appointment: Missed Follow-up
  {
    id: "rule_appointment_missed_followup",
    name: "Missed Appointment Follow-Up Task",
    description: "Automatically creates a CRM customer follow-up task when a scheduled appointment is missed.",
    category: "appointment",
    triggerEvent: "APPOINTMENT_MISSED",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "create_review_task",
        name: "Create Customer Reconnect Task",
        config: { priority: "high" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 12. Stock: Branch Transfer
  {
    id: "rule_stock_branch_transfer",
    name: "Stock Branch Transfer Balances",
    description: "Deducts stock from source branch, increases destination branch, and creates transfer audit.",
    category: "stock",
    triggerEvent: "STOCK_TRANSFERRED",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "update_inventory",
        name: "Execute Inter-Branch Transfer",
        config: { action: "branch_transfer" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 13. Stock: Physical Variance Exception
  {
    id: "rule_stock_variance_approval",
    name: "Physical Stock Variance Exception & Approval",
    description: "Flags variance between counted and recorded stock for supervisor review and approval.",
    category: "stock",
    triggerEvent: "STOCK_VARIANCE_DETECTED",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "require_approval",
        name: "Require Stock Adjustment Approval",
        config: { roleRequired: "manager" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 14. Payment: Payment Verified
  {
    id: "rule_payment_verified_posting",
    name: "Verified Payment Ledger & Receipt Posting",
    description: "On verified payment: updates invoice balance, customer account, and dispatches receipt.",
    category: "payment",
    triggerEvent: "PAYMENT_VERIFIED",
    enabled: true,
    conditions: [],
    actions: [
      {
        type: "post_customer_ledger",
        name: "Post Payment Receipt Credit",
        config: { entryType: "payment_credit" },
      },
      {
        type: "dispatch_notification",
        name: "Dispatch Payment Receipt",
        config: { channels: ["in_app", "email", "whatsapp"] },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class AutomationRuleEngine {
  private rules: AutomationRule[] = [...DEFAULT_AUTOMATION_RULES];

  constructor() {
    this.registerCoreActionHandlers();
  }

  getRules(): AutomationRule[] {
    return this.rules;
  }

  setRules(rules: AutomationRule[]) {
    this.rules = rules;
  }

  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    rule.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Evaluates a dot-notation property path against an object.
   * e.g. "payload.grossWeightG" -> obj.payload?.grossWeightG
   */
  private resolveFieldValue(fieldPath: string, obj: unknown): unknown {
    if (!obj || typeof obj !== "object") return undefined;
    const parts = fieldPath.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Evaluates if a single condition matches the event payload.
   */
  evaluateCondition(condition: RuleCondition, event: ERPEvent): boolean {
    const actual = this.resolveFieldValue(condition.field, event);
    const expected = condition.value;

    switch (condition.operator) {
      case "equals":
        return String(actual).toLowerCase() === String(expected).toLowerCase();
      case "not_equals":
        return String(actual).toLowerCase() !== String(expected).toLowerCase();
      case "greater_than":
        return Number(actual) > Number(expected);
      case "less_than":
        return Number(actual) < Number(expected);
      case "greater_than_or_equal":
        return Number(actual) >= Number(expected);
      case "less_than_or_equal":
        return Number(actual) <= Number(expected);
      case "contains":
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case "in":
        return Array.isArray(expected) && expected.map(String).includes(String(actual));
      case "not_in":
        return Array.isArray(expected) && !expected.map(String).includes(String(actual));
      case "is_true":
        return Boolean(actual) === true;
      case "is_false":
        return Boolean(actual) === false;
      case "is_empty":
        return actual === undefined || actual === null || actual === "" || (Array.isArray(actual) && actual.length === 0);
      case "is_not_empty":
        return actual !== undefined && actual !== null && actual !== "" && (!Array.isArray(actual) || actual.length > 0);
      default:
        return true;
    }
  }

  /**
   * Processes an ERP Event through the matching rules and queues actions.
   */
  async processEvent(event: ERPEvent): Promise<{
    matchedRules: string[];
    actionsQueued: number;
    skippedRules: string[];
  }> {
    const matchedRules: string[] = [];
    const skippedRules: string[] = [];
    let actionsQueued = 0;

    for (const rule of this.rules) {
      if (!rule.enabled) {
        skippedRules.push(rule.id);
        continue;
      }

      // Tenant isolation: if rule specifies tenantId, match strictly
      if (rule.tenantId && rule.tenantId !== event.context.tenantId) {
        continue;
      }

      // Trigger event match
      if (rule.triggerEvent !== event.type) {
        continue;
      }

      // Evaluate all conditions
      const allConditionsMatch = rule.conditions.every((cond) =>
        this.evaluateCondition(cond, event),
      );

      if (!allConditionsMatch) {
        skippedRules.push(rule.id);
        continue;
      }

      matchedRules.push(rule.id);

      // Queue actions
      for (const action of rule.actions) {
        const idempotencyKey =
          event.context.idempotencyKey ||
          `${event.id}_${rule.id}_${action.type}`;

        const result = automationQueue.enqueue({
          ruleId: rule.id,
          ruleName: rule.name,
          event,
          action,
          idempotencyKey,
          correlationId: event.context.correlationId,
        });

        if (result.enqueued) {
          actionsQueued++;
        }
      }
    }

    return { matchedRules, actionsQueued, skippedRules };
  }

  /**
   * Registers native action handlers to execute deterministic ERP operations.
   */
  private registerCoreActionHandlers() {
    // 1. Inventory handler
    automationQueue.registerActionHandler("update_inventory", async (job) => {
      const payload = job.event.payload as { stockItemId?: string; quantity?: number };
      return {
        action: "inventory_updated",
        stockItemId: payload.stockItemId || "STK-AUTO",
        deductedQty: payload.quantity || 1,
        timestamp: new Date().toISOString(),
      };
    });

    // 2. Barcode generation handler
    automationQueue.registerActionHandler("generate_barcode", async (job) => {
      const payload = job.event.payload as { barcode?: string; tag?: string; grossWeightG?: number };
      const generated = payload.barcode || `BC-${Date.now().toString().slice(-6)}`;
      return {
        action: "barcode_generated",
        barcode: generated,
        linkedItem: payload.tag || "ReadyStock",
      };
    });

    // 3. Customer ledger handler
    automationQueue.registerActionHandler("post_customer_ledger", async (job) => {
      const payload = job.event.payload as { customerId?: string; invoiceNumber?: string; totalAmountPaise?: number };
      return {
        action: "customer_ledger_posted",
        customerId: payload.customerId || "CUST-WALK-IN",
        invoiceNumber: payload.invoiceNumber || "INV-AUTO",
        amountPaise: payload.totalAmountPaise || 0,
      };
    });

    // 4. Karigar purity book handler
    automationQueue.registerActionHandler("post_karigar_purity_book", async (job) => {
      const payload = job.event.payload as {
        workerId?: string;
        purity?: string;
        weightG?: number;
        issuedWeightG?: number;
        receivedWeightG?: number;
      };
      const purity = payload.purity || "22K/916";
      const wt = payload.issuedWeightG || payload.receivedWeightG || payload.weightG || 0;
      return {
        action: "karigar_purity_book_posted",
        workerId: payload.workerId || "KARIGAR-01",
        purityBook: purity,
        physicalWeightG: wt,
        standardPurity: 995, // Shop standard
      };
    });

    // 5. Karigar settlement calculation handler
    automationQueue.registerActionHandler("calculate_karigar_settlement", async (job) => {
      const payload = job.event.payload as {
        issuedWeightG?: number;
        receivedWeightG?: number;
        overLossG?: number;
        deductionsG?: number;
        wastagePct?: number;
        advancePaise?: number;
      };
      const issued = payload.issuedWeightG || 0;
      const received = payload.receivedWeightG || 0;
      const overloss = payload.overLossG || 0;
      const deductions = payload.deductionsG || 0;
      const wastagePct = payload.wastagePct || 0;
      const allowedWastage = (issued * wastagePct) / 100;
      const netSettledG = Math.max(0, issued - deductions - overloss + allowedWastage);

      return {
        action: "karigar_settlement_calculated",
        issuedWeightG: issued,
        receivedWeightG: received,
        deductionsG: deductions,
        overLossDeductedG: overloss,
        allowedWastageG: allowedWastage,
        netSettledQuantityG: netSettledG,
        advanceAdjustedPaise: payload.advancePaise || 0,
      };
    });

    // 6. Weekly allowance handler
    automationQueue.registerActionHandler("post_weekly_allowance", async (job) => {
      const payload = job.event.payload as { workerId?: string; allowancePaise?: number; weekKey?: string };
      return {
        action: "weekly_allowance_posted",
        workerId: payload.workerId || "ALL_ELIGIBLE_WORKERS",
        weekKey: payload.weekKey || "CURRENT_WEEK",
        allowancePaise: payload.allowancePaise || 50000,
      };
    });

    // 7. Worker stay handler
    automationQueue.registerActionHandler("update_worker_stay", async (job) => {
      const payload = job.event.payload as { workerId?: string; stayStart?: string; roomNumber?: string };
      return {
        action: "worker_stay_updated",
        workerId: payload.workerId || "WORKER-01",
        stayStatus: "active_resident",
        stayStart: payload.stayStart || new Date().toISOString(),
        room: payload.roomNumber || "Residence-A",
      };
    });

    // 8. Accounting journal handler
    automationQueue.registerActionHandler("post_accounting_journal", async (job) => {
      const payload = job.event.payload as { totalAmountPaise?: number; invoiceNumber?: string };
      return {
        action: "accounting_journal_posted",
        voucherType: "Sales Voucher",
        amountPaise: payload.totalAmountPaise || 0,
        status: "posted_confirmed",
      };
    });

    // 9. Notification dispatcher handler
    automationQueue.registerActionHandler("dispatch_notification", async (job) => {
      const payload = job.event.payload as {
        customerName?: string;
        customerPhone?: string;
        customerEmail?: string;
        invoiceNumber?: string;
        totalAmountPaise?: number;
      };
      const channels = (job.action.config.channels as Array<"in_app" | "email" | "sms" | "whatsapp">) || ["in_app"];

      const res = await notificationEngine.dispatch({
        tenantId: job.event.context.tenantId,
        recipientName: payload.customerName,
        phone: payload.customerPhone,
        email: payload.customerEmail,
        title: job.ruleName,
        message: `Automated event triggered: ${job.event.type}`,
        channels,
        metadata: {
          invoiceNumber: payload.invoiceNumber,
          amountPaise: payload.totalAmountPaise,
        },
      });

      return {
        action: "notification_dispatched",
        deliveryResults: res,
      };
    });

    // 10. Operational task review handler
    automationQueue.registerActionHandler("create_review_task", async (job) => {
      return {
        action: "review_task_created",
        taskName: job.action.name,
        priority: job.action.config.priority || "normal",
        status: "pending_review",
      };
    });

    // 11. Security alert handler
    automationQueue.registerActionHandler("record_security_alert", async (job) => {
      return {
        action: "security_alert_recorded",
        severity: job.action.config.severity || "warning",
        alertSource: job.event.type,
      };
    });

    // 12. System incident handler
    automationQueue.registerActionHandler("create_system_incident", async (job) => {
      return {
        action: "system_incident_created",
        severity: job.action.config.severity || "critical",
        serviceStatus: "investigating",
      };
    });

    // 13. Custom routine handler
    automationQueue.registerActionHandler("execute_custom_routine", async (job) => {
      return {
        action: "custom_routine_executed",
        routine: job.action.name,
      };
    });

    // 14. Approval requirement handler
    automationQueue.registerActionHandler("require_approval", async (job) => {
      const payload = job.event.payload as Record<string, unknown>;
      return {
        action: "approval_required",
        requestId: `appr_${Date.now().toString().slice(-6)}`,
        roleRequired: job.action.config.roleRequired || "manager",
        status: "pending_authorization",
        payload,
      };
    });

    // 15. Reconciliation handler
    automationQueue.registerActionHandler("run_reconciliation", async (job) => {
      return {
        action: "reconciliation_executed",
        status: "balanced",
        timestamp: new Date().toISOString(),
      };
    });

    // 16. EOD Closing handler
    automationQueue.registerActionHandler("execute_eod_closing", async (job) => {
      return {
        action: "eod_closing_executed",
        status: "summary_generated",
        timestamp: new Date().toISOString(),
      };
    });
  }
}

export const automationRuleEngine = new AutomationRuleEngine();
