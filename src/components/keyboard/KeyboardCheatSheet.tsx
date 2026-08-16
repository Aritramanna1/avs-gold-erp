import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { useShortcutsStore } from "@/lib/shortcuts-store";
import { KEYBOARD_EVENTS } from "@/lib/keyboard/keyboard-events";

export function KeyboardCheatSheet() {
  const [open, setOpen] = useState(false);
  const shortcuts = useShortcutsStore((s) => s.shortcuts);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(KEYBOARD_EVENTS.CHEAT_SHEET, onOpen);
    return () => window.removeEventListener(KEYBOARD_EVENTS.CHEAT_SHEET, onOpen);
  }, []);

  const grouped = shortcuts.reduce<Record<string, typeof shortcuts>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Desktop power-user shortcuts. Customize in{" "}
            <Link
              to="/control/shortcuts"
              className="text-gold underline"
              onClick={() => setOpen(false)}
            >
              Keyboard &amp; Shortcuts
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {category}
              </h3>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3">
                    <span className="text-foreground">{s.name}</span>
                    <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {s.customKeys || s.defaultKeys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
            Billing module also supports F2–F10 in invoice screens. Press{" "}
            <kbd className="rounded border px-1 font-mono">Ctrl+K</kbd> for global search.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
