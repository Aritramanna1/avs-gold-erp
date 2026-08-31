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
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
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
  PackageCheck,
  Send,
  CheckCircle2,
  Star,
  Receipt,
  ChevronRight,
} from "lucide-react";
import { formatDateMedium as fmtDate } from "@/lib/format-date";
import { signOutAndLeave } from "@/lib/native/sign-out";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalMobileBottomNav } from "@/components/portal/PortalMobileBottomNav";
import { PortalKycPanel } from "@/components/portal/PortalKycPanel";
import {
  KarigarSettlementDetailSheet,
  type KarigarSettlementDetail,
} from "@/components/portal/KarigarSettlementDetailSheet";
import { reportUserFacingError } from "@/lib/error-handling";
import { portalLoginSearch } from "@/lib/identity/portal-auth-routing";
import { usePortalScope } from "@/lib/portal/portal-scope-store";
import { useTenantContext } from "@/lib/identity/tenant-context-store";

export const Route = createFileRoute("/karigar-portal")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({
    meta: [{ title: "Karigar Portal · AVS ERP" }],
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

function karigarDisplayName(profile: { name?: string; fullName?: string }): string {
  return profile.fullName || profile.name || "Karigar";
}

function goldBalanceView(
  balance: GoldBalance,
  entries: GoldEntry[],
  goldBook: GoldBookEntry[] = [],
  performance?: PerformanceSummary | null,
) {
  const bookIssued =
    numericValue(performance?.issuedFineMg90d) ??
    goldBook
      .filter((e) => e.type === "given" || e.kind === "gold_book_given")
      .reduce((sum, e) => sum + Math.abs(numericValue(e.fineMg) ?? 0), 0);
  const bookReturned =
    numericValue(performance?.returnedFineMg90d) ??
    goldBook
      .filter((e) => e.type === "return" || e.kind === "gold_book_return")
      .reduce((sum, e) => sum + Math.abs(numericValue(e.fineMg) ?? 0), 0);

  const ledgerIssued =
    numericValue(balance.issuedMg) ??
    entries
      .filter((e) => /issue|given/i.test(e.type))
      .reduce((sum, e) => sum + Math.abs(e.netFineMg || 0), 0);
  const ledgerReceived =
    numericValue(balance.receivedMg) ??
    entries
      .filter((e) => /receiv|return/i.test(e.type))
      .reduce((sum, e) => sum + Math.abs(e.netFineMg || 0), 0);

  const useBook = bookIssued > 0 || bookReturned > 0;
  const issued = useBook ? bookIssued : ledgerIssued;
  const received = useBook ? bookReturned : ledgerReceived;
  const net =
    useBook && numericValue(balance.balanceMg) != null
      ? (numericValue(balance.balanceMg) as number)
      : useBook
        ? bookIssued - bookReturned
        : (numericValue(balance.netFineMg) ?? numericValue(balance.balanceMg) ?? 0);

  return {
    net,
    issued,
    received,
    count: numericValue(balance.entryCount) ?? entries.length,
    fromGoldBook: useBook,
  };
}

const PERFORMANCE_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  needs_improvement: "Needs improvement",
};

function fmtStayMs(ms: unknown): string {
  const n = numericValue(ms);
  if (n == null || n <= 0) return "—";
  return new Date(n).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function paiseDisplay(paise: unknown): string {
  const n = numericValue(paise);
  if (n == null) return "—";
  return rs(n / 100);
}

function qcNotesFromJob(raw: Record<string, unknown>): string {
  if (typeof raw.qcNotes === "string" && raw.qcNotes.trim()) return raw.qcNotes;
  if (typeof raw.notes === "string" && raw.notes.trim()) return raw.notes;
  const timeline = Array.isArray(raw.timeline) ? raw.timeline : [];
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const event = timeline[i] as { note?: string };
    if (typeof event?.note === "string" && event.note.trim()) return event.note;
  }
  return "";
}

const KARIGAR_NAV_TO_TAB: Record<
  string,
  "gold" | "wages" | "attendance" | "jobs" | "return" | "qc" | "kyc" | "performance"
> = {
  jobs: "jobs",
  gold: "gold",
  hisab: "wages",
  wages: "wages",
  work: "return",
  return: "return",
  messages: "qc",
  qc: "qc",
  kyc: "kyc",
  attendance: "attendance",
  performance: "performance",
};

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
  issuedMg?: number;
  receivedMg?: number;
  balanceMg?: number;
  netFineMg?: number;
  entryCount?: number;
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

interface GoldBookEntry {
  id: string;
  ts: string;
  kind?: string;
  type: string;
  date?: string;
  entryNo?: string;
  particulars?: string;
  grossMg?: number;
  netMg?: number;
  fineMg?: number;
  purity?: number;
  notes?: string;
}

interface StayEntry {
  id: string;
  arrivedAt?: number | string;
  departedAt?: number | string | null;
  notes?: string;
}

interface SettlementEntry extends KarigarSettlementDetail {}

interface PerformanceSummary {
  latestRating?: string | null;
  latestNote?: string | null;
  latestPeriod?: string | null;
  latestSettlementId?: string | null;
  gramsWorkedMg?: number;
  daysWorked?: number;
  wageNetMg?: number;
  wageCashPaise?: number;
  wagePayOutMode?: string | null;
  finalCashPayablePaise?: number;
  issuedFineMg90d?: number;
  returnedFineMg90d?: number;
  hasSettlement?: boolean;
}

interface WageEntry {
  id: string;
  kind?: string;
  type?: string;
  ts: string;
  amount?: number;
  amountPaise?: number | string;
  notes: string;
}

interface AttendanceEntry {
  date: string;
  status: string;
  inTime: string;
  outTime: string;
  hours?: string;
}

interface KarigarData {
  found: boolean;
  message?: string;
  profile: { id: string; name?: string; fullName?: string; firmId: string };
  goldBalance: GoldBalance;
  goldEntries: GoldEntry[];
  goldBook?: GoldBookEntry[];
  wages: WageEntry[];
  attendance: AttendanceEntry[];
  stays?: StayEntry[];
  settlements?: SettlementEntry[];
  performance?: PerformanceSummary | null;
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
  qcNotes?: string;
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
  const searchTab = useRouterState({
    select: (s) => (s.location.search as { tab?: string; settlement?: string } | undefined),
  });
  const [data, setData] = useState<KarigarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<
    "gold" | "wages" | "attendance" | "jobs" | "return" | "qc" | "kyc" | "performance"
  >((searchTab?.tab && KARIGAR_NAV_TO_TAB[searchTab.tab]) || "jobs");
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);

  useEffect(() => {
    if (searchTab?.tab && KARIGAR_NAV_TO_TAB[searchTab.tab]) {
      setTab(KARIGAR_NAV_TO_TAB[searchTab.tab]);
    }
  }, [searchTab?.tab]);

  useEffect(() => {
    if (searchTab?.settlement) {
      setSelectedSettlementId(searchTab.settlement);
      setTab("performance");
    }
  }, [searchTab?.settlement]);

  function goTab(next: typeof tab, settlementId?: string | null) {
    setTab(next);
    void navigate({
      to: "/karigar-portal",
      search: {
        tab: next,
        ...(settlementId ? { settlement: settlementId } : {}),
      } as never,
      replace: true,
    });
  }

  function openSettlementDetail(settlementId: string) {
    setSelectedSettlementId(settlementId);
    void navigate({
      to: "/karigar-portal",
      search: { tab: "performance", settlement: settlementId } as never,
      replace: true,
    });
  }

  function closeSettlementDetail() {
    setSelectedSettlementId(null);
    void navigate({
      to: "/karigar-portal",
      search: { tab: "performance" } as never,
      replace: true,
    });
  }
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
  const loadMemberships = useTenantContext((s) => s.loadMemberships);
  const activeOrganizationId = useTenantContext((s) => s.activeOrganizationId);
  const portalScopeVersion = usePortalScope((s) => s.version);
  // QC rework state
  const [reworkBusy, setReworkBusy] = useState<string | null>(null);
  const [reworkDone, setReworkDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadMemberships({ portalType: "karigar" });
  }, [loadMemberships]);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    setNotice(null);
    setLoadingJobs(true);
    setJobCards([]);
    void (async () => {
      // Check session first
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData.session) {
        void navigate({ to: "/login", search: portalLoginSearch("karigar") });
        return;
      }

      // Fetch karigar data via RPC
      const portalCtx = await fetchMyPortalContext("karigar");
      if (!active) return;
      if (!portalCtx) {
        setError("Your karigar portal identity is not linked. Please contact your firm.");
        return;
      }

      const partyId = portalCtx.party_links[0]?.party_id ?? portalCtx.identity_id ?? "unknown";

      const applyPortalPayload = (payload: KarigarData) => {
        setData({
          ...payload,
          goldEntries: payload.goldEntries ?? [],
          goldBook: payload.goldBook ?? [],
          wages: payload.wages ?? [],
          attendance: payload.attendance ?? [],
          stays: payload.stays ?? [],
          settlements: payload.settlements ?? [],
          performance: payload.performance ?? null,
        });
      };

      const { data: result, error: rpcError } = await (supabase as any).rpc("get_karigar_portal");
      if (!active) return;
      if (rpcError) {
        const { loadPortalCache, portalOfflineHint } = await import(
          "@/lib/portal/portal-offline-cache"
        );
        const cached = loadPortalCache<{ portal: KarigarData; jobCards: PortalJobCard[] }>(
          "karigar",
          portalCtx.firm_id,
          partyId,
        );
        if (cached?.payload?.portal) {
          applyPortalPayload(cached.payload.portal);
          setJobCards(cached.payload.jobCards ?? []);
          setLoadingJobs(false);
          setError(null);
          setNotice(portalOfflineHint());
        } else {
          setError("Could not load your portal data. Please contact your firm.");
        }
      } else {
        const payload = result as KarigarData;
        applyPortalPayload(payload);
        setNotice(null);

        // Fetch only this karigar's active job cards through Supabase/RLS.
        const { data: jobsResult, error: jobsErr } = await supabase
          .from("job_cards")
          .select("id,job_no,status,created_at,order_id,data")
          .eq("karigar_id", payload.profile.id)
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
              qcNotes: qcNotesFromJob(rawData),
            } satisfies PortalJobCard;
          });
          setJobCards(parsed);
          if (parsed.length > 0) {
            setSelectedJobId(parsed[0].id);
          }
          const { savePortalCache } = await import("@/lib/portal/portal-offline-cache");
          savePortalCache("karigar", portalCtx.firm_id, partyId, {
            portal: {
              ...payload,
              goldEntries: payload.goldEntries ?? [],
              goldBook: payload.goldBook ?? [],
              wages: payload.wages ?? [],
              attendance: payload.attendance ?? [],
              stays: payload.stays ?? [],
              settlements: payload.settlements ?? [],
              performance: payload.performance ?? null,
            },
            jobCards: parsed,
          });
        }
        setLoadingJobs(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate, activeOrganizationId, portalScopeVersion]);

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
          workerName: karigarDisplayName(data.profile),
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
    } catch (ex: unknown) {
      const normalized = reportUserFacingError(ex, "Karigar work return");
      setSubmitError(normalized.message);
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
    } catch (ex: unknown) {
      reportUserFacingError(ex, "Karigar QC rework");
    } finally {
      setReworkBusy(null);
    }
  }

  function handleSignOut() {
    void signOutAndLeave();
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

  const gold = goldBalanceView(
    data.goldBalance,
    data.goldEntries ?? [],
    data.goldBook ?? [],
    data.performance,
  );
  const goldBook = data.goldBook ?? [];
  const stays = data.stays ?? [];
  const settlements = data.settlements ?? [];
  const performance = data.performance;
  const selectedSettlement =
    settlements.find((s) => s.id === selectedSettlementId) ??
    (performance?.latestSettlementId
      ? settlements.find((s) => s.id === performance.latestSettlementId)
      : null) ??
    null;

  return (
    <>
    <PortalShell
      title="Karigar Workbench"
      subtitle={karigarDisplayName(data.profile)}
      contentClassName="max-w-3xl"
      onSignOut={handleSignOut}
      footer={<PortalMobileBottomNav portalPath="/karigar-portal" kind="karigar" />}
    >
        {notice ? (
          <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2" role="status">
            {notice}
          </p>
        ) : null}
        {/* Gold balance summary */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Gold Balance Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={TrendingDown}
              label="Gold Issued to You"
              value={mg(gold.issued)}
              accent="rose"
            />
            <StatCard
              icon={TrendingUp}
              label="Gold Returned"
              value={mg(gold.received)}
              accent="emerald"
            />
            <StatCard
              icon={Scale}
              label="Net fine with you"
              value={mg(gold.net)}
              sub={
                gold.fromGoldBook
                  ? "from your gold issue / return receipts"
                  : "approx — settlement at delivery"
              }
              accent="gold"
            />
          </div>
        </section>

        {/* Tab strip — tablet/desktop; phone uses bottom nav */}
        <div className="hidden md:flex flex-wrap gap-1 bg-card rounded-md border border-border p-1 shadow-xs">
          {(
            ["gold", "jobs", "qc", "return", "performance", "wages", "attendance", "kyc"] as const
          ).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => goTab(t)}
              className={`flex-1 min-w-[5.5rem] min-h-[var(--touch-target)] rounded-md py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                tab === t
                  ? "bg-gold text-black shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {t === "gold"
                ? "Gold"
                : t === "jobs"
                  ? `Jobs (${jobCards.length})`
                  : t === "qc"
                    ? "QC"
                    : t === "return"
                      ? "Return"
                      : t === "performance"
                        ? "Settlement"
                        : t === "wages"
                          ? "Wages"
                          : t === "kyc"
                            ? "KYC"
                            : "Attendance"}
            </button>
          ))}
        </div>

        {/* Tab: Gold receipts */}
        {tab === "gold" && (
          <div className="space-y-4">
            <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground font-serif">
                    Your gold receipts
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Metal the shop issued to you and what you returned — last 90 days.
                  </p>
                </div>
                <Receipt className="h-4 w-4 text-gold shrink-0" />
              </div>
              {goldBook.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground italic">
                  No gold issue or return receipts yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {goldBook.map((e) => {
                    const isIssue = e.type === "given" || e.kind === "gold_book_given";
                    const fine = Math.abs(numericValue(e.fineMg) ?? numericValue(e.netMg) ?? 0);
                    return (
                      <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {isIssue ? "Issued to you" : "Returned by you"}
                            {e.particulars ? ` · ${e.particulars}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {e.date ? fmtDate(e.date) : fmtDate(e.ts)}
                            {e.entryNo ? ` · ${e.entryNo}` : ""}
                            {e.purity ? ` · ${e.purity}‰` : ""}
                          </div>
                          {e.notes && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {e.notes}
                            </div>
                          )}
                        </div>
                        <div
                          className={`text-sm font-mono font-bold shrink-0 ${
                            isIssue ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {isIssue ? "+" : "−"}
                          {mg(fine)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground font-serif">
                  Vault ledger trail
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Accounting ledger lines linked to you (reference).
                </p>
              </div>
              {(data.goldEntries ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground italic">
                  No ledger entries in the last 90 days.
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
          </div>
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
                        goTab("return");
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
                          {job.qcNotes?.trim()
                            ? job.qcNotes
                            : "No QC note was recorded on this job card."}
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

        {tab === "kyc" && data?.profile?.id && (
          <PortalKycPanel
            partyId={data.profile.id}
            displayName={karigarDisplayName(data.profile)}
            portalType="karigar"
            scopeVersion={portalScopeVersion}
          />
        )}

        {/* Tab: Performance */}
        {tab === "performance" && (
          <div className="space-y-4">
            <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground font-serif">
                    Final settlement summary
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tap a salary sheet below for the full breakdown.
                  </p>
                </div>
                <Star className="h-4 w-4 text-gold shrink-0" />
              </div>
              {!performance?.hasSettlement ? (
                <div className="p-8 text-center text-sm text-muted-foreground italic">
                  No salary sheet yet — ask the shop after settlement.
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <StatCard
                      icon={Star}
                      label="Rating"
                      value={
                        PERFORMANCE_LABELS[performance.latestRating ?? ""] ||
                        performance.latestRating ||
                        "—"
                      }
                      sub={performance.latestNote || performance.latestPeriod || undefined}
                      accent="gold"
                    />
                    <StatCard
                      icon={CalendarDays}
                      label="Days worked"
                      value={String(numericValue(performance.daysWorked) ?? "—")}
                      sub={performance.latestPeriod || undefined}
                    />
                    <StatCard
                      icon={Scale}
                      label="Gold worked"
                      value={mg(numericValue(performance.gramsWorkedMg) ?? 0)}
                      sub="in last settlement period"
                      accent="rose"
                    />
                    <StatCard
                      icon={Coins}
                      label={
                        performance.wagePayOutMode === "cash"
                          ? "Wage as cash"
                          : "Wage gold owed"
                      }
                      value={
                        performance.wagePayOutMode === "cash"
                          ? paiseDisplay(performance.wageCashPaise)
                          : mg(numericValue(performance.wageNetMg) ?? 0)
                      }
                      sub={`Final cash: ${paiseDisplay(performance.finalCashPayablePaise)}`}
                      accent="emerald"
                    />
                  </div>
                  {performance.latestSettlementId ? (
                    <button
                      type="button"
                      onClick={() => openSettlementDetail(performance.latestSettlementId as string)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-xs font-semibold text-black shadow-xs hover:bg-gold-dark transition-colors cursor-pointer"
                    >
                      View final settlement
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              )}
            </section>

            <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground font-serif">
                  Past salary sheets
                </h3>
              </div>
              {settlements.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground italic">
                  Settlements will appear here after the shop confirms your salary sheet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {settlements.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openSettlementDetail(s.id)}
                      className="w-full px-4 py-3 space-y-1 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground font-mono">
                            {s.fromDate || "—"} → {s.toDate || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {PERFORMANCE_LABELS[s.performanceRating ?? ""] ||
                              s.performanceRating ||
                              "No rating"}
                            {s.performanceNote ? ` — ${s.performanceNote}` : ""}
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-xs font-mono flex items-start gap-1">
                          <div>
                            <div className="text-gold font-semibold">
                              {mg(numericValue(s.gramsWorkedMg) ?? 0)} worked
                            </div>
                            <div className="text-muted-foreground">
                              Wage {mg(numericValue(s.wageNetMg) ?? 0)}
                            </div>
                            <div className="text-foreground font-semibold">
                              {paiseDisplay(s.finalCashPayablePaise)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Days: {numericValue(s.daysWorked) ?? numericValue(s.payableDays) ?? "—"}
                        {s.wagePctApplied != null
                          ? ` · Wage ${numericValue(s.wagePctApplied)}%`
                          : ""}
                        {s.overlossDeductedMg
                          ? ` · Overloss ${mg(numericValue(s.overlossDeductedMg) ?? 0)}`
                          : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Tab: Wages */}
        {tab === "wages" && (
          <div className="space-y-4">
            {performance?.hasSettlement && (
              <button
                type="button"
                onClick={() => goTab("performance")}
                className="w-full text-left rounded-md border border-gold/30 bg-gold/5 px-4 py-3 cursor-pointer hover:bg-gold/10 transition-colors"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-gold mb-1">
                  Latest rating
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {PERFORMANCE_LABELS[performance.latestRating ?? ""] ||
                    performance.latestRating ||
                    "—"}
                  {performance.latestPeriod ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {performance.latestPeriod}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Open Settlement for full work summary →
                </div>
              </button>
            )}
            <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground font-serif">
                Wages &amp; Payments
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
                        {(w.kind || w.type || "wage").replace(/_/g, " ")}
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
                      {rs(
                        numericValue(w.amountPaise) != null
                          ? (numericValue(w.amountPaise) as number) / 100
                          : (w.amount ?? 0),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </section>
          </div>
        )}

        {/* Tab: Attendance */}
        {tab === "attendance" && (
          <div className="space-y-4">
            <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground font-serif">
                  Stay periods (incoming → outgoing)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Days on-site used for your salary sheet.
                </p>
              </div>
              {stays.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground italic">
                  No stay periods recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stays.map((s) => {
                    const open = s.departedAt == null || s.departedAt === "";
                    return (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground font-mono">
                            {fmtStayMs(s.arrivedAt)} → {open ? "Present" : fmtStayMs(s.departedAt)}
                          </div>
                          {s.notes && (
                            <div className="text-xs text-muted-foreground mt-0.5">{s.notes}</div>
                          )}
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                            open
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {open ? "On site" : "Gone home"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground font-serif">
                Daily attendance
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
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground pb-4">
          Powered by <span className="font-semibold text-gold">AVS ERP</span>
          {" - "}Work returns are submitted to your firm for review.
        </footer>
    </PortalShell>
      <KarigarSettlementDetailSheet
        settlement={selectedSettlement}
        open={Boolean(selectedSettlementId && selectedSettlement)}
        onOpenChange={(open) => {
          if (!open) closeSettlementDetail();
        }}
      />
    </>
  );
}
