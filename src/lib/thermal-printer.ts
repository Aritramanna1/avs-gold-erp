/**
 * MTJ ERP — Thermal Printer Service
 * Supports WebUSB ESC/POS printing for thermal receipts and jewellery tags.
 * Falls back gracefully to browser window.print() when WebUSB is unavailable.
 */
import { useSettings } from "./settings-store";
import { printDocument } from "./print-document";

declare global {
  type USBDevice = any;
  type USBEndpoint = any;
}

export type ThermalPrinterStatus = "disconnected" | "connecting" | "connected" | "error";

export interface PrinterInfo {
  name: string;
  vendorId: number;
  productId: number;
}

class ThermalPrinterService {
  private device: USBDevice | null = null;
  private endpoint: USBEndpoint | null = null;
  private _status: ThermalPrinterStatus = "disconnected";
  private statusCallbacks: Set<(s: ThermalPrinterStatus) => void> = new Set();

  get status(): ThermalPrinterStatus {
    return this._status;
  }
  get isConnected(): boolean {
    return this._status === "connected";
  }
  get isWebUsbAvailable(): boolean {
    return typeof navigator !== "undefined" && "usb" in navigator;
  }

  onStatusChange(cb: (s: ThermalPrinterStatus) => void): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  private setStatus(s: ThermalPrinterStatus) {
    this._status = s;
    this.statusCallbacks.forEach((cb) => cb(s));
  }

  /** Request user to select a USB thermal printer and connect */
  async connect(): Promise<boolean> {
    if (!this.isWebUsbAvailable) {
      console.warn("[ThermalPrinter] WebUSB not available — will use browser print");
      return false;
    }
    try {
      this.setStatus("connecting");
      // @ts-expect-error: WebUSB not in standard TS dom lib yet
      const device: USBDevice = await navigator.usb.requestDevice({
        filters: [
          { classCode: 7 }, // USB_CLASS_PRINTER
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star
          { vendorId: 0x154f }, // SNBC / Bixolon
          { vendorId: 0x0dd4 }, // Custom Engineering
        ],
      });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);
      // Find bulk-OUT endpoint
      const iface = device.configuration?.interfaces[0];
      const alt = iface?.alternates[0];
      const ep = alt?.endpoints.find((e: any) => e.direction === "out" && e.type === "bulk");
      this.device = device;
      this.endpoint = ep ?? null;
      this.setStatus("connected");
      return true;
    } catch (err) {
      console.error("[ThermalPrinter] Connection failed:", err);
      this.setStatus("error");
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.device) return;
    try {
      await this.device.close();
    } catch {}
    this.device = null;
    this.endpoint = null;
    this.setStatus("disconnected");
  }

  /** Send raw ESC/POS byte array to printer */
  async sendRaw(data: Uint8Array): Promise<boolean> {
    if (!this.device || !this.endpoint) {
      console.warn("[ThermalPrinter] Not connected, falling back to browser print");
      void printDocument("Thermal Receipt", "Receipt");
      return false;
    }
    try {
      await this.device.transferOut(this.endpoint.endpointNumber, data);
      return true;
    } catch (err) {
      console.error("[ThermalPrinter] Send failed:", err);
      this.setStatus("error");
      return false;
    }
  }

  /** Build minimal ESC/POS receipt bytes and send */
  async printTextReceipt(lines: string[]): Promise<boolean> {
    const encoder = new TextEncoder();
    const ESC = 0x1b;
    const GS = 0x1d;
    // Init, set center, print lines, cut
    const parts: Uint8Array[] = [
      new Uint8Array([ESC, 0x40]), // Initialize
      new Uint8Array([ESC, 0x61, 0x01]), // Center align
    ];
    for (const line of lines) {
      // ESC/POS printers use CP437 by default — replace ₹ with "Rs." to avoid byte corruption
      const safe = line.replace(/₹/g, "Rs.");
      parts.push(encoder.encode(safe + "\n"));
    }
    parts.push(new Uint8Array([GS, 0x56, 0x00])); // Full cut
    const total = parts.reduce((acc, p) => acc + p.length, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      combined.set(p, offset);
      offset += p.length;
    }
    return this.sendRaw(combined);
  }

  /** Fallback to browser print if no physical printer */
  printViaBrowser(): void {
    void printDocument("Thermal Receipt", "Receipt");
  }

  /**
   * Opens a cash drawer wired through the printer's RJ11/RJ12 kick-out
   * port — the standard way POS cash drawers are triggered (there is no
   * separate "cash drawer protocol"; it's this same ESC/POS pulse sent down
   * the printer's own cable, real hardware behavior, not a made-up API).
   * `ESC p m t1 t2` (0x1B 0x70 0x00 0x19 0xFA) is the standard kick command
   * most drawers (including ones with no printer attached at all) respond
   * to. Returns false — never throws — when no printer is connected, so
   * callers can disable the drawer button gracefully instead of the action
   * silently failing.
   */
  async openCashDrawer(): Promise<boolean> {
    if (!this.device || !this.endpoint) {
      console.warn("[ThermalPrinter] Cannot open cash drawer — no printer connected.");
      return false;
    }
    return this.sendRaw(getCashDrawerCommand());
  }

  get info(): PrinterInfo | null {
    if (!this.device) return null;
    return {
      name: this.device.productName ?? "Unknown Printer",
      vendorId: this.device.vendorId,
      productId: this.device.productId,
    };
  }
}

export const thermalPrinterService = new ThermalPrinterService();

const DEFAULT_CASH_DRAWER_COMMAND = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

/** Parses Settings → Hardware → Cash Drawer's configured hex-byte string (e.g. "1B 70 00 19 FA"); falls back to the standard ESC/POS kick pulse if unset or malformed. */
function getCashDrawerCommand(): Uint8Array {
  const configured = useSettings.getState().hardware.cashDrawerEscPosCommand?.trim();
  if (!configured) return DEFAULT_CASH_DRAWER_COMMAND;

  const bytes = configured
    .split(/\s+/)
    .map((hex) => parseInt(hex, 16))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 0xff);

  return bytes.length > 0 ? new Uint8Array(bytes) : DEFAULT_CASH_DRAWER_COMMAND;
}
