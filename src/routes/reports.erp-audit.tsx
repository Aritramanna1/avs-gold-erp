/**
 * ERP Audit Report — Reports section (02_ERP_AUDIT_REPORT_SPEC.md)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  hydrateErpAuditFromSession,
  useErpAuditStore,
} from "@/lib/erp-audit/store";
import type { AuditStatus, DefectFixStatus, DefectRetestStatus } from "@/lib/erp-audit/types";
import { toast } from "sonner";
import { ClipboardCheck, Play, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/reports/erp-audit")({
  head: () => ({ meta: [{ title: "ERP Audit Report · AVS ERP" }] }),
  component: ErpAuditReportPage,
});

function statusClass(s: AuditStatus): string {
  if (s === "PASS") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/40";
  if (s === "FAIL") return "bg-red-500/15 text-red-700 border-red-500/40";
  return "bg-amber-500/15 text-amber-800 border-amber-500/40";
}

function ErpAuditReportPage() {
  const lastReport = useErpAuditStore((s) => s.lastReport);
  const running = useErpAuditStore((s) => s.running);
  const error = useErpAuditStore((s) => s.error);
  const run = useErpAuditStore((s) => s.run);
  const updateDefect = useErpAuditStore((s) => s.updateDefect);
  const [groupFilter, setGroupFilter] = useState<string>("all");

  useEffect(() => {
    if (!lastReport) hydrateErpAuditFromSession();
  }, [lastReport]);

  const groups = useMemo(() => {
    if (!lastReport) return [];
    return Array.from(new Set(lastReport.modules.map((m) => m.group)));
  }, [lastReport]);

  const modules = useMemo(() => {
    if (!lastReport) return [];
    if (groupFilter === "all") return lastReport.modules;
    return lastReport.modules.filter((m) => m.group === groupFilter);
  }, [lastReport, groupFilter]);

  async function handleRun() {
    try {
      const report = await run();
      toast.success(
        report.readyForRelease
          ? `Audit complete — score ${report.overallScore}. Release gate open (still verify physical hardware).`
          : `Audit complete — score ${report.overallScore} (${report.overallStatus}). Not READY.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed");
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="ERP Audit Report"
        subtitle="Evaluates whether AVS ERP works as a jewellery-business ERP — workflows, books, calculations, RLS, hardware. PASS / FAIL / BLOCKED with evidence. Physical devices and full golden paths remain required."
        actions={
          <Button onClick={() => void handleRun()} disabled={running} className="gap-2">
            <Play className="h-4 w-4" />
            {running ? "Running probes…" : "Generate audit report"}
          </Button>
        }
      />

      {error && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive">{error}</Card>
      )}

      {!lastReport && !running && (
        <Card className="p-8 text-center space-y-3">
          <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            No audit run in this session. Generate a report to probe live stores, ledger math,
            barcode encode, tenant context, and hardware capability. Modules without automated
            probes stay BLOCKED until manually exercised.
          </p>
        </Card>
      )}

      {lastReport && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                Overall score
              </div>
              <div className="text-3xl font-semibold font-mono mt-1">{lastReport.overallScore}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">Status</div>
              <Badge variant="outline" className={`mt-2 ${statusClass(lastReport.overallStatus)}`}>
                {lastReport.overallStatus}
              </Badge>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                Release gate
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4" />
                {lastReport.readyForRelease ? "Eligible*" : "Not READY"}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                *Physical hardware + portal golden paths still required.
              </p>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                Firm / run
              </div>
              <div className="text-xs font-mono mt-2 break-all">
                {lastReport.firmId || "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {new Date(lastReport.createdAt).toLocaleString()}
              </div>
            </Card>
          </div>

          {lastReport.notes.length > 0 && (
            <Card className="p-4 space-y-1">
              {lastReport.notes.map((n) => (
                <p key={n} className="text-xs text-muted-foreground">
                  • {n}
                </p>
              ))}
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={groupFilter === "all" ? "default" : "outline"}
              onClick={() => setGroupFilter("all")}
            >
              All
            </Button>
            {groups.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={groupFilter === g ? "default" : "outline"}
                onClick={() => setGroupFilter(g)}
              >
                {g}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Module</th>
                  <th className="text-left px-3 py-2">Group</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Score</th>
                  <th className="text-left px-3 py-2">Summary / evidence</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.id} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{m.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.group}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={statusClass(m.status)}>
                        {m.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono">{m.score}</td>
                    <td className="px-3 py-2 space-y-1">
                      <p>{m.summary}</p>
                      <ul className="text-[10px] text-muted-foreground font-mono space-y-0.5">
                        {m.evidence.slice(0, 6).map((e, i) => (
                          <li key={`${m.id}-${i}`}>
                            {e.label}: {String(e.value)}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-muted-foreground">{m.durationMs} ms</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Defects</h3>
            {lastReport.defects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No defects recorded in this run.</p>
            ) : (
              <ul className="space-y-3">
                {lastReport.defects.map((d) => (
                  <li key={d.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{d.severity}</Badge>
                      <Badge variant="outline">{d.category}</Badge>
                      <span className="text-sm font-medium">{d.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.detail}</p>
                    <ol className="text-[11px] list-decimal pl-4 space-y-0.5">
                      {d.reproductionSteps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={d.fixStatus}
                        onChange={(e) =>
                          updateDefect(d.id, {
                            fixStatus: e.target.value as DefectFixStatus,
                          })
                        }
                      >
                        <option value="OPEN">Fix: OPEN</option>
                        <option value="FIXED">Fix: FIXED</option>
                        <option value="WONTFIX">Fix: WONTFIX</option>
                      </select>
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={d.retestStatus}
                        onChange={(e) =>
                          updateDefect(d.id, {
                            retestStatus: e.target.value as DefectRetestStatus,
                          })
                        }
                      >
                        <option value="NOT_RUN">Retest: NOT_RUN</option>
                        <option value="NEEDS_RETEST">Retest: NEEDS_RETEST</option>
                        <option value="PASS">Retest: PASS</option>
                        <option value="FAIL">Retest: FAIL</option>
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
