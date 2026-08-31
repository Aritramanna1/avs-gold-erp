/**
 * Email & Automatic Communication Settings Panel
 * Comprehensive admin area for MTJ ERP Gold-First Communication Engine.
 */
import { useState } from "react";
import { useEmailConfigStore, type AutomaticEventKey } from "@/lib/comm/email-config-store";
import { useCommunicationAuditStore } from "@/lib/comm/communication-audit-store";
import { dispatchAutomaticBusinessEvent } from "@/lib/comm/automatic-communication-engine";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Zap,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Loader2,
  RotateCcw,
  Sparkles,
  Server,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

const EVENT_LABELS: Record<AutomaticEventKey, { title: string; desc: string }> = {
  invoice_created: {
    title: "Invoices Created / Finalized",
    desc: "Auto-send full Tax/Retail Invoice PDF with item weights, purity, fine gold, and payment breakdown.",
  },
  order_created: {
    title: "Order Confirmation",
    desc: "Auto-send Order Slip PDF with target purity, delivery date, and advance gold/cash credits.",
  },
  order_assigned: {
    title: "Job Assignment / Workshop Update",
    desc: "Notify when order transitions into workshop production.",
  },
  order_delayed: {
    title: "Order Delay / Apology",
    desc: "Auto-send apology notice explaining delay with revised estimated completion date and attached order slip.",
  },
  order_delivered: {
    title: "Order Delivered / Completed",
    desc: "Auto-send completion notice with attached delivery slip.",
  },
  payment_received: {
    title: "Payment & Cash Receipts",
    desc: "Auto-send Payment Receipt with transaction-time Gold Equivalent and remaining balance.",
  },
  gold_receipt: {
    title: "Gold & Metal Receipts",
    desc: "Auto-send Gold Deposit & Advance Slips with fine gold calculation.",
  },
  advance_receipt: {
    title: "Advance Receipts",
    desc: "Auto-send Advance Payment Slips against pending orders.",
  },
  settlement: {
    title: "Gold Settlements",
    desc: "Auto-send Gold Settlement Slips with rate-lock and balance adjustments.",
  },
  credit_note: {
    title: "Credit Notes",
    desc: "Auto-send Credit Note PDF with parent invoice reference and financial/gold balance adjustment.",
  },
  document_cancelled: {
    title: "Document Deletion / Cancellation",
    desc: "Auto-send official correction notice stating document has been cancelled/voided with audit trace ID.",
  },
  financial_report: {
    title: "Financial & Business Reports",
    desc: "Send requested P&L, Total Profit, and party ledger statements as high-fidelity PDF documents.",
  },
};

export function EmailAutomationSettingsPanel() {
  const config = useEmailConfigStore();
  const audit = useCommunicationAuditStore();
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [auditFilter, setAuditFilter] = useState<"all" | "sent" | "failed" | "skipped_no_email">("all");

  const filteredLogs = audit.entries.filter((entry) => {
    if (auditFilter === "all") return true;
    return entry.status === auditFilter;
  });

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid test recipient email address.");
      return;
    }
    setTesting(true);
    try {
      const result = await dispatchAutomaticBusinessEvent({
        eventKey: "invoice_created",
        recipient: {
          name: "Valued Test Client",
          email: testEmail,
        },
        documentNumber: "AVS/TEST/2026",
        variables: {
          invoiceNo: "AVS/TEST/2026",
          amount: "45,000.00",
          actionUrl: window.location.origin + "/billing",
        },
      });

      if (result.ok) {
        toast.success(`Test email dispatched successfully to ${testEmail}! Check your inbox.`);
      } else {
        toast.error(`Dispatch failed: ${result.error || "Unknown transport error"}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message || "Could not dispatch test email"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sender Configuration Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gold/10 text-gold">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">Email Dispatch Infrastructure (Primary Channel)</CardTitle>
                <CardDescription className="text-xs">
                  Configure sender identity mode. Email is the primary automated channel for all customer & business events.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
              <Zap className="h-3 w-3 mr-1" /> Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Option 1: AVS Company Email */}
            <div
              onClick={() => void config.setSenderMode("avs_company_email")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                config.senderMode === "avs_company_email"
                  ? "border-gold bg-gold/5 ring-1 ring-gold shadow-sm"
                  : "border-border hover:border-border/80 bg-card"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">AVS Company Email</span>
                    <Badge className="text-[10px] bg-gold/20 text-gold border-gold/30">Zero-Config Default</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sends via centrally managed AVS cloud mail infrastructure. Out-of-the-box reliability with high inbox deliverability.
                  </p>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    config.senderMode === "avs_company_email"
                      ? "border-gold bg-gold text-background"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {config.senderMode === "avs_company_email" && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                Sender: {config.avsSenderEmail}
              </div>
            </div>

            {/* Option 2: Custom Tenant Credentials */}
            <div
              onClick={() => void config.setSenderMode("tenant_credentials")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                config.senderMode === "tenant_credentials"
                  ? "border-gold bg-gold/5 ring-1 ring-gold shadow-sm"
                  : "border-border hover:border-border/80 bg-card"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Custom Tenant Credentials</span>
                    <Badge variant="outline" className="text-[10px]">Custom SMTP</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send from your own business domain using custom SMTP or Google Workspace. Passwords stored strictly server-side.
                  </p>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    config.senderMode === "tenant_credentials"
                      ? "border-gold bg-gold text-background"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {config.senderMode === "tenant_credentials" && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                Sender: {config.tenantSenderEmail || "Configure below in Custom SMTP"}
              </div>
            </div>
          </div>

          {/* Master Toggles */}
          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Automatic Email Dispatch</Label>
                <p className="text-xs text-muted-foreground">Dispatches emails automatically on business events when email exists.</p>
              </div>
              <Switch
                checked={config.autoEmailEnabled}
                onCheckedChange={(v) => void config.setAutoEmailEnabled(v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">High-Fidelity PDF Attachments</Label>
                <p className="text-xs text-muted-foreground">Attaches full A4/A5 PDF documents (never thermal slips).</p>
              </div>
              <Switch
                checked={config.attachFullDocumentPdf}
                onCheckedChange={(v) => void config.setAttachFullDocumentPdf(v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Automation Rules Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Event-Level Automation & Attachment Rules</CardTitle>
              <CardDescription className="text-xs">
                Select which events trigger automatic emails and document attachments.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {(Object.keys(EVENT_LABELS) as AutomaticEventKey[]).map((key) => {
              const info = EVENT_LABELS[key];
              const isEnabled = config.eventToggles[key] ?? true;
              return (
                <div
                  key={key}
                  className="flex items-start justify-between p-3 rounded-lg border border-border bg-card/50 hover:bg-secondary/10 transition-colors"
                >
                  <div className="space-y-1 pr-3">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-gold" />
                      {info.title}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{info.desc}</p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(v) => void config.setEventToggle(key, v)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Test Email Dispatcher Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Test Email Delivery</CardTitle>
              <CardDescription className="text-xs">
                Send a live sample document email with PDF attachment to verify inbox deliverability.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
            <Input
              type="email"
              placeholder="Enter test recipient email (e.g. owner@example.com)"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="text-xs h-9"
            />
            <Button
              onClick={() => void handleSendTest()}
              disabled={testing || !testEmail}
              className="text-xs h-9 gap-1.5 shrink-0"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Test Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Communication Delivery Outbox & Audit History */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">Delivery Outbox & Audit Trail</CardTitle>
                <CardDescription className="text-xs">
                  Real-time history of all automated and manual communication events and attachments.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-secondary rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setAuditFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition-all ${auditFilter === "all" ? "bg-background font-semibold shadow-xs" : "text-muted-foreground"}`}
                >
                  All ({audit.entries.length})
                </button>
                <button
                  onClick={() => setAuditFilter("sent")}
                  className={`px-2.5 py-1 rounded-md transition-all ${auditFilter === "sent" ? "bg-background font-semibold shadow-xs text-emerald-500" : "text-muted-foreground"}`}
                >
                  Sent ({audit.entries.filter((e) => e.status === "sent").length})
                </button>
                <button
                  onClick={() => setAuditFilter("skipped_no_email")}
                  className={`px-2.5 py-1 rounded-md transition-all ${auditFilter === "skipped_no_email" ? "bg-background font-semibold shadow-xs text-amber-500" : "text-muted-foreground"}`}
                >
                  No Email ({audit.entries.filter((e) => e.status === "skipped_no_email").length})
                </button>
                <button
                  onClick={() => setAuditFilter("failed")}
                  className={`px-2.5 py-1 rounded-md transition-all ${auditFilter === "failed" ? "bg-background font-semibold shadow-xs text-rose-500" : "text-muted-foreground"}`}
                >
                  Failed ({audit.entries.filter((e) => e.status === "failed").length})
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={() => void audit.refresh()} className="h-8 text-xs gap-1">
                <RotateCcw className="h-3 w-3" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              No communication events match the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2.5 font-medium">Timestamp</th>
                    <th className="p-2.5 font-medium">Event</th>
                    <th className="p-2.5 font-medium">Recipient</th>
                    <th className="p-2.5 font-medium">Document</th>
                    <th className="p-2.5 font-medium">Attachment</th>
                    <th className="p-2.5 font-medium">Provider</th>
                    <th className="p-2.5 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/10">
                      <td className="p-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-2.5 font-medium capitalize whitespace-nowrap">
                        {log.eventKey.replace(/_/g, " ")}
                      </td>
                      <td className="p-2.5">
                        <div className="font-medium text-foreground">{log.recipientName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {log.recipientEmail || <span className="text-amber-500 italic">No email on file</span>}
                        </div>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                        {log.documentNumber}
                      </td>
                      <td className="p-2.5">
                        {log.attachmentName ? (
                          <Badge variant="outline" className="text-[10px] bg-secondary/50 gap-1 font-mono">
                            <FileText className="h-2.5 w-2.5" />
                            {log.attachmentName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {log.provider === "avs_company_mail" ? "AVS Cloud Mail" : log.provider}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        {log.status === "sent" && (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Delivered
                          </Badge>
                        )}
                        {log.status === "skipped_no_email" && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
                            <AlertCircle className="h-2.5 w-2.5 mr-1" /> No Email (Skipped)
                          </Badge>
                        )}
                        {log.status === "failed" && (
                          <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px]">
                            <AlertCircle className="h-2.5 w-2.5 mr-1" /> Failed
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
