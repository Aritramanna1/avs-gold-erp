import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { AttachmentsSection } from "@/components/attachments-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useJobCards,
  JOB_STATUS_LABELS,
  STEP_STATUS_LABELS,
  PROCESS_TEMPLATES,
  jobKarigarCustodyMg,
  type JobStatus,
  type StepStatus,
} from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { IssueGoldDialog } from "@/components/issue-gold-dialog";
import { ReceiveWorkDialog } from "@/components/receive-work-dialog";
import { EmailSendPanel } from "@/components/email-send-panel";
import { CommLogCard } from "@/components/comm-log-card";
import {
  ArrowLeft,
  CheckCircle2,
  Hammer,
  PackageCheck,
  Play,
  Printer,
  Receipt,
  RotateCcw,
  Scale,
  ShoppingBag,
  SkipForward,
  Trash2,
  User as UserIcon,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";
import { PrintPreviewModal } from "@/components/print/PrintPreviewModal";

export const Route = createFileRoute("/workshop/$id")({
  head: () => ({ meta: [{ title: "Job Card · MTJ ERP" }] }),
  component: JobCardDetail,
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

const STEP_TONE: Record<StepStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  skipped: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  rework: "bg-red-500/15 text-red-300 border-red-500/30",
};

function JobCardDetail() {
  const { id } = useParams({ from: "/workshop/$id" });
  const navigate = useNavigate();
  const job = useJobCards((s) => s.jobs.find((j) => j.id === id));
  const update = useJobCards((s) => s.update);
  const remove = useJobCards((s) => s.remove);
  const setStepStatus = useJobCards((s) => s.setStepStatus);
  const appendTimeline = useJobCards((s) => s.appendTimeline);
  const people = usePeople((s) => s.people);

  const [reworkOpen, setReworkOpen] = useState<null | { stepId?: string }>(null);
  const [reworkNote, setReworkNote] = useState("");
  const [skipOpen, setSkipOpen] = useState<null | { stepId: string }>(null);
  const [skipNote, setSkipNote] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  // Print Dialog States
  const [printOpen, setPrintOpen] = useState(false);
  const [printUrl, setPrintUrl] = useState("");
  const [printTitle, setPrintTitle] = useState("");

  // Custom workflow steps states
  const [editStepsOpen, setEditStepsOpen] = useState(false);
  const [newStepName, setNewStepName] = useState("");

  if (!job) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <h1 className="font-serif text-2xl text-gold">Job Card not found</h1>
        <Link to="/workshop" className="text-gold underline mt-4 inline-block">
          Back to Workshop
        </Link>
      </div>
    );
  }

  function triggerPrint(url: string, titleName: string) {
    setPrintUrl(url);
    setPrintTitle(titleName);
    setPrintOpen(true);
  }

  const customer = people.find((p) => p.id === job.customerId);
  const karigar = job.karigarId ? people.find((p) => p.id === job.karigarId) : null;
  const template = job.templateKey ? PROCESS_TEMPLATES[job.templateKey] : null;

  const breadcrumb = [
    "Order",
    "Job Card",
    "Issue Gold",
    "Receive Work",
    "Stock",
    "Billing",
    "Daily Close",
  ];

  function del() {
    if (confirm("Delete this job card? The linked order will become 'Awaiting Job Card' again.")) {
      remove(job!.id);
      navigate({ to: "/workshop" });
    }
  }

  function startStep(stepId: string) {
    setStepStatus(job!.id, stepId, "in_progress");
  }
  function completeStep(stepId: string) {
    setStepStatus(job!.id, stepId, "done");
  }
  function confirmSkip() {
    if (!skipOpen) return;
    setStepStatus(job!.id, skipOpen.stepId, "skipped", skipNote.trim() || undefined);
    setSkipNote("");
    setSkipOpen(null);
  }
  function confirmRework() {
    if (!reworkOpen) return;
    if (reworkOpen.stepId) {
      setStepStatus(job!.id, reworkOpen.stepId, "rework", reworkNote.trim() || undefined);
    } else {
      update(job!.id, { status: "rework" });
      appendTimeline(job!.id, {
        ts: Date.now(),
        label: "Job marked Rework",
        note: reworkNote.trim() || undefined,
      });
    }
    setReworkNote("");
    setReworkOpen(null);
  }

  function moveStep(idx: number, direction: "up" | "down") {
    if (!job) return;
    const next = [...job.steps];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    const temp = next[idx];
    next[idx] = next[swapIdx];
    next[swapIdx] = temp;
    update(job.id, { steps: next });
    appendTimeline(job.id, {
      ts: Date.now(),
      label: `Steps Reordered`,
      note: `Workflow changed: ${next.map((s) => s.name).join(" ➔ ")}`,
    });
  }

  function addCustomStep() {
    if (!job || !newStepName.trim()) return;
    const next = [
      ...job.steps,
      {
        id: `custom_${Date.now()}`,
        name: newStepName.trim(),
        status: "pending" as StepStatus,
      },
    ];
    update(job.id, { steps: next });
    appendTimeline(job.id, {
      ts: Date.now(),
      label: `Added Custom Step`,
      note: `Added "${newStepName.trim()}" to workflow steps`,
    });
    setNewStepName("");
  }

  function deleteStep(stepId: string) {
    if (!job) return;
    const step = job.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (step.status !== "pending") {
      alert("Only pending steps can be deleted from the active workflow.");
      return;
    }
    const next = job.steps.filter((s) => s.id !== stepId);
    update(job.id, { steps: next });
    appendTimeline(job.id, {
      ts: Date.now(),
      label: `Removed Step`,
      note: `Removed step "${step.name}" from workflow`,
    });
  }

  return (
    <div data-testid="workshop-detail-root" className="p-4 md:p-8 max-w-6xl mx-auto">
      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={printTitle}
        docNo={job.jobNo}
        relatedTable="jobcards"
        relatedRecordId={job.id}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs border border-neutral-200 p-3 rounded bg-neutral-50/50 text-left">
            <div>
              <strong className="text-[11px] uppercase tracking-wider text-neutral-500 block">
                Item Details
              </strong>
              <p className="mt-1 font-semibold">Category: {job.category}</p>
              <p>Item Name: {job.itemName}</p>
              <p>Target Net: {mgToGrams(job.targetNetMg)} g</p>
              <p>Target Fine: {mgToGrams(job.targetFineMg)} g</p>
            </div>
            <div>
              <strong className="text-[11px] uppercase tracking-wider text-neutral-500 block">
                Karigar &amp; Customer
              </strong>
              <p className="mt-1 font-semibold">Karigar: {karigar?.fullName || "Unassigned"}</p>
              <p>Customer: {customer?.fullName || "Unknown"}</p>
              <p>Purity Required: {job.purity}</p>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg overflow-hidden mt-3 text-black text-left">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 border-b border-neutral-200 text-[10px] font-bold uppercase text-neutral-600">
                <tr>
                  <th className="p-2.5">Stage</th>
                  <th className="p-2.5">Process Step</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {job.steps.map((st, i) => (
                  <tr key={st.id} className="hover:bg-neutral-50/40">
                    <td className="p-2.5 font-mono text-stone-500">{i + 1}</td>
                    <td className="p-2.5 font-semibold text-stone-800">{st.name}</td>
                    <td className="p-2.5 uppercase text-[9px] font-bold">
                      <span className="px-1.5 py-0.5 rounded border border-neutral-300">
                        {st.status}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-stone-500">
                      {st.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PrintPreviewModal>
      <PageHeader
        title={job.jobNo}
        subtitle={`From order ${job.orderNo} · created ${new Date(job.createdAt).toLocaleString("en-IN")}`}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Link to="/workshop">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Workshop
              </Button>
            </Link>
            <Link to="/orders/$id" params={{ id: job.orderId }}>
              <Button variant="ghost" className="gap-2">
                Back to Order
              </Button>
            </Link>
            <Button
              data-testid="workshop-print-job-card"
              variant="outline"
              className="gap-2"
              onClick={() =>
                triggerPrint(`/workshop/print/${job.id}`, `Job Card Preview · ${job.jobNo}`)
              }
            >
              <Printer className="h-4 w-4" /> Print Job Card
            </Button>
            {!job.workReceipt && (
              <Button
                data-testid="workshop-issue-gold"
                className="gap-2"
                onClick={() => setIssueOpen(true)}
              >
                <Hammer className="h-4 w-4" /> {job.goldIssue ? "Additional Issue" : "Issue Gold"}
              </Button>
            )}
            {job.goldIssue && !job.workReceipt && (
              <Button
                data-testid="workshop-receive-work"
                className="gap-2"
                variant="default"
                onClick={() => setReceiveOpen(true)}
              >
                <PackageCheck className="h-4 w-4" /> Receive Work
              </Button>
            )}
            {job.workReceipt && (
              <Link to="/billing/new" search={{ orderId: job.orderId, jobId: job.id }}>
                <Button className="gap-2">
                  <Receipt className="h-4 w-4" /> Go to Billing
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Breadcrumb */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {breadcrumb.map((b, i) => (
            <div key={b} className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded ${i <= 1 ? "bg-gold/15 text-gold border border-gold/30" : "text-muted-foreground"}`}
              >
                {b}
              </span>
              {i < breadcrumb.length - 1 && <span className="text-muted-foreground">›</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Status:</span>
          <Select
            value={job.status}
            onValueChange={(v) => {
              update(job!.id, { status: v as JobStatus });
              appendTimeline(job!.id, {
                ts: Date.now(),
                label: `Status → ${JOB_STATUS_LABELS[v as JobStatus]}`,
              });
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {JOB_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className={STATUS_TONE[job.status]}>
            {JOB_STATUS_LABELS[job.status]}
          </Badge>
          <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider">
            Priority: {job.priority}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Item target */}
          <Section title="Item & Gold Target" icon={ShoppingBag}>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <Kv k="Item" v={job.itemName} />
              <Kv k="Category" v={job.category} />
              <Kv k="Purity" v={String(job.purity)} />
              <Kv k="Target gross" v={`${mgToGrams(job.targetGrossMg)} g`} />
              <Kv k="Target net" v={`${mgToGrams(job.targetNetMg)} g`} />
              <Kv k="Target fine" v={`${mgToGrams(job.targetFineMg)} g`} accent />
            </div>
            {job.notes && (
              <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
                {job.notes}
              </p>
            )}
          </Section>

          {/* Process steps */}
          <Section title={`Process Steps — ${template?.name ?? "Standard Workflow"}`} icon={Hammer}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] text-muted-foreground mr-2">
                Customize sequencing or insert custom job steps.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1"
                onClick={() => setEditStepsOpen(true)}
              >
                <Hammer className="h-3.5 w-3.5 text-gold" /> Customize Workflow
              </Button>
            </div>
            <ol className="space-y-2">
              {job.steps.map((s, idx) => (
                <li key={s.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-xs">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {s.startedAt
                            ? `Started ${new Date(s.startedAt).toLocaleString("en-IN")}`
                            : ""}
                          {s.completedAt
                            ? ` · Completed ${new Date(s.completedAt).toLocaleString("en-IN")}`
                            : ""}
                        </div>
                        {s.notes && (
                          <div className="text-xs text-muted-foreground mt-1">Note: {s.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={STEP_TONE[s.status]}>
                        {STEP_STATUS_LABELS[s.status]}
                      </Badge>
                      {s.status === "pending" && (
                        <Button
                          data-testid="workshop-start-step"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => startStep(s.id)}
                        >
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {s.status === "in_progress" && (
                        <Button
                          data-testid="workshop-complete-step"
                          size="sm"
                          className="gap-1"
                          onClick={() => completeStep(s.id)}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </Button>
                      )}
                      {(s.status === "pending" || s.status === "in_progress") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setSkipOpen({ stepId: s.id });
                            setSkipNote("");
                          }}
                        >
                          <SkipForward className="h-3 w-3" /> Skip
                        </Button>
                      )}
                      {s.status !== "rework" && s.status !== "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-red-300 border-red-500/30"
                          onClick={() => {
                            setReworkOpen({ stepId: s.id });
                            setReworkNote("");
                          }}
                        >
                          <RotateCcw className="h-3 w-3" /> Rework
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-red-300 border-red-500/30"
                onClick={() => {
                  setReworkOpen({});
                  setReworkNote("");
                }}
              >
                <RotateCcw className="h-3 w-3" /> Mark whole job as Rework
              </Button>
            </div>
          </Section>

          {/* Customer */}
          <Section title="Customer" icon={UserIcon}>
            {customer ? (
              <div>
                <div className="font-medium">{customer.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {customer.phone}
                  {customer.villageCity ? ` · ${customer.villageCity}` : ""}
                  {customer.gstin ? ` · GSTIN ${customer.gstin}` : ""}
                </div>
                <Link to="/people" className="text-xs text-gold underline">
                  View customer profile
                </Link>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Snapshot: {job.customerName}</div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          {/* Karigar */}
          <Section title="Assigned Karigar" icon={Hammer}>
            {karigar ? (
              <div>
                <div className="font-medium">{karigar.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {karigar.phone}
                  {karigar.workType ? ` · ${karigar.workType}` : ""}
                </div>
                <div className="mt-2 text-[11px]">
                  <Badge variant="outline" className="border-gold/30 text-gold">
                    Gold custody this job: {mgToGrams(jobKarigarCustodyMg(job))} g fine
                  </Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Link to="/people" className="text-xs text-gold underline">
                    View profile
                  </Link>
                  <Link
                    to="/attendance"
                    className="text-xs text-muted-foreground hover:text-gold underline"
                  >
                    View passbook
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Not assigned.</div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Expected delivery:{" "}
              <span className="text-foreground">{job.expectedDelivery ?? "—"}</span>
            </div>
            {job.expectedStart && (
              <div className="text-xs text-muted-foreground">
                Start: <span className="text-foreground">{job.expectedStart}</span>
              </div>
            )}
            {job.expectedCompletion && (
              <div className="text-xs text-muted-foreground">
                Completion: <span className="text-foreground">{job.expectedCompletion}</span>
              </div>
            )}
          </Section>

          {/* Gold Issue summary */}
          {job.goldIssue && (
            <Section title="Gold Issued" icon={Hammer}>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slip</span>
                  <span className="font-mono">{job.goldIssue.slipNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross</span>
                  <span className="font-mono">
                    {mgToGrams(job.goldIssue.grossMg)} g @ {job.goldIssue.purity}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fine</span>
                  <span className="font-mono text-gold">{mgToGrams(job.goldIssue.fineMg)} g</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Issued</span>
                  <span>{new Date(job.goldIssue.ts).toLocaleString("en-IN")}</span>
                </div>
                <div className="pt-2">
                  <Button
                    data-testid="workshop-print-issue-slip"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    onClick={() =>
                      triggerPrint(
                        `/workshop/issue-slip/${job.id}`,
                        `Issue Slip Preview · ${job.goldIssue?.slipNo}`,
                      )
                    }
                  >
                    <Printer className="h-3 w-3" /> Print Gold Issue Slip
                  </Button>
                </div>
              </div>
            </Section>
          )}

          {/* Work Receipt summary */}
          {job.workReceipt && (
            <Section title="Work Received" icon={PackageCheck}>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slip</span>
                  <span className="font-mono">{job.workReceipt.slipNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finished</span>
                  <span className="font-mono">
                    {mgToGrams(job.workReceipt.finishedFineMg)} g fine
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scrap</span>
                  <span className="font-mono">{mgToGrams(job.workReceipt.scrapFineMg)} g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filings</span>
                  <span className="font-mono">{mgToGrams(job.workReceipt.filingsFineMg)} g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected loss</span>
                  <span className="font-mono">{mgToGrams(job.workReceipt.expectedLossMg)} g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual loss</span>
                  <span className="font-mono">{mgToGrams(job.workReceipt.actualLossMg)} g</span>
                </div>
                {job.workReceipt.overlossMg > 0 && (
                  <div className="flex justify-between text-red-300">
                    <span>Overloss</span>
                    <span className="font-mono">{mgToGrams(job.workReceipt.overlossMg)} g</span>
                  </div>
                )}
                <div className="pt-2 flex flex-col gap-1">
                  <Button
                    data-testid="workshop-print-receive-slip"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    onClick={() =>
                      triggerPrint(
                        `/workshop/receive-slip/${job.id}`,
                        `Receive Slip Preview · ${job.workReceipt?.slipNo}`,
                      )
                    }
                  >
                    <Printer className="h-3 w-3" /> Print Gold Receive Slip
                  </Button>
                  {job.workReceipt.filingsFineMg > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() =>
                        triggerPrint(
                          `/workshop/filings-slip/${job.id}`,
                          `Filings Receipt Preview · ${job.workReceipt?.slipNo}`,
                        )
                      }
                    >
                      <Printer className="h-3 w-3" /> Print Filings Receipt
                    </Button>
                  )}
                  {job.workReceipt.finishedStockId && (
                    <Link to="/stock/$id" params={{ id: job.workReceipt.finishedStockId }}>
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <ShoppingBag className="h-3 w-3" /> View Finished Stock Item
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Next actions */}
          <Section title="Next actions">
            <div className="space-y-2 text-sm">
              {!job.workReceipt && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setIssueOpen(true)}
                >
                  <Hammer className="h-4 w-4" />{" "}
                  {job.goldIssue ? "Additional Gold Issue" : "Issue Gold to Karigar"}
                </Button>
              )}
              {job.goldIssue && !job.workReceipt && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setReceiveOpen(true)}
                >
                  <PackageCheck className="h-4 w-4" /> Receive Work from Karigar
                </Button>
              )}
              <Link to="/orders/$id" params={{ id: job.orderId }}>
                <Button variant="outline" className="w-full justify-start gap-2 mt-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Order {job.orderNo}
                </Button>
              </Link>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-3 text-red-400 hover:text-red-300 gap-2"
              onClick={del}
            >
              <Trash2 className="h-4 w-4" /> Delete job card
            </Button>
          </Section>

          {/* Timeline */}
          <Section title="Timeline">
            <ol className="space-y-2 text-xs max-h-80 overflow-y-auto">
              {[...job.timeline].reverse().map((e, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="h-3 w-3 text-gold mt-0.5 shrink-0" />
                  <div>
                    <div>{e.label}</div>
                    <div className="text-muted-foreground">
                      {new Date(e.ts).toLocaleString("en-IN")}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <EmailSendPanel
          title="Share to Karigar"
          templateKinds={[
            "job_assignment",
            "work_reminder",
            "gold_issue_alert",
            "work_receive_confirm",
            "custom",
          ]}
          recipients={[
            ...(karigar?.email
              ? [{ label: karigar.fullName, role: "Karigar", email: karigar.email }]
              : []),
            ...(customer?.email
              ? [{ label: customer.fullName, role: "Customer", email: customer.email }]
              : []),
          ]}
          context={{ jobId: job.id, orderId: job.orderId }}
          linkedType="job"
          linkedId={job.id}
          defaultTemplateKind="job_assignment"
          defaultRecipientEmail={karigar?.email}
        />
        <CommLogCard linkedType="job" linkedId={job.id} />
      </div>

      {/* Skip dialog */}
      <Dialog open={!!skipOpen} onOpenChange={(o) => !o && setSkipOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip step</DialogTitle>
            <DialogDescription>
              Add a short reason. The step will be marked skipped.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={skipNote}
            onChange={(e) => setSkipNote(e.target.value)}
            placeholder="Reason for skipping…"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipOpen(null)}>
              Cancel
            </Button>
            <Button onClick={confirmSkip}>Skip step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rework dialog */}
      <Dialog open={!!reworkOpen} onOpenChange={(o) => !o && setReworkOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reworkOpen?.stepId ? "Mark step as Rework" : "Mark Job Card as Rework"}
            </DialogTitle>
            <DialogDescription>
              Write the rework reason. It will appear in Workshop → Rework tab.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reworkNote}
            onChange={(e) => setReworkNote(e.target.value)}
            placeholder="What needs to be redone and why?"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReworkOpen(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRework} disabled={!reworkNote.trim()}>
              Confirm Rework
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AttachmentsSection
        entityType="jobcard"
        entityId={job.id}
        slots={[
          { key: "karigar_photo", label: "Karigar photo" },
          { key: "issued_material", label: "Issued material photo" },
          { key: "received_work", label: "Received work photo" },
          { key: "filings_photo", label: "Filings photo" },
        ]}
      />

      {/* Dynamic Workflow Steps Editor */}
      <Dialog open={editStepsOpen} onOpenChange={setEditStepsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5 text-gold" /> Customize Process Steps
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dynamically append custom steps, reoreder process sequencing, or delete unwanted
              pending steps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {/* Steps list with arrows & delete triggers */}
            <div className="space-y-2 border border-border/60 bg-muted/20 p-3 rounded-xl max-h-60 overflow-y-auto">
              {job.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border/80 text-xs"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span className="h-5 w-5 rounded-full bg-zinc-600/10 dark:bg-zinc-100/15 text-stone-700 dark:text-stone-300 grid place-items-center text-[10px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[160px]">{step.name}</span>
                    <Badge
                      variant="outline"
                      className={`scale-75 origin-left ${STEP_TONE[step.status]}`}
                    >
                      {STEP_STATUS_LABELS[step.status]}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Move Up */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={() => moveStep(idx, "up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    {/* Move Down */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={idx === job.steps.length - 1}
                      onClick={() => moveStep(idx, "down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    {/* Delete pending step */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      disabled={step.status !== "pending"}
                      onClick={() => deleteStep(step.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick-add custom process input form block */}
            <div className="space-y-1.5 border-t pt-3">
              <label className="text-xs font-semibold block text-gold">
                Insert New Custom Stage
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  placeholder="e.g. Meena, Kundan Setting, Laser Logo..."
                  className="flex-1 text-xs h-8 px-3 rounded border border-border bg-background focus:outline-none focus:border-gold"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomStep();
                    }
                  }}
                />
                <Button size="sm" className="h-8 text-xs gap-1" onClick={addCustomStep}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setEditStepsOpen(false)}
            >
              Finish Customization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IssueGoldDialog
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        job={job}
        onIssued={() => {
          window.open(`/workshop/issue-slip/${job?.id}`, "_blank");
        }}
      />
      <ReceiveWorkDialog open={receiveOpen} onClose={() => setReceiveOpen(false)} job={job} />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-4 w-4 text-gold" />}
        <h3 className="font-serif text-lg text-gold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Kv({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`text-sm ${accent ? "text-gold font-mono" : ""}`}>{v}</div>
    </div>
  );
}
