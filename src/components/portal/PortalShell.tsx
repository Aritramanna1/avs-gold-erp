/**
 * Shared portal chrome — one header/nav model for Customer, Supplier, Karigar.
 * Phone: bottom nav + safe-area. Tablet/desktop: header + in-page tabs (no phone rail).
 */
import { useEffect, type ReactNode } from "react";
import { BusinessSwitcher } from "@/components/identity/BusinessSwitcher";
import { WorkspaceSwitcher } from "@/components/identity/WorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { signOutAndLeave } from "@/lib/native/sign-out";
import {
  applyDeviceLayoutAttributes,
  useDeviceClass,
  usePhoneChrome,
} from "@/hooks/use-device-class";
import { cn } from "@/lib/utils";

export function PortalShell({
  title,
  subtitle,
  children,
  footer,
  contentClassName,
  onSignOut,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Phone-only bottom navigation */
  footer?: ReactNode;
  contentClassName?: string;
  onSignOut?: () => void;
}) {
  const deviceClass = useDeviceClass();
  const isPhoneChrome = usePhoneChrome();

  useEffect(() => {
    applyDeviceLayoutAttributes(deviceClass);
  }, [deviceClass]);

  useEffect(() => {
    if (!isPhoneChrome) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/native/mobile-table-stamp").then((m) => {
      if (cancelled) return;
      stop = m.startMobilePresentation();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [isPhoneChrome]);

  return (
    <div className="portal-shell min-h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-background text-foreground">
      <header
        className={cn(
          "shrink-0 border-b border-border bg-card flex items-center gap-2 px-3 sm:px-4",
          "pt-[max(0.5rem,var(--ornexa-inset-top))] min-h-[calc(3.5rem+var(--ornexa-inset-top))]",
        )}
      >
        <Logo variant="svg" className="h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          {subtitle ? (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <WorkspaceSwitcher compact />
          <BusinessSwitcher compact />
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 md:h-9 md:w-auto md:gap-1 md:px-2 min-h-[var(--touch-target)]"
            onClick={() => {
              if (onSignOut) onSignOut();
              else void signOutAndLeave();
            }}
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <main
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y",
          isPhoneChrome
            ? "pb-[calc(var(--mobile-nav-height,4.25rem)+var(--ornexa-inset-bottom)+0.75rem)]"
            : "pb-[max(1rem,var(--ornexa-inset-bottom))]",
        )}
      >
        <div
          className={cn(
            "mx-auto w-full px-4 py-6 space-y-6",
            contentClassName ?? "max-w-5xl",
          )}
        >
          {children}
        </div>
      </main>
      {isPhoneChrome ? footer : null}
    </div>
  );
}
