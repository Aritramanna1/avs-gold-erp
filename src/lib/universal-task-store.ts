/**
 * Arivahly Venture Sphere (AVS) — Universal Task & Follow-up Engine
 * 
 * Supports tasks attachable to any entity:
 * Customer | Lead | Quotation | Appointment | Repair | Inventory Discrepancy | Supplier
 */

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface UniversalTaskRecord {
  id: string;
  taskCode: string; // e.g. AVS-TSK-2026-0104
  title: string;
  description: string;
  assignedStaff: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  linkedEntityType: 'Customer' | 'Lead' | 'Quotation' | 'Appointment' | 'Repair' | 'Inventory' | 'Finance';
  linkedEntityId: string;
  linkedEntityLabel: string;
  reminderDate?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
}

const STORAGE_KEY = 'avs_universal_tasks_v1';

export function getSampleTasks(): UniversalTaskRecord[] {
  return [
    {
      id: 'tsk-1',
      taskCode: 'AVS-TSK-2026-0104',
      title: 'Follow up on Quotation AVS-Q-1048 (Priya Sharma)',
      description: 'Call customer regarding 22K Royal Temple Set quotation terms before validity expires.',
      assignedStaff: 'Rohan Mehta',
      dueDate: '2026-09-07T11:00:00Z',
      priority: 'HIGH',
      status: 'PENDING',
      linkedEntityType: 'Quotation',
      linkedEntityId: 'q-1048',
      linkedEntityLabel: 'AVS-Q-2026-1048 · ₹3.92L',
      createdAt: '2026-09-05T10:00:00Z',
    },
    {
      id: 'tsk-2',
      taskCode: 'AVS-TSK-2026-0105',
      title: 'Prepare VIP Viewing Room for Ananya Sengupta',
      description: 'Ensure requested Royal Temple items are transferred from Safe B to Private Viewing Desk 1.',
      assignedStaff: 'Sanjay Verma',
      dueDate: '2026-09-06T11:00:00Z',
      priority: 'CRITICAL',
      status: 'PENDING',
      linkedEntityType: 'Appointment',
      linkedEntityId: 'apt-1',
      linkedEntityLabel: 'AVS-APT-2026-0041 · 11:30 AM',
      createdAt: '2026-09-05T18:00:00Z',
    },
    {
      id: 'tsk-3',
      taskCode: 'AVS-TSK-2026-0106',
      title: 'Notify Sunita Mehra: Diamond Ring Sizing Complete',
      description: 'Repair #AVS-REP-2026-0035 passed quality check. Send ready for pickup WhatsApp alert.',
      assignedStaff: 'Pooja Sen',
      dueDate: '2026-09-06T14:00:00Z',
      priority: 'MEDIUM',
      status: 'PENDING',
      linkedEntityType: 'Repair',
      linkedEntityId: 'rep-2',
      linkedEntityLabel: 'AVS-REP-2026-0035 · Ring Sizing',
      createdAt: '2026-09-06T10:30:00Z',
    },
  ];
}

export function getUniversalTasks(): UniversalTaskRecord[] {
  if (typeof window === 'undefined') return getSampleTasks();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getSampleTasks();
  } catch {
    return getSampleTasks();
  }
}

export function saveUniversalTasks(tasks: UniversalTaskRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
