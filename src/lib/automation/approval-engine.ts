/**
 * Native ERP Automation Engine — Reusable Approval Engine
 *
 * Enforces human review & authorization for high-risk operations:
 * - Large discount (> configured threshold)
 * - High-value expense (> configured threshold)
 * - Stock count variance (> threshold)
 * - Unusual gold adjustment
 * - Manual ledger adjustments
 * - Period-locked transaction modifications
 */

import type { ApprovalRequest, ApprovalStatus } from "./types";
import { createRepository } from "@/lib/repositories/base-repository";
import { automationAudit } from "./audit";

const approvalRepo = createRepository<ApprovalRequest & { id: string }>("automation_approvals");

export class ApprovalEngine {
  private requests: ApprovalRequest[] = [];
  private maxInMemory = 200;

  async createRequest(
    data: Omit<ApprovalRequest, "id" | "status" | "createdAt">,
  ): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      ...data,
      id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    this.requests.unshift(request);
    if (this.requests.length > this.maxInMemory) {
      this.requests.pop();
    }

    approvalRepo.save(request).catch(() => {});

    await automationAudit.log({
      tenantId: request.tenantId,
      eventId: `evt_${request.id}`,
      eventType: "APPROVAL_REQUESTED",
      sourceTransactionId: request.sourceTransactionId,
      ruleId: "rule_approval_engine",
      ruleName: "High-Risk Operation Approval Required",
      actionType: "require_approval",
      actionName: `Approval Required: ${request.title}`,
      status: "approval_pending",
      actor: request.requestedBy,
      durationMs: 0,
      metadata: { requestType: request.type, threshold: request.thresholdValue, actual: request.actualValue },
    });

    return request;
  }

  async resolveRequest(
    requestId: string,
    action: "approve" | "reject",
    reviewer: string,
    notes?: string,
  ): Promise<{ success: boolean; request?: ApprovalRequest; error?: string }> {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) {
      return { success: false, error: `Approval request ${requestId} not found` };
    }
    if (req.status !== "pending") {
      return { success: false, error: `Request ${requestId} is already ${req.status}` };
    }

    req.status = action === "approve" ? "approved" : "rejected";
    req.reviewedBy = reviewer;
    req.reviewNotes = notes;
    req.reviewedAt = new Date().toISOString();

    approvalRepo.save(req).catch(() => {});

    await automationAudit.log({
      tenantId: req.tenantId,
      eventId: `evt_res_${req.id}`,
      eventType: action === "approve" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
      sourceTransactionId: req.sourceTransactionId,
      ruleId: "rule_approval_engine",
      ruleName: "High-Risk Operation Authorization",
      actionType: "require_approval",
      actionName: `Approval ${action.toUpperCase()}: ${req.title}`,
      status: action === "approve" ? "success" : "skipped",
      actor: reviewer,
      durationMs: 0,
      metadata: { notes, reviewedStatus: req.status },
    });

    return { success: true, request: req };
  }

  getPendingRequests(tenantId?: string): ApprovalRequest[] {
    let list = this.requests.filter((r) => r.status === "pending");
    if (tenantId) {
      list = list.filter((r) => r.tenantId === tenantId);
    }
    return list;
  }

  getAllRequests(tenantId?: string, limit = 100): ApprovalRequest[] {
    let list = this.requests;
    if (tenantId) {
      list = list.filter((r) => r.tenantId === tenantId);
    }
    return list.slice(0, limit);
  }

  async loadPersisted(tenantId?: string): Promise<ApprovalRequest[]> {
    try {
      const records = await approvalRepo.readAll();
      if (Array.isArray(records) && records.length > 0) {
        const filtered = records.filter((r) => !tenantId || r.tenantId === tenantId);
        this.requests = [...filtered, ...this.requests]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, this.maxInMemory);
      }
    } catch {
      // Continue with in-memory
    }
    return this.requests;
  }
}

export const approvalEngine = new ApprovalEngine();
