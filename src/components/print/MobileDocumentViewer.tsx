/**
 * Canonical mobile document viewport controls.
 * Transforms only the preview stage — never changes print page geometry (A4/A5/thermal).
 */
import { useCallback, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export type MobileFitMode = "width" | "page";

export interface MobileDocumentViewerHandle {
  resetZoom: () => void;
  setFitMode: (mode: MobileFitMode) => void;
}

export function MobileDocumentViewerChrome({
  fitMode,
  onFitMode,
  zoom,
  onZoom,
  onResetZoom,
  stageId = "ornexa-print-preview-stage",
  className,
}: {
  fitMode: MobileFitMode;
  onFitMode: (mode: MobileFitMode) => void;
  zoom: number;
  onZoom: (z: number) => void;
  onResetZoom: () => void;
  stageId?: string;
  className?: string;
}) {
  const [isFs, setIsFs] = useState(false);

  const toggleFullscreen = () => {
    const el = document.getElementById(stageId);
    if (!el) return;
    if (document.fullscreenElement !== el) {
      void el.requestFullscreen?.().then(() => setIsFs(true)).catch(() => undefined);
    } else {
      void document.exitFullscreen?.().then(() => setIsFs(false)).catch(() => undefined);
    }
  };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      data-testid="mobile-document-viewer-chrome"
    >
      <Button
        type="button"
        variant={fitMode === "width" ? "default" : "outline"}
        size="sm"
        className="h-9 text-xs"
        onClick={() => onFitMode("width")}
      >
        Fit width
      </Button>
      <Button
        type="button"
        variant={fitMode === "page" ? "default" : "outline"}
        size="sm"
        className="h-9 text-xs"
        onClick={() => onFitMode("page")}
      >
        Fit page
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-9 p-0"
        aria-label="Zoom in"
        onClick={() => onZoom(Math.min(MAX_ZOOM, Math.round((zoom + ZOOM_STEP) * 10) / 10))}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-9 p-0"
        aria-label="Zoom out"
        onClick={() => onZoom(Math.max(MIN_ZOOM, Math.round((zoom - ZOOM_STEP) * 10) / 10))}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-center">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1"
        onClick={onResetZoom}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset zoom
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1"
        onClick={toggleFullscreen}
      >
        {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        Full
      </Button>
    </div>
  );
}

/** Pinch + pan stage wrapper for document preview content. */
export function MobileDocumentViewerStage({
  children,
  zoom,
  onZoom,
  fitMode,
  stageId = "ornexa-print-preview-stage",
  className,
  contentClassName,
}: {
  children: ReactNode;
  zoom: number;
  onZoom: (z: number) => void;
  fitMode: MobileFitMode;
  stageId?: string;
  className?: string;
  contentClassName?: string;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStart.current = { dist, zoom };
      panStart.current = null;
    }
  }, [pan.x, pan.y, zoom]);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && pinchStart.current) {
        const pts = [...pointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchStart.current.dist > 0) {
          const next = pinchStart.current.zoom * (dist / pinchStart.current.dist);
          onZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100)));
        }
      } else if (pointers.current.size === 1 && panStart.current && zoom > 1) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
      }
    },
    [onZoom, zoom],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  }, []);

  return (
    <div
      id={stageId}
      className={cn(
        "flex-1 min-h-0 overflow-auto bg-muted/30 rounded-lg border border-border p-2 sm:p-4 relative touch-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-testid="mobile-document-viewer-stage"
      data-fit-mode={fitMode}
    >
      <div
        className={cn("mx-auto origin-top transition-[transform] duration-75", contentClassName)}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: fitMode === "width" ? "100%" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export { MIN_ZOOM, MAX_ZOOM };
