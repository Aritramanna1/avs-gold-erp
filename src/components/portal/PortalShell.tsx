/**
 * Shared portal chrome — business switcher + sign out for multi-firm portal users.
 */
import type { ReactNode } from "react";
import { BusinessSwitcher } from "@/components/identity/BusinessSwitcher";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Logo } from "@/components/ui/Logo";

export function PortalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4">
        <Logo variant="svg" className="h-8 w-8" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BusinessSwitcher compact />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={() => void supabase.auth.signOut().then(() => (window.location.href = "/"))}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
