/**
 * Hardware Manager abstraction (Plan 1, Step 7).
 *
 * Every physical device category (barcode/QR scanner, weighing scale,
 * thermal/A4/label/receipt printer, cash drawer, camera, document scanner,
 * fingerprint/RFID reader) implements this one interface. The ERP's
 * renderer code (and hardware-service.ts) only ever talks to the registry
 * below by device *kind*, never to a specific brand/protocol — adding a new
 * physical device later means writing one new driver file, not touching the
 * ERP or the IPC surface.
 *
 * IMPORTANT — validation scope: this interface, the registry, and the
 * bundled MockDriver are validated (drivers connect/disconnect, emit events,
 * round-trip commands, registry lookup/list). The concrete drivers for real
 * hardware (actual USB/serial/Bluetooth protocols for scanners, scales,
 * printers, etc.) are NOT implemented here — they cannot be honestly
 * validated without the physical devices, and stubbing 15 fake protocol
 * implementations would misrepresent what's actually working. Each real
 * driver should be added, one at a time, against real hardware, implementing
 * exactly this interface.
 */
export type HardwareKind =
  | "barcode-scanner"
  | "weighing-scale"
  | "thermal-printer"
  | "a4-printer"
  | "label-printer"
  | "receipt-printer"
  | "cash-drawer"
  | "camera"
  | "document-scanner"
  | "biometric-reader"
  | "rfid-reader";

export interface HardwareDeviceInfo {
  id: string;
  kind: HardwareKind;
  label: string;
  connected: boolean;
}

export interface HardwareEvent {
  deviceId: string;
  kind: HardwareKind;
  type: string; // e.g. "scan", "weight-reading", "print-complete", "error"
  payload: unknown;
  at: string; // ISO timestamp
}

export interface HardwareDriver {
  readonly id: string;
  readonly kind: HardwareKind;
  readonly label: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Sends a device-specific command (e.g. print job, drawer-open pulse) and returns a driver-specific result. */
  sendCommand(command: string, args?: unknown): Promise<unknown>;
  /** Subscribe to device-originated events (scans, readings). Returns an unsubscribe function. */
  onEvent(listener: (event: HardwareEvent) => void): () => void;
}
