import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Zap,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  RotateCcw,
  Sparkles,
  Search,
  ShieldAlert,
  FileCheck2,
  Scale,
  CalendarCheck,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAutomationEngine } from "@/lib/automation";

export const Route = createFileRoute("/settings/automation")({
  head: () => ({ meta: [{ title: "Native Automation Center · AVS Gold ERP" }] }),
  component: AutomationCenterPage,
});

function AutomationCenterPage() {
  const {
    rules,
    jobs,
    auditLogs,
    scheduledTasks,
    approvalRequests,
    exceptions,
    eodSummary,
    stats,
    initialize,
    toggleRule,
    toggleScheduledTask,
    runScheduledTaskManually,
    retryJob,
    emitEvent,
    refreshLogs,
    resolveApproval,
    resolveException,
    runReconciliation,
    runEODClosing,
  } = useAutomationEngine();

  const [activeTab, setActiveTab] = useState("attention");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isTesting, setIsTesting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const filteredRules = rules.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.triggerEvent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "all" || r.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleTestEvent = async (ruleId: string, eventType: string) => {
    setIsTesting(true);
    try {
      if (eventType === "SALE_CONFIRMED") {
        await emitEvent("SALE_CONFIRMED", {
          status: "confirmed",
          invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
          totalAmountPaise: 1250000,
          customerName: "Aman Sharma",
        });
      } else if (eventType === "READY_STOCK_CREATED") {
        await emitEvent("READY_STOCK_CREATED", {
          grossWeightG: 15.45,
          purity: "22K/916",
          tag: "Ring-Gold-Test",
        });
      } else if (eventType === "KARIGAR_ISSUE_CREATED") {
        await emitEvent("KARIGAR_ISSUE_CREATED", {
          issuedWeightG: 30.0,
          purity: "22K/916",
          workerId: "KARIGAR-TEST",
        });
      } else if (eventType === "KARIGAR_RECEIPT_CREATED") {
        await emitEvent("KARIGAR_RECEIPT_CREATED", {
          issuedWeightG: 30.0,
          receivedWeightG: 29.5,
          overLossG: 0.1,
          wastagePct: 1.5,
          workerId: "KARIGAR-TEST",
        });
      } else if (eventType === "STOCK_VARIANCE_DETECTED") {
        await emitEvent("STOCK_VARIANCE_DETECTED", {
          sku: "RING-22K-001",
          expectedQty: 10,
          actualQty: 9,
          varianceWeightG: 4.5,
        });
      } else {
        await emitEvent(eventType as any, {
          test: true,
          timestamp: new Date().toISOString(),
          quantity: 1,
        });
      }
      toast.success(`Dispatched test event for ${eventType}`);
      await refreshLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run test event");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Native ERP Automation Center"
          subtitle="One unified deterministic engine running retail store, manufacturing, purity-wise karigar books, payroll, approvals, and daily reconciliations."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshLogs()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.openExceptionsCount}</div>
            <div className="text-[11px] text-muted-foreground">Attention Items</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <FileCheck2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.pendingApprovalsCount}</div>
            <div className="text-[11px] text-muted-foreground">Pending Approvals</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.activeRulesCount}</div>
            <div className="text-[11px] text-muted-foreground">Active Rules</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.totalEventsProcessed}</div>
            <div className="text-[11px] text-muted-foreground">Events Processed</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{scheduledTasks.filter((t) => t.enabled).length}</div>
            <div className="text-[11px] text-muted-foreground">Scheduled Sweeps</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="attention" className="flex items-center gap-1.5 text-xs">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            Attention Center ({exceptions.filter((e) => e.status === "open").length})
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1.5 text-xs">
            <FileCheck2 className="h-3.5 w-3.5" />
            Approvals ({approvalRequests.filter((a) => a.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="flex items-center gap-1.5 text-xs">
            <Scale className="h-3.5 w-3.5" />
            Reconciliation &amp; EOD
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" />
            Rules Engine ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Job Queue ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Audit Logs ({auditLogs.length})
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Scheduler
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            AI Readiness
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Attention Center */}
        <TabsContent value="attention" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  Exception-First Attention Dashboard
                </h3>
                <p className="text-xs text-muted-foreground">
                  Normal automations complete silently in the background. Only anomalies, variances, and pending tasks appear here.
                </p>
              </div>
            </div>

            {exceptions.filter((e) => e.status === "open").length === 0 ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6 text-center text-sm text-emerald-600">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                All operations running smoothly. Zero unhandled discrepancies or exceptions detected.
              </div>
            ) : (
              <div className="space-y-3">
                {exceptions
                  .filter((e) => e.status === "open")
                  .map((exc) => (
                    <div
                      key={exc.id}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="capitalize text-[10px]">
                            {exc.severity}
                          </Badge>
                          <span className="font-semibold text-sm">{exc.title}</span>
                          <span className="text-[11px] text-muted-foreground">
                            ({new Date(exc.createdAt).toLocaleTimeString()})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{exc.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void resolveException(exc.id, "resolved", "Admin")}
                          className="h-8 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void resolveException(exc.id, "dismissed", "Admin")}
                          className="h-8 text-xs text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Approvals Inbox */}
        <TabsContent value="approvals" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-blue-500" />
                High-Risk Operation Approvals
              </h3>
              <p className="text-xs text-muted-foreground">
                Operations exceeding configured thresholds (e.g. large discounts, high expenses, stock variances) require authorization before posting.
              </p>
            </div>

            {approvalRequests.filter((a) => a.status === "pending").length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No pending authorization requests. All high-risk actions are cleared.
              </div>
            ) : (
              <div className="space-y-3">
                {approvalRequests
                  .filter((a) => a.status === "pending")
                  .map((req) => (
                    <div
                      key={req.id}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-blue-500 border-blue-500/30 text-[10px]">
                            {req.type}
                          </Badge>
                          <span className="font-semibold text-sm">{req.title}</span>
                          <span className="text-xs text-muted-foreground">Requested by {req.requestedBy}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{req.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => void resolveApproval(req.id, "approve", "Owner", "Approved via UI")}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Approve Action
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void resolveApproval(req.id, "reject", "Owner", "Rejected via UI")}
                          className="h-8 text-xs text-destructive border-destructive/30"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Reconciliations & EOD */}
        <TabsContent value="reconciliation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Reconciliation Card */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Scale className="h-5 w-5 text-primary" />
                    Daily Financial &amp; Gold Balance
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cross-checks invoices, cash receipts, inventory movements, and purity books.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isReconciling}
                  onClick={async () => {
                    setIsReconciling(true);
                    try {
                      const rep = await runReconciliation();
                      toast.success(rep.isClean ? "Reconciliation complete: 100% Balanced" : "Reconciliation complete: Mismatches detected");
                    } finally {
                      setIsReconciling(false);
                    }
                  }}
                  className="h-8 text-xs flex items-center gap-1"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Audit Now
                </Button>
              </div>

              <div className="rounded border border-border bg-muted/20 p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard Purity Base:</span>
                  <strong>995 / 99.50%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purity Books Monitored:</span>
                  <strong>22K / 916, 18K / 750</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auto Cash-Gold Split:</span>
                  <span className="text-emerald-500 font-semibold">Strictly Separated</span>
                </div>
              </div>
            </div>

            {/* End of Day Closing Card */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-emerald-500" />
                    End-of-Day (EOD) Operations
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Generates store daily closing summary and verifies zero unresolved exceptions.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const eod = await runEODClosing();
                    toast.success(`EOD Summary generated (${eod.status})`);
                  }}
                  className="h-8 text-xs flex items-center gap-1"
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Run EOD Closing
                </Button>
              </div>

              {eodSummary ? (
                <div className="rounded border border-border bg-muted/20 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closing Date:</span>
                    <strong>{eodSummary.date}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Invoices Completed:</span>
                    <strong>{eodSummary.totalSalesCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Karigar Metal Issued / Received:</span>
                    <strong>{eodSummary.totalGoldIssuedG}g / {eodSummary.totalGoldReceivedG}g</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closing Status:</span>
                    <Badge variant={eodSummary.status === "completed" ? "default" : "outline"} className="capitalize text-[10px]">
                      {eodSummary.status}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No EOD closing run today yet. Click "Run EOD Closing" to generate the summary.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Rules Engine */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules, triggers, actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
              {["all", "sales", "stock", "karigar", "payroll", "quotation", "appointment", "payment", "security", "health"].map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="capitalize text-xs h-8"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-border bg-card p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{rule.name}</span>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {rule.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => void toggleRule(rule.id, checked)}
                    />
                  </div>

                  <div className="space-y-2 mt-3 pt-3 border-t border-border/50 text-xs">
                    <div>
                      <span className="text-muted-foreground">Trigger: </span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono text-[11px]">
                        {rule.triggerEvent}
                      </code>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Actions ({rule.actions.length}): </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.actions.map((act, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-muted/80 text-foreground px-2 py-0.5 rounded text-[11px]"
                          >
                            {act.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <span className="text-muted-foreground">
                    Status:{" "}
                    <strong className={rule.enabled ? "text-emerald-500" : "text-muted-foreground"}>
                      {rule.enabled ? "Active" : "Disabled"}
                    </strong>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isTesting}
                    onClick={() => void handleTestEvent(rule.id, rule.triggerEvent)}
                    className="h-7 text-xs flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Test Trigger
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 5: Job Queue */}
        <TabsContent value="queue" className="space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Active &amp; Recent Queue Items</h3>
                <p className="text-xs text-muted-foreground">
                  Idempotent execution queue with automated retries and dead-letter safety.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshLogs()}
                className="h-8 text-xs flex items-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Queue
              </Button>
            </div>

            {jobs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No jobs currently queued. All automation operations completed.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="p-3">Job ID</th>
                      <th className="p-3">Rule / Action</th>
                      <th className="p-3">Event Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Attempts</th>
                      <th className="p-3">Created</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="p-3 font-mono text-xs">{job.id.slice(0, 16)}</td>
                        <td className="p-3">
                          <div className="font-medium text-xs">{job.ruleName}</div>
                          <div className="text-[11px] text-muted-foreground">{job.action.name}</div>
                        </td>
                        <td className="p-3">
                          <code className="text-xs text-primary">{job.event.type}</code>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "default"
                                : job.status === "failed" || job.status === "dead_letter"
                                ? "destructive"
                                : "outline"
                            }
                            className="capitalize text-[10px]"
                          >
                            {job.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {job.attempts}/{job.maxAttempts}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(job.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-3 text-right">
                          {(job.status === "failed" || job.status === "dead_letter") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                retryJob(job.id);
                                toast.success("Job re-queued for execution");
                              }}
                              className="h-7 text-xs flex items-center gap-1"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 6: Audit Logs */}
        <TabsContent value="audit" className="space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Automation Audit Trail</h3>
                <p className="text-xs text-muted-foreground">
                  Immutable execution history for compliance and operational tracking.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshLogs()}
                className="h-8 text-xs flex items-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Logs
              </Button>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No automation logs recorded yet. Trigger a rule or test event to populate audit history.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Event</th>
                      <th className="p-3">Rule &amp; Action</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Idempotency Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <code className="text-xs text-primary font-mono">{log.eventType}</code>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-xs">{log.ruleName}</div>
                          <div className="text-[11px] text-muted-foreground">{log.actionName}</div>
                          {log.errorDetails && (
                            <div className="text-[11px] text-destructive mt-0.5">
                              {log.errorDetails}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={log.status === "success" ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {log.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{log.actor}</td>
                        <td className="p-3 text-xs text-muted-foreground">{log.durationMs}ms</td>
                        <td className="p-3 font-mono text-[10px] text-muted-foreground">
                          {log.idempotencyKey ? log.idempotencyKey.slice(0, 18) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 7: Scheduler */}
        <TabsContent value="scheduler" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduledTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-card p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{task.name}</span>
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {task.frequency}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    </div>
                    <Switch
                      checked={task.enabled}
                      onCheckedChange={(checked) => toggleScheduledTask(task.id, checked)}
                    />
                  </div>

                  <div className="space-y-1.5 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    <div>
                      Scheduled Target Time: <strong className="text-foreground">{task.targetTime || "Interval"}</strong>
                    </div>
                    <div>
                      Next Scheduled Run:{" "}
                      <strong className="text-foreground">
                        {new Date(task.nextRunAt).toLocaleString()}
                      </strong>
                    </div>
                    {task.lastRunAt && (
                      <div>
                        Last Run:{" "}
                        <span className="text-foreground">
                          {new Date(task.lastRunAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const res = await runScheduledTaskManually(task.id);
                      if (res.success) toast.success(res.message);
                      else toast.error(res.message);
                    }}
                    className="h-8 text-xs flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Run Sweep Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 8: AI Readiness Architecture */}
        <TabsContent value="ai" className="space-y-4">
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-5 space-y-4">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-base">
              <Sparkles className="h-5 w-5" />
              AI-Ready Architecture · Decoupled Extension Gateway
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In accordance with enterprise ERP principles, the core automation engine is 100% deterministic and native.
              AI capabilities (such as intelligent stock recommendations, smart customer follow-up suggestions, and automated voice calling)
              are designed with strict boundary gateways so they can be connected in the future without modifying core business rules.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="rounded border border-border bg-card p-3 space-y-1">
                <div className="font-semibold text-foreground">1. Deterministic Core Priority</div>
                <p className="text-muted-foreground">
                  Inventory balance, purity-wise books, and double-entry accounting execute strictly through deterministic rules and never through unverified autonomous agents.
                </p>
              </div>

              <div className="rounded border border-border bg-card p-3 space-y-1">
                <div className="font-semibold text-foreground">2. Human Approval Gateway</div>
                <p className="text-muted-foreground">
                  Any future AI recommendation must pass through the <code>AiApprovalGateway</code> and obtain manager/admin confirmation before ledger posting.
                </p>
              </div>

              <div className="rounded border border-border bg-card p-3 space-y-1">
                <div className="font-semibold text-foreground">3. Multi-Tenant Boundary Enforcement</div>
                <p className="text-muted-foreground">
                  AI evaluation contexts carry isolated <code>tenantId</code> tokens and RLS credentials, preventing any cross-tenant data leakage.
                </p>
              </div>

              <div className="rounded border border-border bg-card p-3 space-y-1">
                <div className="font-semibold text-foreground">4. Extension Interfaces Defined</div>
                <p className="text-muted-foreground">
                  Clean TypeScript contracts for <code>AiSuggestionProvider</code>, <code>AiDecisionLayer</code>, and <code>AiAuditEntry</code> are ready in <code>src/lib/automation/ai-interfaces.ts</code>.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
