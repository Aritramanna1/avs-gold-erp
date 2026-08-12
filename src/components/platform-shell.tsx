import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  CircleDollarSign,
  Database,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Receipt,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Button } from "@/components/ui/button";

const items = [
  ["Overview", "overview", LayoutDashboard],
  ["Firms", "firms", Building2],
  ["Users", "users", Users],
  ["Subscriptions & trials", "subscriptions", CircleDollarSign],
  ["Module licensing", "licensing", ShieldCheck],
  ["Service requests", "requests", Wrench],
  ["Support tickets", "tickets", MessageSquare],
  ["Software billing", "billing", Receipt],
  ["Activity & audit", "activity", LifeBuoy],
  ["Health & monitoring", "health", Activity],
  ["Backups", "backups", Database],
  ["Platform settings", "settings", Settings2],
] as const;

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeView = useRouterState({
    select: (state) => (state.location.search as { view?: string }).view ?? "overview",
  });
  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }
  return (
    <div className="min-h-screen bg-[#f4f0e8] text-[#09090b]">
      <header className="border-b border-[#c9c4ba] bg-[#fffdf8] px-4 py-3 lg:px-14 print:hidden">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8c88]">
              AVS Platform
            </p>
            <p className="font-serif text-lg">Owner Control Center</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="border border-[#b99b5a]/50 bg-[#f7f2e6] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#806738]">
              SaaS Admin
            </span>
            <Button
              variant="outline"
              className="gap-2 border-[#b99b5a] px-3 text-xs"
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-4 lg:px-14 print:hidden">
        <div className="border border-[#dedad1] bg-[#efece6] px-7 py-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6b6659]">
            AVS / Platform Operations
          </p>
          <h1 className="mt-1 font-serif text-2xl leading-tight">Owner Control Center</h1>
          <nav className="mt-5 flex items-center gap-2 overflow-x-auto border-b border-[#c9c4ba] pb-2">
            {items.map(([label, view, Icon]) => {
              const active = pathname === "/platform" && activeView === view;
              return (
                <Link
                  key={view}
                  to="/platform"
                  search={{ view } as never}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-2 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-[#8a6a22] text-[#09090b]"
                      : "border-transparent text-[#6b6659] hover:border-[#c9c4ba] hover:text-[#09090b]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 pb-8 lg:px-14">{children}</main>
    </div>
  );
}
