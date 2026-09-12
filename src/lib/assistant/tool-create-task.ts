/**
 * AVS-68 — create_task PREPARE tool (assistant + MCP).
 * Returns a draft task card requiring human confirm before any write.
 * Uses existing tip universal-task-store on confirm — no invented DB schemas.
 */

import type { ERPActionCard } from "./assistant-types";
import { auditAssistantAction } from "./assistant-tool-registry";
import type { TaskPriority, UniversalTaskRecord } from "@/lib/universal-task-store";
import {
  getUniversalTasks,
  saveUniversalTasks,
} from "@/lib/universal-task-store";

export type CreateTaskDraft = {
  title: string;
  description: string;
  assignedStaff: string;
  dueDate: string;
  priority: TaskPriority;
  linkedEntityType: UniversalTaskRecord["linkedEntityType"];
  linkedEntityId: string;
  linkedEntityLabel: string;
};

const PRIORITY_RE = /\b(critical|high|medium|low)\b/i;
const DUE_ISO_RE = /\b(20\d{2}-\d{2}-\d{2})(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?\b/;
const ASSIGN_RE =
  /\b(?:assign(?:ed)?\s+to|for|@)\s+([A-Za-z][A-Za-z .'-]{1,60})/i;
const TITLE_RE =
  /\b(?:create\s+(?:a\s+)?(?:follow[-\s]?up\s+)?task|add\s+(?:a\s+)?task|new\s+task|remind(?:er)?)\b[:\s-]*(.+)$/i;

export function looksLikeCreateTaskIntent(q: string): boolean {
  const s = q.toLowerCase();
  if (s.includes("create task") || s.includes("add task") || s.includes("new task")) return true;
  if (s.includes("follow up task") || s.includes("follow-up task")) return true;
  if (s.includes("remind me") || s.includes("set a reminder") || s.includes("create reminder"))
    return true;
  if (s.includes("assign task") || s.includes("task for")) return true;
  return false;
}

function defaultDueDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

function normalizePriority(raw: string | undefined): TaskPriority {
  const p = (raw || "MEDIUM").toUpperCase();
  if (p === "CRITICAL" || p === "HIGH" || p === "MEDIUM" || p === "LOW") return p;
  return "MEDIUM";
}

/**
 * Build a structured draft from NL / structured params. Never writes storage.
 */
export function prepareCreateTaskDraft(input: {
  phrase?: string | null;
  title?: string | null;
  dueDate?: string | null;
  priority?: string | null;
  assignedStaff?: string | null;
  description?: string | null;
}): { ok: true; draft: CreateTaskDraft } | { ok: false; message: string } {
  const phrase = (input.phrase || "").trim();
  let title = (input.title || "").trim();

  if (!title && phrase) {
    const m = phrase.match(TITLE_RE);
    if (m?.[1]) title = m[1].trim();
    else if (looksLikeCreateTaskIntent(phrase)) {
      // Strip intent verbs; leftover becomes title if any
      title = phrase
        .replace(
          /\b(please\s+)?(create|add|new|assign|set)\s+(a\s+)?(follow[-\s]?up\s+)?(task|reminder)\b[:\s-]*/gi,
          "",
        )
        .trim();
    }
  }

  if (!title) {
    return {
      ok: false,
      message:
        "Need a task title. Example: create task Follow up Priya quotation due 2026-09-15 high",
    };
  }

  // Trim trailing priority/due/assign clauses from title when parsed from phrase
  let working = title;
  const priMatch = (input.priority || working).toString().match(PRIORITY_RE);
  const priority = normalizePriority(input.priority || priMatch?.[1]);
  if (!input.priority && priMatch) {
    working = working.replace(PRIORITY_RE, "").trim();
  }

  let dueDate = (input.dueDate || "").trim();
  if (!dueDate) {
    const dueMatch = (phrase || working).match(DUE_ISO_RE);
    if (dueMatch) {
      dueDate = dueMatch[1].includes("T") ? new Date(dueMatch[0]).toISOString() : `${dueMatch[1]}T17:00:00.000Z`;
      working = working.replace(DUE_ISO_RE, "").trim();
    }
  }
  if (!dueDate) dueDate = defaultDueDateIso();

  let assignedStaff = (input.assignedStaff || "").trim();
  if (!assignedStaff) {
    const a = (phrase || working).match(ASSIGN_RE);
    if (a?.[1]) {
      assignedStaff = a[1].trim().replace(/[.,;]+$/, "");
      working = working.replace(ASSIGN_RE, "").trim();
    }
  }
  if (!assignedStaff) assignedStaff = "Unassigned";

  const description = (input.description || "").trim() || working || title;
  if (working && working !== title && !input.title) {
    title = working.replace(/\s{2,}/g, " ").replace(/^[\s:-]+|[\s:-]+$/g, "") || title;
  }

  const draft: CreateTaskDraft = {
    title: title.slice(0, 200),
    description: description.slice(0, 2000),
    assignedStaff,
    dueDate,
    priority,
    linkedEntityType: "Finance",
    linkedEntityId: "ops",
    linkedEntityLabel: "Operational follow-up",
  };

  return { ok: true, draft };
}

export function buildCreateTaskConfirmCard(draft: CreateTaskDraft): ERPActionCard {
  return {
    type: "action_confirmation",
    title: `Draft Task: ${draft.title}`,
    summary: `Review & Confirm before saving. No task is written until you confirm.`,
    actionRoute: "/communications/",
    actionPayload: {
      actionId: `act_task_${Date.now()}`,
      actionType: "create_task",
      title: "Confirm Create Task",
      description: `Save task "${draft.title}" (${draft.priority}) due ${draft.dueDate.slice(0, 10)} assigned to ${draft.assignedStaff}. Uses existing tip universal task store.`,
      requiresConfirmation: true,
      targetType: "task",
      recipientName: draft.assignedStaff,
      details: { ...draft, store: "universal-task-store" },
    },
    kpis: [
      { label: "Title", value: draft.title },
      { label: "Priority", value: draft.priority },
      { label: "Due", value: draft.dueDate.slice(0, 10) },
      { label: "Assignee", value: draft.assignedStaff },
    ],
    data: {
      action: "create_task",
      prepareOnly: true,
      draft,
    },
  };
}

export async function toolCreateTask(userMessage: string): Promise<ERPActionCard> {
  const prepared = prepareCreateTaskDraft({ phrase: userMessage });

  if (!prepared.ok) {
    await auditAssistantAction({
      actionKey: "create_task",
      actionType: "suggest",
      status: "rejected",
      requiresConfirmation: true,
      requestPayload: { phrase: userMessage },
      errorMessage: prepared.message,
    });
    return {
      type: "search_results",
      title: "Task draft incomplete",
      summary: prepared.message,
      actionRoute: "/help",
      data: { action: "create_task", ok: false, message: prepared.message },
    };
  }

  const card = buildCreateTaskConfirmCard(prepared.draft);

  await auditAssistantAction({
    actionKey: "create_task",
    actionType: "suggest",
    status: "requested",
    requiresConfirmation: true,
    requestPayload: { phrase: userMessage },
    resultPayload: prepared.draft,
  });

  return card;
}

/** Persist only after human confirm — existing tip universal-task-store. */
export function commitCreateTaskDraft(draft: CreateTaskDraft): UniversalTaskRecord {
  const now = new Date().toISOString();
  const y = now.slice(0, 4);
  const seq = String(Date.now()).slice(-4);
  const record: UniversalTaskRecord = {
    id: `tsk-${Date.now()}`,
    taskCode: `AVS-TSK-${y}-${seq}`,
    title: draft.title,
    description: draft.description,
    assignedStaff: draft.assignedStaff,
    dueDate: draft.dueDate,
    priority: draft.priority,
    status: "PENDING",
    linkedEntityType: draft.linkedEntityType,
    linkedEntityId: draft.linkedEntityId,
    linkedEntityLabel: draft.linkedEntityLabel,
    createdAt: now,
  };

  const existing = getUniversalTasks();
  saveUniversalTasks([record, ...existing]);
  return record;
}
