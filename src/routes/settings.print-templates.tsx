import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_TEMPLATES } from "@/lib/print-engine/default-templates";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import type { PrintSize, SectionConfig } from "@/lib/print-engine/types";
import { PRINT_DOC_LABELS, type PrintDocType } from "@/lib/printlog-store";

export const Route = createFileRoute("/settings/print-templates")({
  head: () => ({ meta: [{ title: "Print Templates - AVS Gold ERP" }] }),
  component: PrintTemplatesPage,
});

const PAPER_SIZES: PrintSize[] = ["a4", "a5", "a6", "thermal", "thermal58", "tag"];

function templateKey(docType: PrintDocType, paperSize: PrintSize) {
  return `${docType}::${paperSize}`;
}

function PrintTemplatesPage() {
  const templates = usePrintTemplates((s) => s.templates);
  const refresh = usePrintTemplates((s) => s.refresh);
  const getForDocType = usePrintTemplates((s) => s.getForDocType);
  const update = usePrintTemplates((s) => s.update);
  const resetToDefault = usePrintTemplates((s) => s.resetToDefault);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allDocTypes = Object.keys(PRINT_DOC_LABELS) as PrintDocType[];
  const configuredDocTypes = Object.keys(DEFAULT_TEMPLATES) as PrintDocType[];
  const configuredSet = new Set(configuredDocTypes);
  const configuredTemplates = configuredDocTypes.flatMap(
    (docType) => DEFAULT_TEMPLATES[docType] ?? [],
  );

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editingMeta = useMemo(() => {
    if (!editingKey) return null;
    const [docType, paperSize] = editingKey.split("::") as [PrintDocType, PrintSize];
    return { docType, paperSize };
  }, [editingKey]);
  const editing = editingMeta ? getForDocType(editingMeta.docType, editingMeta.paperSize) : null;

  const [name, setName] = useState("");
  const [paperSize, setPaperSize] = useState<PrintSize>("a4");
  const [sectionsJson, setSectionsJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setPaperSize(editing.paperSize);
    setSectionsJson(JSON.stringify(editing.sections, null, 2));
    setJsonError(null);
  }, [editing]);

  const handleSave = async () => {
    if (!editing) return;
    let sections: SectionConfig[];
    try {
      sections = JSON.parse(sectionsJson);
      if (!Array.isArray(sections)) throw new Error("Sections must be a JSON array.");
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON.");
      return;
    }
    await update(editing.id, { name, paperSize, sections });
    toast.success(`Saved "${name}" - version ${editing.version + 1}.`);
    setEditingKey(null);
  };

  const handleReset = async (docType: PrintDocType, size: PrintSize) => {
    await resetToDefault(docType, size);
    toast.success("Reset to the shipped default.");
  };

  const historyEntries = useMemo(() => editing?.versions ?? [], [editing]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/settings">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Settings
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Print Templates"
        subtitle="Manufacturing-first print control for templates, paper sizes, PDF output, reprint audit, QR verification, and WhatsApp document reuse."
      />

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <Metric
          label="Engine Coverage"
          value={`${configuredDocTypes.length}/${allDocTypes.length}`}
          note="document families have live templates"
        />
        <Metric
          label="Template Variants"
          value={String(configuredTemplates.length)}
          note="A4, A5, thermal, and tag layouts"
        />
        <Metric
          label="Customized"
          value={String(templates.length)}
          note="local overrides with version history"
        />
        <Metric label="Shared Output" value="PDF" note="preview, download, WhatsApp reuse" />
      </div>

      <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4 text-sm text-muted-foreground">
        Live manufacturing documents include daily material slips, worker custody statements, job
        cards, customer ledgers, invoices, delivery challans, estimates, credit notes, debit notes,
        and order slips. Remaining legacy families are listed below so QA can track migration.
      </div>

      <div className="rounded-xl border border-border divide-y divide-border bg-card">
        {configuredTemplates.map((defaultTemplate) => {
          const t = getForDocType(defaultTemplate.docType, defaultTemplate.paperSize);
          const overridden = templates.some(
            (x) => x.docType === t.docType && x.paperSize === t.paperSize,
          );
          return (
            <div key={defaultTemplate.id} className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{PRINT_DOC_LABELS[t.docType]}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {t.paperSize.toUpperCase()}
                  </Badge>
                  {overridden && (
                    <Badge className="text-[10px] bg-gold/20 text-gold border-gold/30">
                      customized - v{t.version}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.name} - {t.sections.length} sections
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {overridden && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => handleReset(t.docType, t.paperSize)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => setEditingKey(templateKey(t.docType, t.paperSize))}
                >
                  Edit
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Legacy / Specialized Print Families</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These registered document types still need Universal Print Engine templates or are handled
          by specialized hardware paths. They remain visible here for QA instead of being hidden.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {allDocTypes
            .filter((docType) => !configuredSet.has(docType))
            .map((docType) => (
              <Badge key={docType} variant="outline" className="text-[10px]">
                {PRINT_DOC_LABELS[docType]}
              </Badge>
            ))}
        </div>
      </div>

      <Dialog open={!!editingKey} onOpenChange={(o) => !o && setEditingKey(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? PRINT_DOC_LABELS[editing.docType] : ""} Template</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paper Size</Label>
                  <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PrintSize)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAPER_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Sections (JSON - order, visibility, fields, columns; see types.ts)
                </Label>
                <Textarea
                  value={sectionsJson}
                  onChange={(e) => setSectionsJson(e.target.value)}
                  className="font-mono text-xs h-64"
                  spellCheck={false}
                />
                {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
              </div>

              {historyEntries.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <History className="h-3.5 w-3.5" /> Version history
                  </Label>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {historyEntries.map((v) => (
                      <div
                        key={v.version}
                        className="flex items-center justify-between text-xs border border-border rounded px-2 py-1"
                      >
                        <span>
                          v{v.version} - {new Date(v.savedAt).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingKey(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-2xl text-gold">{value}</div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
