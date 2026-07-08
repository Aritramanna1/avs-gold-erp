"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDriver = void 0;
/**
 * A driver with no physical device behind it — used for development without
 * hardware attached, and as the reference implementation new real drivers
 * should be shaped after. `sendCommand("simulate-event", {...})` lets a
 * developer (or a validation script) trigger the same event path a real
 * device would, e.g. simulating a barcode scan or a scale reading.
 */
class MockDriver {
    id;
    kind;
    label;
    connected = false;
    listeners = new Set();
    constructor(id, kind, label) {
        this.id = id;
        this.kind = kind;
        this.label = label;
    }
    isConnected() {
        return this.connected;
    }
    async connect() {
        this.connected = true;
    }
    async disconnect() {
        this.connected = false;
    }
    async sendCommand(command, args) {
        if (!this.connected)
            throw new Error(`Driver "${this.id}" is not connected.`);
        if (command === "simulate-event") {
            const eventArgs = (args ?? {});
            const event = {
                deviceId: this.id,
                kind: this.kind,
                type: eventArgs.type ?? "simulated",
                payload: eventArgs.payload ?? null,
                at: new Date().toISOString(),
            };
            for (const listener of this.listeners)
                listener(event);
            return { ok: true };
        }
        return { ok: true, echoed: command, args };
    }
    onEvent(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
exports.MockDriver = MockDriver;
