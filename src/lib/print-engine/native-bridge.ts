/**
 * Unified Print Engine — native Electron print bridge.
 *
 * Thin typed wrapper around window.mtjDesktop.print (electron/preload.ts),
 * which already implements real silent printing + named-printer targeting
 * via a hidden BrowserWindow (electron/main.ts). That bridge exists today
 * but hardware-service.ts's submitPrintJob never calls it — its "a4" case
 * is a no-op stub. Phase 0 builds this wrapper WITHOUT touching
 * hardware-service.ts, so no existing route's print behavior changes;
 * wiring it into the live dispatch path is Phase 1+ work, done alongside
 * migrating the first document.
 */

import { listAvailablePrinters, type PrinterInfo } from "@/lib/print/print-queue";

export type { PrinterInfo };

interface MtjDesktopPrintApi {
  listPrinters(): Promise<PrinterInfo[]>;
  printHtml(
    html: string,
    options?: {
      silent?: boolean;
      printerName?: string;
      landscape?: boolean;
      marginsMm?: { top: number; bottom: number; left: number; right: number };
    },
  ): Promise<{ success: boolean; error?: string }>;
}

function getBridge(): MtjDesktopPrintApi | null {
  if (typeof window === "undefined") return null;
  const desktop = (window as unknown as { mtjDesktop?: { print?: MtjDesktopPrintApi } }).mtjDesktop;
  return desktop?.print ?? null;
}

export function isNativePrintAvailable(): boolean {
  return getBridge() !== null;
}

/** Delegates to print-queue.ts's listAvailablePrinters — same bridge, one implementation. */
export async function listNativePrinters(): Promise<PrinterInfo[]> {
  return listAvailablePrinters();
}

export async function printHtmlNatively(
  html: string,
  options?: {
    silent?: boolean;
    printerName?: string;
    landscape?: boolean;
    marginsMm?: { top: number; bottom: number; left: number; right: number };
  },
): Promise<{ success: boolean; error?: string }> {
  const bridge = getBridge();
  if (!bridge) return { success: false, error: "Native print bridge unavailable (browser build)." };
  return bridge.printHtml(html, options);
}
