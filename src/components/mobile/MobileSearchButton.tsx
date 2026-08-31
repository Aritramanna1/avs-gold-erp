import { Search } from "lucide-react";
import { dispatchKeyboardAction, KEYBOARD_EVENTS } from "@/lib/keyboard/keyboard-events";
import { hapticLight } from "@/lib/native/haptics";

/** Opens GlobalCommandPalette via the same event bus as Ctrl+K. */
export function MobileSearchButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Search"
      data-testid="mobile-global-search"
      className={
        className ??
        "h-9 w-9 grid place-items-center rounded-full border border-border bg-background text-muted-foreground hover:border-gold/40 hover:text-gold transition-colors lg:hidden"
      }
      onClick={() => {
        void hapticLight();
        dispatchKeyboardAction(KEYBOARD_EVENTS.COMMAND_PALETTE);
      }}
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
