import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Logo } from "@/components/ui/Logo";
import { MobileAccountSheet } from "./MobileAccountSheet";
import { MobileBottomNav } from "./MobileBottomNav";
import { BusinessSwitcher } from "@/components/identity/BusinessSwitcher";
import { useSettings } from "@/lib/settings-store";

/**
 * Mobile ERP chrome — no desktop sidebar. Action-first bottom navigation.
 */
export function MobileShell({ children, title }: { children: ReactNode; title?: string }) {
  const firm = useSettings((s) => s.firm);

  useEffect(() => {
    document.body.setAttribute("data-mobile-erp", "true");
    return () => document.body.removeAttribute("data-mobile-erp");
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:hidden">
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-card flex items-center gap-2 px-3">
        <Logo variant="svg" className="h-7 w-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title ?? firm?.shopName ?? "Ornexa"}</p>
        </div>
        <div className="hidden xs:block">
          <BusinessSwitcher compact />
        </div>
        <MobileAccountSheet />
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
      <MobileBottomNav />
    </div>
  );
}

export function MobilePageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-gold text-sm font-medium hover:underline">
      {children}
    </Link>
  );
}
