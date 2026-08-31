import { create } from "zustand";

interface PrintState {
  isOpen: boolean;
  printUrl: string;
  printTitle: string;
  docNo?: string;
  relatedTable?: string;
  relatedRecordId?: string;
  /** Pre-built Print Engine / report PDF. Native preview uses this instead of an iframe. */
  pdfBlob?: Blob | null;
  pdfFileName?: string;
  shareCaption?: string;
}

interface PrintStore extends PrintState {
  triggerPrint: (
    url: string,
    title: string,
    options?: {
      docNo?: string;
      relatedTable?: string;
      relatedRecordId?: string;
      pdfBlob?: Blob;
      pdfFileName?: string;
      shareCaption?: string;
    },
  ) => void;
  closePrint: () => void;
}

export const usePrintEngine = create<PrintStore>((set) => ({
  isOpen: false,
  printUrl: "",
  printTitle: "",
  docNo: undefined,
  relatedTable: undefined,
  relatedRecordId: undefined,
  pdfBlob: null,
  pdfFileName: undefined,
  shareCaption: undefined,

  triggerPrint: (url, title, options) =>
    set({
      isOpen: true,
      printUrl: url,
      printTitle: title,
      docNo: options?.docNo,
      relatedTable: options?.relatedTable,
      relatedRecordId: options?.relatedRecordId,
      pdfBlob: options?.pdfBlob ?? null,
      pdfFileName: options?.pdfFileName,
      shareCaption: options?.shareCaption,
    }),

  closePrint: () =>
    set({
      isOpen: false,
      printUrl: "",
      printTitle: "",
      docNo: undefined,
      relatedTable: undefined,
      relatedRecordId: undefined,
      pdfBlob: null,
      pdfFileName: undefined,
      shareCaption: undefined,
    }),
}));

/**
 * Global trigger helper for non-React contexts or easy imports
 */
export function triggerGlobalPrint(
  url: string,
  title: string,
  options?: {
    docNo?: string;
    relatedTable?: string;
    relatedRecordId?: string;
    pdfBlob?: Blob;
    pdfFileName?: string;
    shareCaption?: string;
  },
) {
  usePrintEngine.getState().triggerPrint(url, title, options);
}
