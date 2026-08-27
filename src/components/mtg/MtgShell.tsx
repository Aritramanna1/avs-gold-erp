/**
 * MTG-only chrome: compact top bar + no dense AVS sidebar.
 * Non-MTG firms never mount this.
 */
import { type ReactNode, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LogOut, Menu, Settings, X } from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { isAdminLikeRole } from "@/lib/role-resolution";

export function MtgShell({ children }: { children: ReactNode }) {
  const firm = useSettings((s) => s.firm);
  const role = useSettings((s) => s.currentUserRole);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const showAdmin = isAdminLikeRole(role);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-50 via-background to-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/mtg" className="flex items-center gap-2 min-w-0">
            <Logo className="h-8 w-8 shrink-0" />
            <span className="truncate font-serif text-lg font-bold text-foreground">
              {firm?.shopName || "MTG"}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant={pathname === "/mtg" || pathname === "/app" ? "secondary" : "ghost"}
              size="sm"
              asChild
              className="gap-1"
            >
              <Link to="/mtg">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>
            {showAdmin ? (
              <Button variant="ghost" size="sm" asChild className="gap-1">
                <Link to="/settings">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              className="gap-1 text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Out</span>
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-border px-4 py-2 sm:hidden space-y-1">
            <Link
              to="/mtg"
              className="block py-2 text-sm font-medium"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
            {showAdmin ? (
              <Link
                to="/settings"
                className="block py-2 text-sm font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Admin / Settings
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
