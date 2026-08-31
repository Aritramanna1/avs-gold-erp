# MTJ ERP — Hardware Integration Strategy

This document outlines the system architecture for future local hardware communication, linking retail counter physical peripherals to the browser-based MTJ ERP application.

---

## 1. Hardware Service Architecture

Because modern browsers operate in tight security sandboxes, hardware communication is designed around a unified **Hardware Abstraction Layer (HAL)** utilizing modern, standard web protocols.

```text
┌────────────────────────────────────────────────────────┐
│                   MTJ ERP Client App                   │
└───────────────────────────┬────────────────────────────┘
                            │ (WebUSB, WebSerial, WebHID)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Unified Hardware Service HAL               │
├───────────────────────────┼────────────────────────────┤
│  Scale Stream  ·  Barcode Scanner  ·  ESC/POS Printer  │
└────────────────────────────────────────────────────────┘
```

This decoupled layer allows the ERP to function correctly on any device. If hardware is not physically present, the UI gracefully defaults to manual numeric keyboard input.

---

## 2. Jewellery Weighing Scales (COM / Serial)

Precision weighing scales are critical to prevent theft and inventory discrepancies.

- **Protocol**: RS-232 / COM Serial over USB.
- **Browser Driver**: WebSerial API.
- **Data Flow**: Continuous streaming.
- **Implementation Plan**:
  ```typescript
  async function connectScale() {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1 });
      const reader = port.readable.getReader();
      // Continuous parsing loop tracking stable weight string values (e.g. "12.350 g")
    } catch (err) {
      console.error("Scale connection failed:", err);
    }
  }
  ```

---

## 3. Barcode Scanners (USB HID)

Barcode scanning facilitates rapid checkout and reliable inventory stock audits.

- **Protocol**: USB HID Keyboard Emulation.
- **Browser Driver**: Standard DOM Event Listeners.
- **Implementation Plan**:
  - Set barcode scanners to send a specific prefix character (e.g., `Ctrl+F8` or `~`) and a suffix character (e.g., `Enter`).
  - Capture and buffer keystrokes. If keys are typed with a delay interval `< 15ms`, treat them as barcode buffer inputs.
  - Trigger immediate stock database query without interrupting active text box focus.

---

## 4. Barcode Printers (Zebra / TSPL)

High-resolution label printing is necessary for tagging new physical ornaments.

- **Protocol**: Raw print stream sent via WebUSB.
- **Commands**: **ZPL** (Zebra Programming Language) or **TSPL** (TSC Printer Language).
- **Implementation Plan**:
  - Generate raw command string containing barcode coordinates, purity text, and ornament net weight values.
  - Direct USB transmission:
    ```typescript
    const device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x0a5f }] }); // Zebra Vendor ID
    await device.open();
    await device.claimInterface(0);
    await device.transferOut(1, new TextEncoder().encode(zplString));
    ```

---

## 5. Thermal & Receipt Printers (ESC/POS)

Saves countertop space and printing costs by printing quick sales, payment, or advance receipts directly on 80mm thermal paper.

- **Protocol**: WebUSB or WebBluetooth.
- **Commands**: **ESC/POS** raw standard binaries.
- **Layout Design**:
  - High-density, single-column receipt structure with bold company branding, item list, GST breakdown grid, and payment summary text.

---

## 6. Device Discovery & Diagnostics

- **Diagnostics Panel**: Located in the system Settings module.
- **Connection Status Display**: Live color indicators showing state:
  - 🔴 `Disconnected`
  - 🟡 `Connecting / Port Open`
  - 🟢 `Streaming / Operational`
- **Ping Test**: Allow operators to send a test signal to any device (e.g., flash scale display or print 1-inch alignment barcode test strip) to verify alignment before active business operations.
