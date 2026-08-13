import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useAutomationSettings,
  type AutomationEventKey,
} from "@/lib/comm/automation-settings-store";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/settings/automation")({
  head: () => ({ meta: [{ title: "Communication Automation · AVS Gold ERP" }] }),
  component: AutomationSettingsPage,
});

/**
 * Financial/gold reminders are intentionally called out here, not just
 * defaulted off in the store — a manager toggling this on is making a
 * deliberate decision to let the system chase money/gold automatically,
 * which is exactly the kind of thing that should never happen by silent
 * default (see automation-settings-store.ts's DEFAULT_RULES).
 */
const SENSITIVE_EVENTS: AutomationEventKey[] = ["gold_settlement_reminder", "outstanding_reminder"];

function AutomationSettingsPage() {
  const rules = useAutomationSettings((s) => s.rules);
  const reportRecipientEmail = useAutomationSettings((s) => s.reportRecipientEmail);
  const setRule = useAutomationSettings((s) => s.setRule);
  const setReportRecipientEmail = useAutomationSettings((s) => s.setReportRecipientEmail);
  const refresh = useAutomationSettings((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Communication Automation"
        subtitle="Every automated message is off by default. Turning one on here is a deliberate decision — nothing sends automatically until you enable it."
      />

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6 flex items-start gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <b>Financial &amp; gold reminders stay manual by default.</b> Enabling "Gold Settlement
          Reminder" or "Outstanding Balance Reminder" means the system will automatically message
          customers/karigars about money or gold they owe — confirm that's what you want before
          turning these on.
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Event</th>
                <th className="p-3">Channels</th>
                <th className="p-3 text-right">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const sensitive = SENSITIVE_EVENTS.includes(r.eventKey);
                return (
                  <tr key={r.eventKey} className="border-b border-border last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {r.label}
                        {sensitive && (
                          <Badge
                            variant="outline"
                            className="text-amber-500 border-amber-500/40 text-[10px]"
                          >
                            Financial/Gold
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.channels.map((c) =>
                        c === "email" ? (
                          <label
                            key={c}
                            className="inline-flex items-center gap-1 mr-3 cursor-pointer"
                            title="Email delivery requires a configured provider"
                          >
                            <input
                              type="checkbox"
                              checked={r.channels.includes(c)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...r.channels, c]
                                  : r.channels.filter((x) => x !== c);
                                setRule(r.eventKey, { channels: next });
                              }}
                            />
                            <span className="capitalize">email</span>
                          </label>
                        ) : (
                          <label
                            key={c}
                            className="inline-flex items-center gap-1 mr-3 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={r.channels.includes(c)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...r.channels, c]
                                  : r.channels.filter((x) => x !== c);
                                setRule(r.eventKey, { channels: next });
                              }}
                            />
                            <span className="capitalize">{c}</span>
                          </label>
                        ),
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(checked) => setRule(r.eventKey, { enabled: checked })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <Label className="mb-2 block">Business Report Recipient Email</Label>
        <div className="text-xs text-muted-foreground mb-2">
          Daily/weekly/monthly business summaries have no single "customer" to address — sent here
          instead. Delivery requires an active, server-configured email provider and remains opt-in.
        </div>
        <Input
          type="email"
          value={reportRecipientEmail}
          onChange={(e) => setReportRecipientEmail(e.target.value)}
          placeholder="owner@example.com"
          className="max-w-sm"
        />
      </div>
    </div>
  );
}
