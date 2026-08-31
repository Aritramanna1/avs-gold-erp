import { useEffect, useState } from "react";
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
import { Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { isValidWaPhone } from "@/lib/wa-link";
import { sendWhatsAppText } from "@/lib/comm/send-whatsapp-text";

export function ReminderDialog({
  open,
  onClose,
  customerMessage,
  karigarMessage,
  customerPhone,
  karigarPhone,
}: {
  open: boolean;
  onClose: () => void;
  customerMessage: string;
  karigarMessage?: string;
  /** Enables the "Send on WhatsApp" action. Without it, only copy-to-clipboard is offered. */
  customerPhone?: string;
  karigarPhone?: string;
}) {
  const [cm, setCm] = useState(customerMessage);
  const [km, setKm] = useState(karigarMessage ?? "");
  const [done, setDone] = useState<string | null>(null);

  // This dialog stays mounted across opens (its parent renders it
  // unconditionally, toggling only `open`), so cm/km's useState initializer
  // only ever ran once — every subsequent order's reminder kept showing the
  // first order's message. Re-sync from props each time it opens.
  useEffect(() => {
    if (open) {
      setCm(customerMessage);
      setKm(karigarMessage ?? "");
    }
  }, [open, customerMessage, karigarMessage]);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setDone(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setDone(null), 1500);
  }

  /**
   * Sends the message the user is looking at — including any edit they just
   * made in the textarea, not the original draft.
   *
   * Goes through the configured WhatsApp provider rather than opening a wa.me
   * link directly, so switching this install to OpenWA changes nothing here.
   * Today that provider is the deep link: the user's own WhatsApp opens with
   * the text pre-filled and they press send.
   */
  async function sendOnWhatsApp(phone: string, text: string) {
    const result = await sendWhatsAppText({ phone, message: text, linkedType: "order" });
    if (!result.ok) {
      toast.error(result.error ?? "Could not send the WhatsApp message.");
      return;
    }
    // Deep link = opened, not sent. Saying "sent" here would be a lie the
    // workshop acts on.
    if (result.via !== "whatsapp_deep_link") toast.success("WhatsApp message sent.");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reminder Message Drafts</DialogTitle>
          <DialogDescription>
            Send straight to WhatsApp, or copy and paste it yourself. No paid API — the message
            opens in your own WhatsApp, ready to send.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Customer message
            </div>
            <Textarea value={cm} onChange={(e) => setCm(e.target.value)} rows={4} />
            <div className="flex flex-wrap gap-2 mt-2">
              {isValidWaPhone(customerPhone) && (
                <Button
                  size="sm"
                  className="gap-1 bg-[#25D366] hover:bg-[#20bf5a] text-white"
                  onClick={() => void sendOnWhatsApp(customerPhone!, cm)}
                >
                  <MessageCircle className="h-3 w-3" /> Send on WhatsApp
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(cm, "cm")}>
                {done === "cm" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
              </Button>
            </div>
          </div>
          {karigarMessage !== undefined && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Karigar message
              </div>
              <Textarea value={km} onChange={(e) => setKm(e.target.value)} rows={4} />
              <div className="flex flex-wrap gap-2 mt-2">
                {isValidWaPhone(karigarPhone) && (
                  <Button
                    size="sm"
                    className="gap-1 bg-[#25D366] hover:bg-[#20bf5a] text-white"
                    onClick={() => void sendOnWhatsApp(karigarPhone!, km)}
                  >
                    <MessageCircle className="h-3 w-3" /> Send on WhatsApp
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => copy(km, "km")}
                >
                  {done === "km" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{" "}
                  Copy
                </Button>
              </div>
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
