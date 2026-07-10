/**
 * MTJ ERP — QR code component for print receipts.
 * Wraps the `qrcode` library and renders a small <img> that prints crisp.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { payloadFor } from "@/lib/verify-token";
import type { PrintDocType } from "@/lib/printlog-store";

export interface PrintQRProps {
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  createdAt?: number | string | Date;
  size?: number; // px, default 96
  label?: string; // small caption under code
  className?: string;
  /** Set false to omit the label/docNumber caption — for space-constrained contexts like jewellery tags. Default true. */
  showCaption?: boolean;
}

export function PrintQR({
  docType,
  docNumber,
  recordId,
  createdAt,
  size = 96,
  label = "Verify",
  className,
  showCaption = true,
}: PrintQRProps) {
  const payload = payloadFor({ docType, docNumber, recordId, createdAt });
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 3, // crisp on print
      color: { dark: "#000000", light: "#FFFFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  return (
    <div
      className={`inline-flex flex-col items-center text-[8px] text-gray-600 ${className ?? ""}`}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Verification QR"
          width={size}
          height={size}
          style={{ width: size, height: size }}
        />
      ) : (
        <div style={{ width: size, height: size }} className="bg-gray-100 border border-gray-300" />
      )}
      {showCaption && (
        <div className="mt-0.5 leading-tight text-center">
          {label}
          <div className="font-mono">{docNumber}</div>
        </div>
      )}
    </div>
  );
}
