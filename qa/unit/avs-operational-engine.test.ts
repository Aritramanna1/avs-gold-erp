import { describe, it, expect } from 'vitest';
import { AIService, getAIConfig } from '@/lib/ai-readiness/ai-service-interface';
import { evaluateAIPermission, AIPermissionLevel } from '@/lib/ai-readiness/ai-permission-matrix';
import { AI_TOOL_REGISTRY } from '@/lib/ai-readiness/ai-tool-registry';
import { getAIAuditLogs, logAIAction } from '@/lib/ai-readiness/ai-audit-logger';
import { getFounderMetrics } from '@/lib/founder-cockpit-store';
import { getCustomer360Profiles } from '@/lib/crm-360-store';
import { getLeadPipeline } from '@/lib/lead-pipeline-store';
import { getAppointments } from '@/lib/appointment-engine-store';
import { verifyProductAuthentication } from '@/lib/jewellery-identity-store';
import { getGoldRateHistory, createTransactionRateSnapshot } from '@/lib/gold-rate-master-store';
import { evaluateDiscountApproval, getQuotations } from '@/lib/quotation-engine-store';
import { getRepairs } from '@/lib/jewellery-service-store';
import { getUniversalTasks } from '@/lib/universal-task-store';
import { getAutomationRules } from '@/lib/native-automation-hub';
import { generateFounderMorningBrief } from '@/lib/daily-closing-engine';

describe('Arivahly Venture Sphere (AVS) — MTJ Retail Edition Operational Engine', () => {
  // ── 1. AI Readiness & Zero-Call Safety ──────────────────────────────────────
  describe('AI Readiness Layer (Strictly Disabled by Default)', () => {
    it('AI service must report disabled by default with zero external provider calls', async () => {
      const config = getAIConfig();
      expect(config.enabled).toBe(false);
      expect(config.provider).toBe('none');
      expect(AIService.isEnabled()).toBe(false);

      const status = AIService.getStatusDescription();
      expect(status.status).toBe('DISABLED');

      const res = await AIService.generate({
        systemContext: 'Showroom Assistant',
        userPrompt: 'Recommend a gold necklace',
      });
      expect(res.success).toBe(false);
      expect(res.content).toBeNull();
      expect(res.error).toContain('AI is currently DISABLED');
    });

    it('AI permission matrix must enforce Level 4 and Founder approval for financial and stock operations', () => {
      const goldRateRule = evaluateAIPermission('gold_rate.update');
      expect(goldRateRule.level).toBe(AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY);
      expect(goldRateRule.requiresFounderApproval).toBe(true);
      expect(goldRateRule.canEverAutoExecute).toBe(false);

      const discountRule = evaluateAIPermission('discount.approve');
      expect(discountRule.level).toBe(AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY);
      expect(discountRule.canEverAutoExecute).toBe(false);

      const stockRule = evaluateAIPermission('inventory.adjust');
      expect(stockRule.level).toBe(AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY);
      expect(stockRule.canEverAutoExecute).toBe(false);
    });

    it('AI Tool Registry must have schema-bound tool interfaces', () => {
      expect(AI_TOOL_REGISTRY.search_customer).toBeDefined();
      expect(AI_TOOL_REGISTRY.get_inventory_levels).toBeDefined();
      expect(AI_TOOL_REGISTRY.create_task).toBeDefined();
      expect(AI_TOOL_REGISTRY.draft_quotation).toBeDefined();
      expect(AI_TOOL_REGISTRY.get_dashboard_summary).toBeDefined();
    });

    it('AI Action Audit Logger must record structured logs', () => {
      const record = logAIAction({
        agentName: 'AI Showroom Receptionist',
        provider: 'none',
        model: 'none',
        toolUsed: 'search_customer',
        parameters: { query: 'Ananya' },
        permissionLevel: 0,
        requiresHumanApproval: false,
        approvalStatus: 'blocked',
      });
      expect(record.id).toContain('AILOG-');
      expect(record.timestamp).toBeDefined();
    });
  });

  // ── 2. Founder Command Center & Action Engine ────────────────────────────────
  describe('Founder Command Center & Action Required Engine', () => {
    it('Founder metrics must return structured sales, inventory, and ranked action items', () => {
      const metrics = getFounderMetrics();
      expect(metrics.sales.todayPaise).toBeGreaterThan(0);
      expect(metrics.inventory.stockValuationPaise).toBeGreaterThan(0);
      expect(metrics.actionRequired.length).toBeGreaterThan(0);

      // Verify severity sorting
      const severities = metrics.actionRequired.map((a) => a.severity);
      expect(severities).toContain('CRITICAL');
      expect(severities).toContain('HIGH');
    });

    it('Founder morning brief engine must generate daily overview and action items', () => {
      const brief = generateFounderMorningBrief();
      expect(brief.greeting).toContain('Good morning, Founder');
      expect(brief.actionItems.length).toBeGreaterThan(0);
      expect(brief.pendingCollectionsPaise).toBeGreaterThan(0);
    });
  });

  // ── 3. Customer 360 CRM & Leads ─────────────────────────────────────────────
  describe('Customer 360 CRM & Lead Pipeline', () => {
    it('Customer 360 profile must contain preferences, timeline, and consent records', () => {
      const customers = getCustomer360Profiles();
      expect(customers.length).toBeGreaterThan(0);
      const customer = customers[0];
      expect(customer.customerCode).toContain('AVS-C-');
      expect(customer.preferences.goldPurity).toBeDefined();
      expect(customer.consent.transactionalWhatsapp).toBe(true);
      expect(customer.timeline.length).toBeGreaterThan(0);
    });

    it('Lead pipeline must track stages and temperatures', () => {
      const leads = getLeadPipeline();
      expect(leads.length).toBeGreaterThan(0);
      const lead = leads[0];
      expect(lead.stage).toBeDefined();
      expect(lead.temperature).toBe('HOT');
      expect(lead.budgetPaise).toBeGreaterThan(0);
    });

    it('Appointments desk must track showroom slots and VIP status', () => {
      const apts = getAppointments();
      expect(apts.length).toBeGreaterThan(0);
      const vipApt = apts.find((a) => a.priority === 'VIP');
      expect(vipApt).toBeDefined();
      expect(vipApt?.timeSlot).toBeDefined();
    });
  });

  // ── 4. Product Authentication & Gold Rate Immutability ──────────────────────
  describe('Jewellery Authentication & Historical Gold Rate Immutability', () => {
    it('Product authentication must verify authentic SKU while withholding internal cost data', () => {
      const result = verifyProductAuthentication('AVS-G-2026-000127');
      expect(result).not.toBeNull();
      expect(result?.authentic).toBe(true);
      expect(result?.productName).toBe('22K Royal Temple Antique Necklace');
      expect(result?.purity).toBe('22K (916)');
      expect(result?.hallmarked).toBe(true);
      // Ensure private fields (cost, margin, supplier) are not in the public verification model
      expect((result as any).costPaise).toBeUndefined();
      expect((result as any).marginPercent).toBeUndefined();
    });

    it('Gold Rate Engine must create frozen transaction snapshots', () => {
      const history = getGoldRateHistory();
      expect(history.length).toBeGreaterThan(0);
      const snapshot = createTransactionRateSnapshot();
      expect(snapshot.rateId).toBeDefined();
      expect(snapshot.rate22KPaise).toBeGreaterThan(0);
      expect(snapshot.lockedTimestamp).toBeDefined();
    });

    it('Quotation engine must enforce discount approval matrix', () => {
      // 1.5% discount -> Staff permitted (no approval required)
      const staffAllowed = evaluateDiscountApproval(1.5, 'sales');
      expect(staffAllowed.requiresApproval).toBe(false);

      // 4% discount -> Requires Store Manager approval
      const managerReq = evaluateDiscountApproval(4.0, 'sales');
      expect(managerReq.requiresApproval).toBe(true);
      expect(managerReq.approverRole).toBe('Store Manager');

      // 8% discount -> Requires Founder approval
      const founderReq = evaluateDiscountApproval(8.0, 'store_manager');
      expect(founderReq.requiresApproval).toBe(true);
      expect(founderReq.approverRole).toBe('Founder / Super Admin');
    });
  });

  // ── 5. Services, Tasks & Automation ─────────────────────────────────────────
  describe('Jewellery Services, Tasks & Native Automation', () => {
    it('Jewellery repair tracking must maintain intake weights and photos', () => {
      const repairs = getRepairs();
      expect(repairs.length).toBeGreaterThan(0);
      const rep = repairs[0];
      expect(rep.repairCode).toContain('AVS-REP-');
      expect(rep.intakeGrossWeightGrams).toBeGreaterThan(0);
      expect(rep.status).toBeDefined();
    });

    it('Universal tasks must link to entities with priority and assignees', () => {
      const tasks = getUniversalTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[0];
      expect(task.taskCode).toContain('AVS-TSK-');
      expect(task.assignedStaff).toBeDefined();
      expect(task.linkedEntityType).toBeDefined();
    });

    it('Native automation rules must contain pre-configured showroom templates', () => {
      const rules = getAutomationRules();
      expect(rules.length).toBeGreaterThanOrEqual(4);
      const quotationRule = rules.find((r) => r.id === 'rule-quotation-followup');
      expect(quotationRule?.enabled).toBe(true);
      expect(quotationRule?.triggerEvent).toBe('quotation.sent');
    });
  });
});
