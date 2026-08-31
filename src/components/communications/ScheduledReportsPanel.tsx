/**
 * Scheduled report deliveries — email default channel.
 */
import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
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
import { Switch } from "@/components/ui/switch";
import {
  fetchScheduledReports,
  upsertScheduledReport,
  deleteScheduledReport,
  REPORT_PRESETS,
  type ScheduledReportDelivery,
} from "@/lib/comm/platform/scheduled-report-store";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ScheduledReportsPanel({ branchId }: { branchId: string }) {
  const [reports, setReports] = useState<ScheduledReportDelivery[]>([]);
  const [email, setEmail] = useState("");
  const [preset, setPreset] = useState(REPORT_PRESETS[0].key);

  const load = async () => {
    setReports(await fetchScheduledReports());
  };

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd() {
    if (!email.includes("@")) {
      toast.error("Valid email required");
      return;
    }
    const p = REPORT_PRESETS.find((r) => r.key === preset) ?? REPORT_PRESETS[0];
    const row = await upsertScheduledReport({
      reportKey: p.key,
      reportName: p.name,
      scheduleCron: p.cron,
      recipients: [{ name: "Management", email }],
      channel: "email",
      branchId,
    });
    if (row) {
      toast.success("Scheduled report added");
      setEmail("");
      await load();
    } else toast.error("Failed to add schedule");
  }

  return (
    <Panel
      title="Scheduled Reports"
      description="Automatic report delivery. Email is the default low-cost channel."
    >
      <div className="space-y-4 max-w-xl">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Report</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_PRESETS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Recipient Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ceo@firm.com"
            />
          </div>
        </div>
        <Button size="sm" onClick={() => void handleAdd()}>
          <Plus className="h-3.5 w-3.5" /> Add Schedule
        </Button>
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border border-border rounded-sm p-2 text-xs"
            >
              <div>
                <p className="font-medium">{r.reportName}</p>
                <p className="text-muted-foreground">
                  {r.scheduleCron} · {r.channel} · {r.recipients[0]?.email ?? "—"}
                </p>
                {r.lastRunAt && (
                  <p className="text-[10px] text-muted-foreground">
                    Last: {new Date(r.lastRunAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void deleteScheduledReport(r.id).then(load)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="text-xs text-muted-foreground">No scheduled reports configured.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
