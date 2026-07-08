import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "./settings-store";
import { createRepository } from "./repositories/base-repository";

// opportunityToDb/taskToDb/interactionToDb below produce DB-row shapes distinct
// from the domain types (snake_case columns), so these repositories use a
// permissive row type rather than CRMLeadOpportunity/CRMTask/CRMInteraction.
const crmOpportunityRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "crm_leads_opportunities",
);
const crmTaskRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "crm_tasks_meetings",
);
const crmInteractionRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "crm_interactions",
);

export type OpportunityStage =
  "lead" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type PriorityLevel = "low" | "medium" | "high";
export type TaskType = "task" | "meeting" | "follow_up";
export type TaskStatus = "pending" | "completed" | "overdue" | "cancelled";
export type InteractionType =
  "note" | "call" | "meeting" | "whatsapp" | "email" | "sms" | "comment" | "system_event";

export interface CRMLeadOpportunity {
  id: string;
  branchId: string;
  personId?: string;
  leadName: string;
  stage: OpportunityStage;
  priority: PriorityLevel;
  estimatedValuePaise: number;
  targetGoldMg: number;
  assignedStaffEmail?: string;
  followUpDate?: string; // YYYY-MM-DD
  lastContactedAt?: string; // ISO
  remarks?: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMTaskMeeting {
  id: string;
  branchId: string;
  personId?: string;
  opportunityId?: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: PriorityLevel;
  dueDate: string; // ISO
  assignedStaffEmail?: string;
  description?: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMInteraction {
  id: string;
  branchId: string;
  personId: string;
  opportunityId?: string;
  type: InteractionType;
  title: string;
  body?: string;
  staffEmail?: string;
  data: Record<string, any>;
  createdAt: string;
}

interface CRMState {
  opportunities: CRMLeadOpportunity[];
  tasks: CRMTaskMeeting[];
  interactions: CRMInteraction[];
  loading: boolean;

  refresh: () => Promise<void>;

  // Opportunities CRUD
  saveOpportunity: (opp: CRMLeadOpportunity) => Promise<void>;
  deleteOpportunity: (id: string) => Promise<void>;
  moveStage: (id: string, newStage: OpportunityStage) => Promise<void>;

  // Tasks CRUD
  saveTask: (task: CRMTaskMeeting) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskCompleted: (id: string) => Promise<void>;

  // Interactions CRUD
  addInteraction: (
    interaction: Omit<CRMInteraction, "id" | "createdAt">,
  ) => Promise<CRMInteraction>;
  deleteInteraction: (id: string) => Promise<void>;
}

// Helpers to map DB <-> State
export function dbToOpportunity(row: any): CRMLeadOpportunity {
  return {
    id: row.id,
    branchId: row.branch_id,
    personId: row.person_id || undefined,
    leadName: row.lead_name,
    stage: row.stage,
    priority: row.priority || "medium",
    estimatedValuePaise: Number(row.estimated_value_paise || 0),
    targetGoldMg: Number(row.target_gold_mg || 0),
    assignedStaffEmail: row.assigned_staff_email || undefined,
    followUpDate: row.follow_up_date || undefined,
    lastContactedAt: row.last_contacted_at || undefined,
    remarks: row.remarks || undefined,
    data: row.data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function opportunityToDb(opp: CRMLeadOpportunity): { id: string } & Record<string, any> {
  return {
    id: opp.id,
    branch_id: opp.branchId,
    person_id: opp.personId || null,
    lead_name: opp.leadName,
    stage: opp.stage,
    priority: opp.priority,
    estimated_value_paise: opp.estimatedValuePaise,
    target_gold_mg: opp.targetGoldMg,
    assigned_staff_email: opp.assignedStaffEmail || null,
    follow_up_date: opp.followUpDate || null,
    last_contacted_at: opp.lastContactedAt || null,
    remarks: opp.remarks || null,
    data: opp.data,
  };
}

export function dbToTask(row: any): CRMTaskMeeting {
  return {
    id: row.id,
    branchId: row.branch_id,
    personId: row.person_id || undefined,
    opportunityId: row.opportunity_id || undefined,
    title: row.title,
    type: row.type,
    status: row.status || "pending",
    priority: row.priority || "medium",
    dueDate: row.due_date,
    assignedStaffEmail: row.assigned_staff_email || undefined,
    description: row.description || undefined,
    data: row.data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function taskToDb(task: CRMTaskMeeting): { id: string } & Record<string, any> {
  return {
    id: task.id,
    branch_id: task.branchId,
    person_id: task.personId || null,
    opportunity_id: task.opportunityId || null,
    title: task.title,
    type: task.type,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate,
    assigned_staff_email: task.assignedStaffEmail || null,
    description: task.description || null,
    data: task.data,
  };
}

export function dbToInteraction(row: any): CRMInteraction {
  return {
    id: row.id,
    branchId: row.branch_id,
    personId: row.person_id,
    opportunityId: row.opportunity_id || undefined,
    type: row.type,
    title: row.title,
    body: row.body || undefined,
    staffEmail: row.staff_email || undefined,
    data: row.data || {},
    createdAt: row.created_at,
  };
}

export function interactionToDb(i: CRMInteraction): { id: string } & Record<string, any> {
  return {
    id: i.id,
    branch_id: i.branchId,
    person_id: i.personId,
    opportunity_id: i.opportunityId || null,
    type: i.type,
    title: i.title,
    body: i.body || null,
    staff_email: i.staffEmail || null,
    data: i.data,
  };
}

export const useCRMStore = create<CRMState>()((set, get) => ({
  opportunities: [],
  tasks: [],
  interactions: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";

    try {
      let oppsQ = supabase.from("crm_leads_opportunities" as any).select("*");
      if (bid) oppsQ = (oppsQ as any).eq("branch_id", bid);

      let tasksQ = supabase.from("crm_tasks_meetings" as any).select("*");
      if (bid) tasksQ = (tasksQ as any).eq("branch_id", bid);

      let intersQ = supabase
        .from("crm_interactions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (bid) intersQ = (intersQ as any).eq("branch_id", bid);

      const [oppsRes, tasksRes, intersRes] = await Promise.all([oppsQ, tasksQ, intersQ]);

      if (oppsRes.error) throw new Error(`crm_leads_opportunities: ${oppsRes.error.message}`);
      if (tasksRes.error) throw new Error(`crm_tasks_meetings: ${tasksRes.error.message}`);
      if (intersRes.error) throw new Error(`crm_interactions: ${intersRes.error.message}`);

      const opportunities = (oppsRes.data || []).map(dbToOpportunity);
      const tasks = (tasksRes.data || []).map(dbToTask);
      const interactions = (intersRes.data || []).map(dbToInteraction);

      set({ opportunities, tasks, interactions });
    } catch (err) {
      console.error("Failed to fetch CRM data:", err);
    } finally {
      set({ loading: false });
    }
  },

  saveOpportunity: async (opp) => {
    const isNew = !opp.id || opp.id.length < 5;
    const finalOpp = {
      ...opp,
      id: isNew ? crypto.randomUUID() : opp.id,
      createdAt: opp.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((s) => {
      const filtered = s.opportunities.filter((o) => o.id !== finalOpp.id);
      return { opportunities: [...filtered, finalOpp] };
    });

    await crmOpportunityRepository.save(opportunityToDb(finalOpp));
  },

  deleteOpportunity: async (id) => {
    set((s) => ({ opportunities: s.opportunities.filter((o) => o.id !== id) }));
    await crmOpportunityRepository.delete(id);
  },

  moveStage: async (id, newStage) => {
    const opp = get().opportunities.find((o) => o.id === id);
    if (!opp) return;
    const updated = {
      ...opp,
      stage: newStage,
      updatedAt: new Date().toISOString(),
    };

    // Add history interaction event
    await get().addInteraction({
      branchId: opp.branchId,
      personId: opp.personId || "",
      opportunityId: opp.id,
      type: "system_event",
      title: `Moved to ${newStage.toUpperCase()}`,
      body: `Stage updated from ${opp.stage.toUpperCase()} to ${newStage.toUpperCase()}`,
      data: { oldStage: opp.stage, newStage },
    });

    set((s) => ({
      opportunities: s.opportunities.map((o) => (o.id === id ? updated : o)),
    }));
    await crmOpportunityRepository.save(opportunityToDb(updated));
  },

  saveTask: async (task) => {
    const isNew = !task.id || task.id.length < 5;
    const finalTask = {
      ...task,
      id: isNew ? crypto.randomUUID() : task.id,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((s) => {
      const filtered = s.tasks.filter((t) => t.id !== finalTask.id);
      return { tasks: [...filtered, finalTask] };
    });

    await crmTaskRepository.save(taskToDb(finalTask));
  },

  deleteTask: async (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    await crmTaskRepository.delete(id);
  },

  toggleTaskCompleted: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const updated = {
      ...task,
      status: newStatus as TaskStatus,
      updatedAt: new Date().toISOString(),
    };

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
    }));
    await crmTaskRepository.save(taskToDb(updated));
  },

  addInteraction: async (input) => {
    const item: CRMInteraction = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    set((s) => ({ interactions: [item, ...s.interactions] }));
    await crmInteractionRepository.save(interactionToDb(item));
    return item;
  },

  deleteInteraction: async (id) => {
    set((s) => ({ interactions: s.interactions.filter((i) => i.id !== id) }));
    await crmInteractionRepository.delete(id);
  },
}));
