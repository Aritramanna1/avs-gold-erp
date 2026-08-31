import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
import {
  MOBILE_QUICK_CREATE_ACTIONS,
  type MobileAction,
} from "@/lib/mobile/mobile-actions-catalog";
import { useSettings } from "@/lib/settings-store";
import { hasRoutePermission } from "@/lib/permissions";
import { hapticLight } from "@/lib/native/haptics";
import { loadMobileFavorites, toggleMobileFavorite } from "@/lib/mobile/mobile-favorites";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";

/**
 * Global Quick Create (+) FAB — role-filtered create-ready targets only.
 */
export function MobileQuickCreateFab() {
  const navigate = useNavigate();
  const role = useSettings((s) => s.currentUserRole);
  const branchId = useSettings((s) => s.selectedBranchId);
  const favoriteScope = `${role ?? "anon"}:${branchId ?? "none"}`;
  const [open, setOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    void loadMobileFavorites(favoriteScope).then(setFavorites);
  }, [favoriteScope]);

  const actions = useMemo(() => {
    return MOBILE_QUICK_CREATE_ACTIONS.filter((a) =>
      hasRoutePermission(role, a.permissionPath ?? a.to),
    );
  }, [role]);

  if (actions.length === 0) return null;

  async function onPick(action: MobileAction) {
    void hapticLight();
    setOpen(false);
    if (action.id === "qc-expense") {
      setExpenseOpen(true);
      return;
    }
    await navigate({
      to: action.to as "/people",
      search: action.search as Record<string, string> | undefined,
    });
  }

  async function onToggleFavorite(e: React.MouseEvent, actionId: string) {
    e.stopPropagation();
    e.preventDefault();
    void hapticLight();
    const next = await toggleMobileFavorite(favoriteScope, actionId);
    setFavorites(next);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Quick create"
        data-testid="mobile-quick-create-fab"
        className="mobile-quick-create-fab lg:hidden fixed z-[45] right-4 bottom-[calc(var(--mobile-nav-height,4.25rem)+env(safe-area-inset-bottom)+0.5rem)] h-14 w-14 rounded-full bg-gold text-black shadow-lg shadow-gold/30 grid place-items-center active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        onClick={() => {
          void hapticLight();
          setOpen(true);
        }}
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85dvh] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-2 text-left">
            <SheetTitle className="font-serif text-gold">Quick create</SheetTitle>
          </SheetHeader>
          <ul className="grid gap-1.5 pb-4">
            {actions.map((action) => {
              const Icon = action.icon;
              const pinned = favorites.includes(action.id);
              return (
                <li key={action.id}>
                  <div className="flex items-stretch gap-1">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-3 min-h-[var(--touch-target)] rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:border-gold/40 active:bg-muted/40"
                      onClick={() => void onPick(action)}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight">
                          {action.label}
                        </span>
                        {action.description ? (
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {action.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={pinned ? "Unpin favorite" : "Pin favorite"}
                      className="w-11 shrink-0 grid place-items-center rounded-xl border border-border text-muted-foreground hover:text-gold hover:border-gold/40"
                      onClick={(e) => void onToggleFavorite(e, action.id)}
                    >
                      <Star className={`h-4 w-4 ${pinned ? "fill-gold text-gold" : ""}`} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>

      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
    </>
  );
}
