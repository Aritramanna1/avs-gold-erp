import type { HardwareDriver, HardwareEvent, HardwareKind } from "../types";

/**
 * A driver with no physical device behind it — used for development without
 * hardware attached, and as the reference implementation new real drivers
 * should be shaped after. `sendCommand("simulate-event", {...})` lets a
 * developer (or a validation script) trigger the same event path a real
 * device would, e.g. simulating a barcode scan or a scale reading.
 */
export class MockDriver implements HardwareDriver {
  readonly id: string;
  readonly kind: HardwareKind;
  readonly label: string;
  private connected = false;
  private listeners = new Set<(event: HardwareEvent) => void>();

  constructor(id: string, kind: HardwareKind, label: string) {
    this.id = id;
    this.kind = kind;
    this.label = label;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async sendCommand(command: string, args?: unknown): Promise<unknown> {
    if (!this.connected) throw new Error(`Driver "${this.id}" is not connected.`);
    if (command === "simulate-event") {
      const eventArgs = (args ?? {}) as { type?: string; payload?: unknown };
      const event: HardwareEvent = {
        deviceId: this.id,
        kind: this.kind,
        type: eventArgs.type ?? "simulated",
        payload: eventArgs.payload ?? null,
        at: new Date().toISOString(),
      };
      for (const listener of this.listeners) listener(event);
      return { ok: true };
    }
    return { ok: true, echoed: command, args };
  }

  onEvent(listener: (event: HardwareEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
