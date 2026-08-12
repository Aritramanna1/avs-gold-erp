/**
 * Karigar Portal — /karigar-portal
 *
 * Public-accessible route (authenticated via Supabase OTP, not ERP staff login).
 * Shows a karigar's own data: gold balance, gold issue/return ledger,
 * wages, and attendance — all read-only.
 *
 * Data fetched via get_karigar_portal() Supabase RPC, which uses
 * the caller's JWT to find their karigar record by phone/email.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  Hammer,
  Loader2,
  Scale,
  Coins,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/karigar-portal")({
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

function fmtDate(val: string | number | null | undefined) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN", { dateStyle: "medium" });
  } catch {
    return String(val);
  }
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
  accent?: "emerald" | "rose" | "amber";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  };
  const cls = accent ? colors[accent] : "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono leading-tight">{value}</div>
      {sub && <div className="text-xs mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

function KarigarPortal() {
  const navigate = useNavigate();
  const [data, setData] = useState<KarigarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"gold" | "wages" | "attendance">("gold");

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
      const { data: result, error: rpcError } = await (supabase as any).rpc("get_karigar_portal");
      if (!active) return;
      if (rpcError) {
        setError("Could not load your portal data. Please contact your firm.");
      } else {
        setData(result as KarigarData);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  function handleSignOut() {
    void supabase.auth.signOut().then(() => {
      window.location.href = "/karigar-login";
    });
  }

  // ── Loading ──
  if (!data && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
          <p className="text-sm text-orange-700">Loading your portal…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !data?.found) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-orange-200 shadow p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Hammer className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Profile Not Found</h2>
          <p className="text-sm text-gray-500">
            {error ?? data?.message ?? "Your karigar profile is not linked to this account yet."}
          </p>
          <p className="text-xs text-gray-400">
            Please ask your firm administrator to link your email address.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const bal = data.goldBalance;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Top bar */}
      <header className="bg-white border-b border-orange-100 shadow-sm">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white">
              <Hammer className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-orange-900">Karigar Portal</div>
              <div className="text-xs text-gray-500">{data.profile.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Gold balance summary */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
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
              accent="amber"
            />
          </div>
        </section>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          {(["gold", "wages", "attendance"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "gold" ? "Gold Ledger" : t === "wages" ? "Wages & Payments" : "Attendance"}
            </button>
          ))}
        </div>

        {/* Tab: Gold Ledger */}
        {tab === "gold" && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Gold Ledger (Last 90 Days)</h3>
            </div>
            {data.goldEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No entries found.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.goldEntries.map((e) => (
                  <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {e.narration || e.type}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(e.ts)}
                        {e.slipNo && ` · Slip: ${e.slipNo}`}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-mono font-bold shrink-0 ${
                        (e.netFineMg ?? 0) < 0 ? "text-rose-600" : "text-emerald-600"
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

        {/* Tab: Wages */}
        {tab === "wages" && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">
                Wages &amp; Payments (Last 90 Days)
              </h3>
            </div>
            {data.wages.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No wage records found.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.wages.map((w) => (
                  <div key={w.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 capitalize">
                        {w.kind.replace(/_/g, " ")}
                      </div>
                      {w.notes && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{w.notes}</div>
                      )}
                      <div className="text-xs text-gray-400">{fmtDate(w.ts)}</div>
                    </div>
                    <div className="text-sm font-mono font-bold text-gray-900 shrink-0">
                      <Coins className="h-3.5 w-3.5 inline-block mr-1 text-amber-600" />
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
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Attendance (Last 30 Days)</h3>
            </div>
            {data.attendance.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No attendance records found.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.attendance.map((a, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{fmtDate(a.date)}</div>
                        {(a.inTime || a.outTime) && (
                          <div className="text-xs text-gray-500">
                            {a.inTime || "—"} → {a.outTime || "—"}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        a.status === "present"
                          ? "bg-emerald-100 text-emerald-700"
                          : a.status === "absent"
                            ? "bg-rose-100 text-rose-700"
                            : a.status === "half_day"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-500"
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
        <footer className="text-center text-xs text-gray-400 pb-4">
          Powered by <span className="font-semibold text-orange-700">AVS Gold ERP</span>
          {" · "}Data is read-only. Contact your firm for corrections.
        </footer>
      </main>
    </div>
  );
}
