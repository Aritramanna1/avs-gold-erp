import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { usePrintEngine } from "@/lib/print-engine";
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
  type JobStatus,
} from "@/lib/jobcards-store";
import { referenceImagesForOrder } from "@/lib/job-card-engine";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";

import { ReceiveWorkDialog } from "@/components/receive-work-dialog";
import { EmailSendPanel } from "@/components/email-send-panel";
import { CommLogCard } from "@/components/comm-log-card";
import {
  ArrowLeft,
  CheckCircle2,
  Hammer,
  PackageCheck,
  Printer,
  Receipt,
  RotateCcw,
  Scale,
  ShoppingBag,
  Trash2,
  User as UserIcon,
} from "lucide-react";


export const Route = createFileRoute("/workshop/$id")({
  head: () => ({ meta: [{ title: "Job Card · AVS Gold ERP" }] }),
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

function JobCardDetail() {
  const { id } = useParams({ from: "/workshop/$id" });
  const navigate = useNavigate();
  const job = useJobCards((s) => s.jobs.find((j) => j.id === id));
  const update = useJobCards((s) => s.update);
  const remove = useJobCards((s) => s.remove);
  const appendTimeline = useJobCards((s) => s.appendTimeline);
  const people = usePeople((s) => s.people);

  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkNote, setReworkNote] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  // Print Dialog States
  const { triggerPrint } = usePrintEngine();

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

  const customer = people.find((p) => p.id === job.customerId);
  const karigar = job.karigarId ? people.find((p) => p.id === job.karigarId) : null;
  const referenceImages = referenceImagesForOrder(job.orderId);

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

  function confirmRework() {
    update(job!.id, { status: "rework" });
    appendTimeline(job!.id, {
      ts: Date.now(),
      label: "Job marked Rework",
      note: reworkNote.trim() || undefined,
    });
    setReworkNote("");
    setReworkOpen(false);
  }

  return (
    <div data-testid="workshop-detail-root" className="p-4 md:p-8 max-w-6xl mx-auto">
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
              <Button size="sm" className="gap-1" onClick={() => navigate({ to: '/workshop/gold-book' })}>
                <Hammer className="h-4 w-4" /> Worker Gold Book
              </Button>
            )}
            {!job.workReceipt && (
              <Button size="sm" className="gap-1" onClick={() => setReceiveOpen(true)}>
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
          {job.status !== "rework" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-red-300 border-red-500/30"
              onClick={() => {
                setReworkOpen(true);
                setReworkNote("");
              }}
            >
              <RotateCcw className="h-3 w-3" /> Mark as Rework
            </Button>
          )}
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
            {referenceImages.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="text-[11px] text-muted-foreground mb-2">Reference images</div>
                <div className="flex flex-wrap gap-2">
                  {referenceImages.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer">
                      <img
                        src={src}
                        alt={`Reference ${i + 1}`}
                        className="h-20 w-20 object-cover rounded border border-border"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
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
                  onClick={() => navigate({ to: '/workshop/gold-book' })}
                >
                  <Hammer className="h-4 w-4" /> Issue Gold to Karigar (Worker Gold Book)
                </Button>
              )}
              {!job.workReceipt && (
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

      {/* Rework dialog */}
      <Dialog open={reworkOpen} onOpenChange={(o) => !o && setReworkOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Job Card as Rework</DialogTitle>
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
            <Button variant="ghost" onClick={() => setReworkOpen(false)}>
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
