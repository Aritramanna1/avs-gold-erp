import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { MobileModulesSheet } from "@/components/mobile/MobileModulesSheet";
import { HomeGoldCashToday } from "@/components/dashboard/HomeGoldCashToday";
import { HomeMvpShortcuts } from "@/components/dashboard/HomeMvpShortcuts";
import { useSettings } from "@/lib/settings-store";
import {
  fetchHomeDashboardSummary,
  HOME_DASHBOARD_TIMEOUT_MS,
  type HomeDashboardSummary,
} from "@/lib/home-dashboard-query";
import { withTimeout } from "@/lib/performance/resilient-async";
<<<<<<< HEAD
import { triggerGoldRateEditor } from "@/components/app-shell";
import { listAttentionItems } from "@/lib/attention/list-attention-items";
import { Button } from "@/components/ui/button";
=======
import { APP_NAME } from "@/lib/app-info";
>>>>>>> 4ea03cf (fix(branding): BUG-014 Ornexa contact/chrome to AVS (legal + auth chrome))

export function MobileHomeDashboard() {
  const firm = useSettings((s) => s.firm);
  const goldRate = useSettings((s) => s.goldRatePerGramPaise);
  const [summary, setSummary] = useState<HomeDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await withTimeout(
          fetchHomeDashboardSummary(ac.signal),
          HOME_DASHBOARD_TIMEOUT_MS,
          "mobileHomeDashboard",
          ac.signal,
        );
        if (!ac.signal.aborted) {
          setSummary(data);
          setLoadError(data.loadWarning ?? null);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setLoadError(err instanceof Error ? err.message : "Dashboard could not load.");
        }
      }
    })();
    return () => ac.abort();
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { dateStyle: "medium" });
  const attention = useMemo(() => listAttentionItems().items, [goldRate]);

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto" data-tour="mobile-home-mvp">
      <header>
        <p className="text-sm text-muted-foreground">Good day</p>
        <h1 className="font-serif text-xl">{firm?.shopName ?? APP_NAME}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Operating date {today}</p>
      </header>

      {loadError ? (
        <p className="text-xs text-amber-700 border border-amber-500/30 rounded-md p-2">{loadError}</p>
      ) : null}

      {!(goldRate > 0) && (
        <div className="rounded-md border border-red-500 bg-red-500/10 p-3 flex flex-col gap-2 animate-pulse">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Gold rate not set today
              </p>
              <p className="text-xs text-muted-foreground">
                One tap opens the same Set rate sheet as the header chip.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-gold hover:bg-gold/90 text-black font-medium min-h-[48px]"
            onClick={() => triggerGoldRateEditor()}
          >
            Set today&apos;s gold rate
          </Button>
        </div>
      )}

      <HomeGoldCashToday summary={summary} />
      <HomeMvpShortcuts />

      {attention.length > 0 ? (
        <section aria-labelledby="mobile-needs-attention">
          <h2
            id="mobile-needs-attention"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2"
          >
            Needs attention
          </h2>
          <ul className="space-y-2">
            {attention.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 min-h-[48px]"
              >
                <span className="text-sm font-medium">{item.title}</span>
                {item.kind === "RATE" ? (
                  <Button
                    size="sm"
                    className="bg-gold hover:bg-gold/90 text-black font-medium min-h-[48px]"
                    onClick={() => triggerGoldRateEditor()}
                  >
                    {item.fixLabel ?? "Open"}
                  </Button>
                ) : (
                  <Link to={item.href as any} className="text-sm text-gold font-medium">
                    {item.fixLabel ?? "Open"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Full ERP
        </h2>
        <MobileModulesSheet />
      </section>
    </div>
  );
}
