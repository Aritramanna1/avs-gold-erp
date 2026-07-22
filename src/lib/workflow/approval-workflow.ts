/**
 * Generic Approval Workflow Engine (Priority 5).
 *
 * A reusable request/approve/reject flow any module can build on — a
 * discount override, a settlement dispute, a manual stock adjustment, a
 * financial-lock unlock, whatever needs "someone with authority must sign
 * off before this takes effect." This module only manages the REQUEST
 * lifecycle (pending -> approved/rejected); it deliberately does not know
 * what "applying" an approved request means for any specific entity type —
 * that stays with the calling module, which reads back an approved
 * request's status and then performs its own domain-specific action.
 *
 * Every request, approval, and rejection is itself an audited action (Step
 * 8) — "every approval must be fully auditable" is satisfied structurally,
 * not just documented.
 */
import { createRepository } from "@/lib/repositories/base-repository";
import { append as appendAudit } from "@/lib/security/audit-log";
import { getCloudDataClient as getRawSupabaseClient } from "@/lib/providers/data-provider";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  requestedById: string | null;
  requestedByEmail: string | null;
  requestedAt: number;
  status: ApprovalStatus;
  decidedById: string | null;
  decidedByEmail: string | null;
  decidedAt: number | null;
  decisionNote: string | null;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `appr_${crypto.randomUUID()}`;
  return `appr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const approvalRepository = createRepository<ApprovalRequest>("approval_requests");

export async function requestApproval(
  entityType: string,
  entityId: string,
  reason: string,
  actor: { id: string | null; email: string | null },
): Promise<ApprovalRequest> {
  const request: ApprovalRequest = {
    id: makeId(),
    entityType,
    entityId,
    reason,
    requestedById: actor.id,
    requestedByEmail: actor.email,
    requestedAt: Date.now(),
    status: "pending",
    decidedById: null,
    decidedByEmail: null,
    decidedAt: null,
    decisionNote: null,
  };
  await approvalRepository.save(request);
  await appendAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "approval_workflow.requested",
    entityType,
    entityId,
    before: null,
    after: request,
    deviceId: null,
  });
  return request;
}

/**
 * Always reads the request fresh from Supabase, never from any local
 * cache — the "is this still pending?" check below is exactly the kind of
 * read that must never see stale data. A cached copy (e.g. from an
 * earlier `.read()` call elsewhere) could still show "pending" after
 * another actor has already decided it, which would let two approvers
 * race past this guard and both "successfully" decide the same request.
 */
async function fetchCurrentRequest(requestId: string): Promise<ApprovalRequest | null> {
  const client = getRawSupabaseClient();
  const { data, error } = await client
    .from("approval_requests" as any)
    .select("id, data")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown as { id: string; data: ApprovalRequest }).data;
}

async function decide(
  requestId: string,
  status: "approved" | "rejected",
  actor: { id: string | null; email: string | null },
  note?: string,
): Promise<ApprovalRequest | null> {
  const request = await fetchCurrentRequest(requestId);
  if (!request) return null;
  if (request.status !== "pending") {
    throw new Error(
      `Approval request ${requestId} has already been ${request.status} — cannot decide twice.`,
    );
  }

  const updated: ApprovalRequest = {
    ...request,
    status,
    decidedById: actor.id,
    decidedByEmail: actor.email,
    decidedAt: Date.now(),
    decisionNote: note ?? null,
  };
  await approvalRepository.save(updated);
  await appendAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: `approval_workflow.${status}`,
    entityType: request.entityType,
    entityId: request.entityId,
    before: request,
    after: updated,
    deviceId: null,
  });
  return updated;
}

export function approveRequest(
  requestId: string,
  actor: { id: string | null; email: string | null },
  note?: string,
): Promise<ApprovalRequest | null> {
  return decide(requestId, "approved", actor, note);
}

export function rejectRequest(
  requestId: string,
  actor: { id: string | null; email: string | null },
  note?: string,
): Promise<ApprovalRequest | null> {
  return decide(requestId, "rejected", actor, note);
}

/**
 * Fetches every request fresh from Supabase — same reasoning as
 * fetchCurrentRequest(): approval status is exactly the kind of data a
 * stale cache must never be allowed to misrepresent (a pending
 * item that was actually just approved elsewhere must not still show as
 * pending here). A failed cloud request returns an empty result.
 */
async function fetchAllRequests(): Promise<ApprovalRequest[]> {
  try {
    const client = getRawSupabaseClient();
    const { data, error } = await client.from("approval_requests" as any).select("id, data");
    if (error || !data) throw error ?? new Error("No data");
    return (data as unknown as Array<{ id: string; data: ApprovalRequest }>).map((row) => row.data);
  } catch {
    return [];
  }
}

export async function getPendingApprovals(entityType?: string): Promise<ApprovalRequest[]> {
  const all = await fetchAllRequests();
  return all
    .filter((r) => r.status === "pending")
    .filter((r) => !entityType || r.entityType === entityType)
    .sort((a, b) => a.requestedAt - b.requestedAt);
}

export async function getApprovalHistory(
  entityType: string,
  entityId: string,
): Promise<ApprovalRequest[]> {
  const all = await fetchAllRequests();
  return all
    .filter((r) => r.entityType === entityType && r.entityId === entityId)
    .sort((a, b) => a.requestedAt - b.requestedAt);
}
