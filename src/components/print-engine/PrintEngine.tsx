/**
 * Unified Print Engine — shell component.
 *
 * Phase 0: built, exported, and validated by typecheck/build, but not
 * imported by any route yet — per the phase requirement that no existing
 * business module changes behavior until a document is actually migrated.
 * When a document IS migrated (Phase 1+), its route file becomes a thin
 * wrapper: `<PrintEngine docType="credit_note" recordId={id} />`, replacing
 * that route's bespoke JSX — everything else (audit, reprint, toolbar,
 * paper-size CSS, QR) is unchanged because it's the same underlying calls
 * PrintLayout/PrintToolbar/usePrintRecord already make today.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PrintLayout } from "@/components/print/PrintLayout";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { useSettings } from "@/lib/settings-store";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { generateDocumentPdf } from "@/lib/print-engine/pdf/generate";
import { PrintSections } from "./sections";
import { CustomShell } from "./CustomShell";
import type {
  HeaderSectionConfig,
  PrintDocType,
  PrintSize,
  QrSectionConfig,
} from "@/lib/print-engine/types";

export interface PrintEngineProps {
  docType: PrintDocType;
  recordId: string;
  backUrl?: string;
}

/** PrintToolbar's size-switcher only accepts these 5 (no "a6") — every doc type with a switcher today stays within them. */
const TOOLBAR_SIZES = ["a4", "a5", "thermal", "thermal58", "tag"] as const;
type ToolbarSize = (typeof TOOLBAR_SIZES)[number];
function isToolbarSize(size: PrintSize): size is ToolbarSize {
  return (TOOLBAR_SIZES as readonly string[]).includes(size);
}

export function PrintEngine({ docType, recordId, backUrl }: PrintEngineProps) {
  // getForDocType/getAvailablePaperSizes both construct a fresh array/object
  // on some calls (the "Unconfigured" placeholder, Array.from(new Set(...)))
  // — calling them directly as a zustand selector's return value breaks
  // useSyncExternalStore's reference-equality check ("getSnapshot should be
  // cached"), which becomes a real infinite render loop the moment a
  // template lookup takes that branch. Select the reactive `templates`
  // array (zustand keeps this reference stable across renders when the
  // store hasn't actually changed) and memoize the derived lookups against
  // it instead of calling the derivation functions inside the selector.
  const templates = usePrintTemplates((s) => s.templates);
  const [layoutSize, setLayoutSize] = useState<PrintSize | null>(null);

  // `templates` is a re-render trigger, not read by name in these bodies —
  // .getState() re-reads the store fresh each call, so exhaustive-deps
  // can't see the dependency; the array is still required to invalidate
  // the memo when the store updates.

  const availableSizes = useMemo(
    () => usePrintTemplates.getState().getAvailablePaperSizes(docType),
    [docType, templates],
  );

  const defaultTemplate = useMemo(
    () => usePrintTemplates.getState().getForDocType(docType),
    [docType, templates],
  );
  const activeSize = layoutSize ?? defaultTemplate.paperSize;

  const template = useMemo(
    () => usePrintTemplates.getState().getForDocType(docType, activeSize),
    [docType, activeSize, templates],
  );

  const rawData = resolvePrintContext(docType, recordId);
  const firm = useSettings((s) => s.firm);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const {
    loading,
    error,
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(docType, recordId);

  // Reprint state comes from usePrintRecord (the audit log), not the
  // document's own data builder — merged here once so every section
  // (billedToStamp's "REPRINT RECORD" marker, etc.) can read it the same
  // way as any other field, without each doc-type builder re-deriving it.
  const data = useMemo(() => {
    if (!rawData) return null;
    return {
      ...rawData,
      flags: { ...rawData.flags, isReprint },
      fields: { ...rawData.fields, reprintCount },
    };
  }, [rawData, isReprint, reprintCount]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        {error || `No print context builder registered yet for "${docType}".`}
      </div>
    );
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const { blob, fileName } = await generateDocumentPdf(data, template, firm);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[PrintEngine] PDF generation failed:", err);
      toast.error("Could not generate PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const toolbar = (
    <PrintToolbar
      title={data.title}
      docNumber={docNumber || data.docNumber}
      isReprint={isReprint}
      reprintCount={reprintCount}
      reprintOpen={reprintOpen}
      setReprintOpen={setReprintOpen}
      onPrint={handlePrintTrigger}
      onReprintConfirm={recordReprint}
      backUrl={backUrl}
      onDownloadPdf={handleDownloadPdf}
      downloadingPdf={downloadingPdf}
      layoutSize={availableSizes.length > 1 && isToolbarSize(activeSize) ? activeSize : undefined}
      onLayoutSizeChange={availableSizes.length > 1 ? (sz) => setLayoutSize(sz) : undefined}
    />
  );

  if (template.shell === "custom") {
    return (
      <>
        {toolbar}
        <CustomShell paperSize={template.paperSize}>
          <PrintSections sections={template.sections} data={data} />
        </CustomShell>
      </>
    );
  }

  const headerConfig = template.sections.find((s) => s.type === "header") as
    HeaderSectionConfig | undefined;
  const qrConfig = template.sections.find((s) => s.type === "qr") as QrSectionConfig | undefined;

  // No explicit "qr" section and header.showQr not set to false: leave
  // showQR/qrPosition/qrLabel undefined so PrintLayout's own defaults
  // (showQR=true, position="header", label="Verify") apply exactly as
  // they do for every other route — a template only needs to say
  // something when it wants to DEVIATE from that default.
  const showQR = qrConfig ? true : (headerConfig?.showQr ?? undefined);
  const qrPosition = qrConfig
    ? qrConfig.position === "inline"
      ? "footer"
      : qrConfig.position
    : undefined;
  const qrLabel = qrConfig?.label ?? headerConfig?.qrLabel;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {toolbar}
      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title={data.title}
          docNumber={docNumber || data.docNumber}
          docType={docType}
          recordId={recordId}
          createdAt={data.createdAt}
          size={template.paperSize}
          showQR={showQR}
          qrLabel={qrLabel}
          qrPosition={qrPosition}
        >
          <PrintSections sections={template.sections} data={data} />
        </PrintLayout>
      </div>
    </div>
  );
}
