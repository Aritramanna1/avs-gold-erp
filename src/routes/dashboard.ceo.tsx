/**
 * CEO Dashboard — Management-only analytics view.
 * No operational work here. Per-branch KPI cards + consolidated company view.
 * Uses dynamic branches from settings-store (persisted in Supabase).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { getBranchKPIs } from "@/lib/services/ceo-dashboard-service";
import {
  fetchCeoGoldTrend,
  fetchCeoManufacturingGoldSummary,
  fetchCeoProductionPipeline,
  fetchCeoWorkerPerformance,
  type CeoGoldTrendPoint,
  type CeoManufacturingGoldSummary,
  type CeoProductionPipelinePoint,
  type CeoWorkerPerformanceRow,
} from "@/lib/services/ceo-dashboard-analytics";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { BarChart, Bar } from "recharts";
import type { Branch } from "@/lib/settings-store";
import {
  Building2,
  TrendingUp,
  Users,
  Package,
  Wrench,
  AlertCircle,
  IndianRupee,
  Layers,
  RefreshCw,
  Scale,
  BarChart3,
  CheckCircle,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/dashboard/ceo")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "CEO Dashboard · AVS Gold ERP" }] }),
  component: CeoDashboard,
});

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCr(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(1)} L`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * Gold-first executive trend — the ledger's own running vault balance over
 * the last 30 days, day by day. Deliberately the FIRST chart on this
 * dashboard: gold is the primary accounting unit, so it gets the primary
 * visual slot, ahead of any cash/revenue chart.
 */
function GoldTrendChart() {
  const [data, setData] = useState<CeoGoldTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCeoGoldTrend(30));
    } catch {
      setError("Could not load gold trend from Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
        <div className="h-4 w-72 max-w-full rounded bg-muted/30 animate-pulse mb-4" />
        <div className="h-[180px] rounded-xl bg-muted/20 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-700">
        {error}
        <button type="button" onClick={() => void load()} className="ml-3 underline">
          Retry
        </button>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Not enough gold ledger activity yet to chart a trend.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
      <div className="text-xs uppercase tracking-wider font-bold text-gold mb-3">
        Gold Under Management — 30 Day Trend (Fine Grams)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="goldTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d4af37" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="date" fontSize={10} tickLine={false} />
          <YAxis fontSize={10} tickLine={false} width={50} />
          <Tooltip formatter={(v: number) => [`${v} g`, "Gold"]} />
          <Area
            type="monotone"
            dataKey="grams"
            stroke="#d4af37"
            fill="url(#goldTrendFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Company-wide Gold Outstanding + Manufacturing Summary — reuses the exact
 * same computations reports.gold-outstanding.tsx and reports.gold-summary.tsx
 * expose (computeGoldOutstandingRows / computeManufacturingGoldTotals)
 * rather than re-deriving these figures, so this card can never disagree
 * with either report.
 */
function ManufacturingGoldSummaryCard() {
  const [summary, setSummary] = useState<CeoManufacturingGoldSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchCeoManufacturingGoldSummary());
    } catch {
      setError("Could not load manufacturing gold summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="h-3 w-28 rounded bg-muted/30 animate-pulse" />
            <div className="mt-3 h-6 w-24 rounded bg-muted/20 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
        {error ?? "No manufacturing gold summary available."}
        <button type="button" onClick={() => void load()} className="ml-3 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {summary.capped && (
        <div className="text-xs text-amber-700">
          Showing a bounded dashboard aggregate. Open reports for full register review.
        </div>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link
          to="/reports/gold-outstanding"
          className="rounded-2xl border border-border bg-card p-4 hover:border-gold/30 transition-colors"
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Gold Outstanding
          </div>
          <div className="text-xl font-mono font-bold mt-1">
            {mgToGrams(summary.totalOutstandingMg)} g
          </div>
        </Link>
        <Link
          to="/reports/gold-summary"
          className="rounded-2xl border border-border bg-card p-4 hover:border-gold/30 transition-colors"
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Gold Issued (Mfg)
          </div>
          <div className="text-xl font-mono font-bold mt-1">{mgToGrams(summary.issuedMg)} g</div>
        </Link>
        <Link
          to="/reports/gold-summary"
          className="rounded-2xl border border-border bg-card p-4 hover:border-gold/30 transition-colors"
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Gold Returned (Mfg)
          </div>
          <div className="text-xl font-mono font-bold mt-1">{mgToGrams(summary.returnedMg)} g</div>
        </Link>
        <Link
          to="/reports/gold-summary"
          className="rounded-2xl border border-border bg-card p-4 hover:border-gold/30 transition-colors"
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Wastage (Mfg)
          </div>
          <div className="text-xl font-mono font-bold mt-1">{mgToGrams(summary.wastageMg)} g</div>
        </Link>
      </div>
    </div>
  );
}

/**
 * Production Status — every Job Card grouped by its own `status` field
 * (the same JobStatus union jobcards-store.ts already tracks), so this is a
 * grouping of existing data, not a new pipeline-stage model.
 */
function ProductionPipelineChart() {
  const [data, setData] = useState<CeoProductionPipelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCeoProductionPipeline());
    } catch {
      setError("Could not load production status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-3">
        Production Status — Job Cards by Stage
      </div>
      {loading ? (
        <div className="h-[200px] rounded-xl bg-muted/20 animate-pulse" />
      ) : error ? (
        <div className="py-8 text-center text-sm text-amber-700">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 underline">
            Retry
          </button>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="status"
              fontSize={9}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis fontSize={10} tickLine={false} allowDecimals={false} width={30} />
            <Tooltip />
            <Bar dataKey="count" fill="#d4af37" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/**
 * Worker Performance — per-karigar active/ready job-card counts plus their
 * pending gold from the Worker Gold Book, both reusing existing per-job and
 * per-worker data already computed elsewhere (jobcards-store.ts,
 * worker-gold-book-store.ts's getWorkerBalance()) rather than a new metric.
 */
function WorkerPerformanceTable() {
  const [rows, setRows] = useState<CeoWorkerPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCeoWorkerPerformance());
    } catch {
      setError("Could not load worker performance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-3">
        Worker Performance — Top Active Karigars
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-amber-700 text-center py-6">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 underline">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          No karigar-assigned job cards yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground text-left">
                <th className="pb-2">Karigar</th>
                <th className="pb-2 text-right">Active Jobs</th>
                <th className="pb-2 text-right">Ready for Billing</th>
                <th className="pb-2 text-right">Pending Gold</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.karigarId} className="border-t border-border">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right font-mono">{r.active}</td>
                  <td className="py-2 text-right font-mono">{r.readyForBilling}</td>
                  <td className="py-2 text-right font-mono">{mgToGrams(r.pendingGoldMg)}g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BranchKPIs {
  salesThisMonthPaise: number;
  invoiceCount: number;
  outstandingPaise: number;
  pendingOrders: number;
  activeJobCards: number;
  readyJobCards: number;
  pendingRepairs: number;
  totalCustomers: number;
}

// ── Fetch per-branch KPIs from Supabase ───────────────────────────────────────

async function fetchBranchKPIs(branchId: string): Promise<BranchKPIs> {
  return getBranchKPIs(branchId);
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  icon: Icon,
  label,
  value,
  colorClass,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  colorClass: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card/60 p-3 space-y-1 ${alert ? "border-red-500/40" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
          {label}
        </span>
      </div>
      <div className={`font-bold text-lg font-mono ${colorClass}`}>{value}</div>
    </div>
  );
}

// ── Branch Panel ──────────────────────────────────────────────────────────────

const BRANCH_PALETTE: Record<string, { bg: string; border: string; text: string; accent: string }> =
  {
    retail: {
      bg: "bg-blue-500/8",
      border: "border-blue-500/25",
      text: "text-blue-400",
      accent: "bg-blue-500/15",
    },
    mfg: {
      bg: "bg-amber-500/8",
      border: "border-amber-500/25",
      text: "text-amber-400",
      accent: "bg-amber-500/15",
    },
    default: { bg: "bg-gold/5", border: "border-gold/20", text: "text-gold", accent: "bg-gold/10" },
  };

function branchPalette(branch: Branch) {
  const id = branch.id.toLowerCase();
  if (id.includes("retail")) return BRANCH_PALETTE.retail;
  if (id.includes("mfg") || id.includes("manufacturing")) return BRANCH_PALETTE.mfg;
  return BRANCH_PALETTE.default;
}

function BranchPanel({ branch }: { branch: Branch }) {
  const [kpis, setKpis] = useState<BranchKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = branchPalette(branch);
  const isRetail = branch.id.toLowerCase().includes("retail");
  const isMfg = branch.id.toLowerCase().includes("mfg") || branch.id.toLowerCase().includes("mfg");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBranchKPIs(branch.id);
      setKpis(data);
    } catch {
      setError("Could not load branch data");
    } finally {
      setLoading(false);
    }
  }, [branch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-xl ${colors.accent} flex items-center justify-center shrink-0`}
          >
            <Building2 className={`h-5 w-5 ${colors.text}`} />
          </div>
          <div>
            <div className="font-bold text-sm">{branch.name}</div>
            <div className="text-xs text-muted-foreground">
              {branch.code} · {isRetail ? "Retail" : isMfg ? "Manufacturing" : "Branch"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${colors.text} border-current`}>
            {branch.active ? "Active" : "Inactive"}
          </Badge>
          <button
            type="button"
            onClick={() => void load()}
            className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/30 transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : "text-muted-foreground"}`}
            />
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-muted/20 border border-border h-14 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPIs */}
      {kpis && !loading && isRetail && (
        <div className="grid grid-cols-2 gap-3">
          <KpiTile
            icon={IndianRupee}
            label="Sales This Month"
            value={fmtCr(kpis.salesThisMonthPaise)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={TrendingUp}
            label="Invoices (Month)"
            value={String(kpis.invoiceCount)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={Users}
            label="Total Customers"
            value={String(kpis.totalCustomers)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={Layers}
            label="Pending Orders"
            value={String(kpis.pendingOrders)}
            colorClass={kpis.pendingOrders > 10 ? "text-amber-400" : colors.text}
          />
          <KpiTile
            icon={IndianRupee}
            label="Outstanding"
            value={fmtCr(kpis.outstandingPaise)}
            colorClass={kpis.outstandingPaise > 0 ? "text-red-400" : colors.text}
            alert={kpis.outstandingPaise > 50_000_00}
          />
          <KpiTile
            icon={Wrench}
            label="Open Repairs"
            value={String(kpis.pendingRepairs)}
            colorClass={colors.text}
          />
        </div>
      )}

      {kpis && !loading && isMfg && (
        <div className="grid grid-cols-2 gap-3">
          <KpiTile
            icon={Wrench}
            label="Active Job Cards"
            value={String(kpis.activeJobCards)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={CheckCircle}
            label="Ready for Delivery"
            value={String(kpis.readyJobCards)}
            colorClass={kpis.readyJobCards > 0 ? "text-emerald-400" : colors.text}
          />
          <KpiTile
            icon={Package}
            label="Pending Orders"
            value={String(kpis.pendingOrders)}
            colorClass={kpis.pendingOrders > 10 ? "text-amber-400" : colors.text}
          />
          <KpiTile
            icon={IndianRupee}
            label="Sales This Month"
            value={fmtCr(kpis.salesThisMonthPaise)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={IndianRupee}
            label="Outstanding"
            value={fmtCr(kpis.outstandingPaise)}
            colorClass={kpis.outstandingPaise > 0 ? "text-red-400" : colors.text}
            alert={kpis.outstandingPaise > 50_000_00}
          />
          <KpiTile
            icon={Users}
            label="Total Customers"
            value={String(kpis.totalCustomers)}
            colorClass={colors.text}
          />
        </div>
      )}

      {kpis && !loading && !isRetail && !isMfg && (
        <div className="grid grid-cols-2 gap-3">
          <KpiTile
            icon={IndianRupee}
            label="Sales This Month"
            value={fmtCr(kpis.salesThisMonthPaise)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={Layers}
            label="Pending Orders"
            value={String(kpis.pendingOrders)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={Users}
            label="Customers"
            value={String(kpis.totalCustomers)}
            colorClass={colors.text}
          />
          <KpiTile
            icon={IndianRupee}
            label="Outstanding"
            value={fmtCr(kpis.outstandingPaise)}
            colorClass={colors.text}
          />
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function CeoDashboard() {
  const branches = useSettings((s) => s.branches);
  const activeBranches = branches.filter((b) => b.active);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl text-gold leading-tight">CEO Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Company-wide analytics · Read-only management view · {activeBranches.length} active
            branch{activeBranches.length !== 1 ? "es" : ""}
          </p>
        </div>
        <Badge className="bg-gold/15 text-gold border-gold/30 text-xs gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {activeBranches.length} of {branches.length} Active
        </Badge>
      </div>

      {/* Gold Dashboard — gold is the primary accounting unit, so its trend
          gets the first visual slot on this page, ahead of any cash KPI. */}
      <GoldTrendChart />

      {/* Manufacturing Summary — Gold Outstanding, Issued, Returned, Wastage,
          company-wide, reusing the same computations the dedicated reports
          use (see ManufacturingGoldSummaryCard's doc comment). */}
      <ManufacturingGoldSummaryCard />

      <div className="grid md:grid-cols-2 gap-6">
        <ProductionPipelineChart />
        <WorkerPerformanceTable />
      </div>

      {/* Per-Branch KPI Cards */}
      {activeBranches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">No active branches configured.</p>
          <Link to="/branches" className="text-gold text-sm underline">
            Set up branches →
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {activeBranches.map((b) => (
            <BranchPanel key={b.id} branch={b} />
          ))}
        </div>
      )}

      {/* Internal Staff & User Governance */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg text-gold">Internal Staff &amp; User Governance</h2>
              <p className="text-xs text-muted-foreground">
                Manage internal ERP operators, roles, branch access scopes, and pending invitations
              </p>
            </div>
          </div>
          <Link
            to="/invite"
            className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-dark transition-colors shadow-sm"
          >
            <Users className="h-3.5 w-3.5" />+ Invite Internal Staff
          </Link>
        </div>

        <div className="divide-y divide-border text-xs">
          <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-0.5">
              <div className="font-semibold flex items-center gap-2">
                Aritra Manna
                <Badge variant="outline" className="text-[10px] text-gold border-gold/30">
                  Super Owner
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                All Branches · Owner Executive Access · Active Now
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
              Active
            </Badge>
          </div>

          <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-0.5">
              <div className="font-semibold flex items-center gap-2">
                Workshop Lead Supervisor
                <Badge variant="outline" className="text-[10px]">
                  Workshop
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Main Workshop HQ · Bench Custody &amp; QC
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
              Active
            </Badge>
          </div>

          <div className="py-2.5 flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-0.5">
              <div className="font-semibold flex items-center gap-2">
                Counter Billing Operator
                <Badge variant="outline" className="text-[10px]">
                  Billing
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Retail Showroom Branch · Invoices &amp; Receipts
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
              Active
            </Badge>
          </div>
        </div>
      </div>

      {/* Management Links */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-4 w-4 text-gold" />
          <h2 className="font-serif text-lg text-gold">Management</h2>
          <span className="text-xs text-muted-foreground ml-1">
            Reports and analytics the CEO operates
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Reports", to: "/reports", icon: BarChart3 },
            { label: "Gold Ledger", to: "/ledger", icon: Scale },
            { label: "People / KYC", to: "/people", icon: Users },
            { label: "Branch Setup", to: "/branches", icon: Building2 },
            { label: "Manufacturing", to: "/manufacturing", icon: Wrench },
            { label: "Manufacturing Books", to: "/workshop", icon: Package },
            { label: "Backup & Recovery", to: "/settings/backup-recovery", icon: ShieldCheck },
            { label: "Settings", to: "/settings", icon: ArrowUpRight },
            { label: "Daily Close", to: "/reports/daily-close", icon: CheckCircle },
            { label: "Exception Report", to: "/reports/exceptions", icon: AlertTriangle },
            { label: "Inventory Ageing", to: "/reports/inventory-ageing", icon: Clock },
            { label: "Month-End Close", to: "/reports/month-end-close", icon: Lock },
            { label: "Pending Approvals", to: "/reports/approvals", icon: CheckCircle },
            { label: "Audit Log", to: "/reports/audit-log", icon: AlertCircle },
            { label: "Gold Reconciliation", to: "/reports/gold-reconciliation", icon: Scale },
            {
              label: "Communication Analytics",
              to: "/reports/communication-analytics",
              icon: Users,
            },
            { label: "Manufacturing Gold Summary", to: "/reports/gold-summary", icon: Scale },
            { label: "Gold Outstanding", to: "/reports/gold-outstanding", icon: Scale },
            { label: "Daily Gold Flow", to: "/reports/daily-gold-flow", icon: Scale },
            { label: "Gold Position (D/W/M/Y)", to: "/reports/gold-position", icon: Scale },
            { label: "Worker Report", to: "/reports/worker", icon: Users },
            { label: "Settlement Report", to: "/reports/settlements", icon: CheckCircle },
            { label: "Outside Work Report", to: "/reports/outside-work", icon: Package },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-4 py-3 hover:border-gold/40 hover:bg-gold/5 transition-colors text-sm font-medium"
            >
              <item.icon className="h-4 w-4 text-gold shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">CEO View — Analytics Only</p>
        <p>
          This dashboard queries each branch independently from Supabase with branch-level RLS.
          Per-branch data refreshes on page load. Click the refresh icon on any card to pull latest
          data. Branches are loaded from the database — add or remove branches in the{" "}
          <Link to="/branches" className="text-gold underline">
            Branch Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
