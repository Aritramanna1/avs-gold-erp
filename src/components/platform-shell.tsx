import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  Database,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Button } from "@/components/ui/button";

const items = [
  ["Overview", "/platform?view=overview", LayoutDashboard],
  ["Firms", "/platform?view=firms", Building2],
  ["Users", "/platform?view=firms", Users],
  ["Support", "/platform?view=tickets", LifeBuoy],
  ["Health", "/platform?view=health", Activity],
  ["Audit", "/platform?view=activity", ShieldCheck],
  ["Backups", "/platform?view=backups", Database],
  ["Settings", "/platform?view=settings", Settings2],
] as const;

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }
  return (
    <div className="min-h-screen bg-[#f4f0e8] text-[#09090b]">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-[#2f2f33] bg-[#09090b] text-white lg:flex print:hidden">
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b99b5a]">
              AVS Platform
            </p>
            <h1 className="mt-1 font-serif text-xl">Owner Control</h1>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {items.map(([label, href, Icon]) => (
              <Link
                key={href}
                to={href as never}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === "/platform" && window.location.search === href.slice(href.indexOf("?")) ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/10 p-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="border-b border-[#dedad1] bg-[#fffdf8] px-4 py-3 lg:px-8 print:hidden">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8c88]">
                  AVS platform
                </p>
                <p className="font-serif text-lg">Owner Control Center</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="border border-[#b99b5a]/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#806738]">
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
            <nav className="mt-3 flex gap-1 overflow-x-auto lg:hidden">
              {items.slice(0, 5).map(([label, href]) => (
                <Link
                  key={href}
                  to={href as never}
                  className={`whitespace-nowrap border px-3 py-2 text-xs ${pathname === "/platform" && window.location.search === href.slice(href.indexOf("?")) ? "border-[#b99b5a] bg-[#eee5d2]" : "border-[#dedad1]"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="mx-auto max-w-[1600px]">{children}</main>
        </div>
      </div>
    </div>
  );
}
