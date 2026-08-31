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
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SHARE_INITIATED_TOAST } from "@/lib/native/share-business-document";
import { DocumentShareModeBar } from "@/components/comm/DocumentShareModeBar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { useSettings } from "@/lib/settings-store";
import { useBilling } from "@/lib/billing-store";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { resolvePrintContext, hasPrintContextBuilder } from "@/lib/print-engine/data-mapper";
import { usePrintDataSourcesTick } from "@/lib/print-engine/data-source-tick";
import { enrichPrintDocumentData } from "@/lib/print-engine/attachment-images";
import { PrintSections } from "./sections";
import { CustomShell } from "./CustomShell";
import { resolveBrandedFirm } from "@/lib/print-engine/print-theme";
import { applyPrintProfileForDoc } from "@/lib/print-engine/print-profile-apply";
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

  // Re-derives whenever a source store updates after mount (e.g. a
  // background pullBackground() finishing) — see data-source-tick.ts for
  // why resolvePrintContext() alone can't do this on its own.
  const dataSourcesTick = usePrintDataSourcesTick();
  const [invoiceReady, setInvoiceReady] = useState(() => {
    if (docType !== "gst_invoice" && docType !== "retail_invoice") return true;
    return useBilling.getState().invoices.some((row) => row.id === recordId);
  });

  useEffect(() => {
    if (docType !== "gst_invoice" && docType !== "retail_invoice") return;
    let active = true;
    void import("@/lib/billing-print-prep").then(({ ensureBillingInvoiceForPrint }) =>
      ensureBillingInvoiceForPrint(recordId).then((inv) => {
        if (active) setInvoiceReady(!!inv);
      }),
    );
    return () => {
      active = false;
    };
  }, [docType, recordId]);

  const rawData = useMemo(() => {
    if (!invoiceReady) return null;
    return resolvePrintContext(docType, recordId);
  }, [docType, recordId, dataSourcesTick, invoiceReady]);
  const firm = useSettings((s) => s.firm);
  const branding = useSettings((s) => s.branding);
  const brandedFirm = useMemo(
    () => resolveBrandedFirm(firm, branding, template),
    [firm, branding, template],
  );

  useEffect(() => {
    applyPrintProfileForDoc(docType, activeSize, template.margins);
  }, [docType, activeSize, template.id, template.margins]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Always call the object-arg overload with OUR data-mapper's own
  // docNumber. usePrintRecord.ts's internal docType->store switch still
  // runs unconditionally either way and still supplies its own
  // linkedLabel/record for the ~20 doc types it recognizes (an explicit
  // legacyArgs.linkedLabel of undefined falls through to the switch's
  // value, per usePrintRecord's own `legacyArgs.linkedLabel || linkedLabel`
  // merge) — so this is a strict superset, not a behavior change, for
  // every doc type the switch already covers.
  //
  // It's required (not just tidier) for every doc type the switch does
  // NOT cover, e.g. karigar_custody_statement / customer_ledger_statement:
  // usePrintRecord's recordPrint effect only fires when its OWN resolved
  // docNumber is truthy (`if (!docType || !id || !docNumber) return;`),
  // and for docTypes outside its switch that value is permanently "" —
  // silently skipping the reprint-audit log for the entire document type,
  // forever, with no error. Supplying our already-correct docNumber here
  // makes audit logging work uniformly for every doc type this engine
  // will ever support, not just the ones usePrintRecord's switch happens
  // to know about.
  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    recordReprint,
  } = usePrintRecord(
    rawData
      ? { docType, docNumber: rawData.docNumber, linkedId: recordId, linkedLabel: undefined }
      : docType,
    recordId,
  );

  // Reprint state comes from usePrintRecord (the audit log), not the
  // document's own data builder — merged here once so every section
  // (billedToStamp's "REPRINT RECORD" marker, etc.) can read it the same
  // way as any other field, without each doc-type builder re-deriving it.
  const data = useMemo(() => {
    if (!rawData) return null;
    return {
      ...rawData,
      flags: { ...rawData.flags, isReprint },
      fields: { ...rawData.fields, reprintCount } as Record<string, unknown>,
    };
  }, [rawData, isReprint, reprintCount]);

  const [enrichedData, setEnrichedData] = useState<typeof data>(null);
  const [imagesLoading, setImagesLoading] = useState(false);

  useEffect(() => {
    if (!data) {
      setEnrichedData(null);
      setImagesLoading(false);
      return;
    }
    let active = true;
    setImagesLoading(true);
    void enrichPrintDocumentData(data)
      .then((next) => {
        if (!active) return;
        setEnrichedData({
          ...next,
          flags: { ...next.flags, isReprint: data.flags.isReprint },
          fields: { ...next.fields, reprintCount: data.fields.reprintCount },
        });
        setImagesLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setEnrichedData(data);
        setImagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [data]);

  const printData = enrichedData ?? data;

  // Every store lookup here is a synchronous local zustand read, not an
  // async fetch — there is no real "still loading" phase to wait out, only
  // "found" or "not found" (which flips to "found" on its own once a
  // background pullBackground() finishes, via dataSourcesTick above). Gating
  // on usePrintRecord's `loading` was tried before and is actively wrong:
  // that flag is just `!record`, which — for a doc type outside its
  // docType->store switch (e.g. karigar_custody_statement,
  // customer_ledger_statement) or for a genuinely-missing record in ANY doc
  // type — stays true forever, permanently stranding this on a "Loading…"
  // spinner instead of ever showing the real not-found message. `data`
  // itself (this engine's own resolution) is the only signal to block on.
  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        {!invoiceReady ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
            Loading invoice for print…
          </>
        ) : (
          <>
            {hasPrintContextBuilder(docType)
              ? "Document not found."
              : `No print context builder registered yet for "${docType}".`}
          </>
        )}
      </div>
    );
  }

  if (!printData || imagesLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
        Loading document images…
      </div>
    );
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const { enrichPrintDocumentData } = await import("@/lib/print-engine/attachment-images");
      const { generateDocumentPdf } = await import("@/lib/print-engine/pdf/generate");
      // Re-resolve R2 images immediately before PDF so bytes match preview.
      const dataForPdf = await enrichPrintDocumentData(printData);
      const { blob, fileName } = await generateDocumentPdf(dataForPdf, template, brandedFirm);
      const { downloadPdfBlob } = await import("@/lib/native/document-output");
      const { isNativeApp } = await import("@/lib/native/platform");
      const result = await downloadPdfBlob(blob, fileName);
      if (isNativeApp()) {
        toast.success(result.saved ? "PDF saved to Documents" : "Could not save PDF");
      }
    } catch (err) {
      console.error("[PrintEngine] PDF generation failed:", err);
      toast.error("Could not generate PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    const { enrichPrintDocumentData } = await import("@/lib/print-engine/attachment-images");
    const { generateDocumentPdf } = await import("@/lib/print-engine/pdf/generate");
    const dataForPdf = await enrichPrintDocumentData(printData);
    const { blob, fileName } = await generateDocumentPdf(dataForPdf, template, brandedFirm);
    const { sharePdfBlobCanonical } = await import("@/lib/native/document-output");
    const { documentShareCaption } = await import("@/lib/native/share-caption");
    const party =
      typeof printData.fields.customerName === "string"
        ? printData.fields.customerName
        : typeof printData.fields.workerName === "string"
          ? printData.fields.workerName
          : undefined;
    const caption = documentShareCaption({
      docLabel: printData.title,
      docNo: printData.docNumber,
      partyName: party,
    });
    await sharePdfBlobCanonical(blob, { title: printData.title, fileName, caption });
    toast.message(SHARE_INITIATED_TOAST);
  };

  /** Always PDF → print dialog. Never scrape / window.print() the on-screen UI. */
  const handleNativeOrWebPrint = async () => {
    const { enrichPrintDocumentData } = await import("@/lib/print-engine/attachment-images");
    const { generateDocumentPdf } = await import("@/lib/print-engine/pdf/generate");
    const { printPdfBlob } = await import("@/lib/native/document-output");
    const { isNativeApp } = await import("@/lib/native/platform");
    const dataForPdf = await enrichPrintDocumentData(printData);
    const { blob, fileName } = await generateDocumentPdf(dataForPdf, template, brandedFirm);
    await printPdfBlob(blob, {
      title: printData.title,
      fileName,
      printSize: template.paperSize,
    });
    if (isNativeApp()) {
      toast.success("Opened Android print dialog");
    }
  };

  const toolbar = (
    <>
      <PrintToolbar
        title={printData.title}
        docNumber={docNumber || printData.docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={() => void handleNativeOrWebPrint()}
        onReprintConfirm={recordReprint}
        backUrl={backUrl}
        onDownloadPdf={() => void handleDownloadPdf()}
        downloadingPdf={downloadingPdf}
        onShare={() => void handleSharePdf()}
        documentSize={template.paperSize}
        layoutSize={availableSizes.length > 1 && isToolbarSize(activeSize) ? activeSize : undefined}
        onLayoutSizeChange={availableSizes.length > 1 ? (sz) => setLayoutSize(sz) : undefined}
      />
      <div className="px-4 py-2 border-b border-border/40 print:hidden flex flex-wrap gap-2 bg-background/95">
        <DocumentShareModeBar
          docType={docType}
          recordId={recordId}
          title={printData.title}
          caption={`${printData.title} ${printData.docNumber}`}
        />
      </div>
    </>
  );

  if (template.shell === "custom") {
    return (
      <>
        {toolbar}
        <CustomShell paperSize={template.paperSize}>
          <PrintSections sections={template.sections} data={printData} template={template} />
        </CustomShell>
      </>
    );
  }

  const headerConfig = template.sections.find((s) => s.type === "header") as
    HeaderSectionConfig | undefined;
  const qrConfig = template.sections.find((s) => s.type === "qr") as QrSectionConfig | undefined;

  // QR only when template explicitly requests it; PrintQR also requires tenant opt-in.
  const showQR = qrConfig != null || headerConfig?.showQr === true ? true : false;
  const qrPosition = qrConfig
    ? qrConfig.position === "inline"
      ? "footer"
      : qrConfig.position
    : undefined;
  const qrLabel = qrConfig?.label ?? headerConfig?.qrLabel;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {toolbar}
      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-x-auto overflow-y-auto">
        <PrintLayout
          title={printData.title}
          docNumber={docNumber || printData.docNumber}
          docType={docType}
          recordId={recordId}
          createdAt={printData.createdAt}
          size={template.paperSize}
          showQR={showQR}
          qrLabel={qrLabel}
          qrPosition={qrPosition}
          footerLine={
            typeof printData.fields.footerLine === "string" ? printData.fields.footerLine : undefined
          }
          verificationPublicToken={
            typeof printData.fields.verificationPublicToken === "string"
              ? printData.fields.verificationPublicToken
              : undefined
          }
          partyLabel={
            typeof printData.fields.partyLabel === "string" ? printData.fields.partyLabel : undefined
          }
          totalPaise={
            typeof printData.fields.totalPaise === "number" ? printData.fields.totalPaise : undefined
          }
        >
          <PrintSections sections={template.sections} data={printData} template={template} />
        </PrintLayout>
      </div>
    </div>
  );
}
