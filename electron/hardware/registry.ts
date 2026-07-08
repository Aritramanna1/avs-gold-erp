import type { HardwareDeviceInfo, HardwareDriver, HardwareEvent, HardwareKind } from "./types";

/**
 * Single registry the main process holds for every known hardware driver
 * instance. IPC handlers in main.ts are the only callers — the registry
 * itself has no Electron dependency, so it's unit-testable in plain Node.
 */
export class HardwareRegistry {
  private drivers = new Map<string, HardwareDriver>();
  private globalListeners = new Set<(event: HardwareEvent) => void>();

  register(driver: HardwareDriver): void {
    if (this.drivers.has(driver.id)) {
      throw new Error(`Hardware driver with id "${driver.id}" is already registered.`);
    }
    this.drivers.set(driver.id, driver);
    driver.onEvent((event) => {
      for (const listener of this.globalListeners) listener(event);
    });
  }

  unregister(id: string): void {
    this.drivers.delete(id);
  }

  list(): HardwareDeviceInfo[] {
    return Array.from(this.drivers.values()).map((d) => ({
      id: d.id,
      kind: d.kind,
      label: d.label,
      connected: d.isConnected(),
    }));
  }

  listByKind(kind: HardwareKind): HardwareDeviceInfo[] {
    return this.list().filter((d) => d.kind === kind);
  }

  get(id: string): HardwareDriver | undefined {
    return this.drivers.get(id);
  }

  async connect(id: string): Promise<void> {
    const driver = this.requireDriver(id);
    await driver.connect();
  }

  async disconnect(id: string): Promise<void> {
    const driver = this.requireDriver(id);
    await driver.disconnect();
  }

  async sendCommand(id: string, command: string, args?: unknown): Promise<unknown> {
    const driver = this.requireDriver(id);
    return driver.sendCommand(command, args);
  }

  /** Subscribe to events from every registered driver, regardless of kind. */
  onAnyEvent(listener: (event: HardwareEvent) => void): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  private requireDriver(id: string): HardwareDriver {
    const driver = this.drivers.get(id);
    if (!driver) throw new Error(`No hardware driver registered with id "${id}".`);
    return driver;
  }
}
