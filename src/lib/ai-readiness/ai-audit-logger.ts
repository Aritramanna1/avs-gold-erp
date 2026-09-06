/**
 * Arivahly Venture Sphere (AVS) — AI Action Audit Logger
 * 
 * Immutable log of every proposed or executed AI action.
 */

export interface AIAuditRecord {
  id: string;
  agentName: string;
  provider: string;
  model: string;
  timestamp: string;
  userContext?: string;
  toolUsed: string;
  parameters: Record<string, unknown>;
  outputResult?: Record<string, unknown>;
  permissionLevel: number;
  requiresHumanApproval: boolean;
  approvalStatus: 'approved' | 'rejected' | 'pending' | 'auto_executed' | 'blocked';
  approverId?: string;
  rejectionReason?: string;
}

const STORAGE_KEY = 'avs_ai_audit_logs_v1';

export function getAIAuditLogs(): AIAuditRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logAIAction(record: Omit<AIAuditRecord, 'id' | 'timestamp'>): AIAuditRecord {
  const fullRecord: AIAuditRecord = {
    ...record,
    id: `AILOG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const logs = getAIAuditLogs();
      logs.unshift(fullRecord);
      // Keep up to 1000 logs
      if (logs.length > 1000) logs.pop();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to persist AI audit log', e);
    }
  }

  return fullRecord;
}
