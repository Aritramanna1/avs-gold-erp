import { useEffect, useState } from "react";
import { useSettings } from "./settings-store";
import { recordJob, makeId } from "./print/print-queue";

// Types of printer jobs
export type PrinterType = "a4" | "thermal_58" | "thermal_80" | "barcode" | "tag";

export interface PrintJob {
  type: PrinterType;
  title: string;
  data: unknown; // Raw document model or instructions
  rawCommands?: string; // TSPL/ZPL/ESC-POS
  /**
   * For "barcode"/"tag" jobs only (Priority 7 manual fallback): when
   * provided AND no physical label printer is available, submitPrintJob()
   * generates and downloads a real PDF label with these exact fields
   * instead of just formatting raw printer commands nobody receives.
   * Optional and additive — omitting it preserves the exact prior behavior.
   */
  tagData?: {
    itemName: string;
    barcode: string;
    grossMg: number;
    purity: string;
    itemCode?: string;
  };
}

export interface ScaleReading {
  weightGrams: number;
  isStable: boolean;
  rawString: string;
}

export type ScaleCallback = (reading: ScaleReading) => void;

class HardwareService {
  private scalePort: any | null = null;
  private scaleReader: any | null = null;
  private scaleCallbacks: Set<ScaleCallback> = new Set();
  private isReadingScale = false;

  get isScaleConnected(): boolean {
    return this.scalePort !== null;
  }

  // Barcode Scanner buffer
  private scannerBuffer = "";
  private lastKeyTime = 0;
  private barcodeCallbacks: Set<(barcode: string) => void> = new Set();

  constructor() {
    this.setupScannerListener();
  }

  // --- 1. Barcode Scanner USB HID Emulator Listener ---
  private setupScannerListener() {
    if (typeof window === "undefined") return;

    window.addEventListener("keydown", (e) => {
      // Ignore inputs from input/textarea unless it is rapid (hardware scanner)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      const currentTime = Date.now();
      const diff = currentTime - this.lastKeyTime;
      this.lastKeyTime = currentTime;

      // Hardware scanners typically dump characters extremely quickly (< 15-30ms)
      const isRapid = diff < 35;

      if (e.key === "Enter") {
        if (this.scannerBuffer.length > 2) {
          const scanned = this.scannerBuffer;
          this.scannerBuffer = "";
          e.preventDefault();
          this.triggerBarcodeScanned(scanned);
        } else {
          this.scannerBuffer = "";
        }
      } else if (e.key && e.key.length === 1) {
        if (!isInput || isRapid || this.scannerBuffer.length > 0) {
          this.scannerBuffer += e.key;
        } else {
          this.scannerBuffer = "";
        }
      }

      // Clear buffer if long idle
      if (diff > 200) {
        this.scannerBuffer = e.key && e.key.length === 1 ? e.key : "";
      }
    });
  }

  public onBarcodeScanned(callback: (barcode: string) => void) {
    this.barcodeCallbacks.add(callback);
    return () => this.barcodeCallbacks.delete(callback);
  }

  public triggerBarcodeScanned(barcode: string) {
    this.barcodeCallbacks.forEach((cb) => cb(barcode));
  }

  // --- 2. Jewellery Weighing Scale (WebSerial) ---
  public async connectPhysicalScale(): Promise<boolean> {
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      console.warn("WebSerial API is not supported in this browser.");
      return false;
    }

    try {
      const baudRate = useSettings.getState()?.hardware?.scaleBaudRate || 9600;
      // @ts-expect-error: WebSerial API lacks official DOM types in default config
      this.scalePort = await navigator.serial.requestPort();
      await this.scalePort.open({ baudRate, dataBits: 8, stopBits: 1 });
      this.isReadingScale = true;
      this.readScaleStream();
      return true;
    } catch (err) {
      console.error("[Hardware HAL] Failed to connect physical scale:", err);
      return false;
    }
  }

  public async disconnectPhysicalScale() {
    this.isReadingScale = false;
    if (this.scaleReader) {
      try {
        await this.scaleReader.cancel();
      } catch {}
      this.scaleReader = null;
    }
    if (this.scalePort) {
      try {
        await this.scalePort.close();
      } catch {}
      this.scalePort = null;
    }
  }

  private async readScaleStream() {
    if (!this.scalePort) return;
    const decoder = new TextDecoder();

    try {
      this.scaleReader = this.scalePort.readable.getReader();
      let buffer = "";

      while (this.isReadingScale) {
        const { value, done } = await this.scaleReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Handle common scale transmission endings like Carriage Return / Line Feed
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const parsed = this.parseScaleRawOutput(line);
          if (parsed) {
            this.triggerScaleReading(parsed);
          }
        }
      }
    } catch (err) {
      console.error("[Hardware HAL] Scale reading stream interrupted:", err);
    } finally {
      if (this.scaleReader) {
        this.scaleReader.releaseLock();
      }
    }
  }

  // Common precision scales transmit formats like: "ST,GS,+0012.350g" or "US,GS,+0012.200g"
  // ST = Stable, US = Unstable, GS/NT = Gross/Net weight, followed by sign, value, unit.
  private parseScaleRawOutput(raw: string): ScaleReading | null {
    const cleaned = raw.trim();
    if (!cleaned) return null;

    // Standard pattern extraction
    const match = cleaned.match(/([A-Z]{2}),.*?\+?(-?\d+\.?\d*)\s*(g|kg|mg)?/i);
    if (match) {
      const isStable = match[1] === "ST";
      const weightGrams = parseFloat(match[2]);
      return {
        weightGrams,
        isStable,
        rawString: cleaned,
      };
    }

    // Fallback extraction of numbers
    const fallbackNumMatch = cleaned.match(/-?\d+\.?\d*/);
    if (fallbackNumMatch) {
      const val = parseFloat(fallbackNumMatch[0]);
      return {
        weightGrams: val,
        isStable: cleaned.toLowerCase().includes("st") || cleaned.toLowerCase().includes("s"),
        rawString: cleaned,
      };
    }

    return null;
  }

  public onScaleReading(callback: ScaleCallback) {
    this.scaleCallbacks.add(callback);
    return () => this.scaleCallbacks.delete(callback);
  }

  public subscribeToScale(callback: ScaleCallback) {
    const unsub = this.onScaleReading(callback);
    return {
      unsubscribe: () => {
        if (typeof unsub === "function") {
          unsub();
        }
      },
    };
  }

  private triggerScaleReading(reading: ScaleReading) {
    this.scaleCallbacks.forEach((cb) => cb(reading));
  }

  // --- 3. Centralized Printer Service ---
  public async submitPrintJob(
    job: PrintJob,
  ): Promise<{
    success: boolean;
    message: string;
    jobId: string;
    status: "printed" | "pdf_fallback" | "failed";
  }> {
    // Abstract printer selection
    const settings = useSettings.getState().hardware;

    if (job.rawCommands) {
      // In a real desktop environment with Electron or direct WebUSB, we stream commands.
      // In the web preview we fall back to browser print with styled structures.
    }

    const logMsg = `Printed: ${job.title} [Profile: ${job.type}]`;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("hardware-print-log", {
          detail: { message: `[${new Date().toLocaleTimeString()}] ${logMsg}` },
        }),
      );
    }

    // Direct routing based on type
    const { result, isPdfFallback } = await (async (): Promise<{
      result: { success: boolean; message: string };
      isPdfFallback: boolean;
    }> => {
      switch (job.type) {
        case "a4":
          return {
            result: { success: true, message: "A4 documents sent to browser print spooler." },
            isPdfFallback: false,
          };
        case "thermal_58":
        case "thermal_80": {
          // Try physical thermal printer via WebUSB first
          const { thermalPrinterService } = await import("./thermal-printer");
          if (thermalPrinterService.isConnected && job.rawCommands) {
            const encoder = new TextEncoder();
            await thermalPrinterService.sendRaw(encoder.encode(job.rawCommands));
            return {
              result: { success: true, message: "Sent to physical thermal printer." },
              isPdfFallback: false,
            };
          }
          return {
            result: { success: true, message: "Thermal receipt payload generated successfully." },
            isPdfFallback: false,
          };
        }
        case "barcode":
        case "tag": {
          // No label-printer connection state is tracked anywhere in this
          // codebase yet (unlike thermalPrinterService.isConnected for
          // receipt printers) — so whenever real label data is supplied, we
          // treat "no physical printer" as the default and always offer the
          // PDF fallback rather than silently assume hardware is present.
          if (job.tagData) {
            const { downloadTagLabelPdf } = await import("./hardware/tag-pdf-fallback");
            downloadTagLabelPdf(job.tagData);
            return {
              result: {
                success: true,
                message: "No label printer detected — downloaded as PDF instead.",
              },
              isPdfFallback: true,
            };
          }
          return {
            result: {
              success: true,
              message: "Portrait jewelry tag commands formatted for printer.",
            },
            isPdfFallback: false,
          };
        }
        default:
          return {
            result: { success: false, message: "Unknown printer device type." },
            isPdfFallback: false,
          };
      }
    })();

    // The Print Queue report (reports.print-queue.tsx) reads from the same
    // `print_jobs` table print-queue.ts's own submitPrintJob() writes to —
    // recording here too is what makes that report reflect what actually
    // gets printed through this (the real, universally-used) call site.
    // pdf_fallback must be recorded distinctly from printed — the report's
    // whole point is warning the operator when jobs are silently missing a
    // physical printer, which "printed" (its previous, always-used label
    // whenever success was true, PDF fallback included) can never surface.
    // Best-effort: a logging failure must never block a print the operator
    // is actively waiting on. The id is generated up front (not inside the
    // try) so it's always returned to the caller even if the history write
    // itself fails — the report the id names is best-effort, the id isn't.
    const jobId = makeId();
    const status: "printed" | "pdf_fallback" | "failed" = isPdfFallback
      ? "pdf_fallback"
      : result.success
        ? "printed"
        : "failed";
    try {
      await recordJob(
        jobId,
        job.type,
        job.title,
        status,
        1,
        result.success ? undefined : result.message,
        undefined,
      );
    } catch (err) {
      console.error("[HardwareService] Failed to record print job history:", err);
    }

    return { ...result, jobId, status };
  }

  // Helper to generate TSPL command for jewellery barcode tag sheets in Portrait
  public generateTsplTagCommand(item: {
    itemName: string;
    barcode: string;
    grossMg: number;
    purity: string;
    itemCode?: string;
  }): string {
    const grossG = (item.grossMg / 1000).toFixed(3);
    const itemName = safePrinterText(item.itemName, 16);
    const purity = safePrinterText(item.purity, 12);
    const barcode = safeBarcode(item.barcode);
    const itemCode = safePrinterText(item.itemCode || barcode, 32);
    const labelWidth = "40"; // 40 mm
    const labelHeight = "25"; // 25 mm

    // Format portrait commands
    return `
SIZE ${labelWidth} mm, ${labelHeight} mm
GAP 2 mm, 0 mm
DIRECTION 1
OFFSET 0 mm
REFERENCE 0,0
CLEAR
TEXT 10,15,"ROMAN.TTF",0,1,1,"${itemName}"
TEXT 10,35,"ROMAN.TTF",0,1,1,"Purity: ${purity}"
TEXT 10,55,"ROMAN.TTF",0,1,1,"Gross: ${grossG} g"
BARCODE 10,80,"128",40,1,0,2,2,"${barcode}"
TEXT 10,130,"ROMAN.TTF",0,1,1,"Code: ${itemCode}"
PRINT 1,1
`;
  }

  // Helper to generate Zebra ZPL command for Portrait jewellery labels
  public generateZplTagCommand(item: {
    itemName: string;
    barcode: string;
    grossMg: number;
    purity: string;
    itemCode?: string;
  }): string {
    const grossG = (item.grossMg / 1000).toFixed(3);
    const itemName = safePrinterText(item.itemName, 16);
    const purity = safePrinterText(item.purity, 12);
    const barcode = safeBarcode(item.barcode);
    // Standard ZPL commands keeping upright portrait format
    return `
^XA
^LT0
^LH0,0
^FO15,20^A0N,22,22^FD${itemName}^FS
^FO15,45^A0N,20,20^FDPurity: ${purity}^FS
^FO15,70^A0N,20,20^FDGross: ${grossG} g^FS
^FO15,100^BY2,2.0,35^BCN,35,Y,N,N^FD${barcode}^FS
^XZ
`;
  }
}

export const hardwareService = new HardwareService();

function safePrinterText(value: string, maxLength: number): string {
  return Array.from(String(value), (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || character === '"' || character === "^" || character === "~"
      ? " "
      : character;
  })
    .join("")
    .trim()
    .slice(0, maxLength);
}

function safeBarcode(value: string): string {
  const barcode = String(value)
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 64);
  if (!barcode) throw new Error("A valid barcode is required for printer output.");
  return barcode;
}

/**
 * One shared scale-subscription hook — the single place any component reads
 * live weighing-scale state from. `WeightInput.tsx` and BillingModule's
 * item-row table both consume this instead of each subscribing to
 * `hardwareService.onScaleReading()` independently: device handling,
 * connection lifecycle, and read-side plumbing stay unified in
 * `hardwareService`; this hook is just the one React-level wrapper around
 * it. Presentation (full "Use Reading" UI vs a compact table-row hint) is
 * left entirely to the caller — this returns data only.
 */
export function useScaleReading(): { reading: ScaleReading | null; connected: boolean } {
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [connected, setConnected] = useState(hardwareService.isScaleConnected);

  useEffect(() => {
    const unsubscribe = hardwareService.onScaleReading((r) => {
      setReading(r);
      setConnected(hardwareService.isScaleConnected);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return { reading, connected };
}
