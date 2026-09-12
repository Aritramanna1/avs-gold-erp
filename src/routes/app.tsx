import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { MobileHomeDashboard } from "@/components/mobile/MobileHomeDashboard";
import { usePhoneChrome } from "@/hooks/use-device-class";
import { useSettings } from "@/lib/settings-store";
import { useCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  describeDashboardError,
  emptyHomeDashboardSummary,
  fetchHomeDashboardSummary,
  HOME_DASHBOARD_TIMEOUT_MS,
  type HomeDashboardOrder,
  type HomeDashboardPerson,
  type HomeDashboardSummary,
} from "@/lib/home-dashboard-query";
import { withTimeout } from "@/lib/performance/resilient-async";
import { StagedLoadPanel } from "@/components/staged-load-panel";
import { useStagedLoad } from "@/hooks/use-staged-load";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import { HomeDashboardSkeleton } from "@/components/dashboard/HomeDashboardSkeleton";
import { WorkspaceGateways } from "@/components/dashboard/WorkspaceGateways";
import { ProgressiveDisclosure } from "@/components/ui/progressive-disclosure";
import { recordStartupMetric, markStartup } from "@/lib/performance/startup-metrics";
import { mgToGrams } from "@/lib/gold";
import {
  isAdminLikeRole,
  isBillingLikeRole,
  isWorkshopLikeRole,
  normalizeRoleKey,
} from "@/lib/role-resolution";
import { customerReminderMessage, karigarReminderMessage } from "@/lib/orders-tracking";
import { ReminderDialog } from "@/components/reminder-dialog";
import { useSubscriptionAccess } from "@/lib/identity/subscription-access-service";
import {
  Scale,
  Hammer,
  ShoppingBag,
  Receipt,
  AlertTriangle,
  Clock,
  CalendarCheck,
  ClipboardList,
  MessageCircle,
  CheckCircle2,
  Banknote,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Dashboard · AVS ERP" },
      { name: "description", content: "Daily operations overview." },
    ],
  }),
  component: Home,
});

function emptySummaryBuckets() {
  return { today: [], tomorrow: [], delayed: [], pendingJobCard: [], readyBilling: [] };
}

function Home() {
  const { t } = useLanguage();
  const isMobileLayout = usePhoneChrome();
  const { firm } = useSettings();
  const goldRatePerGramPaise = useCurrentGoldRatePaise();
  const trialStatus = useSubscriptionAccess((s) => s.status);
  const trialDays = useSubscriptionAccess((s) => s.daysRemaining);
  const [summary, setSummary] = useState<HomeDashboardSummary | null>(null);
  const [dashboardPhase, setDashboardPhase] = useState<"loading" | "critical" | "ready">("loading");
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [dashboardFailed, setDashboardFailed] = useState(false);
  const stagedDashboard = useStagedLoad({
    active: dashboardPhase === "loading",
    done: dashboardPhase === "ready",
    failed: dashboardFailed,
  });
  const bumpDashboardRetry = stagedDashboard.bumpRetry;

  const loadDashboard = useCallback(async (ac: AbortController) => {
    setDashboardPhase("loading");
    setDashboardError(null);
    setDashboardFailed(false);
    bumpDashboardRetry();
    markStartup("dashboard_critical");
    try {
      const data = await withTimeout(
        fetchHomeDashboardSummary(ac.signal),
        HOME_DASHBOARD_TIMEOUT_MS,
        "homeDashboard",
        ac.signal,
      );
      if (ac.signal.aborted) return;

      setSummary(data);
      setDashboardError(data.loadWarning ?? null);
      setDashboardFailed(false);
      setDashboardPhase("critical");
      recordStartupMetric("dashboard_critical", undefined, "dashboard_critical");
      requestAnimationFrame(() => {
        if (!ac.signal.aborted) setDashboardPhase("ready");
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      setSummary(emptyHomeDashboardSummary());
      setDashboardError(describeDashboardError(err));
      setDashboardFailed(false);
      setDashboardPhase("ready");
    }
  }, [bumpDashboardRetry]);

  useEffect(() => {
    const ac = new AbortController();
    void loadDashboard(ac);
    return () => ac.abort();
  }, [loadDashboard]);

  const retryDashboard = useCallback(() => {
    void loadDashboard(new AbortController());
  }, [loadDashboard]);

  const buckets = summary?.buckets ?? emptySummaryBuckets();
  const peopleById = useMemo(() => {
    const map = new Map<string, HomeDashboardPerson>();
    for (const person of summary?.people ?? []) map.set(person.id, person);
    return map;
  }, [summary?.people]);

  const [reminder, setReminder] = useState<{
    cust: string;
    kari?: string;
    custPhone?: string;
    kariPhone?: string;
  } | null>(null);

  function openReminder(orderId: string) {
    const allOrders = [
      ...buckets.today,
      ...buckets.tomorrow,
      ...buckets.delayed,
      ...buckets.pendingJobCard,
      ...buckets.readyBilling,
    ];
    const order = allOrders.find((candidate) => candidate.id === orderId);
    if (!order) return;

    const customer = order.customerId ? peopleById.get(order.customerId) : undefined;
    const karigar = order.karigarId ? peopleById.get(order.karigarId) : undefined;
    setReminder({
      custPhone: customer?.phone,
      kariPhone: karigar?.phone,
      cust: customerReminderMessage({
        customerName: customer?.fullName ?? "Customer",
        orderNo: order.orderNo,
        itemName: order.item?.itemName ?? "",
      }),
      kari: karigar
        ? karigarReminderMessage({
            karigarName: karigar.fullName,
            orderNo: order.orderNo,
            itemName: order.item?.itemName ?? "",
            deliveryDate: order.expectedDelivery,
          })
        : undefined,
    });
  }

  const { currentUserRole, setFirm, setFirmLocal } = useSettings();
  const isOwnerOrManager = isAdminLikeRole(currentUserRole);
  const isWorkshop = isWorkshopLikeRole(currentUserRole);
  const isBilling = isBillingLikeRole(currentUserRole);

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem("ornexa_migration_banner_dismissed") === "true" ||
      sessionStorage.getItem("ornexa_migration_banner_dismissed") === "true"
    );
  });

  const migrationStatus = firm.tenant_migration_status ?? "NOT_STARTED";
  const showMigrationBanner =
    isOwnerOrManager &&
    !bannerDismissed &&
    migrationStatus !== "COMPLETED" &&
    migrationStatus !== "SKIPPED" &&
    migrationStatus !== "DEFERRED";

  const handleDoItLater = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem("ornexa_migration_banner_dismissed", "true");
      sessionStorage.setItem("ornexa_migration_banner_dismissed", "true");
    } catch {
      // Ignore
    }
    setFirmLocal({ tenant_migration_status: "DEFERRED" });
    toast.info("Setup banner deferred. You can revisit anytime in Settings.");
  };

  const handleStartFresh = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem("ornexa_migration_banner_dismissed", "true");
      sessionStorage.setItem("ornexa_migration_banner_dismissed", "true");
    } catch {
      // Ignore
    }
    setFirmLocal({ tenant_migration_status: "SKIPPED" });
    toast.success("Starting fresh with clean database.");
  };

  if (isMobileLayout) {
    return <MobileHomeDashboard />;
  }

  return (
    <div data-tour="home-dashboard" className="p-4 md:p-7 max-w-7xl mx-auto page-enter">
      <PageHeader title={t("dashboard.goodDay")} subtitle={t("dashboard.overview")} />

      <WorkspaceGateways />

      {/* ── 13-Stage Onboarding & Migration Banner ──────────────────────── */}
      {showMigrationBanner && (
        <div className="mb-6 rounded-md border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-background to-card p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500 font-bold text-base">
                13
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    13-Stage Historical Data & Opening Balance Setup
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-500/40 text-amber-500 font-mono"
                  >
                    Action Required
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ingest legacy parties, dual-running cash & metal opening balances, stock tags,
                  active WIP jobs, and Karigar custody.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link to="/control/migration">
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-8"
                >
                  Launch Migration Wizard
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
                onClick={handleDoItLater}
              >
                Do It Later
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
                onClick={handleStartFresh}
              >
                Start Fresh
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role snapshot (optional — expand for KPI cards) ───────────────── */}
      {isOwnerOrManager && summary && dashboardPhase === "ready" && (
        <ProgressiveDisclosure title="Owner / manager snapshot" className="mb-6">
          <h2 className="erp-section-title mb-3 flex items-center gap-2 sr-only">
            <Layers className="h-4 w-4 text-gold" />
            {isAdminLikeRole(currentUserRole) &&
            (normalizeRoleKey(currentUserRole ?? "").includes("owner") ||
              normalizeRoleKey(currentUserRole ?? "").includes("super"))
              ? "Owner Overview"
              : "Manager Overview"}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              to="/ledger"
              className="erp-surface rounded-none p-3 hover:border-gold/40 transition-colors block"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Scale className="h-3 w-3" /> Vault Gold
              </div>
              <div className="font-mono font-semibold text-gold text-sm">
                {mgToGrams(summary.goldBuckets.vault ?? 0)} g
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Fine gold in vault</div>
            </Link>
            <Link
              to="/workshop"
              className="erp-surface rounded-none p-3 hover:border-gold/40 transition-colors block"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Hammer className="h-3 w-3" /> With Karigars
              </div>
              <div className="font-mono font-semibold text-amber-500 text-sm">
                {mgToGrams(summary.goldBuckets.karigar ?? 0)} g
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Gold in WIP custody</div>
            </Link>
            <Link
              to="/orders"
              className="erp-surface rounded-none p-3 hover:border-primary/40 transition-colors block"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" /> Open Orders
              </div>
              <div className="font-mono font-bold text-foreground text-lg">
                {summary.openOrders ?? 0}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {summary.totalOrders ?? 0} total orders
              </div>
            </Link>
            <Link
              to="/billing"
              className="erp-surface rounded-none p-3 hover:border-primary/40 transition-colors block"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Banknote className="h-3 w-3 text-gold" /> Today Billing (Gold First)
              </div>
              <div className="font-mono font-bold text-gold text-lg">
                {mgToGrams(Math.round(((summary.todayBillingPaise ?? 0) / (goldRatePerGramPaise || 750000)) * 1000))} g Fine
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                ₹{((summary.todayBillingPaise ?? 0) / 100).toLocaleString("en-IN")} · {summary.todayInvoiceCount ?? 0} bills
              </div>
            </Link>
          </div>
          {(buckets.readyBilling.length > 0 || buckets.delayed.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {buckets.readyBilling.length > 0 && (
                <Link to="/billing/new">
                  <Button
                    size="sm"
                    className="bg-gold hover:bg-gold/90 text-black h-8 text-xs font-medium"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {buckets.readyBilling.length} Ready to Bill
                  </Button>
                </Link>
              )}
              {buckets.delayed.length > 0 && (
                <Link to="/orders">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/50 text-red-600 h-8 text-xs"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    {buckets.delayed.length} Delayed Orders
                  </Button>
                </Link>
              )}
            </div>
          )}
        </ProgressiveDisclosure>
      )}

      {isWorkshop && summary && dashboardPhase === "ready" && (
        <ProgressiveDisclosure title="Workshop snapshot" className="mb-6">
          <h2 className="erp-section-title mb-3 flex items-center gap-2">
            <Hammer className="h-4 w-4 text-gold" />
            Workshop Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="erp-surface rounded-none p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Gold with Karigars
              </div>
              <div className="font-mono font-bold text-amber-500 text-xl">
                {mgToGrams(summary.goldBuckets.karigar ?? 0)} g
              </div>
            </div>
            <div className="erp-surface rounded-none p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Orders in WIP
              </div>
              <div className="font-mono font-bold text-foreground text-xl">
                {(buckets.pendingJobCard?.length ?? 0) + (buckets.today?.length ?? 0)}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <Link to="/workshop">
              <Button
                size="sm"
                className="bg-gold hover:bg-gold/90 text-black h-8 text-xs font-medium w-full sm:w-auto"
              >
                <Hammer className="h-3.5 w-3.5 mr-1" /> Open Workshop
              </Button>
            </Link>
          </div>
        </ProgressiveDisclosure>
      )}

      {isBilling && summary && dashboardPhase === "ready" && (
        <ProgressiveDisclosure title="Billing snapshot" className="mb-6">
          <h2 className="erp-section-title mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gold" />
            Billing Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="erp-surface rounded-none p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Today Revenue (Gold First)
              </div>
              <div className="font-mono font-bold text-emerald-500 text-lg">
                {mgToGrams(Math.round(((summary.todayBillingPaise ?? 0) / (goldRatePerGramPaise || 750000)) * 1000))} g Fine
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                Cash Equiv: ₹{((summary.todayBillingPaise ?? 0) / 100).toLocaleString("en-IN")}
              </div>
            </div>
            <div className="erp-surface rounded-none p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Ready to Bill
              </div>
              <div className="font-mono font-bold text-gold text-lg">
                {buckets.readyBilling.length}
              </div>
            </div>
            <div className="erp-surface rounded-none p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Today Invoices
              </div>
              <div className="font-mono font-bold text-foreground text-lg">
                {summary.todayInvoiceCount ?? 0}
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            <Link to="/billing/new">
              <Button
                size="sm"
                className="bg-gold hover:bg-gold/90 text-black h-8 text-xs font-medium"
              >
                <Receipt className="h-3.5 w-3.5 mr-1" /> New Invoice
              </Button>
            </Link>
            <Link to="/billing">
              <Button size="sm" variant="outline" className="h-8 text-xs">
                View All Billing
              </Button>
            </Link>
          </div>
        </ProgressiveDisclosure>
      )}

      {!firm.shopName && (
        <div className="mb-6 p-4 rounded-md border border-gold/40 bg-gold/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-sm text-gold">
              Welcome - finish setting up your business
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Business name, GST, address, and your first branch are not configured yet.
            </p>
          </div>
          <Link to="/setup">
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-black shrink-0 font-medium">
              Run First-Time Setup
            </Button>
          </Link>
        </div>
      )}

      {goldRatePerGramPaise === 0 && (
        <div className="mb-6 p-4 rounded-md border border-red-500 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse shadow-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Gold Rate Not Set</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The live gold rate is currently missing. Money values, karigar salary calculations,
                and invoices will display as blank or zero until set.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white shrink-0 font-medium"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-gold-rate-editor"));
              }
            }}
          >
            Set Gold Rate Now
          </Button>
        </div>
      )}

      {(dashboardError ||
        stagedDashboard.phase === "slow" ||
        stagedDashboard.phase === "retry") && (
        <div className="mb-6">
          {dashboardError ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mb-2">
              <p className="text-sm font-medium">Dashboard totals are showing zeros until retry succeeds.</p>
              <p className="mt-1 text-xs text-muted-foreground font-mono break-all">{dashboardError}</p>
              <Button size="sm" className="mt-2 h-8 text-xs" onClick={() => void retryDashboard()}>
                Retry dashboard
              </Button>
            </div>
          ) : (
            <StagedLoadPanel
              phase={stagedDashboard.phase}
              title="Daily dashboard"
              compact
              onRetry={() => void retryDashboard()}
            />
          )}
        </div>
      )}

      {dashboardPhase !== "ready" && !dashboardFailed && (
        <HomeDashboardSkeleton phase={summary ? "secondary" : "critical"} />
      )}

      {summary?.capped && summary.includesOrderBuckets && dashboardPhase === "ready" && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
          Some dashboard fallback values are based on bounded recent Supabase rows. Apply the
          prepared dashboard aggregate RPC on the correct project for exact full-history cockpit
          totals.
        </div>
      )}

      {dashboardPhase === "ready" && (
        <WidgetErrorBoundary title="Dashboard widgets" onRetry={() => void retryDashboard()}>
          <ProgressiveDisclosure title={t("dashboard.orderTracking")} className="mb-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <BucketCard
              icon={CalendarCheck}
              tone="emerald"
              label={t("dashboard.todayDeliveries")}
              count={buckets.today.length}
              orders={buckets.today.slice(0, 3)}
              onReminder={openReminder}
            />
            <BucketCard
              icon={Clock}
              tone="amber"
              label={t("dashboard.dueTomorrow")}
              count={buckets.tomorrow.length}
              orders={buckets.tomorrow.slice(0, 3)}
              onReminder={openReminder}
            />
            <BucketCard
              icon={AlertTriangle}
              tone="red"
              label={t("dashboard.delayed")}
              count={buckets.delayed.length}
              orders={buckets.delayed.slice(0, 3)}
              onReminder={openReminder}
            />
            <BucketCard
              icon={ClipboardList}
              tone="blue"
              label={t("dashboard.pendingJobCard")}
              count={buckets.pendingJobCard.length}
              orders={buckets.pendingJobCard.slice(0, 3)}
              onReminder={openReminder}
            />
            <BucketCard
              icon={Receipt}
              tone="gold"
              label={t("dashboard.readyForBilling")}
              count={buckets.readyBilling.length}
              orders={buckets.readyBilling.slice(0, 3)}
            />
          </div>
          </ProgressiveDisclosure>

          {(trialStatus === "TRIAL_ACTIVE" || trialStatus === "TRIAL_EXPIRING") && (
            <div
              className="mb-6 rounded-md border border-border bg-card p-3 text-xs"
              data-testid="trial-setup-strip"
            >
              <div className="font-semibold text-sm">
                Trial
                {trialDays != null ? ` · ${trialDays} day${trialDays === 1 ? "" : "s"} remaining` : ""}
              </div>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-muted-foreground">
                <li>
                  <Link to="/people" className="text-gold hover:underline">
                    Add parties
                  </Link>
                </li>
                <li>
                  <Link to="/ledger" className="text-gold hover:underline">
                    Record opening vault
                  </Link>
                </li>
                <li>
                  <Link to="/onboarding" className="text-gold hover:underline">
                    Complete setup checklist
                  </Link>
                </li>
                <li>
                  <Link to="/settings" className="text-gold hover:underline">
                    Upgrade / licence
                  </Link>
                </li>
              </ul>
            </div>
          )}

          <h2 className="erp-section-title mb-3">{t("dashboard.todaySnapshot")}</h2>
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 rounded-md border border-border bg-card p-2"
            data-testid="dashboard-gold-strip"
          >
            <Link to="/ledger" className="px-2 py-1.5 hover:bg-muted/30 rounded-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("dashboard.vaultGold")}
              </div>
              <div className="font-mono text-sm text-gold">
                {mgToGrams(summary?.goldBuckets.vault ?? 0)} g
              </div>
              <div className="text-[10px] text-muted-foreground">
                {summary?.ledgerBalanced
                  ? "Balanced"
                  : `Difference ${mgToGrams(summary?.ledgerDiscrepancyMg ?? 0)} g`}
              </div>
            </Link>
            <Link to="/workshop" className="px-2 py-1.5 hover:bg-muted/30 rounded-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("dashboard.goldWithKarigars")}
              </div>
              <div className="font-mono text-sm text-gold">
                {mgToGrams(summary?.goldBuckets.karigar ?? 0)} g
              </div>
            </Link>
            <Link to="/stock" className="px-2 py-1.5 hover:bg-muted/30 rounded-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("dashboard.finishedStock")}
              </div>
              <div className="font-mono text-sm text-gold">
                {mgToGrams(summary?.goldBuckets.finished ?? 0)} g
              </div>
              <div className="text-[10px] text-muted-foreground">{summary?.stockCount ?? 0} in stock</div>
            </Link>
            <Link to="/people" className="px-2 py-1.5 hover:bg-muted/30 rounded-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("dashboard.customerGoldHeld")}
              </div>
              <div className="font-mono text-sm text-gold">
                {mgToGrams(summary?.goldBuckets.customer ?? 0)} g
              </div>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Tile
              to="/orders"
              icon={ShoppingBag}
              label={t("dashboard.openOrders")}
              value={String(summary?.openOrders ?? 0)}
              hint={`${summary?.totalOrders ?? 0} total`}
            />
            <Tile
              to="/billing"
              icon={Receipt}
              label={t("dashboard.todayBilling")}
              value={`Rs. ${((summary?.todayBillingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
              hint={`${summary?.todayInvoiceCount ?? 0} bills today · ${summary?.totalInvoiceCount ?? 0} total`}
            />
          </div>

          {(summary?.todayInvoiceCount ?? 0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "Cash", value: summary?.todayCashPaise ?? 0, color: "text-emerald-500" },
                { label: "UPI", value: summary?.todayUpiPaise ?? 0, color: "text-blue-500" },
                { label: "Card", value: summary?.todayCardPaise ?? 0, color: "text-purple-500" },
                { label: "Gold Paid", value: summary?.todayGoldPaidPaise ?? 0, color: "text-gold" },
                {
                  label: "Outstanding",
                  value: summary?.todayOutstandingPaise ?? 0,
                  color: "text-rose-500",
                },
                {
                  label: "Gold Sold",
                  value: -1,
                  goldGrams: summary?.todayGoldSoldMg ?? 0,
                  color: "text-amber-500",
                },
              ].map((item) => (
                <div key={item.label} className="erp-surface rounded-md p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {item.label}
                  </div>
                  <div className={`font-mono font-bold text-sm ${item.color}`}>
                    {item.value === -1
                      ? `${mgToGrams(item.goldGrams ?? 0)} g`
                      : `Rs. ${((item.value ?? 0) / 100).toLocaleString("en-IN")}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </WidgetErrorBoundary>
      )}

      <ReminderDialog
        open={!!reminder}
        onClose={() => setReminder(null)}
        customerMessage={reminder?.cust ?? ""}
        karigarMessage={reminder?.kari}
        customerPhone={reminder?.custPhone}
        karigarPhone={reminder?.kariPhone}
      />
    </div>
  );
}

function Tile({
  to,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: typeof Scale;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group erp-surface rounded-none p-4 hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-mono text-2xl font-semibold text-gold mt-2">{value}</div>
        </div>
        <div className="h-9 w-9 rounded-md bg-accent/60 grid place-items-center group-hover:bg-gold/10 transition-colors">
          <Icon className="h-5 w-5 text-gold" />
        </div>
      </div>
      <div className="mt-4 text-[11px] text-muted-foreground">{hint}</div>
    </Link>
  );
}

const TONE: Record<string, string> = {
  emerald: "border-l-emerald-500/70",
  amber: "border-l-amber-500/70",
  red: "border-l-red-500/70",
  blue: "border-l-blue-500/70",
  gold: "border-l-gold/80",
};

function BucketCard({
  icon: Icon,
  tone,
  label,
  count,
  orders,
  onReminder,
}: {
  icon: typeof Scale;
  tone: keyof typeof TONE;
  label: string;
  count: number;
  orders: HomeDashboardOrder[];
  onReminder?: (id: string) => void;
}) {
  return (
    <Card className={`rounded-none border-l-2 p-3 ${TONE[tone]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      {orders.length === 0 ? (
        <div className="text-xs text-muted-foreground">None</div>
      ) : (
        <ul className="text-xs space-y-1">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-2">
              <Link to="/orders/$id" params={{ id: order.id }} className="truncate hover:text-gold">
                <span className="font-mono">{order.orderNo}</span> ·{" "}
                {order.item?.itemName ?? "No Item Name"}
              </Link>
              {onReminder && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[#25D366] hover:bg-[#25D366]/10 shrink-0"
                  onClick={() => onReminder(order.id)}
                  title="Send WhatsApp reminder (Customer / Karigar)"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
