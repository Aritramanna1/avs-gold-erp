/**
 * Page setup for the print pipeline — paper size, orientation, margins,
 * scale and fit-to-page.
 *
 * One store, read by PrintLayout (which emits the real `@page` rule and sizes
 * the on-screen sheet from it) and written by PrintToolbar / PrintPreviewModal.
 * Because the SAME values produce both the preview and the `@page` rule that
 * printDocument()/printToPDF honour (preferCSSPageSize), the preview and the
 * paper cannot disagree.
 *
 * Persisted: a workshop that prints job cards on half-A4 sets it once.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PrintSize, PrintOrientation } from "@/components/print/PrintLayout";

export interface PrintMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface PrintSetupState {
  /** null = use the document's own declared size. */
  sizeOverride: PrintSize | null;
  /** null = the size's natural orientation (a5l is landscape, rest portrait). */
  orientation: PrintOrientation | null;
  /** null = the size's built-in default margins (see PrintLayout DEFAULT_MARGINS). */
  margins: PrintMargins | null;
  /** 100 = actual size. Applied as CSS zoom on the print root, so screen and paper scale alike. */
  scalePct: number;
  /** Shrink content just enough to avoid a near-empty extra page. */
  fitToPage: boolean;
  setSizeOverride: (s: PrintSize | null) => void;
  setOrientation: (o: PrintOrientation | null) => void;
  setMargins: (m: PrintMargins | null) => void;
  setScalePct: (p: number) => void;
  setFitToPage: (f: boolean) => void;
  reset: () => void;
}

const DEFAULTS = {
  sizeOverride: null,
  orientation: null,
  margins: null,
  scalePct: 100,
  fitToPage: true,
} as const;

export const usePrintSetup = create<PrintSetupState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setSizeOverride: (sizeOverride) => set({ sizeOverride }),
      setOrientation: (orientation) => set({ orientation }),
      setMargins: (margins) => set({ margins }),
      // Clamped: a 0% or 900% scale is never a print the user meant.
      setScalePct: (scalePct) => set({ scalePct: Math.min(200, Math.max(25, scalePct || 100)) }),
      setFitToPage: (fitToPage) => set({ fitToPage }),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "mtj-print-setup-v1" },
  ),
);
