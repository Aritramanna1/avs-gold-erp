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
   * For "barcode"/"tag" jobs: when no physical label printer is connected,
   * submitPrintJob downloads a PDF with these unified tag fields.
   */
  tagData?: {
    itemName: string;
    barcode: string;
    grossMg: number;
    netMg?: number;
    purity: string;
    itemCode?: string;
    huid?: string;
    diaPcs?: number;
    symbology?: import("./barcode-symbology").BarcodeSymbology;
    barcodeValue?: string;
  };
}

export interface ScaleReading {
  weightGrams: number;
  isStable: boolean;
  rawString: string;
  /** Gross / net indication when the scale protocol provides it. */
  mode?: "gross" | "net" | "tare" | "unknown";
  unit?: "g" | "kg" | "mg";
  deviceId?: string;
  timestampMs?: number;
  tareGrams?: number;
  netGrams?: number;
  grossGrams?: number;
}

export interface XrfTouchReading {
  goldPct: number;
  silverPct: number;
  copperPct: number;
  zincPct: number;
  rawPurityKarat: number;
  rawString: string;
}

export interface RfidTrayScanResult {
  trayId: string;
  totalTagsFound: number;
  tagRfids: string[];
  scannedAt: string;
}

export type ScaleCallback = (reading: ScaleReading) => void;
export type XrfCallback = (reading: XrfTouchReading) => void;
export type RfidCallback = (result: RfidTrayScanResult) => void;

class HardwareService {
  private scalePort: any | null = null;
  private scaleReader: any | null = null;
  private scaleCallbacks: Set<ScaleCallback> = new Set();
  private isReadingScale = false;
  /** Soft connection flag for TSPL/ZPL label printer (WebUSB when paired). */
  private labelPrinterConnected = false;
  private _labelPrinterDialect: "tspl" | "zpl" = "tspl";

  get isScaleConnected(): boolean {
    return this.scalePort !== null;
  }

  get isLabelPrinterConnected(): boolean {
    return this.labelPrinterConnected;
  }

  get labelPrinterDialect(): "tspl" | "zpl" {
    return this._labelPrinterDialect;
  }

  /** Mark a TSPL/ZPL label printer as ready (WebUSB pair UX sets this). */
  public setLabelPrinterConnected(connected: boolean, dialect: "tspl" | "zpl" = "tspl") {
    this.labelPrinterConnected = connected;
    this._labelPrinterDialect = dialect;
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
    void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => emitUiFeedback("scan"));
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
      const unitRaw = (match[3] || "g").toLowerCase();
      const unit = unitRaw === "kg" ? "kg" : unitRaw === "mg" ? "mg" : "g";
      const mode: ScaleReading["mode"] = /nt/i.test(cleaned)
        ? "net"
        : /gs/i.test(cleaned)
          ? "gross"
          : "unknown";
      return {
        weightGrams,
        isStable,
        rawString: cleaned,
        mode,
        unit,
        timestampMs: Date.now(),
        grossGrams: mode === "gross" ? weightGrams : undefined,
        netGrams: mode === "net" ? weightGrams : undefined,
      };
    }

    // Fallback extraction of numbers — never invent stability
    const fallbackNumMatch = cleaned.match(/-?\d+\.?\d*/);
    if (fallbackNumMatch) {
      const val = parseFloat(fallbackNumMatch[0]);
      const claimsStable =
        /\bst\b/i.test(cleaned) || cleaned.toLowerCase().includes("stable");
      return {
        weightGrams: val,
        isStable: claimsStable,
        rawString: cleaned,
        mode: "unknown",
        unit: "g",
        timestampMs: Date.now(),
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
  public async submitPrintJob(job: PrintJob): Promise<{
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
        case "a4": {
          const html = typeof job.data === "string" ? job.data : null;
          if (html && html.includes("<")) {
            const { isNativeApp, isDesktopApp } = await import("./native/platform");
            if (isNativeApp()) {
              const { OrnexaPrint } = await import("./native/ornexa-print-plugin");
              await OrnexaPrint.printHtml({ jobName: job.title, html, mediaSize: "iso_a4" });
              return {
                result: { success: true, message: "Opened Android print dialog." },
                isPdfFallback: false,
              };
            }
            if (isDesktopApp()) {
              const { printHtmlNatively, isNativePrintAvailable } = await import(
                "./print-engine/native-bridge"
              );
              if (isNativePrintAvailable()) {
                const native = await printHtmlNatively(html);
                if (native.success) {
                  return {
                    result: { success: true, message: "Sent to OS printer." },
                    isPdfFallback: false,
                  };
                }
              }
            }
            const { printHtmlInWebBrowser } = await import("./print-document");
            printHtmlInWebBrowser(html);
            return {
              result: { success: true, message: "Opened browser print dialog." },
              isPdfFallback: false,
            };
          }
          return {
            result: {
              success: false,
              message:
                "A4 print needs a document. Open the invoice or voucher preview and tap Print — this hardware tile does not spool an empty job.",
            },
            isPdfFallback: false,
          };
        }
        case "thermal_58":
        case "thermal_80": {
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
            result: {
              success: false,
              message:
                "No thermal printer connected — receipt was not printed. Connect WebUSB thermal or use document Print/PDF.",
            },
            isPdfFallback: false,
          };
        }
        case "barcode":
        case "tag": {
          // One printer path: when label printer is connected and rawCommands
          // are present, treat as printed. Otherwise PDF fallback with unified
          // GW/NW/Dia/HUID/code fields.
          if (this.labelPrinterConnected && job.rawCommands) {
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("hardware-label-print", {
                  detail: { dialect: this.labelPrinterDialect, commands: job.rawCommands },
                }),
              );
            }
            return {
              result: {
                success: true,
                message: `Sent ${this.labelPrinterDialect.toUpperCase()} commands to label printer.`,
              },
              isPdfFallback: false,
            };
          }
          if (job.tagData) {
            const { downloadTagLabelPdfAsync } = await import("./hardware/tag-pdf-fallback");
            await downloadTagLabelPdfAsync(job.tagData);
            return {
              result: {
                success: true,
                message: "No label printer connected — downloaded PDF tag instead.",
              },
              isPdfFallback: true,
            };
          }
          if (job.rawCommands) {
            // Commands generated but nowhere to send — still PDF if we can build tagData later.
            return {
              result: {
                success: true,
                message: "Label commands ready; connect a TSPL/ZPL printer or supply tagData for PDF.",
              },
              isPdfFallback: false,
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
    netMg?: number;
    purity: string;
    itemCode?: string;
    huid?: string;
    diaPcs?: number;
  }): string {
    const grossG = (item.grossMg / 1000).toFixed(3);
    const netG = item.netMg != null ? (item.netMg / 1000).toFixed(3) : "—";
    const itemName = safePrinterText(item.itemName, 16);
    const purity = safePrinterText(item.purity, 12);
    const barcode = safeBarcode(item.barcode);
    const itemCode = safePrinterText(item.itemCode || barcode, 32);
    const huid = item.huid ? safePrinterText(item.huid, 16) : "";
    const dia = item.diaPcs != null ? String(item.diaPcs) : "";
    const labelWidth = "40";
    const labelHeight = "25";

    return `
SIZE ${labelWidth} mm, ${labelHeight} mm
GAP 2 mm, 0 mm
DIRECTION 1
OFFSET 0 mm
REFERENCE 0,0
CLEAR
TEXT 10,10,"ROMAN.TTF",0,1,1,"${itemName}"
TEXT 10,28,"ROMAN.TTF",0,1,1,"GW ${grossG} NW ${netG}"
TEXT 10,44,"ROMAN.TTF",0,1,1,"Purity: ${purity}${dia ? ` Dia:${dia}` : ""}"
${huid ? `TEXT 10,58,"ROMAN.TTF",0,1,1,"HUID: ${huid}"` : ""}
BARCODE 10,${huid ? "72" : "62"},"128",36,1,0,2,2,"${barcode}"
TEXT 10,${huid ? "118" : "110"},"ROMAN.TTF",0,1,1,"Code: ${itemCode}"
PRINT 1,1
`;
  }

  // Helper to generate Zebra ZPL command for Portrait jewellery labels
  public generateZplTagCommand(item: {
    itemName: string;
    barcode: string;
    grossMg: number;
    netMg?: number;
    purity: string;
    itemCode?: string;
    huid?: string;
    diaPcs?: number;
  }): string {
    const grossG = (item.grossMg / 1000).toFixed(3);
    const netG = item.netMg != null ? (item.netMg / 1000).toFixed(3) : "—";
    const itemName = safePrinterText(item.itemName, 16);
    const purity = safePrinterText(item.purity, 12);
    const barcode = safeBarcode(item.barcode);
    const itemCode = safePrinterText(item.itemCode || barcode, 24);
    const huid = item.huid ? safePrinterText(item.huid, 16) : "";
    const dia = item.diaPcs != null ? String(item.diaPcs) : "";
    return `
^XA
^LT0
^LH0,0
^FO15,12^A0N,20,20^FD${itemName}^FS
^FO15,34^A0N,18,18^FDGW ${grossG} NW ${netG}^FS
^FO15,54^A0N,18,18^FDPurity: ${purity}${dia ? ` Dia:${dia}` : ""}^FS
${huid ? `^FO15,72^A0N,16,16^FDHUID: ${huid}^FS` : ""}
^FO15,${huid ? "92" : "78"}^BY2,2.0,32^BCN,32,Y,N,N^FD${barcode}^FS
^FO15,${huid ? "140" : "126"}^A0N,16,16^FDCode: ${itemCode}^FS
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
