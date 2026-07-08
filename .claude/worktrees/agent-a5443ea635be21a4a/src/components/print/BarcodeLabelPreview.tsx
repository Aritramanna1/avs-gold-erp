import { useMemo } from "react";
import { Barcode } from "@/components/barcode";
import { mgToGrams } from "@/lib/gold";
import type { StockItem } from "@/lib/stock-store";

interface BarcodeLabelPreviewProps {
  item: StockItem;
  tagSize?: string; // "50x38mm" | "40x25mm"
  showPrice?: boolean;
  showHuid?: boolean;
  showMaking?: boolean;
  shopName?: string;
  layout?: "dual_landscape" | "portrait_upright" | "single_thermal";
}

export function BarcodeLabelPreview({
  item,
  tagSize = "50x38mm",
  showPrice = false,
  showHuid = true,
  showMaking = false,
  shopName = "",
  layout = "dual_landscape",
}: BarcodeLabelPreviewProps) {
  // Determine dimensions based on tag size and layout orientation settings
  const is50x38 = tagSize === "50x38mm";
  const isPortrait = layout === "portrait_upright";

  const widthPx = isPortrait ? "240px" : is50x38 ? "380px" : "320px";
  const heightPx = isPortrait ? "385px" : is50x38 ? "240px" : "200px";

  // Crisp offline micro vector QR Code rendering grid mapping
  const qrGrid = useMemo(() => {
    const codeStr = `MTJ-VERIFY:${item.itemCode || item.id}`;
    const gridDim = 21; // 21x21 grid for Version 1 QR code representation
    const grid: boolean[][] = Array(gridDim)
      .fill(null)
      .map(() => Array(gridDim).fill(false));

    // Draw Finder Patterns (Corners: 7x7 squares)
    const drawFinder = (row: number, col: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[row + r][col + c] = isBorder || isCenter;
        }
      }
    };

    drawFinder(0, 0); // Top Left
    drawFinder(0, gridDim - 7); // Top Right
    drawFinder(gridDim - 7, 0); // Bottom Left

    // Draw timing patterns (dashed lines bridging corner boxes)
    for (let i = 8; i < gridDim - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Algoritmically fill remaining columns
    let charIndex = 0;
    for (let r = 0; r < gridDim; r++) {
      for (let c = 0; c < gridDim; c++) {
        const isTopLeft = r < 9 && c < 9;
        const isTopRight = r < 9 && c >= gridDim - 9;
        const isBottomLeft = r >= gridDim - 9 && c < 9;
        if (isTopLeft || isTopRight || isBottomLeft) continue;

        if (r === 6 || c === 6) continue;

        const charCode = codeStr.charCodeAt(charIndex % codeStr.length);
        const bitIndex = (r * gridDim + c) % 8;
        grid[r][c] = ((charCode >> bitIndex) & 1) === 1;
        charIndex++;
      }
    }

    return grid;
  }, [item.itemCode, item.id]);

  return (
    <div
      data-testid="barcode-label-preview-root"
      className="bg-white text-black font-sans p-2 border border-neutral-300 rounded shadow-sm hover:shadow-md transition-shadow duration-200"
      style={{
        width: widthPx,
        height: heightPx,
        pageBreakInside: "avoid",
      }}
    >
      <div className="h-full flex flex-col justify-between p-1">
        {/* Top Shop Banner with Shop Name */}
        <div className="flex items-center justify-between border-b border-black/40 pb-1">
          <div className="flex flex-col items-start leading-[1.1]">
            <div className="text-[11px] font-bold tracking-tight uppercase truncate max-w-[180px]">
              {shopName}
            </div>
          </div>
          <div className="text-[10px] font-mono font-bold text-neutral-700 bg-neutral-100 px-1 py-0.5 rounded leading-none shrink-0 self-center">
            {item.itemCode}
          </div>
        </div>

        {/* Item Identification */}
        <div className="mt-1 leading-tight">
          <div className="font-semibold text-xs text-neutral-900 truncate">{item.itemName}</div>
          <div className="text-[10px] text-neutral-600 font-medium">
            {item.category} · <span className="font-semibold">{item.purity}</span>
          </div>
        </div>

        {/* Technical Vault Parameters (Weights & Certification) */}
        <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] bg-neutral-50 p-1 rounded border border-neutral-200/50">
          <div>
            <div className="text-neutral-500 font-medium text-[9px]">GROSS</div>
            <div className="font-bold text-neutral-800">{mgToGrams(item.grossMg)}g</div>
          </div>
          <div>
            <div className="text-neutral-500 font-medium text-[9px]">NET</div>
            <div className="font-bold text-neutral-800">{mgToGrams(item.netMg)}g</div>
          </div>
          {showHuid && (
            <div>
              <div className="text-neutral-500 font-medium text-[9px]">HUID</div>
              <div className="font-bold text-amber-900 truncate tracking-tight">
                {item.huid || "—"}
              </div>
            </div>
          )}
        </div>

        {/* Optional Financial Ledger & Making Estimates */}
        {(showPrice || showMaking) && (
          <div className="flex justify-between items-center text-[10px] font-mono bg-amber-50/50 px-1 py-0.5 rounded border border-amber-100 mt-1">
            {showMaking && item.makingChargePerGPaise !== undefined && (
              <span className="text-[9px] font-medium text-amber-900">
                MC: ₹{(item.makingChargePerGPaise / 100).toFixed(2)}/g
              </span>
            )}
            {showPrice && item.pricePaise !== undefined && (
              <span className="font-bold text-neutral-900 ml-auto">
                ₹{(item.pricePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        )}

        {/* Integrated dual barcode and QR representation tag bottom layout */}
        <div
          className={`mt-1 flex gap-2 bg-neutral-50 p-1 rounded border border-neutral-200/50 ${isPortrait ? "flex-col items-center" : "items-center justify-between"}`}
        >
          <div className="w-full flex justify-center bg-white py-1 rounded border border-neutral-150 shrink-min">
            <Barcode
              value={item.barcode}
              height={isPortrait ? 40 : is50x38 ? 32 : 24}
              width={isPortrait ? 1.1 : is50x38 ? 1.0 : 0.8}
              fontSize={8}
              color="#000000"
              background="#ffffff"
            />
          </div>
          <div className="shrink-0 flex items-center justify-center p-0.5 border border-neutral-150 bg-white rounded">
            <svg
              width={isPortrait ? 40 : is50x38 ? 34 : 26}
              height={isPortrait ? 40 : is50x38 ? 34 : 26}
              viewBox="0 0 21 21"
              shapeRendering="crispEdges"
              className="text-black"
              style={{ imageRendering: "pixelated" }}
            >
              <rect width="21" height="21" fill="#FFFFFF" />
              {qrGrid.map((row, r) =>
                row.map((active, c) =>
                  active ? (
                    <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000000" />
                  ) : null,
                ),
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
