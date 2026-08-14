import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Truck,
  Loader2,
  FileText,
  Coins,
  Scale,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Badge } from "@/components/ui/badge";
import { formatDateMedium as fmtDate } from "@/lib/format-date";

type SupplierPortalData = {
  profile: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    village_city?: string | null;
    current_address?: string | null;
  };
  purchases: Array<{
    id: string;
    purchase_no: string;
    invoice_no: string | null;
    invoice_date: string | null;
    total_paise: number;
    paid_paise: number;
    due_paise: number;
    fine_mg: number;
    gold_paid_fine_mg: number;
    gross_mg: number;
    created_at: string;
  }>;
  outside_work: Array<{
    id: string;
    order_id: string | null;
    created_at: string;
    data: any;
  }>;
};

export const Route = createFileRoute("/supplier-portal")({
  head: () => ({
    meta: [{ title: "Supplier Portal · AVS Gold ERP" }],
  }),
  component: SupplierPortal,
});

// helpers
function mg(val: number) {
  const g = val / 1000;
  return g.toFixed(3) + "g";
}

function rs(paise: number) {
  return "₹" + (paise / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const PURCHASE_STATUS_COLORS = (due: number) => {
  if (due <= 0) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
};

function SupplierPortal() {
  const navigate = useNavigate();
  const [data, setData] = useState<SupplierPortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "purchases" | "jobs">("dashboard");

  useEffect(() => {
    let active = true;
    void (async () => {
      // 1. Check session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData.session) {
        void navigate({ to: "/supplier-login" });
        return;
      }
      setAuthChecked(true);

      // 2. Fetch supplier portal data
      const { data: result, error: queryError } = await (supabase as any).rpc(
        "get_supplier_portal",
      );
      if (!active) return;
      if (queryError) {
        setError("Your supplier portal is not yet configured. Please contact the partner firm.");
      } else {
        setData(result as SupplierPortalData);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="erp-surface rounded-md p-6">
          <h1 className="text-xl font-semibold">Supplier portal unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-[50vh] place-items-center">
        <Loader2
          className="h-6 w-6 animate-spin text-primary"
          aria-label="Loading supplier portal"
        />
      </main>
    );
  }

  // Calculate stats
  const totalPurchasesAmount = data.purchases.reduce((sum, p) => sum + p.total_paise, 0);
  const totalDueAmount = data.purchases.reduce((sum, p) => sum + p.due_paise, 0);
  const totalFineGoldBought = data.purchases.reduce((sum, p) => sum + p.fine_mg, 0);

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Top bar */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Supplier Portal</div>
              <div className="text-xs text-muted-foreground">{data.profile.full_name}</div>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => {
              void supabase.auth.signOut().then(() => {
                window.location.href = "/supplier-login";
              });
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Navigation - Mobile select */}
        <div className="block md:hidden">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as any)}
            className="w-full bg-white border border-border rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="dashboard">Dashboard Overview</option>
            <option value="purchases">Purchase Vouchers ({data.purchases.length})</option>
            <option value="jobs">Outside Work Jobs ({data.outside_work.length})</option>
          </select>
        </div>

        {/* Navigation - Desktop tabs */}
        <div className="hidden md:flex gap-1 bg-white rounded-xl border border-border p-1 shadow-sm">
          {[
            ["dashboard", "Overview"],
            ["purchases", `Purchase Vouchers (${data.purchases.length})`],
            ["jobs", `Outside Work Jobs (${data.outside_work.length})`],
          ].map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t as any)}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold capitalize transition-all ${
                tab === t
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content: Dashboard */}
        {tab === "dashboard" && (
          <div className="space-y-6 font-sans">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Total Purchases
                </span>
                <div className="text-xl font-bold font-mono text-orange-950">
                  {rs(totalPurchasesAmount)}
                </div>
                <span className="text-[10px] text-muted-foreground">Cumulative invoice value</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Balance Due to You
                </span>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  {rs(totalDueAmount)}
                </div>
                <span className="text-[10px] text-muted-foreground">Unpaid settlements</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Gold Supply fine
                </span>
                <div className="text-xl font-bold font-mono text-gold">
                  {mg(totalFineGoldBought)}
                </div>
                <span className="text-[10px] text-muted-foreground">Total metal purchased</span>
              </div>
            </div>

            {/* Profile */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm text-foreground">Supplier Business Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Supplier Name</span>
                  <span className="font-medium text-foreground">{data.profile.full_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Phone / Whatsapp</span>
                  <span className="font-medium text-foreground">{data.profile.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Email</span>
                  <span className="font-medium text-foreground">{data.profile.email || "—"}</span>
                </div>
                {data.profile.village_city && (
                  <div>
                    <span className="text-muted-foreground block mb-0.5">City / Village</span>
                    <span className="font-medium text-foreground">{data.profile.village_city}</span>
                  </div>
                )}
                {data.profile.current_address && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground block mb-0.5">Address</span>
                    <span className="font-medium text-foreground">
                      {data.profile.current_address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Purchases List */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm text-foreground">Recent Supplies</h2>
              {data.purchases.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center italic">
                  No transactions found.
                </p>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {data.purchases.slice(0, 5).map((p) => (
                    <div className="flex justify-between items-center py-3" key={p.id}>
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">
                          Purchase {p.purchase_no}
                        </span>
                        {p.invoice_no && (
                          <span className="block text-[10px] text-muted-foreground">
                            Bill No: {p.invoice_no}
                          </span>
                        )}
                        <span className="block text-[10px] text-muted-foreground">
                          {fmtDate(p.invoice_date || p.created_at)}
                        </span>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-bold text-foreground">{rs(p.total_paise)}</div>
                        <Badge
                          className={`${PURCHASE_STATUS_COLORS(p.due_paise)} border px-1.5 py-0.5 text-[9px]`}
                        >
                          {p.due_paise <= 0 ? "Paid" : `Due: ${rs(p.due_paise)}`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab content: Purchases */}
        {tab === "purchases" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-sm">Purchase Vouchers History</h2>
            {data.purchases.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-2xl">
                No purchase transactions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data.purchases.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-border bg-card p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-foreground">
                          Voucher: {p.purchase_no}
                        </span>
                        {p.invoice_no && (
                          <span className="block text-[10px] text-muted-foreground">
                            Invoice: {p.invoice_no}
                          </span>
                        )}
                        <span className="block text-[10px] text-muted-foreground">
                          Date: {fmtDate(p.invoice_date || p.created_at)}
                        </span>
                      </div>
                      <Badge
                        className={`${PURCHASE_STATUS_COLORS(p.due_paise)} border px-2 py-0.5 text-[10px]`}
                      >
                        {p.due_paise <= 0 ? "Settled" : "Balance Due"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center font-mono bg-muted/20 p-2.5 rounded-lg text-[10px]">
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Gross Metal
                        </span>
                        <span>{p.gross_mg ? mg(p.gross_mg) : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Fine Gold
                        </span>
                        <span>{p.fine_mg ? mg(p.fine_mg) : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Total Bill
                        </span>
                        <span className="font-semibold text-foreground">{rs(p.total_paise)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-[10px] border-t border-border pt-2 font-mono">
                      <div className="flex justify-between px-2 text-emerald-600 font-semibold">
                        <span>Paid:</span>
                        <span>{rs(p.paid_paise)}</span>
                      </div>
                      <div className="flex justify-between px-2 text-amber-700 font-semibold">
                        <span>Due:</span>
                        <span>{rs(p.due_paise)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab content: Outside Work */}
        {tab === "jobs" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-sm">Outside Work Challans</h2>
            {data.outside_work.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-2xl">
                No outside-work jobs assigned yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data.outside_work.map((ow) => {
                  const owData = typeof ow.data === "string" ? {} : ow.data || {};
                  const inputsFineMg = owData.inputsSentFineMg || owData.goldIssuedMg || 0;
                  const returnedFineMg = owData.goodsReturnedFineMg || owData.goldReturnedMg || 0;

                  return (
                    <div
                      key={ow.id}
                      className="rounded-2xl border border-border bg-card p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-sm text-foreground">
                            Challan: {owData.challanNo || ow.id}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            Date: {fmtDate(ow.created_at)}
                          </span>
                        </div>
                        <Badge
                          className={`${owData.status === "fully_returned" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"} border px-2 py-0.5 text-[10px] capitalize`}
                        >
                          {owData.status || "in progress"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-muted-foreground block text-[9px]">
                            Material sent
                          </span>
                          <span className="font-medium text-foreground">
                            {owData.materialReturned || owData.itemName || "Raw metal / scrap"}
                          </span>
                        </div>
                        {ow.order_id && (
                          <div>
                            <span className="text-muted-foreground block text-[9px]">
                              Linked Order
                            </span>
                            <span className="font-medium text-foreground">{ow.order_id}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center font-mono bg-muted/20 p-2.5 rounded-lg text-[10px]">
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">
                            Issued Fine
                          </span>
                          <span>{inputsFineMg ? mg(inputsFineMg) : "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">
                            Returned Fine
                          </span>
                          <span>{returnedFineMg ? mg(returnedFineMg) : "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
