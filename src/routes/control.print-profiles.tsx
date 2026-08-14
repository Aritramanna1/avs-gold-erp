/**
 * Canonical Route: /control/print-profiles
 * Universal Document Engine & Millimeter-Calibrated Print Profiles
 * Master Reference: docs/MASTER/DOCUMENT_TEMPLATE_ENGINE.md & PRINT_PROFILE_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { useEffect, useMemo, useState } from "react";
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
import { Printer, RotateCcw, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/control/print-profiles")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Print Profiles & Templates · Ornexa ERP" }] }),
  component: ControlPrintProfilesPage,
});

const PAPER_SIZES: PrintSize[] = ["a4", "a5", "a6", "thermal", "thermal58", "tag"];

function ControlPrintProfilesPage() {
  const templates = usePrintTemplates((s) => s.templates);
  const refresh = usePrintTemplates((s) => s.refresh);
  const getForDocType = usePrintTemplates((s) => s.getForDocType);
  const update = usePrintTemplates((s) => s.update);
  const resetToDefault = usePrintTemplates((s) => s.resetToDefault);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const configuredDocTypes = Object.keys(DEFAULT_TEMPLATES) as PrintDocType[];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Universal Document Engine & Print Profiles"
        subtitle="Configure millimeter-calibrated layouts for Laser A4, A5, and POS Thermal (80mm/58mm) printers."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configuredDocTypes.map((docType) => {
          const variants = DEFAULT_TEMPLATES[docType] ?? [];
          return (
            <div
              key={docType}
              className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm hover:border-amber-500/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold text-sm text-foreground">
                    {PRINT_DOC_LABELS[docType] || docType}
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {variants.length} Layouts
                </Badge>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Supported Formats: {variants.map((v) => v.paperSize.toUpperCase()).join(", ")}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {variants.map((v) => (
                    <Badge key={v.paperSize} variant="secondary" className="text-[10px]">
                      {v.paperSize}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t text-xs">
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  ● Ready
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetToDefault(docType)}
                  className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
