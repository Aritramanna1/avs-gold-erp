/**
 * CEO Dashboard — Management-only analytics view.
 * No operational work here. Per-branch KPI cards + consolidated company view.
 * Uses dynamic branches from settings-store (persisted in Supabase).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/settings-store";
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
} from "lucide-react";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/dashboard/ceo")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "CEO Dashboard · MTJ ERP" }] }),
  component: CeoDashboard,
});

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCr(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(1)} L`;
  return `₹${rupees.toLocaleString("en-IN")}`;
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
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [invoiceRes, outstandRes, orderRes, jobRes, repairRes, customerRes] =
    await Promise.allSettled([
      supabase
        .from("invoices")
        .select("id, grand_total_paise")
        .eq("branch_id", branchId)
        .gte("created_at", monthStart),

      supabase
        .from("invoices")
        .select("id, balance_paise")
        .eq("branch_id", branchId)
        .gt("balance_paise", 0),

      supabase
        .from("orders")
        .select("id, status")
        .eq("branch_id", branchId)
        .in("status", ["pending", "in_progress", "ready"]),

      supabase
        .from("job_cards")
        .select("id, status")
        .eq("branch_id", branchId)
        .in("status", ["open", "in_progress", "ready"]),

      supabase
        .from("repairs")
        .select("id, status")
        .eq("branch_id", branchId)
        .not("status", "in", '("delivered","cancelled")'),

      supabase.from("people").select("id").eq("branch_id", branchId).eq("type", "customer"),
    ]);

  const invoices = invoiceRes.status === "fulfilled" ? (invoiceRes.value.data ?? []) : [];
  const outstanding = outstandRes.status === "fulfilled" ? (outstandRes.value.data ?? []) : [];
  const orders = orderRes.status === "fulfilled" ? (orderRes.value.data ?? []) : [];
  const jobs = jobRes.status === "fulfilled" ? (jobRes.value.data ?? []) : [];
  const repairs = repairRes.status === "fulfilled" ? (repairRes.value.data ?? []) : [];
  const customers = customerRes.status === "fulfilled" ? (customerRes.value.data ?? []) : [];

  return {
    salesThisMonthPaise: invoices.reduce(
      (s: number, i: { grand_total_paise?: number }) => s + (i.grand_total_paise ?? 0),
      0,
    ),
    invoiceCount: invoices.length,
    outstandingPaise: outstanding.reduce(
      (s: number, i: { balance_paise?: number }) => s + (i.balance_paise ?? 0),
      0,
    ),
    pendingOrders: orders.length,
    activeJobCards: jobs.filter(
      (j: { status?: string }) => j.status === "open" || j.status === "in_progress",
    ).length,
    readyJobCards: jobs.filter((j: { status?: string }) => j.status === "ready").length,
    pendingRepairs: repairs.length,
    totalCustomers: customers.length,
  };
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

export default function CeoDashboard() {
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
            { label: "Workshop", to: "/workshop", icon: Package },
            { label: "Settings", to: "/settings", icon: ArrowUpRight },
            { label: "Daily Close", to: "/reports/daily-close", icon: CheckCircle },
            { label: "Exception Report", to: "/reports/exceptions", icon: AlertTriangle },
            { label: "Inventory Ageing", to: "/reports/inventory-ageing", icon: Clock },
            { label: "Month-End Close", to: "/reports/month-end-close", icon: Lock },
            { label: "Pending Approvals", to: "/reports/approvals", icon: CheckCircle },
            { label: "Audit Log", to: "/reports/audit-log", icon: AlertCircle },
            { label: "Gold Reconciliation", to: "/reports/gold-reconciliation", icon: Scale },
            { label: "Communication Analytics", to: "/reports/communication-analytics", icon: Users },
            { label: "Manufacturing Gold Summary", to: "/reports/gold-summary", icon: Scale },
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
