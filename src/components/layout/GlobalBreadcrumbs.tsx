import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";
import {
  navigationGroups,
  resolveBreadcrumbTrail,
  filterNavGroupsByPermission,
  type BreadcrumbTrailItem,
} from "@/lib/navigation-groups";
import { useSettings } from "@/lib/settings-store";
import { hasRoutePermission } from "@/lib/permissions";
import { useLanguage } from "@/contexts/LanguageContext";

export function GlobalBreadcrumbs({ className = "" }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as Record<string, unknown>,
  });
  const role = useSettings((s) => s.currentUserRole);
  const { t } = useLanguage();

  const filteredGroups = useMemo(
    () => filterNavGroupsByPermission(navigationGroups, (to) => hasRoutePermission(role, to)),
    [role],
  );

  const trail: BreadcrumbTrailItem[] = useMemo(() => {
    return resolveBreadcrumbTrail(pathname, search, filteredGroups);
  }, [pathname, search, filteredGroups]);

  // Don't render on public auth screens
  if (
    pathname === "/login" ||
    pathname === "/otp-login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/accept-invitation" ||
    pathname === "/customer-login" ||
    pathname === "/karigar-login" ||
    pathname === "/supplier-login" ||
    pathname === "/onboarding" ||
    pathname === "/setup"
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Global breadcrumb navigation"
      className={`flex items-center gap-1.5 px-4 py-2 border-b border-border/40 bg-card/40 text-[11px] text-muted-foreground no-print select-none ${className}`}
    >
      <Link
        to="/app"
        className="flex items-center gap-1 hover:text-gold transition-colors text-muted-foreground"
        title="Go to Home Dashboard"
      >
        <Home className="h-3 w-3 text-gold shrink-0" />
      </Link>

      {trail.map((item, idx) => {
        const isLast = idx === trail.length - 1;
        return (
          <div key={`${item.label}-${idx}`} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
            {item.href && !isLast ? (
              <Link
                to={item.href as never}
                className="hover:text-foreground transition-colors truncate max-w-[160px]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`truncate max-w-[200px] ${
                  isLast ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
