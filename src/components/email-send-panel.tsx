/**
 * MTJ ERP — Shared Email Send Panel (Fully Automated with API integration).
 *
 * Renders template selector + recipient email selector + live preview + action
 * buttons. Every action records a CommEvent on the linked record.
 */
import { useMemo, useState } from "react";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWaTemplates, TEMPLATE_KIND_LABELS, type TemplateKind } from "@/lib/wa-templates-store";
import { buildContext, renderTemplate, type BuildCtxArgs } from "@/lib/wa-placeholders";
import { useCommLog, type CommLinkedType } from "@/lib/comm-log-store";
import { toast } from "sonner";
import { Mail, Copy, Eye, Send, Sparkles } from "lucide-react";
import { sendGenericEmail } from "@/lib/email-service";

export interface RecipientOption {
  label: string; // "Priya Sharma"
  role: string; // "Customer", "Karigar", "Firm"
  email: string; // email address
}

export interface EmailSendPanelProps {
  /** Template kinds that make sense in this context (filtered list). */
  templateKinds: TemplateKind[];
  /** Recipients pre-loaded from the underlying record. */
  recipients: RecipientOption[];
  /** Placeholder lookup keys for renderer. */
  context: BuildCtxArgs;
  /** Where this comm is attached for the comm log. */
  linkedType: CommLinkedType;
  linkedId: string;
  /** Optional default template id (e.g. share-to-karigar quick-action). */
  defaultTemplateKind?: TemplateKind;
  defaultRecipientEmail?: string;
  /** Section title, optional. */
  title?: string;
}

export function EmailSendPanel(props: EmailSendPanelProps) {
  const templates = useWaTemplates((s) => s.templates);
  const record = useCommLog((s) => s.record);

  const available = useMemo(
    () => templates.filter((t) => t.active && props.templateKinds.includes(t.kind)),
    [templates, props.templateKinds],
  );

  const validRecipients = props.recipients.filter((r) => r.email && r.email.trim().includes("@"));

  const [tplId, setTplId] = useState<string>(() => {
    if (props.defaultTemplateKind) {
      const m = available.find((t) => t.kind === props.defaultTemplateKind);
      if (m) return m.id;
    }
    return available[0]?.id ?? "";
  });

  const [recEmail, setRecEmail] = useState<string>(() => {
    if (props.defaultRecipientEmail) {
      const m = validRecipients.find(
        (r) => r.email.toLowerCase() === props.defaultRecipientEmail?.toLowerCase(),
      );
      if (m) return m.email;
    }
    return validRecipients[0]?.email ?? "";
  });

  const [subject, setSubject] = useState<string>(() => {
    return useSettings.getState().firm.shopName || "ERP Notification";
  });

  const [sending, setSending] = useState(false);

  const tpl = available.find((t) => t.id === tplId);
  const recipient = validRecipients.find((r) => r.email === recEmail);

  const message = useMemo(() => {
    if (!tpl) return "";
    return renderTemplate(tpl.body, buildContext(props.context));
  }, [tpl, props.context]);

  function logEvent(kind: "prepared" | "copied" | "manually_sent") {
    if (!tpl || !recipient) return;
    record({
      kind,
      templateKind: tpl.kind,
      templateName: tpl.name,
      target: tpl.target,
      recipientLabel: `${recipient.label} (${recipient.role})`,
      recipientPhone: recipient.email, // using email as identifier in log
      linkedType: props.linkedType,
      linkedId: props.linkedId,
      body: message,
    });
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      logEvent("copied");
      toast.success("Message content copied to clipboard!");
    } catch {
      toast.error("Copy failed");
    }
  };

  const onSendEmail = async () => {
    if (!recipient) return;
    setSending(true);

    try {
      const result = await sendGenericEmail({
        to: recipient.email,
        subject,
        htmlBody: `<pre style="font-family:sans-serif;white-space:pre-wrap">${message}</pre>`,
        textBody: message,
      });
      if (result.success) {
        logEvent("manually_sent");
        toast.success(`Email sent to ${recipient.email}`);
      } else {
        toast.error(result.error || "Email delivery failed — check SMTP settings.");
      }
    } catch (err: any) {
      console.warn("Email send error:", err);
      toast.error("Email send error: " + (err.message || err));
    } finally {
      setSending(false);
    }
  };

  if (available.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">
        No active templates for this context. Add or activate one in{" "}
        <a className="text-gold underline" href="/settings">
          Settings → Email & Templates
        </a>
        .
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="h-4 w-4 text-gold" />
        <h3 className="font-serif text-lg text-gold">{props.title ?? "Send Automated Email"}</h3>
        <Badge
          variant="outline"
          className="text-[10px] ml-auto bg-green-500/10 text-green-400 border-green-500/20"
        >
          Automated API
        </Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Template Kind
          </Label>
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger>
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {available.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {TEMPLATE_KIND_LABELS[t.kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Recipient Email
          </Label>
          {validRecipients.length === 0 ? (
            <Input
              placeholder="e.g. customer@example.com"
              value={recEmail}
              onChange={(e) => setRecEmail(e.target.value)}
              className="text-xs"
            />
          ) : (
            <Select value={recEmail} onValueChange={setRecEmail}>
              <SelectTrigger>
                <SelectValue placeholder="Select Recipient" />
              </SelectTrigger>
              <SelectContent>
                {validRecipients.map((r) => (
                  <SelectItem key={r.email + r.role} value={r.email}>
                    {r.label} ({r.role}) — {r.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="mb-3">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Subject Line
        </Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email Subject"
          className="text-xs"
        />
      </div>

      <div className="mt-3">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Eye className="h-3 w-3" /> Live Email Body Preview
        </Label>
        <Textarea readOnly value={message} className="font-mono text-xs min-h-[140px]" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={onCopy} disabled={!recEmail}>
          <Copy className="h-3 w-3" /> Copy Text
        </Button>
        <Button
          size="sm"
          className="gap-1 ml-auto bg-gold hover:bg-gold-600 text-slate-950 font-semibold"
          onClick={onSendEmail}
          disabled={!recEmail || sending}
        >
          <Send className="h-3 w-3" /> {sending ? "Dispatching..." : "Send Automated Email"}
        </Button>
      </div>
      {!recEmail && (
        <p className="text-xs text-amber-400 mt-2">
          Add a valid email on the linked record to enable direct automated dispatch.
        </p>
      )}
    </div>
  );
}
