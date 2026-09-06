/**
 * Arivahly Venture Sphere (AVS) — AI Permission & Safety Matrix
 * 
 * Levels:
 * Level 0 — Read Only: AI can only retrieve public or authorized metadata.
 * Level 1 — Draft: AI can prepare draft communications, notes, or tasks.
 * Level 2 — Recommend: AI can suggest actions or product matches.
 * Level 3 — Execute Low-Risk: AI can execute explicitly whitelisted low-risk actions (e.g. tag customer).
 * Level 4 — Human Approval Required: All financial, stock, discount, or pricing actions.
 */

export enum AIPermissionLevel {
  LEVEL_0_READ_ONLY = 0,
  LEVEL_1_DRAFT = 1,
  LEVEL_2_RECOMMEND = 2,
  LEVEL_3_EXECUTE_LOW_RISK = 3,
  LEVEL_4_HUMAN_APPROVAL_MANDATORY = 4,
}

export interface AIPermissionRule {
  actionName: string;
  category: 'financial' | 'inventory' | 'customer' | 'communication' | 'marketing' | 'system';
  level: AIPermissionLevel;
  canEverAutoExecute: boolean;
  requiresFounderApproval: boolean;
  description: string;
}

export const AI_SAFETY_RULES: Record<string, AIPermissionRule> = {
  // FINANCIAL & PRICING — ALWAYS LEVEL 4 (NEVER AUTONOMOUS)
  'gold_rate.update': {
    actionName: 'gold_rate.update',
    category: 'financial',
    level: AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY,
    canEverAutoExecute: false,
    requiresFounderApproval: true,
    description: 'Modifying official showroom gold or silver rates.',
  },
  'discount.approve': {
    actionName: 'discount.approve',
    category: 'financial',
    level: AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY,
    canEverAutoExecute: false,
    requiresFounderApproval: true,
    description: 'Approving commercial discounts on quotations or bills.',
  },
  'payment.refund': {
    actionName: 'payment.refund',
    category: 'financial',
    level: AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY,
    canEverAutoExecute: false,
    requiresFounderApproval: true,
    description: 'Issuing customer refunds or payment reversals.',
  },
  'invoice.cancel': {
    actionName: 'invoice.cancel',
    category: 'financial',
    level: AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY,
    canEverAutoExecute: false,
    requiresFounderApproval: true,
    description: 'Cancelling or amending authoritative tax invoices.',
  },

  // INVENTORY & STOCK — ALWAYS LEVEL 4
  'inventory.adjust': {
    actionName: 'inventory.adjust',
    category: 'inventory',
    level: AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY,
    canEverAutoExecute: false,
    requiresFounderApproval: true,
    description: 'Manually adjusting physical inventory counts or stock write-offs.',
  },
  'inventory.move': {
    actionName: 'inventory.move',
    category: 'inventory',
    level: AIPermissionLevel.LEVEL_3_EXECUTE_LOW_RISK,
    canEverAutoExecute: false,
    requiresFounderApproval: false,
    description: 'Recording physical movement between showroom trays and safe.',
  },

  // DRAFTING & COMMUNICATIONS — LEVEL 1
  'communication.draft_message': {
    actionName: 'communication.draft_message',
    category: 'communication',
    level: AIPermissionLevel.LEVEL_1_DRAFT,
    canEverAutoExecute: false,
    requiresFounderApproval: false,
    description: 'Preparing draft WhatsApp or email message for staff review.',
  },
  'quotation.draft': {
    actionName: 'quotation.draft',
    category: 'financial',
    level: AIPermissionLevel.LEVEL_1_DRAFT,
    canEverAutoExecute: false,
    requiresFounderApproval: false,
    description: 'Drafting initial quotation for salesperson review.',
  },
  'task.create': {
    actionName: 'task.create',
    category: 'system',
    level: AIPermissionLevel.LEVEL_3_EXECUTE_LOW_RISK,
    canEverAutoExecute: true,
    requiresFounderApproval: false,
    description: 'Creating a follow-up or relationship reminder task.',
  },

  // READ ONLY — LEVEL 0
  'customer.search': {
    actionName: 'customer.search',
    category: 'customer',
    level: AIPermissionLevel.LEVEL_0_READ_ONLY,
    canEverAutoExecute: true,
    requiresFounderApproval: false,
    description: 'Searching customer directory and viewing CRM profiles.',
  },
  'inventory.search': {
    actionName: 'inventory.search',
    category: 'inventory',
    level: AIPermissionLevel.LEVEL_0_READ_ONLY,
    canEverAutoExecute: true,
    requiresFounderApproval: false,
    description: 'Looking up product SKU or showroom stock availability.',
  },
};

export function evaluateAIPermission(actionName: string): AIPermissionRule {
  return AI_SAFETY_RULES[actionName] ?? {
    actionName,
    category: 'system',
    level: AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY,
    canEverAutoExecute: false,
    requiresFounderApproval: true,
    description: 'Unclassified action defaulting to mandatory human approval.',
  };
}
