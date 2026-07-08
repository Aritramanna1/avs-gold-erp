/**
 * MTJ ERP — Barcode component (Code128 via JsBarcode → inline SVG).
 */
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({
  value,
  height = 48,
  width = 1.6,
  fontSize = 12,
  displayValue = true,
  className,
  background = "transparent",
  color = "currentColor",
}: {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
  background?: string;
  color?: string;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width,
        displayValue,
        fontSize,
        margin: 0,
        background,
        lineColor: color,
      });
    } catch {
      // ignore
    }
  }, [value, height, width, fontSize, displayValue, background, color]);
  return <svg ref={ref} className={className} />;
}
