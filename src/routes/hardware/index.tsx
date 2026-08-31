import { createFileRoute } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-store";
import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { hardwareService, type ScaleReading } from "@/lib/hardware-service";
import { thermalPrinterService, type ThermalPrinterStatus } from "@/lib/thermal-printer";
import {
  Scale,
  Printer,
  ScanLine,
  Tag,
  Plug,
  PlugZap,
  Wifi,
  WifiOff,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/hardware/")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  component: HardwarePage,
});

// ---------- Status LED ----------
function StatusLed({ connected, loading }: { connected: boolean; loading?: boolean }) {
  if (loading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />;
  return connected ? (
    <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse inline-block" />
  ) : (
    <span className="h-2.5 w-2.5 rounded-full bg-destructive inline-block" />
  );
}

// ---------- Section Card ----------
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 rounded-md border border-border bg-card shadow-elegant">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="text-gold">{icon}</div>
        <h2 className="font-serif text-xl text-foreground">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

// ============================================================
// SECTION 1 — Weighing Scale
// ============================================================
function WeighingScaleSection() {
  const [connected, setConnected] = useState(hardwareService.isScaleConnected);
  const [connecting, setConnecting] = useState(false);
  const [reading, setReading] = useState<ScaleReading | null>(null);

  useEffect(() => {
    const unsub = hardwareService.onScaleReading((r) => setReading(r));
    return () => {
      unsub();
    };
  }, []);

  async function handleConnect() {
    setConnecting(true);
    const ok = await hardwareService.connectPhysicalScale();
    setConnected(ok);
    setConnecting(false);
  }

  async function handleDisconnect() {
    await hardwareService.disconnectPhysicalScale();
    setConnected(false);
  }

  const weightDisplay = reading ? `${reading.weightGrams.toFixed(3)} g` : "— g";

  const isStable = reading?.isStable ?? true;

  return (
    <SectionCard title="Weighing Scale" icon={<Scale className="h-5 w-5" />}>
      <div className="flex items-center gap-3 mb-4">
        <StatusLed connected={connected} loading={connecting} />
        <Badge variant={connected ? "default" : "outline"} className="text-xs">
          {connected ? "Physical Scale Connected" : "Disconnected"}
        </Badge>
      </div>

      {/* Live Weight Display */}
      <div className="rounded-md border border-border bg-background/60 p-4 mb-5 text-center">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">
          Live Weight
        </div>
        <div
          className={`font-serif text-4xl font-bold tracking-tight ${isStable ? "text-gold" : "text-amber-500"}`}
        >
          {weightDisplay}
        </div>
        <div className="text-[11px] mt-1.5 text-muted-foreground">
          {reading ? (isStable ? "Stable" : "Stabilising…") : "No reading yet"}
        </div>
        {reading && (
          <div className="text-[10px] font-mono mt-1 text-muted-foreground/60">
            {reading.rawString}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <Button size="sm" onClick={handleConnect} disabled={connecting} className="gap-2">
            <PlugZap className="h-3.5 w-3.5" />
            Connect Scale
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={handleDisconnect} className="gap-2">
            <WifiOff className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleConnect} className="gap-2">
          <Plug className="h-3.5 w-3.5" />
          Connect Web Serial
        </Button>
      </div>

      {!("serial" in navigator) && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
          WebSerial is not available in this browser. Use Chrome or Edge for physical scale support.
        </p>
      )}
    </SectionCard>
  );
}

// ============================================================
// SECTION 2 — Thermal Printer
// ============================================================
function ThermalPrinterSection() {
  const [status, setStatus] = useState<ThermalPrinterStatus>(thermalPrinterService.status);
  const [info, setInfo] = useState(thermalPrinterService.info);

  useEffect(() => {
    const unsub = thermalPrinterService.onStatusChange((s) => {
      setStatus(s);
      setInfo(thermalPrinterService.info);
    });
    return unsub;
  }, []);

  async function handleConnect() {
    await thermalPrinterService.connect();
    setInfo(thermalPrinterService.info);
  }

  async function handleDisconnect() {
    await thermalPrinterService.disconnect();
    setInfo(null);
  }

  async function handleTestPrint() {
    await thermalPrinterService.printTextReceipt([
      "================================",
      "  " + (useSettings.getState().firm?.shopName || "Jewellers ERP"),
      "  Hardware Test Print",
      `  ${new Date().toLocaleString("en-IN")}`,
      "================================",
      "  Test line 1",
      "  Test line 2",
      "================================",
    ]);
  }

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isError = status === "error";

  return (
    <SectionCard title="Thermal Printer (ESC/POS)" icon={<Printer className="h-5 w-5" />}>
      <div className="flex items-center gap-3 mb-4">
        <StatusLed connected={isConnected} loading={isConnecting} />
        <Badge
          variant={isConnected ? "default" : isError ? "destructive" : "outline"}
          className="text-xs"
        >
          {isConnected
            ? "Connected"
            : isConnecting
              ? "Connecting…"
              : isError
                ? "Error"
                : "Disconnected"}
        </Badge>
        {!thermalPrinterService.isWebUsbAvailable && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400/30">
            WebUSB unavailable — browser print fallback
          </Badge>
        )}
      </div>

      {info && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4 text-sm">
          <div className="font-semibold text-foreground">{info.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Vendor: 0x{info.vendorId.toString(16).toUpperCase().padStart(4, "0")} · Product: 0x
            {info.productId.toString(16).toUpperCase().padStart(4, "0")}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!isConnected ? (
          <Button size="sm" onClick={handleConnect} disabled={isConnecting} className="gap-2">
            <PlugZap className="h-3.5 w-3.5" />
            Connect via WebUSB
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={handleDisconnect} className="gap-2">
            <Plug className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleTestPrint} className="gap-2">
          <Printer className="h-3.5 w-3.5" />
          Test Print
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => thermalPrinterService.printViaBrowser()}
          className="gap-2 text-muted-foreground"
        >
          Browser Print Fallback
        </Button>
      </div>
    </SectionCard>
  );
}

// ============================================================
// SECTION 3 — Barcode Scanner + Camera QR
// ============================================================
function BarcodeScannerSection() {
  const [lastScan, setLastScan] = useState<{ code: string; ts: Date } | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = hardwareService.onBarcodeScanned((code) => {
      setLastScan({ code, ts: new Date() });
    });
    return () => {
      unsub();
    };
  }, []);

  // Camera QR scanning loop
  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !detectorRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const codes = await detectorRef.current.detect(canvas);
      if (codes.length > 0) {
        const code = codes[0].rawValue;
        setLastScan({ code, ts: new Date() });
        hardwareService.triggerBarcodeScanned(code);
      }
    } catch {}
    rafRef.current = requestAnimationFrame(scanFrame);
  }, []);

  async function handleStartCamera() {
    setCameraError(null);
    if (!("BarcodeDetector" in window)) {
      setCameraError(
        "BarcodeDetector API is not supported in this browser. Try Chrome on Android or desktop.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-expect-error: BarcodeDetector not in TS lib
      detectorRef.current = new BarcodeDetector({
        formats: ["qr_code", "code_128", "ean_13", "ean_8", "code_39", "data_matrix"],
      });
      setCameraActive(true);
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      setCameraError(`Camera access failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleStopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  useEffect(() => () => handleStopCamera(), []);

  function handleManualScan(e: React.FormEvent) {
    e.preventDefault();
    if (manualInput.trim()) {
      hardwareService.triggerBarcodeScanned(manualInput.trim());
      setManualInput("");
    }
  }

  return (
    <SectionCard title="Barcode / QR Scanner" icon={<ScanLine className="h-5 w-5" />}>
      <div className="flex items-center gap-3 mb-4">
        <StatusLed connected />
        <Badge variant="default" className="text-xs">
          HID Keyboard Emulation — Always Active
        </Badge>
      </div>

      {lastScan ? (
        <div className="rounded-lg border border-border bg-success/5 p-3 mb-4">
          <div className="text-xs text-muted-foreground mb-1">Last Scanned</div>
          <div className="font-mono font-semibold text-foreground text-base">{lastScan.code}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {lastScan.ts.toLocaleString("en-IN")}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 mb-4 text-center text-xs text-muted-foreground">
          No scan yet — scan a barcode or QR code with a USB/Bluetooth scanner
        </div>
      )}

      <form onSubmit={handleManualScan} className="flex gap-2 mb-4">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Type barcode to test…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <Button type="submit" size="sm" variant="outline">
          Connect Barcode Scanner
        </Button>
      </form>

      {/* Camera QR scanner */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Camera QR Scanner</span>
          {cameraActive ? (
            <Button size="sm" variant="destructive" onClick={handleStopCamera} className="gap-2">
              <CameraOff className="h-3.5 w-3.5" />
              Stop Camera
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleStartCamera} className="gap-2">
              <Camera className="h-3.5 w-3.5" />
              Start Camera Scanner
            </Button>
          )}
        </div>

        {cameraError && <p className="text-xs text-destructive mb-2">{cameraError}</p>}

        <div className={cameraActive ? "block" : "hidden"}>
          <div className="relative rounded-md overflow-hidden border border-border aspect-video bg-black">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-gold/60 rounded-lg w-48 h-48 opacity-70" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Point camera at a QR code or barcode to scan automatically
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================================
// SECTION 4 — Label Printer (TSPL)
// ============================================================
const DEMO_ITEM = {
  itemName: "Necklace Set",
  barcode: "MTJ-2026-001",
  grossMg: 12350,
  purity: "916 (22K)",
  itemCode: "NS-001",
};

function LabelPrinterSection() {
  const [tsplCmd, setTsplCmd] = useState(() => hardwareService.generateTsplTagCommand(DEMO_ITEM));
  const [printResult, setPrintResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleTestLabel() {
    setLoading(true);
    setPrintResult(null);
    const result = await hardwareService.submitPrintJob({
      type: "tag",
      title: "Hardware Test Label",
      data: DEMO_ITEM,
      rawCommands: tsplCmd,
    });
    setPrintResult(result.message);
    setLoading(false);
  }

  return (
    <SectionCard title="Label Printer (TSPL / ZPL)" icon={<Tag className="h-5 w-5" />}>
      <div className="flex items-center gap-3 mb-4">
        <Badge variant="outline" className="text-xs">
          TSPL Commands Preview
        </Badge>
      </div>

      <div className="rounded-md border border-border bg-background/60 p-1 mb-4">
        <textarea
          value={tsplCmd}
          onChange={(e) => setTsplCmd(e.target.value)}
          rows={14}
          spellCheck={false}
          className="w-full font-mono text-xs bg-transparent p-2 resize-none focus:outline-none text-foreground/80"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" onClick={handleTestLabel} disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Tag className="h-3.5 w-3.5" />
          )}
          Connect Label Printer (WebUSB)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setPrintResult("Color printer workflow is ready for browser print output.")
          }
          className="gap-2"
        >
          Connect Color Printer
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTsplCmd(hardwareService.generateTsplTagCommand(DEMO_ITEM))}
          className="gap-2 text-muted-foreground"
        >
          Reset Commands
        </Button>
      </div>

      {printResult && (
        <div className="mt-3 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {printResult}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================
// PAGE
// ============================================================
import { HardwareDevicesRegistry } from "@/components/hardware/HardwareDevicesRegistry";

function HardwarePage() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Hardware Management"
        subtitle="Configure and test connected hardware devices — scales, printers, and scanners"
      />
      <div className="mb-6">
        <HardwareDevicesRegistry />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <WeighingScaleSection />
        <ThermalPrinterSection />
        <BarcodeScannerSection />
        <LabelPrinterSection />
      </div>
    </div>
  );
}
