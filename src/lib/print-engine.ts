import { create } from "zustand";

interface PrintState {
  isOpen: boolean;
  printUrl: string;
  printTitle: string;
  docNo?: string;
  relatedTable?: string;
  relatedRecordId?: string;
}

interface PrintStore extends PrintState {
  triggerPrint: (
    url: string,
    title: string,
    options?: { docNo?: string; relatedTable?: string; relatedRecordId?: string },
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

  triggerPrint: (url, title, options) =>
    set({
      isOpen: true,
      printUrl: url,
      printTitle: title,
      docNo: options?.docNo,
      relatedTable: options?.relatedTable,
      relatedRecordId: options?.relatedRecordId,
    }),

  closePrint: () =>
    set({
      isOpen: false,
      printUrl: "",
      printTitle: "",
      docNo: undefined,
      relatedTable: undefined,
      relatedRecordId: undefined,
    }),
}));

/**
 * Global trigger helper for non-React contexts or easy imports
 */
export function triggerGlobalPrint(
  url: string,
  title: string,
  options?: { docNo?: string; relatedTable?: string; relatedRecordId?: string },
) {
  usePrintEngine.getState().triggerPrint(url, title, options);
}
