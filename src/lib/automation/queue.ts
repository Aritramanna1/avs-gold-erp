/**
 * Native ERP Automation Engine — Idempotent Queue & Worker
 */

import type { JobQueueItem, JobStatus, RetryPolicy } from "./types";
import { automationAudit } from "./audit";

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};

type ActionExecutionHandler = (job: JobQueueItem) => Promise<Record<string, unknown> | void>;

class AutomationJobQueue {
  private queue: JobQueueItem[] = [];
  private processedKeys = new Map<string, { status: JobStatus; timestamp: number }>();
  private handlers = new Map<string, ActionExecutionHandler>();
  private isProcessing = false;
  private retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY;

  registerActionHandler(actionType: string, handler: ActionExecutionHandler) {
    this.handlers.set(actionType, handler);
  }

  enqueue(
    jobData: Omit<JobQueueItem, "id" | "status" | "attempts" | "maxAttempts" | "nextRunAt" | "createdAt">,
    customMaxAttempts?: number,
  ): { enqueued: boolean; job: JobQueueItem; isDuplicate?: boolean } {
    const existing = this.processedKeys.get(jobData.idempotencyKey);
    const now = Date.now();

    // Idempotency: Ignore duplicate execution if completed within last 1 hour
    if (existing && existing.status === "completed" && now - existing.timestamp < 3600000) {
      return {
        enqueued: false,
        isDuplicate: true,
        job: {
          ...jobData,
          id: `job_dedup_${jobData.idempotencyKey}`,
          status: "completed",
          attempts: 1,
          maxAttempts: customMaxAttempts || this.retryPolicy.maxAttempts,
          nextRunAt: now,
          createdAt: new Date(existing.timestamp).toISOString(),
          completedAt: new Date(existing.timestamp).toISOString(),
        },
      };
    }

    const job: JobQueueItem = {
      ...jobData,
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      attempts: 0,
      maxAttempts: customMaxAttempts || this.retryPolicy.maxAttempts,
      nextRunAt: now,
      createdAt: new Date().toISOString(),
    };

    this.queue.push(job);
    this.processedKeys.set(job.idempotencyKey, { status: "pending", timestamp: now });

    // Drain queue asynchronously in next tick
    this.scheduleDrain();

    return { enqueued: true, job };
  }

  private scheduleDrain() {
    if (this.isProcessing) return;
    setTimeout(() => {
      void this.drain();
    }, 10);
  }

  async drain(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const readyJobs = this.queue.filter(
        (j) => (j.status === "pending" || j.status === "retrying") && j.nextRunAt <= now,
      );

      for (const job of readyJobs) {
        job.status = "running";
        job.startedAt = new Date().toISOString();
        job.attempts += 1;

        const startTime = Date.now();
        const handler = this.handlers.get(job.action.type);

        if (!handler) {
          job.status = "failed";
          job.lastError = `No handler registered for action type "${job.action.type}"`;
          job.completedAt = new Date().toISOString();
          this.processedKeys.set(job.idempotencyKey, { status: "failed", timestamp: Date.now() });

          await automationAudit.log({
            tenantId: job.event.context.tenantId,
            branchId: job.event.context.branchId,
            eventId: job.event.id,
            eventType: job.event.type,
            ruleId: job.ruleId,
            ruleName: job.ruleName,
            actionType: job.action.type,
            actionName: job.action.name,
            status: "failed",
            actor: job.event.context.actorId || "system",
            durationMs: Date.now() - startTime,
            idempotencyKey: job.idempotencyKey,
            errorDetails: job.lastError,
          });
          continue;
        }

        try {
          const result = await handler(job);
          job.status = "completed";
          job.result = result || {};
          job.completedAt = new Date().toISOString();
          this.processedKeys.set(job.idempotencyKey, { status: "completed", timestamp: Date.now() });

          await automationAudit.log({
            tenantId: job.event.context.tenantId,
            branchId: job.event.context.branchId,
            eventId: job.event.id,
            eventType: job.event.type,
            ruleId: job.ruleId,
            ruleName: job.ruleName,
            actionType: job.action.type,
            actionName: job.action.name,
            status: "success",
            actor: job.event.context.actorId || "system",
            durationMs: Date.now() - startTime,
            idempotencyKey: job.idempotencyKey,
            metadata: job.result,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          job.lastError = errorMsg;

          if (job.attempts < job.maxAttempts) {
            job.status = "retrying";
            const delay =
              this.retryPolicy.initialDelayMs *
              Math.pow(this.retryPolicy.backoffMultiplier, job.attempts - 1);
            job.nextRunAt = Date.now() + delay;
          } else {
            job.status = "dead_letter";
            job.completedAt = new Date().toISOString();
            this.processedKeys.set(job.idempotencyKey, { status: "failed", timestamp: Date.now() });
          }

          await automationAudit.log({
            tenantId: job.event.context.tenantId,
            branchId: job.event.context.branchId,
            eventId: job.event.id,
            eventType: job.event.type,
            ruleId: job.ruleId,
            ruleName: job.ruleName,
            actionType: job.action.type,
            actionName: job.action.name,
            status: "failed",
            actor: job.event.context.actorId || "system",
            durationMs: Date.now() - startTime,
            idempotencyKey: job.idempotencyKey,
            errorDetails: `Attempt ${job.attempts}/${job.maxAttempts}: ${errorMsg}`,
          });
        }
      }
    } finally {
      this.isProcessing = false;
      // Re-schedule if retrying jobs remain
      const hasPending = this.queue.some(
        (j) => j.status === "pending" || j.status === "retrying",
      );
      if (hasPending) {
        setTimeout(() => {
          void this.drain();
        }, 1000);
      }
    }
  }

  retryJob(jobId: string): boolean {
    const job = this.queue.find((j) => j.id === jobId);
    if (!job) return false;
    job.status = "pending";
    job.nextRunAt = Date.now();
    job.attempts = 0;
    this.scheduleDrain();
    return true;
  }

  getAllJobs(limit = 100, tenantId?: string): JobQueueItem[] {
    let result = this.queue;
    if (tenantId) {
      result = result.filter((j) => j.event.context.tenantId === tenantId);
    }
    return result.slice().reverse().slice(0, limit);
  }

  clearQueue() {
    this.queue = [];
    this.processedKeys.clear();
  }
}

export const automationQueue = new AutomationJobQueue();
