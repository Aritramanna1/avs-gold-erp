/**
 * Arivahly Venture Sphere (AVS) — Native Rule-Based Automation Engine
 * 
 * Deterministic Engine: EVENT → CONDITIONS → ACTION → AUDIT LOG
 * 
 * Pre-configured Native Automation Templates:
 * 1. New Quotation Created → Schedule Expiry Follow-up Task
 * 2. Appointment Booked → Create Preparation Task & Confirmation Queue
 * 3. High-Value Lead Created → Notify Showroom Founder
 * 4. Repair Quality Check Passed → Create Customer Pickup Notification Task
 * 5. Customer Birthday / Anniversary Approaching → Create Relationship Review Task
 * 6. Inventory Discrepancy Flagged → Create Urgent Safe Audit Task
 */

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  conditionDescription: string;
  actionType: 'CREATE_TASK' | 'QUEUE_NOTIFICATION' | 'TRIGGER_APPROVAL' | 'MOVE_STAGE';
  actionPayloadTemplate: Record<string, unknown>;
  enabled: boolean;
  totalExecutionsCount: number;
  lastExecutedAt?: string;
  lastExecutionStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED';
}

export interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerEvent: string;
  eventPayload: Record<string, unknown>;
  actionResult: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  timestamp: string;
  executionDurationMs: number;
}

const STORAGE_KEY_RULES = 'avs_native_automation_rules_v1';
const STORAGE_KEY_LOGS = 'avs_native_automation_logs_v1';

export function getDefaultAutomationRules(): AutomationRule[] {
  return [
    {
      id: 'rule-quotation-followup',
      name: 'Quotation Expiry Follow-up',
      description: 'When a quotation is sent, automatically generate a follow-up task 24 hours before expiration.',
      triggerEvent: 'quotation.sent',
      conditionDescription: 'Quotation final amount >= ₹1,00,000',
      actionType: 'CREATE_TASK',
      actionPayloadTemplate: {
        title: 'Follow-up on quotation {{quotation.number}}',
        priority: 'HIGH',
      },
      enabled: true,
      totalExecutionsCount: 42,
      lastExecutedAt: '2026-09-05T10:00:00Z',
      lastExecutionStatus: 'SUCCESS',
    },
    {
      id: 'rule-appointment-prep',
      name: 'VIP Appointment Room Prep',
      description: 'When a VIP bridal or diamond appointment is confirmed, create a preparation task for the showroom manager.',
      triggerEvent: 'appointment.confirmed',
      conditionDescription: 'Appointment priority == VIP',
      actionType: 'CREATE_TASK',
      actionPayloadTemplate: {
        title: 'Prepare VIP room for {{customer.name}}',
        priority: 'CRITICAL',
      },
      enabled: true,
      totalExecutionsCount: 19,
      lastExecutedAt: '2026-09-05T18:00:00Z',
      lastExecutionStatus: 'SUCCESS',
    },
    {
      id: 'rule-repair-ready',
      name: 'Repair Ready Customer Notification',
      description: 'When jewellery repair passes final quality check, queue ready-for-pickup WhatsApp message.',
      triggerEvent: 'repair.quality_checked',
      conditionDescription: 'Quality check status == PASS',
      actionType: 'CREATE_TASK',
      actionPayloadTemplate: {
        title: 'Send pickup notification for repair {{repair.code}}',
        priority: 'MEDIUM',
      },
      enabled: true,
      totalExecutionsCount: 58,
      lastExecutedAt: '2026-09-06T10:30:00Z',
      lastExecutionStatus: 'SUCCESS',
    },
    {
      id: 'rule-birthday-outreach',
      name: 'VIP Birthday Relationship Outreach',
      description: 'Generate customer relationship outreach task 3 days before VIP client birthday.',
      triggerEvent: 'customer.birthday_approaching',
      conditionDescription: 'Customer tier == VIP or Lifetime Value >= ₹5,00,000',
      actionType: 'CREATE_TASK',
      actionPayloadTemplate: {
        title: 'Personalized birthday greeting for {{customer.name}}',
        priority: 'LOW',
      },
      enabled: true,
      totalExecutionsCount: 88,
      lastExecutedAt: '2026-09-04T08:00:00Z',
      lastExecutionStatus: 'SUCCESS',
    },
  ];
}

export function getAutomationRules(): AutomationRule[] {
  if (typeof window === 'undefined') return getDefaultAutomationRules();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RULES);
    return raw ? JSON.parse(raw) : getDefaultAutomationRules();
  } catch {
    return getDefaultAutomationRules();
  }
}

export function saveAutomationRules(rules: AutomationRule[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
}
