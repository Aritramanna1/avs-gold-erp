/**
 * Karigar Portal — /karigar-portal
 *
 * Public-accessible route (authenticated via Supabase OTP, not ERP staff login).
 * Shows a karigar's own data: gold balance, active jobs, work returns,
 * wages, and attendance.
 *
 * Data fetched via get_karigar_portal() Supabase RPC, which uses
 * the caller's JWT to find their karigar record by phone/email.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { useEffect, useState, type FormEvent } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fetchMyPortalContext } from "@/lib/portal/portal-context-service";
import {
  Hammer,
  Loader2,
  Scale,
  Coins,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  LogOut,
  PackageCheck,
  Send,
  CheckCircle2,
} from "lucide-react";
import { formatDateMedium as fmtDate } from "@/lib/format-date";
import { Logo } from "@/components/ui/Logo";

export const Route = createFileRoute("/karigar-portal")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({
    meta: [{ title: "Karigar Portal · AVS Gold ERP" }],
  }),
  component: KarigarPortal,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function mg(val: number) {
  const g = val / 1000;
  return g.toFixed(3) + "g";
}

function rs(paiseOrAmount: number) {
  return "₹" + paiseOrAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function gramsToMg(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 1000);
}

function safeJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function cryptoSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ── types ─────────────────────────────────────────────────────────────────────

interface GoldBalance {
  issuedMg: number;
  receivedMg: number;
  balanceMg: number;
}

interface GoldEntry {
  id: string;
  ts: string;
  type: string;
  narration: string;
  netFineMg: number;
  grossMg: number;
  purity: number;
  slipNo: string;
}

interface WageEntry {
  id: string;
  kind: string;
  ts: string;
  amount: number;
  notes: string;
}

interface AttendanceEntry {
  date: string;
  status: string;
  inTime: string;
  outTime: string;
}

interface KarigarData {
  found: boolean;
  message?: string;
  profile: { id: string; name: string; firmId: string };
  goldBalance: GoldBalance;
  goldEntries: GoldEntry[];
  wages: WageEntry[];
  attendance: AttendanceEntry[];
}

interface PortalJobCard {
  id: string;
  jobNo: string;
  status: string;
  createdAt: string;
  branchId: string | null;
  orderId: string;
  itemName?: string;
  customerName?: string;
  grossMg?: number;
  netMg?: number;
  fineMg?: number;
  purity?: number;
  dueDate?: string;
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "rose" | "gold";
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    rose: "bg-red-500/10 text-red-400 border-red-500/30",
    gold: "bg-gold/10 text-gold border-gold/30",
  };
  const cls = accent ? colors[accent] : "bg-card text-foreground border-border";
  return (
    <div className={`rounded-md border p-4 shadow-xs ${cls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold font-mono leading-tight">{value}</div>
      {sub && <div className="text-xs mt-0.5 text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

function KarigarPortal() {
  const navigate = useNavigate();
  const [data, setData] = useState<KarigarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"gold" | "wages" | "attendance" | "jobs" | "return" | "qc">(
    "gold",
  );
  const [jobCards, setJobCards] = useState<PortalJobCard[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Form states for Scrap/Return Submission
  const [selectedJobId, setSelectedJobId] = useState("");
  const [finishedGrossWt, setFinishedGrossWt] = useState("");
  const [scrapGrossWt, setScrapGrossWt] = useState("");
  const [filingsGrossWt, setFilingsGrossWt] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  // QC rework state
  const [reworkBusy, setReworkBusy] = useState<string | null>(null);
  const [reworkDone, setReworkDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    void (async () => {
      // Check session first
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData.session) {
        void navigate({ to: "/karigar-login" });
        return;
      }

      // Fetch karigar data via RPC
      const portalCtx = await fetchMyPortalContext("karigar");
      if (!active) return;
      if (!portalCtx) {
        setError("Your karigar portal identity is not linked. Please contact your firm.");
        return;
      }

      const { data: result, error: rpcError } = await (supabase as any).rpc("get_karigar_portal");
      if (!active) return;
      if (rpcError) {
        setError("Could not load your portal data. Please contact your firm.");
      } else {
        setData(result as KarigarData);

        // Fetch only this karigar's active job cards through Supabase/RLS.
        const { data: jobsResult, error: jobsErr } = await supabase
          .from("job_cards")
          .select("id,job_no,status,created_at,order_id,data")
          .eq("karigar_id", (result as KarigarData).profile.id)
          .not("status", "in", "(closed,cancelled,delivered)")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!active) return;
        if (jobsErr) {
          setJobsError(jobsErr.message || "Could not load your active jobs.");
          setJobCards([]);
          setLoadingJobs(false);
          return;
        }
        if (!jobsErr && jobsResult) {
          const parsed = jobsResult.map((j) => {
            const rawData =
              (typeof j.data === "string"
                ? safeJson<Record<string, unknown>>(j.data)
                : (j.data as Record<string, unknown> | null)) ?? {};
            return {
              id: j.id,
              jobNo: j.job_no,
              status: j.status,
              createdAt: j.created_at,
              branchId: String(rawData?.branchId ?? "") || null,
              orderId: j.order_id ?? "",
              itemName: String(
                rawData?.itemName ?? rawData?.designName ?? rawData?.productName ?? "",
              ),
              customerName: String(rawData?.customerName ?? ""),
              grossMg: numericValue(rawData?.grossMg),
              netMg: numericValue(rawData?.netMg),
              fineMg: numericValue(rawData?.fineMg),
              purity: numericValue(rawData?.purity),
              dueDate: typeof rawData?.dueDate === "string" ? rawData.dueDate : undefined,
            } satisfies PortalJobCard;
          });
          setJobCards(parsed);
          if (parsed.length > 0) {
            setSelectedJobId(parsed[0].id);
          }
        }
        setLoadingJobs(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleReturnSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedJobId || !data) return;
    setSubmitBusy(true);
    setSubmitSuccess(false);
    setSubmitError(null);

    const selectedJob = jobCards.find((j) => j.id === selectedJobId);
    if (!selectedJob) {
      setSubmitBusy(false);
      setSubmitError("Select an active job before submitting returned work.");
      return;
    }

    try {
      const finishedMg = gramsToMg(finishedGrossWt);
      const scrapMg = gramsToMg(scrapGrossWt);
      const filingsMg = gramsToMg(filingsGrossWt);
      if (finishedMg + scrapMg + filingsMg <= 0) {
        throw new Error("Enter at least one returned weight.");
      }

      const now = Date.now();
      const returnNo = `WR-${new Date(now).toISOString().slice(0, 10).replace(/-/g, "")}-${cryptoSuffix()}`;
      const returnId = `wr_${cryptoSuffix().toLowerCase()}_${now}`;
      const { error: insertErr } = await supabase.from("worker_returns").insert({
        id: returnId,
        branch_id: selectedJob.branchId || null,
        order_id: selectedJob.orderId || "",
        worker_id: data.profile.id,
        data: {
          id: returnId,
          returnNo,
          orderId: selectedJob.orderId || "",
          workerId: data.profile.id,
          workerName: data.profile.name,
          jobCardId: selectedJob.id,
          jobNo: selectedJob.jobNo,
          materialReturned: "Finished Product",
          itemName: selectedJob.itemName ?? "",
          finishedGrossMg: finishedMg,
          scrapGrossMg: scrapMg,
          filingsGrossMg: filingsMg,
          grossMg: finishedMg + scrapMg + filingsMg,
          fineMg: 0,
          purity: selectedJob.purity ?? 0,
          ts: now,
          notes: returnNotes,
          remarks: returnNotes,
          status: "submitted",
          source: "karigar_portal",
          createdAt: now,
        },
      });

      if (insertErr) throw insertErr;

      setSubmitSuccess(true);
      setFinishedGrossWt("");
      setScrapGrossWt("");
      setFilingsGrossWt("");
      setReturnNotes("");
      setSelectedJobId(jobCards.find((job) => job.id !== selectedJob.id)?.id ?? selectedJob.id);
    } catch (ex: any) {
      setSubmitError(ex.message || "Could not submit returned work.");
    } finally {
      setSubmitBusy(false);
    }
  }

  async function handleAcknowledgeRework(jobId: string) {
    setReworkBusy(jobId);
    try {
      const { error: updErr } = await supabase
        .from("job_cards")
        .update({ status: "rework_started" })
        .eq("id", jobId);
      if (updErr) throw updErr;
      setReworkDone((prev) => new Set([...prev, jobId]));
    } catch {
      // silently fail - next reload will show updated state
    } finally {
      setReworkBusy(null);
    }
  }

  function handleSignOut() {
    void supabase.auth.signOut().then(() => {
      window.location.href = "/karigar-login";
    });
  }

  // ── Loading ──
  if (!data && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-gold mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your portal…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !data?.found) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full bg-card rounded-md border border-border shadow-xs p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-gold/10 text-gold border border-gold/20">
            <Hammer className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Profile Not Found</h2>
          <p className="text-sm text-muted-foreground">
            {error ?? data?.message ?? "Your karigar profile is not linked to this account yet."}
          </p>
          <p className="text-xs text-muted-foreground">
            Please ask your firm administrator to link your email address.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-md border border-border px-4 py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const bal = data.goldBalance;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="bg-card border-b border-border shadow-xs sticky top-0 z-40">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-7" />
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Hammer className="h-4 w-4 text-gold" />
                Karigar Workbench
              </div>
              <div className="text-xs text-muted-foreground">{data.profile.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Gold balance summary */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Gold Balance Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={TrendingDown}
              label="Gold Issued to You"
              value={mg(bal.issuedMg)}
              accent="rose"
            />
            <StatCard
              icon={TrendingUp}
              label="Gold Returned"
              value={mg(bal.receivedMg)}
              accent="emerald"
            />
            <StatCard
              icon={Scale}
              label="Balance Held by You"
              value={mg(bal.balanceMg)}
              sub="approx — settlement at delivery"
              accent="gold"
            />
          </div>
        </section>

        {/* Tab navigation */}
        {/* Mobile View */}
        <div className="block sm:hidden mb-4">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as any)}
            className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm font-semibold shadow-xs focus:outline-none focus:ring-1 focus:ring-gold text-foreground"
          >
            <option value="gold">Gold Ledger Summary</option>
            <option value="jobs">Your Active Bench Jobs ({jobCards.length})</option>
            <option value="qc">QC Rejections</option>
            <option value="return">Submit Completed Work &amp; Scrap</option>
            <option value="wages">Wages &amp; Payments Ledger</option>
            <option value="attendance">Daily Attendance Log</option>
          </select>
        </div>

        {/* Desktop View: Full horizontal tabs triggers bar */}
        <div className="hidden sm:flex gap-1 bg-card rounded-md border border-border p-1 shadow-xs">
          {(["gold", "jobs", "qc", "return", "wages", "attendance"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                tab === t
                  ? "bg-gold text-black shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {t === "gold"
                ? "Gold Ledger"
                : t === "jobs"
                  ? `Active Jobs (${jobCards.length})`
                  : t === "qc"
                    ? "QC Rejected"
                    : t === "return"
                      ? "Work Return"
                      : t === "wages"
                        ? "Wages"
                        : "Attendance"}
            </button>
          ))}
        </div>

        {/* Tab: Gold Ledger */}
        {tab === "gold" && (
          <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground font-serif">
                Gold Ledger (Last 90 Days)
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                Fine Gold Records
              </span>
            </div>
            {data.goldEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                No entries found.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.goldEntries.map((e) => (
                  <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {e.narration || e.type}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {fmtDate(e.ts)}
                        {e.slipNo && ` · Slip: ${e.slipNo}`}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-mono font-bold shrink-0 ${
                        (e.netFineMg ?? 0) < 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {(e.netFineMg ?? 0) < 0 ? "−" : "+"}
                      {mg(Math.abs(e.netFineMg ?? 0))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Active Jobs */}
        {tab === "jobs" && (
          <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground font-serif">
                  Active Bench Jobs
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Jobs assigned to you by the firm.
                </p>
              </div>
              <span className="rounded-md bg-gold/10 border border-gold/30 px-2 py-0.5 text-xs font-semibold text-gold font-mono">
                {jobCards.length}
              </span>
            </div>
            {loadingJobs ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-md bg-muted/40" />
                ))}
              </div>
            ) : jobsError ? (
              <div className="p-8 text-center text-sm text-red-400">{jobsError}</div>
            ) : jobCards.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                No active jobs are assigned right now.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jobCards.map((job) => (
                  <div key={job.id} className="px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground font-mono">
                          {job.jobNo || job.id}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {job.itemName || "Manufacturing job"}
                          {job.customerName ? ` for ${job.customerName}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-muted border border-border px-2 py-0.5 text-xs font-semibold capitalize text-muted-foreground">
                        {job.status?.replace(/_/g, " ") || "active"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-md bg-muted/20 border border-border/50 p-2">
                        <div className="text-[10px] text-muted-foreground uppercase">Gross</div>
                        <div className="font-mono font-semibold text-foreground">
                          {job.grossMg != null ? mg(job.grossMg) : "-"}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/20 border border-border/50 p-2">
                        <div className="text-[10px] text-muted-foreground uppercase">Fine</div>
                        <div className="font-mono font-semibold text-foreground">
                          {job.fineMg != null ? mg(job.fineMg) : "-"}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/20 border border-border/50 p-2">
                        <div className="text-[10px] text-muted-foreground uppercase">Purity</div>
                        <div className="font-mono font-semibold text-foreground">
                          {job.purity != null ? job.purity : "-"}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/20 border border-border/50 p-2">
                        <div className="text-[10px] text-muted-foreground uppercase">Due</div>
                        <div className="font-semibold text-foreground">{fmtDate(job.dueDate)}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setTab("return");
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-4 py-2 text-xs font-semibold text-black shadow-xs hover:bg-gold-dark transition-colors sm:w-auto cursor-pointer"
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      Return work
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: QC Rejections */}
        {tab === "qc" && (
          <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground font-serif">
                  QC Rejected — Needs Rework
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Jobs returned by QC. Review rejection notes and start rework.
                </p>
              </div>
              <span className="rounded-md bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-xs font-semibold text-red-400 font-mono">
                {jobCards.filter((j) => j.status === "qc_rejected" && !reworkDone.has(j.id)).length}
              </span>
            </div>
            {loadingJobs ? (
              <div className="p-6 space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-md bg-red-500/10" />
                ))}
              </div>
            ) : jobCards.filter((j) => j.status === "qc_rejected").length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <div className="text-sm text-muted-foreground">
                  No QC rejections. All jobs are in good standing.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jobCards
                  .filter((j) => j.status === "qc_rejected")
                  .map((job) => (
                    <div key={job.id} className="px-4 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground font-mono">
                            {job.jobNo || job.id}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {job.itemName || "Manufacturing job"}
                            {job.customerName ? ` for ${job.customerName}` : ""}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 text-xs font-semibold">
                          QC Rejected
                        </span>
                      </div>
                      <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                        <div className="text-xs font-semibold text-red-400 mb-0.5 uppercase tracking-wide">
                          Rejection Reason
                        </div>
                        <div className="text-xs text-red-300">
                          Please contact your supervisor for rejection details and rework
                          instructions.
                        </div>
                      </div>
                      {reworkDone.has(job.id) ? (
                        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Rework acknowledged — supervisor
                          notified.
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={reworkBusy === job.id}
                          onClick={() => void handleAcknowledgeRework(job.id)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          {reworkBusy === job.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PackageCheck className="h-3.5 w-3.5" />
                          )}
                          Acknowledge &amp; Start Rework
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Work Return */}
        {tab === "return" && (
          <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground font-serif">
                Submit Completed Work &amp; Scrap
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send finished work, scrap, and filings to the firm for review.
              </p>
            </div>
            <form onSubmit={handleReturnSubmit} className="p-4 space-y-4">
              <div>
                <label
                  htmlFor="return-job"
                  className="block text-xs font-semibold text-muted-foreground uppercase mb-1"
                >
                  Job
                </label>
                <select
                  id="return-job"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  disabled={loadingJobs || jobCards.length === 0}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold disabled:bg-muted"
                >
                  {jobCards.length === 0 ? (
                    <option value="">No active jobs</option>
                  ) : (
                    jobCards.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.jobNo || job.id}
                        {job.itemName ? ` - ${job.itemName}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="finished-gross"
                    className="block text-xs font-semibold text-muted-foreground uppercase mb-1"
                  >
                    Finished gross (g)
                  </label>
                  <input
                    id="finished-gross"
                    value={finishedGrossWt}
                    onChange={(e) => setFinishedGrossWt(e.target.value)}
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="0.001"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="scrap-gross"
                    className="block text-xs font-semibold text-muted-foreground uppercase mb-1"
                  >
                    Scrap (g)
                  </label>
                  <input
                    id="scrap-gross"
                    value={scrapGrossWt}
                    onChange={(e) => setScrapGrossWt(e.target.value)}
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="0.001"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="filings-gross"
                    className="block text-xs font-semibold text-muted-foreground uppercase mb-1"
                  >
                    Filings (g)
                  </label>
                  <input
                    id="filings-gross"
                    value={filingsGrossWt}
                    onChange={(e) => setFilingsGrossWt(e.target.value)}
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="0.001"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="return-notes"
                  className="block text-xs font-semibold text-muted-foreground uppercase mb-1"
                >
                  Notes
                </label>
                <textarea
                  id="return-notes"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold placeholder:text-muted-foreground"
                />
              </div>
              {submitError && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {submitError}
                </div>
              )}
              {submitSuccess && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                  Work return submitted. The firm can review it in Supabase-backed records.
                </div>
              )}
              <button
                type="submit"
                disabled={submitBusy || jobCards.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-xs font-semibold text-black shadow-xs hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto transition-colors cursor-pointer"
              >
                {submitBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Submit return
              </button>
            </form>
          </section>
        )}

        {/* Tab: Wages */}
        {tab === "wages" && (
          <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground font-serif">
                Wages &amp; Payments (Last 90 Days)
              </h3>
            </div>
            {data.wages.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                No wage records found.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.wages.map((w) => (
                  <div key={w.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground capitalize">
                        {w.kind.replace(/_/g, " ")}
                      </div>
                      {w.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {w.notes}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground/70 font-mono">
                        {fmtDate(w.ts)}
                      </div>
                    </div>
                    <div className="text-sm font-mono font-bold text-gold shrink-0">
                      <Coins className="h-3.5 w-3.5 inline-block mr-1 text-gold" />
                      {rs(w.amount ?? 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Attendance */}
        {tab === "attendance" && (
          <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground font-serif">
                Attendance (Last 30 Days)
              </h3>
            </div>
            {data.attendance.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                No attendance records found.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.attendance.map((a, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-gold shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-foreground">{fmtDate(a.date)}</div>
                        {(a.inTime || a.outTime) && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {a.inTime || "—"} → {a.outTime || "—"}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                        a.status === "present"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : a.status === "absent"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : a.status === "half_day"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {a.status?.replace(/_/g, " ") ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground pb-4">
          Powered by <span className="font-semibold text-gold">AVS Gold ERP</span>
          {" - "}Work returns are submitted to your firm for review.
        </footer>
      </main>
    </div>
  );
}
