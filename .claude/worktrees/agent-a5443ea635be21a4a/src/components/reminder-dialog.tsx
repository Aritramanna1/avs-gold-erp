import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function ReminderDialog({
  open,
  onClose,
  customerMessage,
  karigarMessage,
}: {
  open: boolean;
  onClose: () => void;
  customerMessage: string;
  karigarMessage?: string;
}) {
  const [cm, setCm] = useState(customerMessage);
  const [km, setKm] = useState(karigarMessage ?? "");
  const [done, setDone] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setDone(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setDone(null), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reminder Message Drafts</DialogTitle>
          <DialogDescription>
            Copy to clipboard and paste into WhatsApp. No paid API — manual paste only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Customer message
            </div>
            <Textarea value={cm} onChange={(e) => setCm(e.target.value)} rows={4} />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1"
              onClick={() => copy(cm, "cm")}
            >
              {done === "cm" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
              Customer Message
            </Button>
          </div>
          {karigarMessage !== undefined && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Karigar message
              </div>
              <Textarea value={km} onChange={(e) => setKm(e.target.value)} rows={4} />
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1"
                onClick={() => copy(km, "km")}
              >
                {done === "km" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
                Karigar Message
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
