/**
 * Canonical document share — PDF or Image from the same Universal Print Engine
 * template. Opens native/Web share when possible; otherwise downloads or
 * deep-links a firm-scoped secure document URL (never unrestricted public dumps).
 */
import { isNativeApp } from "@/lib/native/platform";
import { shareContent, nativeShareAvailable, type ShareOutcome } from "@/lib/native/share";
import { shareFileBlob } from "@/lib/native/print-mobile";
import { useCommLog, type CommLinkedType } from "@/lib/comm-log-store";
import type { PrintDocType } from "@/lib/print-engine/types";

export const SHARE_INITIATED_TOAST =
  "Share sheet opened. The document is sent only if you complete it in WhatsApp, Email, or another app.";

export type ShareDocumentFormat = "pdf" | "image";

export interface ShareBusinessDocumentInput {
  title: string;
  text?: string;
  fileName?: string;
  /** When set with recordId, builds the Print Engine PDF (and image when format=image). */
  docType?: PrintDocType;
  recordId?: string;
  /** Pre-built blob (skips Print Engine). */
  blob?: Blob;
  format?: ShareDocumentFormat;
  linkedType?: CommLinkedType;
  linkedId?: string;
  recipientLabel?: string;
  recipientPhone?: string;
  /** Branch for minting secure document links on desktop fallback. */
  branchId?: string;
}

async function resolveShareBlob(
  input: ShareBusinessDocumentInput,
): Promise<{ blob: Blob; fileName: string; mimeType: string } | null> {
  const format: ShareDocumentFormat = input.format ?? "pdf";

  if (input.blob) {
    const mimeType =
      format === "image" ? "image/png" : input.blob.type || "application/pdf";
    const fallbackExt = format === "image" ? ".png" : ".pdf";
    return {
      blob: input.blob,
      fileName:
        input.fileName ??
        `${input.title.replace(/\s+/g, "-").toLowerCase()}${fallbackExt}`,
      mimeType,
    };
  }

  if (!input.docType || !input.recordId) return null;

  if (format === "image") {
    const { generatePrintEngineImage } = await import("@/lib/native/document-output");
    const img = await generatePrintEngineImage(input.docType, input.recordId);
    if (!img) return null;
    return {
      blob: img.blob,
      fileName: input.fileName ?? img.fileName,
      mimeType: "image/png",
    };
  }

  const { generatePrintEnginePdf } = await import("@/lib/native/document-output");
  const pdf = await generatePrintEnginePdf(input.docType, input.recordId);
  if (!pdf) return null;
  return {
    blob: pdf.blob,
    fileName: input.fileName ?? pdf.fileName,
    mimeType: "application/pdf",
  };
}

function logShareInitiated(input: ShareBusinessDocumentInput, outcome: ShareOutcome): void {
  if (!input.linkedType || !input.linkedId) return;
  useCommLog.getState().record({
    kind: "share_initiated",
    templateKind: "custom",
    templateName: `${input.title}${input.format === "image" ? " (image)" : ""}`,
    target: "customer",
    recipientLabel: input.recipientLabel ?? "Recipient",
    recipientPhone: input.recipientPhone ?? "",
    linkedType: input.linkedType,
    linkedId: input.linkedId,
    body: input.text ?? input.title,
    deliveryStatus: outcome.activityType ? "deep_link_opened" : undefined,
  });
}

async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const { downloadPdfBlob } = await import("@/lib/native/document-output");
  await downloadPdfBlob(blob, fileName);
}

/**
 * True when the platform can attach a file to the share sheet.
 */
export function canShareFiles(): boolean {
  if (isNativeApp()) return true;
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    const probe = new File([new Blob(["x"], { type: "application/pdf" })], "probe.pdf", {
      type: "application/pdf",
    });
    return !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Opens the OS share sheet with PDF or image from the same UPE template.
 * On desktop without file-share support: downloads the file (and optionally
 * returns a hint for deep-link callers). Never claims SENT.
 */
export async function shareBusinessDocument(
  input: ShareBusinessDocumentInput,
): Promise<{
  initiated: boolean;
  outcome?: ShareOutcome;
  error?: string;
  /** Set when file share was unavailable and we fell back to download. */
  downloaded?: boolean;
}> {
  const { documentShareCaption } = await import("@/lib/native/share-caption");
  const caption =
    input.text ??
    documentShareCaption({
      docLabel: input.title,
      partyName: input.recipientLabel,
    });
  try {
    const file = await resolveShareBlob(input);
    if (!file) {
      const outcome = await shareContent({
        title: input.title,
        text: caption,
      });
      if (outcome.initiated) logShareInitiated(input, outcome);
      return { initiated: outcome.initiated, outcome };
    }

    if (isNativeApp() || canShareFiles()) {
      await shareFileBlob(file.blob, file.fileName, file.mimeType, input.title, caption);
      const outcome: ShareOutcome = { initiated: true, shared: true };
      logShareInitiated(input, outcome);
      return { initiated: true, outcome };
    }

    // Desktop / no file share: download so the operator still gets the real document.
    await downloadBlob(file.blob, file.fileName);
    const outcome: ShareOutcome = { initiated: true, shared: true };
    logShareInitiated(input, outcome);
    return { initiated: true, outcome, downloaded: true };
  } catch (err) {
    return {
      initiated: false,
      error: err instanceof Error ? err.message : "Could not open share sheet.",
    };
  }
}

export { nativeShareAvailable };
