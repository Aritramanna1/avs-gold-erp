import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, TrendingUp, TrendingDown, Users, FileText } from "lucide-react";
import { MOBILE_QUICK_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { MobileModulesSheet } from "@/components/mobile/MobileModulesSheet";
import { useSettings } from "@/lib/settings-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

function mgToKgDisplay(mg: number): string {
  const g = mg / 1000;
  if (g >= 1000) return `${(g / 1000).toFixed(3)} kg`;
  return `${g.toFixed(3)} g`;
}

export function MobileHomeDashboard() {
  const firm = useSettings((s) => s.firm);
  const goldRate = useSettings((s) => s.goldRatePerGramPaise);
  const [goldMg, setGoldMg] = useState<number | null>(null);
  const [issuedToday, setIssuedToday] = useState(0);
  const [returnedToday, setReturnedToday] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await (supabase as any).rpc("get_vault_summary");
        if (!cancelled && data?.fine_mg != null) setGoldMg(Number(data.fine_mg));
      } catch {
        /* lazy — home still renders */
      }
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: movements } = await supabase
          .from("gold_movements" as never)
          .select("type, net_fine_mg")
          .gte("ts", `${today}T00:00:00`)
          .limit(200);
        if (!cancelled && movements) {
          let issue = 0;
          let ret = 0;
          for (const m of movements as { type?: string; net_fine_mg?: number }[]) {
            const v = Math.abs(Number(m.net_fine_mg ?? 0));
            if (m.type === "issue" || m.type === "out") issue += v;
            if (m.type === "return" || m.type === "in") ret += v;
          }
          setIssuedToday(issue);
          setReturnedToday(ret);
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { dateStyle: "medium" });

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto">
      <header>
        <p className="text-sm text-muted-foreground">Good day</p>
        <h1 className="font-serif text-xl">{firm?.shopName ?? "Ornexa"}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Operating date {today}</p>
      </header>

      <section className="rounded-md border border-gold/30 bg-card p-4">
        <div className="flex items-center gap-2 text-gold mb-2">
          <Coins className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Fine Gold Position</span>
        </div>
        <p className="font-serif text-2xl text-foreground tabular-nums">
          {goldMg != null ? mgToKgDisplay(goldMg) : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Ledger reconciled · {today}
        </p>
        <Link
          to="/assistant"
          search={{ q: "fine gold position today" }}
          className="mt-3 inline-flex text-xs font-medium text-gold"
        >
          Open Gold Book →
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-card p-3">
          <TrendingUp className="h-4 w-4 text-primary mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Issued Today</p>
          <p className="text-sm font-semibold tabular-nums">{mgToKgDisplay(issuedToday)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <TrendingDown className="h-4 w-4 text-emerald-600 mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Returned Today</p>
          <p className="text-sm font-semibold tabular-nums">{mgToKgDisplay(returnedToday)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <Users className="h-4 w-4 text-gold mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">22K Rate</p>
          <p className="text-sm font-semibold">
            {goldRate > 0 ? `₹${(goldRate / 100).toLocaleString("en-IN")}/g` : "Not set"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <FileText className="h-4 w-4 text-muted-foreground mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Quick</p>
          <Link to="/orders" className="text-sm font-medium text-gold">
            Orders →
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {MOBILE_QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.id}
                to={a.to}
                search={a.search}
                className="flex flex-col items-start gap-2 min-h-[var(--touch-target)] rounded-md border border-border bg-card p-3 hover:border-gold/30"
              >
                <Icon className="h-4 w-4 text-gold" />
                <span className="text-xs font-semibold leading-tight">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Full ERP
        </h2>
        <MobileModulesSheet />
      </section>
    </div>
  );
}
