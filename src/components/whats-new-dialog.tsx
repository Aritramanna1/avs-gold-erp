import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getLatestWhatsNew } from "@/lib/whats-new";

const SEEN_KEY_PREFIX = "whats-new-seen-";

/** Shows the latest release's fixes/additions once per version, on first open after update. */
export function WhatsNewDialog() {
  const entry = getLatestWhatsNew();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!entry) return;
    const seenKey = `${SEEN_KEY_PREFIX}${entry.version}`;
    if (!window.localStorage.getItem(seenKey)) setOpen(true);
  }, [entry]);

  if (!entry) return null;

  const dismiss = () => {
    window.localStorage.setItem(`${SEEN_KEY_PREFIX}${entry.version}`, "shown");
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <AlertDialogContent className="border-gold/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" /> What&apos;s new · {entry.date}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-foreground">
              {entry.fixed && entry.fixed.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Fixed
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {entry.fixed.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {entry.added && entry.added.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Added
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {entry.added.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={dismiss}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
