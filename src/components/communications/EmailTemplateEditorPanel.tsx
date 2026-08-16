/**
 * Email template editor — preview, test, draft, publish, rollback.
 */
import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchEmailTemplates,
  seedSystemEmailTemplatesIfEmpty,
  publishEmailTemplateDraft,
  rollbackEmailTemplate,
  previewTemplate,
  sendTestEmail,
  type EmailTemplateRecord,
} from "@/lib/comm/platform/email-template-library-store";
import { useSettings } from "@/lib/settings-store";
import { Eye, Send, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function EmailTemplateEditorPanel({ branchId }: { branchId: string }) {
  const { firm } = useSettings();
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = templates.find((t) => t.id === selectedId);

  const load = async () => {
    await seedSystemEmailTemplatesIfEmpty();
    const list = await fetchEmailTemplates();
    setTemplates(list);
    if (!selectedId && list[0]) {
      setSelectedId(list[0].id);
      setSubject(list[0].subjectTemplate);
      setHtml(list[0].htmlTemplate);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selected) {
      setSubject(selected.subjectTemplate);
      setHtml(selected.htmlTemplate);
    }
  }, [selectedId, selected?.id]);

  const preview = previewTemplate(subject, html, {
    recipientName: "Sample Customer",
    recipientEmail: testEmail || "customer@example.com",
    firmName: firm.shopName || "AVS",
    productName: "Ornexa",
    actionUrl: "https://example.com/doc",
    documentNumber: "INV-001",
    amountFormatted: "₹ 12,500",
  });

  async function handlePublish() {
    if (!selectedId) return;
    setBusy(true);
    const ok = await publishEmailTemplateDraft({
      id: selectedId,
      subjectTemplate: subject,
      htmlTemplate: html,
    });
    toast[ok ? "success" : "error"](ok ? "Template published" : "Publish failed");
    await load();
    setBusy(false);
  }

  async function handleTest() {
    if (!testEmail) {
      toast.error("Enter test email");
      return;
    }
    setBusy(true);
    const res = await sendTestEmail(testEmail, preview.subject, preview.html, branchId);
    toast[res.success ? "success" : "error"](
      res.success ? "Test email sent" : (res.error ?? "Failed"),
    );
    setBusy(false);
  }

  async function handleRollback() {
    if (!selected || selected.version <= 1) return;
    setBusy(true);
    const ok = await rollbackEmailTemplate(selected.id, selected.version - 1);
    toast[ok ? "success" : "error"](ok ? "Rolled back" : "Rollback failed");
    await load();
    setBusy(false);
  }

  return (
    <Panel
      title="Email Templates"
      description="Preview, test, publish and version professional AVS email templates."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} (v{t.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">HTML Body</Label>
            <Textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Test recipient</Label>
            <Input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void handleTest()} disabled={busy}>
              <Send className="h-3.5 w-3.5" /> Test
            </Button>
            <Button size="sm" onClick={() => void handlePublish()} disabled={busy}>
              <Save className="h-3.5 w-3.5" /> Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRollback()}
              disabled={busy || !selected || selected.version <= 1}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Rollback
            </Button>
          </div>
        </div>
        <div className="rounded-sm border border-border p-3">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Preview
          </div>
          <p className="text-xs font-medium mb-2">{preview.subject}</p>
          <div className="prose prose-sm max-w-none text-xs border border-border rounded-sm p-3 bg-muted/10 overflow-auto max-h-96">
            <div dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
