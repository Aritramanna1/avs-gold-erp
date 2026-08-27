/**
 * AVS ERP — QR code for print receipts.
 * Encodes a public verification URL (/doc/{token} or /verify?payload=…), never a private ERP route.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { PrintDocType } from "@/lib/printlog-store";
import { useSettings } from "@/lib/settings-store";
import { shouldRenderVerificationQr } from "@/lib/print-engine/print-branding";
import { resolveDocumentVerifyQrContent } from "@/lib/print-engine/document-verify-url";

export interface PrintQRProps {
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  createdAt?: number | string | Date;
  size?: number;
  label?: string;
  className?: string;
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
  const firm = useSettings((s) => s.firm);
  const enabled = shouldRenderVerificationQr(firm);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!enabled) {
      setDataUrl("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { content } = await resolveDocumentVerifyQrContent({
          docType,
          docNumber,
          recordId,
          createdAt,
        });
        const url = await QRCode.toDataURL(content, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: size * 3,
          color: { dark: "#000000", light: "#FFFFFFFF" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docType, docNumber, recordId, createdAt, size, enabled]);

  if (!enabled) return null;

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
