import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { DEFAULT_TEMPLATES } from "@/lib/print-engine/default-templates";
import { PRINT_DOC_LABELS, type PrintDocType } from "@/lib/printlog-store";
import type { PrintSize, SectionConfig } from "@/lib/print-engine/types";

export const Route = createFileRoute("/settings/print-templates")({
  head: () => ({ meta: [{ title: "Print Templates · AVS Gold ERP" }] }),
  component: PrintTemplatesPage,
});

const PAPER_SIZES: PrintSize[] = ["a4", "a5", "a6", "thermal", "thermal58", "tag"];

function PrintTemplatesPage() {
  const templates = usePrintTemplates((s) => s.templates);
  const refresh = usePrintTemplates((s) => s.refresh);
  const getForDocType = usePrintTemplates((s) => s.getForDocType);
  const update = usePrintTemplates((s) => s.update);
  const resetToDefault = usePrintTemplates((s) => s.resetToDefault);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const configuredDocTypes = Object.keys(DEFAULT_TEMPLATES) as PrintDocType[];
  const [editingDocType, setEditingDocType] = useState<PrintDocType | null>(null);
  const editing = editingDocType ? getForDocType(editingDocType) : null;
  const isOverridden = editingDocType ? templates.some((t) => t.docType === editingDocType) : false;

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
    toast.success(`Saved "${name}" — version ${editing.version + 1}.`);
    setEditingDocType(null);
  };

  const handleReset = async (docType: PrintDocType) => {
    await resetToDefault(docType);
    toast.success("Reset to the shipped default.");
  };

  const historyEntries = useMemo(() => editing?.versions ?? [], [editing]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/settings">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Settings
          </Button>
        </Link>
      </div>
      <PageHeader
        title="Print Templates"
        subtitle="Customize document layout — header, sections, paper size — as data, without changing app code. Part of the Unified Print Engine (Phase 0: not yet wired to any live document)."
      />

      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 mb-4 text-sm text-muted-foreground">
        Only doc types with a seeded default are listed here in Phase 0 (
        {configuredDocTypes.map((d) => PRINT_DOC_LABELS[d]).join(", ")}). The remaining doc types
        gain a template as each is migrated onto the new engine.
      </div>

      <div className="rounded-xl border border-border divide-y divide-border">
        {configuredDocTypes.map((docType) => {
          const t = getForDocType(docType);
          const overridden = templates.some((x) => x.docType === docType);
          return (
            <div key={docType} className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{PRINT_DOC_LABELS[docType]}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {t.paperSize.toUpperCase()}
                  </Badge>
                  {overridden && (
                    <Badge className="text-[10px] bg-gold/20 text-gold border-gold/30">
                      customized · v{t.version}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.name} · {t.sections.length} sections
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {overridden && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => handleReset(docType)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                )}
                <Button size="sm" className="text-xs" onClick={() => setEditingDocType(docType)}>
                  Edit
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editingDocType} onOpenChange={(o) => !o && setEditingDocType(null)}>
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
                  Sections (JSON — order, visibility, fields, columns; see types.ts)
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
                          v{v.version} · {new Date(v.savedAt).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingDocType(null)}>
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
