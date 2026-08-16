import { Link, useRouterState } from "@tanstack/react-router";
import { Hammer, Coins, FileText, MessageCircle, PackageCheck } from "lucide-react";

const TABS = [
  { to: "/karigar-portal", label: "Jobs", icon: Hammer, tab: "jobs" },
  { to: "/karigar-portal", label: "Gold", icon: Coins, tab: "gold", search: { tab: "gold" } },
  { to: "/karigar-portal", label: "Hisab", icon: FileText, tab: "hisab", search: { tab: "hisab" } },
  {
    to: "/karigar-portal",
    label: "Work",
    icon: PackageCheck,
    tab: "work",
    search: { tab: "work" },
  },
  {
    to: "/karigar-portal",
    label: "Messages",
    icon: MessageCircle,
    tab: "messages",
    search: { tab: "messages" },
  },
] as const;

export function PortalMobileBottomNav({ portalPath }: { portalPath: string }) {
  const search = useRouterState({ select: (s) => (s.location.search as { tab?: string }) ?? {} });
  const activeTab = search.tab ?? "jobs";

  return (
    <nav
      className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40"
      aria-label="Portal navigation"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.tab || (tab.tab === "jobs" && !search.tab);
        return (
          <Link
            key={tab.tab}
            to={portalPath as "/karigar-portal"}
            search={"search" in tab ? tab.search : { tab: tab.tab }}
            className={`mobile-bottom-nav__item ${active ? "is-active" : ""}`}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
