/**
 * InviteToPortalDialog Component
 *
 * Allows authorized staff to generate and dispatch secure, single-use
 * portal invitations for Customers, Karigars, and Suppliers from Party 360.
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Mail, Phone, Copy, Check, Send, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { notifyPortalInvitation } from "@/lib/comm/platform";
import { useSettings } from "@/lib/settings-store";

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
}

export function InviteToPortalDialog({ open, onOpenChange, person }: InviteToPortalDialogProps) {
  const { firm } = useSettings();
  const defaultPortal =
    person.type === "karigar" || person.type === "worker"
      ? "karigar_portal"
      : person.type === "vendor" || person.type === "outside_worker"
        ? "supplier_portal"
        : "customer_portal";

  const [portalType, setPortalType] = useState<string>(defaultPortal);
  const [email, setEmail] = useState(person.email || "");
  const [phone, setPhone] = useState(person.phone || "");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "link">("email");

  const [busy, setBusy] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(person.email || "");
      setPhone(person.phone || "");
      setGeneratedLink(null);
    }
  }, [open, person.email, person.phone]);

  function makeInviteCode(): string {
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
        : Math.random().toString(36).substring(2, 14).toUpperCase();
    return `INV-${rand}`;
  }

  async function handleCreateInvitation() {
    if (!email.trim() && !phone.trim()) {
      toast.error("Email or phone is required.");
      return;
    }
    setBusy(true);
    try {
      const inviteCode = makeInviteCode();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("portal_invitations" as never).insert([
        {
          party_id: person.id,
          portal_type: portalType,
          recipient_email: email.trim() || null,
          recipient_phone: phone.trim() || null,
          code: inviteCode,
          status: "SENT",
          expires_at: expiresAt,
          metadata: {
            person_name: person.fullName,
            channel,
          },
        } as never,
      ]);

      if (error) {
        toast.error(error.message || "Failed to save invitation.");
        return;
      }

      const contact = email.trim() || phone.trim();
      const baseUrl = window.location.origin;
      const directUrl = `${baseUrl}/invite/accept?code=${inviteCode}&email=${encodeURIComponent(contact)}`;
      setGeneratedLink(directUrl);

      if (channel === "email" && email) {
        const portalMap: Record<string, "customer" | "karigar" | "supplier" | "internal"> = {
          customer_portal: "customer",
          karigar_portal: "karigar",
          supplier_portal: "supplier",
          internal_portal: "internal",
        };
        const portal = portalMap[portalType] ?? "customer";
        const result = await notifyPortalInvitation({
          portal,
          recipient: { name: person.fullName, email: email.trim(), partyId: person.id },
          actionUrl: directUrl,
          firmName: firm.shopName || "AVS",
        });
        if (result.success) {
          toast.success(`Invitation email queued for ${email}`);
        } else {
          toast.warning(`Invitation created but email failed: ${result.errors[0] ?? "unknown"}`);
        }
      } else if (channel === "whatsapp" && phone) {
        const text = encodeURIComponent(
          `Hello ${person.fullName}, you have been invited to access the AVS Gold ERP Portal. Click here to set up your password: ${directUrl}`,
        );
        window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${text}`, "_blank");
        toast.success("Opened WhatsApp with invitation message");
      } else {
        toast.success("Invitation link generated successfully!");
      }
    } catch (ex: any) {
      toast.error(ex.message || "Failed to generate invitation.");
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Invitation link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
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
            Generate a secure, single-use onboarding link for this party to set their password and
            access their self-service portal.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Target Portal
              </Label>
              <Select value={portalType} onValueChange={setPortalType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_portal">
                    Customer Portal (Orders, CAD Approvals, Invoices)
                  </SelectItem>
                  <SelectItem value="karigar_portal">
                    Karigar Portal (Bench Jobs, Gold Balance, Returns)
                  </SelectItem>
                  <SelectItem value="supplier_portal">
                    Supplier Portal (POs, Deliveries, Vendor Bills)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Recipient Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Mobile Phone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Delivery Channel
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={channel === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel("email")}
                  className="text-xs"
                >
                  Email
                </Button>
                <Button
                  type="button"
                  variant={channel === "whatsapp" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel("whatsapp")}
                  className="text-xs"
                >
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant={channel === "link" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel("link")}
                  className="text-xs"
                >
                  Copy Link
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Check className="h-4 w-4" />
                Invitation Generated!
              </div>
              <p className="text-muted-foreground">
                Share this secure link with <strong>{person.fullName}</strong>. The link expires in
                72 hours.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Input value={generatedLink} readOnly className="text-xs font-mono bg-background" />
                <Button
                  type="button"
                  size="sm"
                  onClick={copyToClipboard}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!generatedLink ? (
            <Button
              type="button"
              onClick={handleCreateInvitation}
              disabled={busy || (!email && !phone)}
              className="gap-2 bg-gold hover:bg-gold-dark text-black font-semibold"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Dispatch Invitation
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratedLink(null);
              }}
            >
              Create Another Link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
