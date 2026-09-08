import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { dispatchKeyboardAction, KEYBOARD_EVENTS } from "@/lib/keyboard/keyboard-events";
import { hapticLight } from "@/lib/native/haptics";

/** Opens QuickCommandPalette via the same event bus as Ctrl+K. */
export function MobileSearchButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Search"
      data-testid="mobile-global-search"
      className={cn(
        "h-9 w-9 grid place-items-center rounded-full border border-border bg-background text-muted-foreground hover:border-gold/40 hover:text-gold transition-colors md:hidden",
        className,
      )}
      onClick={() => {
        void hapticLight();
        dispatchKeyboardAction(KEYBOARD_EVENTS.COMMAND_PALETTE);
      }}
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
