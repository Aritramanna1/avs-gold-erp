import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { User, BarChart3, Settings, Sparkles, LogOut, ChevronRight, Keyboard } from "lucide-react";
import { BusinessSwitcher } from "@/components/identity/BusinessSwitcher";
import { MobileModulesSheet } from "@/components/mobile/MobileModulesSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

const SECONDARY_LINKS = [
  { to: "/assistant", label: "AVS Assistant", icon: Sparkles },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/control/shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileAccountSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/30 text-foreground"
          aria-label="Account and more"
        >
          <User className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100vw-2rem,320px)]">
        <SheetHeader>
          <SheetTitle className="text-left font-serif">Account</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Business
            </p>
            <BusinessSwitcher compact />
          </div>
          <MobileModulesSheet onNavigate={() => setOpen(false)} />
          <nav className="space-y-1">
            {SECONDARY_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 min-h-[var(--touch-target)] rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <Icon className="h-4 w-4 text-gold" />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            className="flex w-full items-center gap-2 min-h-[var(--touch-target)] rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => void supabase.auth.signOut().then(() => (window.location.href = "/"))}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
