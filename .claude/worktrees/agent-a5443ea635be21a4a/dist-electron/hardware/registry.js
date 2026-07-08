"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HardwareRegistry = void 0;
/**
 * Single registry the main process holds for every known hardware driver
 * instance. IPC handlers in main.ts are the only callers — the registry
 * itself has no Electron dependency, so it's unit-testable in plain Node.
 */
class HardwareRegistry {
    drivers = new Map();
    globalListeners = new Set();
    register(driver) {
        if (this.drivers.has(driver.id)) {
            throw new Error(`Hardware driver with id "${driver.id}" is already registered.`);
        }
        this.drivers.set(driver.id, driver);
        driver.onEvent((event) => {
            for (const listener of this.globalListeners)
                listener(event);
        });
    }
    unregister(id) {
        this.drivers.delete(id);
    }
    list() {
        return Array.from(this.drivers.values()).map((d) => ({
            id: d.id,
            kind: d.kind,
            label: d.label,
            connected: d.isConnected(),
        }));
    }
    listByKind(kind) {
        return this.list().filter((d) => d.kind === kind);
    }
    get(id) {
        return this.drivers.get(id);
    }
    async connect(id) {
        const driver = this.requireDriver(id);
        await driver.connect();
    }
    async disconnect(id) {
        const driver = this.requireDriver(id);
        await driver.disconnect();
    }
    async sendCommand(id, command, args) {
        const driver = this.requireDriver(id);
        return driver.sendCommand(command, args);
    }
    /** Subscribe to events from every registered driver, regardless of kind. */
    onAnyEvent(listener) {
        this.globalListeners.add(listener);
        return () => this.globalListeners.delete(listener);
    }
    requireDriver(id) {
        const driver = this.drivers.get(id);
        if (!driver)
            throw new Error(`No hardware driver registered with id "${id}".`);
        return driver;
    }
}
exports.HardwareRegistry = HardwareRegistry;
