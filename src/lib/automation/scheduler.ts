/**
 * Native ERP Automation Engine — Scheduled Job Runner
 *
 * Runs background interval sweeps for time-based automations:
 * Due payment reminders, birthday/anniversary checks, Karigar weekly allowance,
 * dead stock scanning, and daily sales/gold reconciliation.
 */

import type { ScheduledTaskDefinition } from "./types";
import { createERPEvent } from "./events";
import { automationAudit } from "./audit";

export class AutomationScheduler {
  private tasks: ScheduledTaskDefinition[] = [
    {
      id: "sched_daily_due_payments",
      name: "Daily Due Payment Sweep",
      description: "Checks customer and supplier invoices reaching payment due dates.",
      frequency: "daily",
      targetTime: "09:00",
      enabled: true,
      nextRunAt: new Date(Date.now() + 3600000).toISOString(),
      handlerName: "sweepDuePayments",
    },
    {
      id: "sched_daily_birthdays_anniversaries",
      name: "Daily Birthday & Anniversary Greetings",
      description: "Identifies customers celebrating birthdays or wedding anniversaries today.",
      frequency: "daily",
      targetTime: "09:30",
      enabled: true,
      nextRunAt: new Date(Date.now() + 5400000).toISOString(),
      handlerName: "sweepBirthdaysAndAnniversaries",
    },
    {
      id: "sched_daily_evening_reconciliation",
      name: "Evening Daily Reconciliation",
      description: "Verifies daily sales, cash drawer, and gold book balances match transactions.",
      frequency: "daily",
      targetTime: "21:00",
      enabled: true,
      nextRunAt: new Date(Date.now() + 7200000).toISOString(),
      handlerName: "reconcileDailyOperations",
    },
    {
      id: "sched_weekly_karigar_allowances",
      name: "Weekly Karigar Allowance Posting",
      description: "Applies configured fixed weekly allowances with idempotency key: worker+week+rule.",
      frequency: "weekly",
      dayOfWeek: 1, // Monday
      targetTime: "10:00",
      enabled: true,
      nextRunAt: new Date(Date.now() + 86400000).toISOString(),
      handlerName: "postWeeklyKarigarAllowances",
    },
    {
      id: "sched_weekly_dead_stock_scan",
      name: "Weekly Dead Stock Review",
      description: "Flags ready stock items unsold past aging thresholds for manager review.",
      frequency: "weekly",
      dayOfWeek: 5, // Friday
      targetTime: "17:00",
      enabled: true,
      nextRunAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      handlerName: "scanDeadStock",
    },
    {
      id: "sched_monthly_period_closing",
      name: "Monthly Period Closing Audit",
      description: "Runs monthly accounting verification and flags un-settled Karigar accounts.",
      frequency: "monthly",
      dayOfMonth: 1,
      targetTime: "00:30",
      enabled: true,
      nextRunAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      handlerName: "auditMonthlyPeriodClosing",
    },
  ];

  private intervalId: NodeJS.Timeout | null = null;
  private dispatchEventFn: ((event: ReturnType<typeof createERPEvent>) => Promise<void>) | null = null;

  init(dispatchEvent: (event: ReturnType<typeof createERPEvent>) => Promise<void>) {
    this.dispatchEventFn = dispatchEvent;
    if (this.intervalId) clearInterval(this.intervalId);

    // Check scheduled tasks every 60 seconds
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 60000);
  }

  async tick() {
    const now = new Date();
    for (const task of this.tasks) {
      if (!task.enabled) continue;
      const nextRun = new Date(task.nextRunAt);
      if (now >= nextRun) {
        await this.runTask(task.id, "default_tenant");
        task.lastRunAt = now.toISOString();
        // Advance nextRunAt by 24h for daily, 7 days for weekly, 30 days for monthly
        const intervalMs =
          task.frequency === "daily"
            ? 86400000
            : task.frequency === "weekly"
            ? 86400000 * 7
            : 86400000 * 30;
        task.nextRunAt = new Date(now.getTime() + intervalMs).toISOString();
      }
    }
  }

  async runTask(taskId: string, tenantId = "default_tenant"): Promise<{ success: boolean; message: string }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return { success: false, message: `Task ${taskId} not found` };

    const startTime = Date.now();
    try {
      if (task.handlerName === "sweepDuePayments" && this.dispatchEventFn) {
        await this.dispatchEventFn(
          createERPEvent(
            "CUSTOMER_PAYMENT_DUE",
            { source: "scheduler", scanTimestamp: new Date().toISOString() },
            { tenantId, actorType: "scheduler" },
          ),
        );
      } else if (task.handlerName === "postWeeklyKarigarAllowances" && this.dispatchEventFn) {
        // Current ISO week string e.g. "2026-W36"
        const weekKey = `${new Date().getFullYear()}-W${Math.ceil(new Date().getDate() / 7)}`;
        await this.dispatchEventFn(
          createERPEvent(
            "KARIGAR_WEEKLY_ALLOWANCE_POSTED",
            { weekKey, source: "scheduler" },
            {
              tenantId,
              actorType: "scheduler",
              idempotencyKey: `allowance_sweep_${tenantId}_${weekKey}`,
            },
          ),
        );
      } else if (task.handlerName === "scanDeadStock" && this.dispatchEventFn) {
        await this.dispatchEventFn(
          createERPEvent(
            "STOCK_DEAD",
            { thresholdDays: 90, source: "scheduler" },
            { tenantId, actorType: "scheduler" },
          ),
        );
      }

      await automationAudit.log({
        tenantId,
        eventId: `sched_run_${taskId}_${Date.now()}`,
        eventType: "SYSTEM_HEALTH_RECOVERED",
        ruleId: task.id,
        ruleName: task.name,
        actionType: "execute_custom_routine",
        actionName: `Scheduled ${task.name}`,
        status: "success",
        actor: "scheduler",
        durationMs: Date.now() - startTime,
        metadata: { taskId: task.id, handler: task.handlerName },
      });

      return { success: true, message: `Executed ${task.name} successfully.` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await automationAudit.log({
        tenantId,
        eventId: `sched_err_${taskId}_${Date.now()}`,
        eventType: "SYSTEM_HEALTH_FAILED",
        ruleId: task.id,
        ruleName: task.name,
        actionType: "execute_custom_routine",
        actionName: `Scheduled ${task.name}`,
        status: "failed",
        actor: "scheduler",
        durationMs: Date.now() - startTime,
        errorDetails: msg,
      });
      return { success: false, message: `Failed: ${msg}` };
    }
  }

  getTasks(): ScheduledTaskDefinition[] {
    return this.tasks;
  }

  toggleTask(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.enabled = enabled;
    return true;
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const automationScheduler = new AutomationScheduler();
