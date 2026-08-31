import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Loader2,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  verifyAuditChain,
  getAuditEntries,
  type AuditEntry,
  type ChainVerificationResult,
} from "@/lib/security/audit-log";
import { closeFinancialYear } from "@/lib/financial-lock-store";
import { useSettings } from "@/lib/settings-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { formatDateTime as fmtDate } from "@/lib/format-date";

export const Route = createFileRoute("/reports/auditor")({
  head: () => ({ meta: [{ title: "Auditor Workspace · AVS Gold ERP" }] }),
  component: AuditorWorkspacePage,
});

function AuditorWorkspacePage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId || "MAIN");
  const { config, patch } = useWorkflowEngine();

  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<ChainVerificationResult | null>(null);

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [fyYear, setFyYear] = useState(new Date().getFullYear() - 1);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    void loadLogs();
  }, []);

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const data = await getAuditEntries();
      // Show latest 30 logs
      setLogs(data.slice(-30).reverse());
    } catch (err: any) {
      toast.error(err.message || "Failed to load audit logs");
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleVerifyChain() {
    setVerifying(true);
    setVerification(null);
    try {
      const result = await verifyAuditChain();
      setVerification(result);
      if (result.ok) {
        toast.success(`Verified ${result.entriesChecked} entries successfully.`);
      } else {
        toast.error(`Verification failed. Chain broke at entry ${result.brokenAtSeq}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Cryptographic verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleCloseYear() {
    if (
      !window.confirm(
        `Are you absolutely sure you want to close Financial Year ${fyYear}-${(fyYear + 1) % 100}? This will lock all months in this FY and carry forward metal balances to April 1st, ${fyYear + 1}.`,
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const actor = {
        id: sessionData.session?.user.id ?? null,
        email: sessionData.session?.user.email ?? null,
      };
      const result = await closeFinancialYear(selectedBranchId, fyYear, actor);
      if (result.success) {
        toast.success(result.message);
        await loadLogs();
      } else {
        toast.error("Year closing failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to close financial year");
    } finally {
      setClosing(false);
    }
  }

  async function handleFinancialLockToggle(enabled: boolean) {
    const before = config.financialLockEnforcementEnabled;
    patch({ financialLockEnforcementEnabled: enabled });
    try {
      const { data } = await supabase.auth.getSession();
      const [{ append }] = await Promise.all([import("@/lib/security/audit-log")]);
      await append({
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
        action: "workflow.financial_lock_enforcement_toggled",
        entityType: "workflow_config",
        entityId: "financialLockEnforcementEnabled",
        before: { enabled: before },
        after: { enabled },
      });
      if (enabled) {
        toast.success("Financial lock enforcement re-enabled.");
      } else {
        toast.warning(
          "Financial lock enforcement disabled - locked periods will no longer block postings.",
        );
      }
      await loadLogs();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="h-6 w-6 text-amber-600" />
            Auditor Workspace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reconcile ledger integrity, lock financial years, and verify system audit trails.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/reports/gst-returns">
            <Button variant="outline" size="sm" className="text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> GST Returns
            </Button>
          </Link>
          <Link to="/reports/itc04">
            <Button variant="outline" size="sm" className="text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1" /> GST ITC-04
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Security verification */}
        <div className="md:col-span-2 space-y-6">
          {/* Cryptographic chain checker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Verification Engine
              </CardTitle>
              <CardDescription>
                Validates the sequential cryptographic hash chain of the ledger. Catch database
                level manual tampering.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={handleVerifyChain} disabled={verifying} className="gap-2">
                  {verifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Run Chain Verification"
                  )}
                </Button>
                {verification && (
                  <Badge
                    className={
                      verification.ok
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-rose-100 text-rose-800 border-rose-200"
                    }
                  >
                    {verification.ok ? (
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Integrity verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" /> Chain broken!
                      </span>
                    )}
                  </Badge>
                )}
              </div>

              {verification && (
                <div className="rounded-md border border-border bg-muted/20 p-4 space-y-2 text-xs">
                  <div className="flex justify-between font-mono">
                    <span className="text-muted-foreground">Checked:</span>
                    <span className="font-semibold">{verification.entriesChecked} entries</span>
                  </div>
                  {verification.brokenAtSeq !== null && (
                    <div className="flex justify-between font-mono text-red-600">
                      <span>Broken at sequence:</span>
                      <span className="font-bold">#{verification.brokenAtSeq}</span>
                    </div>
                  )}
                  {verification.issues.length > 0 ? (
                    <div className="space-y-1 pt-2 border-t border-border mt-2 text-red-500 font-mono">
                      {verification.issues.map((issue, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-emerald-600 font-medium flex gap-1.5 items-center pt-1">
                      <CheckCircle2 className="h-4 w-4" /> Cryptographic ledger is fully intact and
                      authentic.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Logs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">System Audit Trail</CardTitle>
                <CardDescription>
                  Immutable record of recent administrative and financial operations.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="text-xs"
              >
                {loadingLogs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No audit entries found.
                </p>
              ) : (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-md border border-border p-3 space-y-2 text-xs bg-muted/5"
                    >
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] uppercase tracking-wider"
                        >
                          {log.action}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(log.ts)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-mono">
                        <div>
                          <span>Actor:</span>{" "}
                          <span className="text-foreground">{log.actorEmail || "System"}</span>
                        </div>
                        <div>
                          <span>Sequence:</span> <span className="text-foreground">#{log.seq}</span>
                        </div>
                      </div>
                      {!!log.after && (
                        <div className="bg-muted/30 p-2 rounded text-[10px] font-mono break-all max-h-16 overflow-y-auto text-muted-foreground">
                          {JSON.stringify(log.after)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Financial Locks */}
        <div className="space-y-6">
          {/* Lock Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-primary" /> Active Lock Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold block">Enforce Period Locks</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Reject transactions posted in locked periods.
                  </span>
                </div>
                <Switch
                  checked={config.financialLockEnforcementEnabled}
                  onCheckedChange={handleFinancialLockToggle}
                />
              </div>

              <div className="flex justify-between items-center text-xs py-1.5 font-mono">
                <span className="text-muted-foreground">Lock State:</span>
                {config.financialLockEnforcementEnabled ? (
                  <span className="text-amber-600 font-semibold flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" /> Enforcement Active
                  </span>
                ) : (
                  <span className="text-red-500 font-bold flex items-center gap-1">
                    <Unlock className="h-3.5 w-3.5" /> Warning: Bypassed
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Close Financial Year */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" /> Close Financial Year
              </CardTitle>
              <CardDescription>
                Permanently lock the preceding year and roll balances forward.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fy-year" className="text-xs">
                  Financial Year Start (April)
                </Label>
                <Input
                  id="fy-year"
                  type="number"
                  value={fyYear}
                  onChange={(e) => setFyYear(Number(e.target.value))}
                  placeholder="2025"
                  className="font-mono text-xs"
                />
              </div>

              <Button
                variant="destructive"
                className="w-full text-xs font-semibold"
                onClick={handleCloseYear}
                disabled={closing}
              >
                {closing ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                Run Year Closing
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
