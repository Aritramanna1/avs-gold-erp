/**
 * InviteToPortalDialog — create tenant+party scoped portal invitations and dispatch
 * via Email / WhatsApp (Communication Platform) / Copy link / Native share.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, Copy, Check, Send, Loader2, UserCheck, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-store";
import { useCommunicationPolicy } from "@/hooks/use-communication-policy";
import {
  createAndDispatchPortalInvite,
  defaultPortalTypeForPerson,
  isNativeShareAvailable,
  markInviteLinkCopied,
  type PortalTypeKey,
} from "@/lib/portal/portal-access-service";
import { celebrateCompletion, unlockFeedbackAudio } from "@/lib/native/feedback-sounds";

interface InviteToPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: {
    id: string;
    fullName: string;
    phone?: string;
    type?: string;
    email?: string;
  };
  onCreated?: () => void;
}

export function InviteToPortalDialog({
  open,
  onOpenChange,
  person,
  onCreated,
}: InviteToPortalDialogProps) {
  const { firm } = useSettings();
  const policy = useCommunicationPolicy();
  const [portalType, setPortalType] = useState<PortalTypeKey>(
    defaultPortalTypeForPerson(person.type),
  );
  const [email, setEmail] = useState(person.email || "");
  const [phone, setPhone] = useState(person.phone || "");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "link" | "native_share">("email");
  const [busy, setBusy] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [deliveryOk, setDeliveryOk] = useState<boolean | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(person.email || "");
      setPhone(person.phone || "");
      setPortalType(defaultPortalTypeForPerson(person.type));
      setGeneratedLink(null);
      setGeneratedCode(null);
      setInvitationId(null);
      setDeliveryNote(null);
      setDeliveryOk(null);
      setDeliveryError(null);
      setChannel(
        person.email
          ? "email"
          : isNativeShareAvailable()
            ? "native_share"
            : "link",
      );
    }
  }, [open, person.email, person.phone, person.type]);

  async function handleCreateInvitation() {
    await unlockFeedbackAudio();
    if (!email.trim() && !phone.trim()) {
      toast.error("Email or phone is required.");
      return;
    }
    setBusy(true);
    try {
      const result = await createAndDispatchPortalInvite({
        partyId: person.id,
        partyName: person.fullName,
        portalType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        channel,
        firmName: firm.shopName || "AVS ERP",
      });
      setGeneratedLink(result.inviteUrl);
      setGeneratedCode(result.invitation.code);
      setInvitationId(result.invitation.id);
      setDeliveryNote(result.deliveryMessage);
      setDeliveryOk(result.deliveryOk);
      setDeliveryError(result.invitation.delivery_error ?? null);
      if (result.deliveryOk) {
        toast.success(result.deliveryMessage);
        void celebrateCompletion({
          voiceMessage: "Done. Invitation sent successfully.",
          sound: "complete",
        });
      } else toast.warning(result.deliveryMessage);
      onCreated?.();
    } catch (ex: unknown) {
      toast.error(ex instanceof Error ? ex.message : "Failed to generate invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string, kind: "link" | "code") {
    await navigator.clipboard.writeText(text);
    if (kind === "link" && invitationId) await markInviteLinkCopied(invitationId);
    if (kind === "link") {
      setCopiedLink(true);
      toast.success("Invitation link copied.");
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      toast.success("Invitation code copied.");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-gold" />
            Invite to Portal · {person.fullName}
          </DialogTitle>
          <DialogDescription>
            Creates a secure, expiring, party-scoped invitation. After acceptance, this Party 360
            record remains authoritative — no duplicate customer is created.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Target Portal
              </Label>
              <Select
                value={portalType}
                onValueChange={(v) => setPortalType(v as PortalTypeKey)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_portal">
                    Customer Portal (Orders, invoices, documents)
                  </SelectItem>
                  <SelectItem value="karigar_portal">
                    Karigar Portal (Jobs, gold, returns, hisab)
                  </SelectItem>
                  <SelectItem value="supplier_portal">
                    Supplier Portal (POs, deliveries, statements)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Recipient Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Recipient Mobile
              </Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="91XXXXXXXXXX"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Send via
              </Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as typeof channel)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email invitation (default)</SelectItem>
                  <SelectItem value="whatsapp">
                    Share via WhatsApp{policy.whatsapp_api_enabled ? " (API)" : ""}
                  </SelectItem>
                  <SelectItem value="link">Copy invite link only</SelectItem>
                  {isNativeShareAvailable() && (
                    <SelectItem value="native_share">Share from this device</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {deliveryOk === false ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Email or WhatsApp delivery failed
                </p>
                <p className="text-xs text-muted-foreground">{deliveryNote}</p>
                {deliveryError ? (
                  <p className="text-xs font-mono text-destructive">{deliveryError}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Copy the link below and share it manually — the invitation is still valid.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{deliveryNote}</p>
            )}
            <p className="text-xs text-muted-foreground">Valid for 24 hours.</p>
            {generatedCode ? (
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">
                  Invitation code
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border bg-muted/40 p-3 font-mono text-sm font-semibold tracking-wide">
                    {generatedCode}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyToClipboard(generatedCode, "code")}
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Invitation link
              </Label>
              <div className="rounded-md border bg-muted/40 p-3 break-all text-xs font-mono">
                {generatedLink}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copyToClipboard(generatedLink, "link")}>
                {copiedLink ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                Copy Link
              </Button>
              {generatedCode ? (
                <Button size="sm" variant="outline" onClick={() => void copyToClipboard(generatedCode, "code")}>
                  {copiedCode ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  Copy Code
                </Button>
              ) : null}
              {isNativeShareAvailable() && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void shareContentFallback(generatedLink!, person.fullName, generatedCode)
                  }
                >
                  <Share2 className="h-3.5 w-3.5 mr-1" />
                  Share
                </Button>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!generatedLink ? (
            <Button onClick={() => void handleCreateInvitation()} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Invitation
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function shareContentFallback(url: string, name: string, code: string | null) {
  const { shareContent } = await import("@/lib/native/share");
  const codeLine = code ? ` Code: ${code}.` : "";
  await shareContent({
    title: `AVS ERP invitation for ${name}`,
    text: `Accept your AVS ERP portal invitation.${codeLine} Valid 24 hours.`,
    url,
  });
}
