import { Barcode } from "@/components/barcode";
import { PrintQR } from "@/components/print-qr";
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
  const qrSize = isPortrait ? 40 : is50x38 ? 34 : 26;

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
            {showMaking && item.makingChargePct !== undefined && (
              <span className="text-[9px] font-medium text-amber-900">
                MC: {item.makingChargePct}%
              </span>
            )}
            {showMaking &&
              item.makingChargePct === undefined &&
              item.makingChargePerGPaise !== undefined && (
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
            <PrintQR
              docType="jewellery_tag"
              docNumber={item.itemCode || item.id}
              recordId={item.id}
              size={qrSize}
              showCaption={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
