import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  FileText,
  Hammer,
  ShieldCheck,
  Package,
  Layers,
  ChevronRight,
  Printer,
  Share2,
} from "lucide-react";
import type { ERPActionCard, ActionPayload } from "@/lib/assistant/assistant-types";
import { executeConfirmedAction } from "@/lib/assistant/assistant-tool-registry";
import { toast } from "sonner";

interface AssistantCardRendererProps {
  card: ERPActionCard;
  onActionConfirmed?: (actionId: string, resultMessage: string) => void;
}

export function AssistantCardRenderer({ card, onActionConfirmed }: AssistantCardRendererProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const handleConfirmAction = async (payload: ActionPayload) => {
    setIsExecuting(true);
    try {
      const result = await executeConfirmedAction(payload);
      setIsExecuting(false);
      if (result.success) {
        setActionDone(true);
        setExecutionMessage(result.message);
        toast.success(result.message);
        onActionConfirmed?.(payload.actionId, result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      setIsExecuting(false);
      toast.error(err.message || "Failed to execute action");
    }
  };

  return (
    <div className="mt-3 w-full rounded-sm border border-border/80 bg-card/95 p-3.5 shadow-sm text-foreground space-y-3 transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-gold/10 text-gold flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-xs font-semibold tracking-tight text-foreground">{card.title}</h4>
        </div>
        {card.actionRoute && (
          <Link
            to={card.actionRoute as any}
            className="flex items-center gap-1 text-[11px] font-medium text-gold hover:underline"
          >
            Open in ERP <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* 1. KPI Stat Cards */}
      {card.kpis && card.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {card.kpis.map((kpi, idx) => {
            const variantStyles =
              kpi.variant === "gold"
                ? "border-gold/30 bg-gold/5 text-gold"
                : kpi.variant === "destructive"
                  ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
                  : kpi.variant === "warning"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                    : kpi.variant === "success"
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-border bg-background/50 text-foreground";

            return (
              <div
                key={idx}
                className={`flex flex-col justify-between rounded-sm border p-2.5 ${variantStyles}`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </span>
                <div className="my-1 text-sm font-bold leading-none">{kpi.value}</div>
                {kpi.subtitle && (
                  <span className="text-[10px] text-muted-foreground">{kpi.subtitle}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Visual Charts (Bar / Ageing / Breakdown) */}
      {card.chartData && card.chartData.length > 0 && (
        <div className="rounded-sm border border-border/60 bg-background/50 p-2.5 space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">Distribution Analysis</div>
          <div className="space-y-1.5">
            {card.chartData.map((dp, idx) => {
              const maxVal = Math.max(...card.chartData!.map((d) => d.value), 1);
              const percentage = Math.round((dp.value / maxVal) * 100);
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium">{dp.label}</span>
                    <span className="text-muted-foreground font-mono">
                      {typeof dp.value === "number" && dp.value > 1000
                        ? `Rs. ${dp.value.toLocaleString("en-IN")}`
                        : `${dp.value} g`}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(percentage, 4)}%`,
                        backgroundColor: dp.color || "#eab308",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Dense Data Tables */}
      {card.tableColumns && card.tableRows && card.tableRows.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-border/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase font-semibold text-muted-foreground">
              <tr>
                {card.tableColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2.5 py-1.5 ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {card.tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                  {card.tableColumns!.map((col) => {
                    const val = row[col.key];
                    if (col.format === "badge") {
                      const isGood = ["Paid", "Completed", "Active", "<30 Days"].includes(
                        String(val),
                      );
                      const isBad = ["Overdue", "Critical", ">90 Days", "Pending"].includes(
                        String(val),
                      );
                      return (
                        <td key={col.key} className="px-2.5 py-1.5 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                              isGood
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : isBad
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {val}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-2.5 py-1.5 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left"
                        }`}
                      >
                        {val ?? "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Milestone Timelines */}
      {card.timelineEvents && card.timelineEvents.length > 0 && (
        <div className="rounded-sm border border-border/60 bg-background/40 p-3 space-y-3">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Production Milestones
          </div>
          <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {card.timelineEvents.map((evt, idx) => {
              const isDone = evt.status === "completed";
              const isCurrent = evt.status === "in_progress";
              return (
                <div key={idx} className="relative">
                  <div
                    className={`absolute -left-6 top-0.5 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center ${
                      isDone
                        ? "border-emerald-500 text-emerald-500"
                        : isCurrent
                          ? "border-gold text-gold animate-pulse"
                          : "border-muted-foreground/40 text-transparent"
                    }`}
                  >
                    {isDone && <CheckCircle2 className="h-3 w-3" />}
                    {isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-gold" />}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{evt.title}</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {evt.timestamp}
                      </span>
                    </div>
                    {evt.subtitle && (
                      <div className="text-[11px] text-muted-foreground">{evt.subtitle}</div>
                    )}
                    {evt.workerName && (
                      <div className="mt-0.5 text-[10px] text-gold font-medium">
                        Assigned: {evt.workerName}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Document Previews */}
      {card.documentMeta && (
        <div className="rounded-sm border border-border/80 bg-background/60 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-sm bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                {card.documentMeta.docType} #{card.documentMeta.docNumber}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Date: {card.documentMeta.date} &bull; Total: {card.documentMeta.amountFormatted}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {card.documentUrl && (
              <Link
                to={card.documentUrl as any}
                className="p-2 rounded-md border border-border hover:bg-muted text-foreground transition-colors"
                title="View Document"
              >
                <Printer className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 6. Action Confirmation Cards (Safe Preview before Write) */}
      {card.actionPayload && (
        <div className="rounded-sm border-2 border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs">
            <ShieldCheck className="h-4 w-4" />
            <span>Safe Action Preview (User Approval Required)</span>
          </div>

          <p className="text-xs text-foreground/90 leading-relaxed">
            {card.actionPayload.description}
          </p>

          {actionDone ? (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{executionMessage || "Action executed and logged to audit trail."}</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-500/20">
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => handleConfirmAction(card.actionPayload!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gold text-black font-semibold text-xs hover:bg-gold/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    Executing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirm & Execute
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
