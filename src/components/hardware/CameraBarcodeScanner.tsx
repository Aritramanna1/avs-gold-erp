import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, AlertTriangle } from "lucide-react";

/**
 * Live camera barcode/QR scanner — uses the browser's native BarcodeDetector
 * API (supported in Electron's Chromium engine) rather than pulling in a
 * separate scanning library, since Electron already ships everything this
 * needs. Detects camera availability, requests permission explicitly, runs
 * a live detection loop while open, and fails gracefully (clear message,
 * never a crash) if no camera exists, permission is denied, or
 * BarcodeDetector isn't available on this build.
 */
export function CameraBarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<
    "checking" | "ready" | "no-camera" | "denied" | "unsupported"
  >("checking");
  const [lastDetected, setLastDetected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!("BarcodeDetector" in window)) {
        setStatus("unsupported");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }

      // Detect camera presence before requesting permission — a clearer
      // failure message than letting getUserMedia throw for "no device".
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some((d) => d.kind === "videoinput");
        if (!hasCamera) {
          setStatus("no-camera");
          return;
        }
      } catch {
        // enumerateDevices can fail pre-permission on some platforms —
        // fall through and let getUserMedia itself be the source of truth.
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ready");

        const detector = new (window as any).BarcodeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
        });

        const scanLoop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const value = codes[0].rawValue as string;
              setLastDetected(value);
              onDetected(value);
              return; // stop the loop — caller decides whether to reopen
            }
          } catch {
            // A single failed detect() frame is not fatal — keep scanning.
          }
          rafRef.current = requestAnimationFrame(() => void scanLoop());
        };
        rafRef.current = requestAnimationFrame(() => void scanLoop());
      } catch (err: any) {
        if (cancelled) return;
        setStatus(err?.name === "NotAllowedError" ? "denied" : "no-camera");
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="h-4 w-4 text-gold" /> Live Camera Scan
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="camera-scanner-close">
          <CameraOff className="h-4 w-4" /> Close
        </Button>
      </div>

      {status === "ready" && (
        <video
          ref={videoRef}
          className="w-full max-w-md rounded-lg border border-border"
          muted
          playsInline
          data-testid="camera-scanner-video"
        />
      )}

      {status === "checking" && (
        <p className="text-sm text-muted-foreground">Requesting camera access…</p>
      )}
      {status === "unsupported" && (
        <div
          className="flex items-start gap-2 text-sm text-amber-600"
          data-testid="camera-scanner-unsupported"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Live camera scanning isn't supported on this build. Use a USB barcode scanner or type
            the code manually below — both work exactly the same as scanning.
          </span>
        </div>
      )}
      {status === "no-camera" && (
        <div
          className="flex items-start gap-2 text-sm text-amber-600"
          data-testid="camera-scanner-no-camera"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            No camera was detected on this device. Use a USB barcode scanner or type the code
            manually.
          </span>
        </div>
      )}
      {status === "denied" && (
        <div
          className="flex items-start gap-2 text-sm text-destructive"
          data-testid="camera-scanner-denied"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Camera permission was denied. Enable camera access for this app in your system settings,
            or use a USB barcode scanner / manual entry instead.
          </span>
        </div>
      )}
      {lastDetected && <p className="text-xs text-emerald-600">Detected: {lastDetected}</p>}
    </div>
  );
}
