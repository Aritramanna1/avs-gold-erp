/**
 * Business-document share entry — stub pending full print/share parity vs shop chunks.
 * Gold/ledger baseline paths do not depend on this module.
 */
export type ShareBusinessDocumentInput = {
  title: string;
  text?: string;
  fileName?: string;
  format?: "pdf" | "image";
  linkedType?: string;
  linkedId?: string;
  recipientLabel?: string;
  recipientPhone?: string;
};

export type ShareOutcome = { ok: boolean; activityType?: string };

export async function shareBusinessDocument(
  _input: ShareBusinessDocumentInput,
): Promise<ShareOutcome> {
  return { ok: false };
}

export function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function";
}
