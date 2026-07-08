import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useJobCards,
  JOB_STATUS_LABELS,
  karigarCustodySummaries,
  type JobStatus,
} from "@/lib/jobcards-store";
import { mgToGrams } from "@/lib/gold";
import { ReceiveWorkDialog } from "@/components/receive-work-dialog";
import {
  Search,
  Eye,
  Calendar,
  Hammer,
  AlertTriangle,
  ClipboardList,
  ArrowRightCircle,
  Wallet,
  PackageCheck,
  BookOpen,
  UserPlus,
  ArrowRightLeft,
  Truck,
  Sparkles,
  ScanLine,
} from "lucide-react";
import { useBusinessRules } from "@/lib/business-rules-store";

export const Route = createFileRoute("/workshop/")({
  head: () => ({ meta: [{ title: "Workshop · AVS Gold ERP" }] }),
  component: WorkshopPage,
});

const STATUS_TONE: Record<JobStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  ready_for_gold_issue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  gold_issued: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  work_received: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  qc_pending: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  ready_for_billing: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rework: "bg-red-500/15 text-red-300 border-red-500/30",
  closed: "bg-green-600/20 text-green-300 border-green-500/30",
};

function WorkshopPage() {
  const jobs = useJobCards((s) => s.jobs);
  const polishingModuleEnabled = useBusinessRules((s) => s.isEnabled("enable_polishing_module"));
  const barcodeModuleEnabled = useBusinessRules((s) => s.isEnabled("enable_barcode_module"));

  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState<"all" | JobStatus>("all");
  const [receiveJobId, setReceiveJobId] = useState<string | null>(null);
  const navigate = useNavigate();
  const receiveJob = useMemo(
    () => jobs.find((j) => j.id === receiveJobId) ?? null,
    [jobs, receiveJobId],
  );
  const custody = useMemo(() => karigarCustodySummaries(jobs), [jobs]);
  const activeJobs = useMemo(() => jobs.filter((j) => (j.status === "in_progress" || j.status === "rework") && !j.workReceipt), [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusF !== "all" && j.status !== statusF) return false;
      if (q) {
        const hay =
          `${j.jobNo} ${j.orderNo} ${j.customerName} ${j.itemName} ${j.karigarName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, query, statusF]);

  const reworkJobs = jobs.filter((j) => j.status === "rework");
  const readyJobs = jobs.filter((j) => j.status === "ready_for_gold_issue" || j.status === "draft");



  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Workshop"
        subtitle="Manufacturing job cards, process steps and karigar work tracking."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Link
              to="/workshop/gold-book"
              className="inline-flex items-center justify-center rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2.5 text-sm font-semibold gap-2 transition-colors active:scale-95"
            >
              <BookOpen className="h-4 w-4" /> Worker Gold Book
            </Link>
            <Link
              to="/workshop/outside-work"
              className="inline-flex items-center justify-center rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2.5 text-sm font-semibold gap-2 transition-colors active:scale-95"
            >
              <Truck className="h-4 w-4" /> Outside Work
            </Link>
            {polishingModuleEnabled && (
              <Link
                to="/workshop/polishing"
                className="inline-flex items-center justify-center rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2.5 text-sm font-semibold gap-2 transition-colors active:scale-95"
              >
                <Sparkles className="h-4 w-4" /> Polishing
              </Link>
            )}
            {barcodeModuleEnabled && (
              <Link
                to="/workshop/barcode-scanner"
                className="inline-flex items-center justify-center rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2.5 text-sm font-semibold gap-2 transition-colors active:scale-95"
              >
                <ScanLine className="h-4 w-4" /> Barcode Scanner
              </Link>
            )}
          </div>
        }
      />

      <Tabs defaultValue="jobs">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="jobs" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Job Cards
          </TabsTrigger>

          <TabsTrigger value="rework" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Rework ({reworkJobs.length})
          </TabsTrigger>
          <TabsTrigger value="ready" className="gap-2">
            <ArrowRightCircle className="h-4 w-4" /> Ready for Gold Issue ({readyJobs.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2">
            <PackageCheck className="h-4 w-4" /> In Progress ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger value="custody" className="gap-2">
            <Wallet className="h-4 w-4" /> Gold Custody
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job no, order, customer, item, karigar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusF} onValueChange={(v) => setStatusF(v as typeof statusF)}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {JOB_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No job cards yet"
              body="Open any confirmed order and click Create Job Card to begin."
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Job No</th>
                      <th className="text-left px-4 py-3 font-medium">Order</th>
                      <th className="text-left px-4 py-3 font-medium">Customer</th>
                      <th className="text-left px-4 py-3 font-medium">Item</th>
                      <th className="text-left px-4 py-3 font-medium">Karigar</th>
                      <th className="text-left px-4 py-3 font-medium">Due</th>
                      <th className="text-left px-4 py-3 font-medium">Priority</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((j) => {
                      return (
                        <tr key={j.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-xs text-gold">{j.jobNo}</td>
                          <td className="px-4 py-3 font-mono text-xs">{j.orderNo}</td>
                          <td className="px-4 py-3">{j.customerName}</td>
                          <td className="px-4 py-3">
                            {j.itemName}
                            <div className="text-[11px] text-muted-foreground">
                              {mgToGrams(j.targetFineMg)} g fine
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {j.karigarName ?? <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {j.expectedDelivery ? (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {j.expectedDelivery}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">{j.priority}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={STATUS_TONE[j.status]}>
                              {JOB_STATUS_LABELS[j.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to="/workshop/$id"
                              params={{ id: j.id }}
                              className="inline-flex items-center gap-1 text-gold hover:underline text-xs"
                            >
                              <Eye className="h-3 w-3" /> View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>



        <TabsContent value="rework">
          {reworkJobs.length === 0 ? (
            <EmptyState
              title="Nothing in rework"
              body="Cards marked as rework will appear here with notes."
            />
          ) : (
            <div className="space-y-2">
              {reworkJobs.map((j) => {
                const lastRework = [...(j.timeline ?? [])]
                  .reverse()
                  .find((e) => e.label.includes("Rework"));
                return (
                  <Link
                    key={j.id}
                    to="/workshop/$id"
                    params={{ id: j.id }}
                    className="block rounded-2xl border border-red-500/30 bg-red-500/5 p-4 hover:border-red-400/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-gold">
                          {j.jobNo} · {j.orderNo}
                        </div>
                        <div className="text-sm">
                          {j.customerName} · {j.itemName}
                        </div>
                        {lastRework?.note && (
                          <div className="text-xs text-red-300/80 mt-1">
                            Reason: {lastRework.note}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className={STATUS_TONE.rework}>
                        Rework
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ready">
          {readyJobs.length === 0 ? (
            <EmptyState
              title="Nothing ready for gold issue"
              body="Confirmed job cards waiting for vault gold will appear here."
            />
          ) : (
            <div className="space-y-2">
              {readyJobs.map((j) => (
                <div
                  key={j.id}
                  className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-gold">
                      {j.jobNo} · {j.orderNo}
                    </div>
                    <div className="text-sm">
                      {j.customerName} · {j.itemName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Target fine {mgToGrams(j.targetFineMg)} g
                      {j.karigarName ? ` · ${j.karigarName}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/workshop/$id" params={{ id: j.id }}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye className="h-3 w-3" /> View
                      </Button>
                    </Link>
                    <Button size="sm" className="gap-1" onClick={() => navigate({ to: '/workshop/gold-book' })}>
                      <Hammer className="h-3 w-3" /> Issue Gold
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active">
          {activeJobs.length === 0 ? (
            <EmptyState
              title="No jobs in karigar custody"
              body="Assign orders to the workshop and create job cards. Gold should be issued via the Worker Gold Book."
            />
          ) : (
            <div className="space-y-2">
              {activeJobs.map((j) => (
                <div
                  key={j.id}
                  className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-gold">
                      {j.jobNo} · {j.orderNo}
                    </div>
                    <div className="text-sm">
                      {j.customerName} · {j.itemName} · {j.karigarName ?? "—"}
                    </div>
                    <div className="text-muted-foreground flex gap-2 truncate">
                      {/* Issue details moved to Worker Gold Book */}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/workshop/$id" params={{ id: j.id }}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye className="h-3 w-3" /> View
                      </Button>
                    </Link>
                    <Button size="sm" className="gap-1" onClick={() => setReceiveJobId(j.id)}>
                      <PackageCheck className="h-3 w-3" /> Receive Work
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="custody">
          {custody.length === 0 ? (
            <EmptyState
              title="No karigar custody yet"
              body="Custody appears once gold is issued from the vault to a karigar."
            />
          ) : (
            <div className="space-y-3">
              {custody.map((c) => (
                <div key={c.karigarId} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="font-medium">{c.karigarName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.jobs.length} job card{c.jobs.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        c.outstandingMg > 0
                          ? "border-gold/40 text-gold"
                          : "border-emerald-500/40 text-emerald-300"
                      }
                    >
                      Outstanding: {mgToGrams(c.outstandingMg)} g fine
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                    <Stat k="Issued" v={`${mgToGrams(c.issuedMg)} g`} />
                    <Stat k="Finished" v={`${mgToGrams(c.finishedMg)} g`} />
                    <Stat k="Scrap" v={`${mgToGrams(c.scrapMg)} g`} />
                    <Stat k="Filings" v={`${mgToGrams(c.filingsMg)} g`} />
                    <Stat k="Wastage" v={`${mgToGrams(c.wastageMg)} g`} />
                    <Stat
                      k="Overloss"
                      v={`${mgToGrams(c.overlossMg)} g`}
                      tone={c.overlossMg > 0 ? "red" : undefined}
                    />
                  </div>
                  <div className="mt-3 space-y-1">
                    {c.jobs.map((cj) => (
                      <Link
                        key={cj.jobId}
                        to="/workshop/$id"
                        params={{ id: cj.jobId }}
                        className="flex items-center justify-between text-xs hover:text-gold"
                      >
                        <span className="font-mono">{cj.jobNo}</span>
                        <span className="font-mono">{mgToGrams(cj.outstandingMg)} g</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Workflow: Order → Job Card → <span className="text-gold">Worker Gold Book</span> → Receive Work →
        Stock → Billing → Daily Close.
      </p>


      <ReceiveWorkDialog
        open={!!receiveJob}
        onClose={() => setReceiveJobId(null)}
        job={receiveJob}
      />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
      <Hammer className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-serif text-xl text-gold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "red" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`text-sm font-mono ${tone === "red" ? "text-red-300" : ""}`}>{v}</div>
    </div>
  );
}
