import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, LayoutDashboard } from "lucide-react";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/reports")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Reports · AVS Gold ERP" }] }),
  component: ReportsLayout,
});

/**
 * Shared Back-to-Reports breadcrumb bar for every /reports/* sub-page — one
 * place to fix "missing Back button / breadcrumbs" across all 19+ report
 * pages, instead of touching each page individually. Hidden on the Reports
 * index itself (nothing to go "back" to from the hub) and on any print
 * route (never leak app chrome into printed output).
 */
function ReportsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/reports" || pathname === "/reports/";
  // Real print-chrome routes are named "<report>-print" (e.g.
  // dailyclose-print). The old broader check also matched "/print" as a
  // plain substring, which silently swallowed print-queue and print-log —
  // ordinary report pages that happen to have "print" in their own name,
  // not print-chrome routes — leaving them with no Back button at all.
  const isPrintRoute = pathname.includes("-print");

  return (
    <>
      {!isIndex && !isPrintRoute && (
        <div className="no-print px-4 md:px-8 pt-4 max-w-6xl mx-auto">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/reports" className="flex items-center gap-1 hover:text-gold">
              <LayoutDashboard className="h-3.5 w-3.5" /> Reports
            </Link>
            <ChevronLeft className="h-3 w-3 rotate-180" />
            <span className="text-foreground">Current report</span>
          </nav>
          <Link to="/reports">
            <button className="mt-1 flex items-center gap-1 text-sm text-gold hover:underline">
              <ChevronLeft className="h-4 w-4" /> Back to Reports
            </button>
          </Link>
        </div>
      )}
      <Outlet />
    </>
  );
}
