/**
 * QR code for print receipts — CVsE73i6 shop parity.
 * Prefers cloud publicToken URL; falls back to AVS|MTJ legacy payload.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { PrintDocType } from "@/lib/printlog-store";
import { useSettings } from "@/lib/settings-store";
import { useBilling } from "@/lib/billing-store";
import { shouldRenderVerificationQr } from "@/lib/print-engine/print-branding";
import {
  payloadFor,
  registerDocumentVerification,
  resolveVerificationQrUrl,
  verificationQrUrlFromPayload,
} from "@/lib/document-verification";

export interface PrintQRProps {
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  createdAt?: number | string | Date;
  size?: number;
  label?: string;
  className?: string;
  showCaption?: boolean;
  partyLabel?: string | null;
  totalPaise?: number | null;
  verificationPublicToken?: string | null;
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
  partyLabel,
  totalPaise,
  verificationPublicToken,
}: PrintQRProps) {
  const firm = useSettings((s) => s.firm);
  const invoiceToken = useBilling(
    (s) => s.invoices.find((i) => i.id === recordId)?.verificationPublicToken,
  );
  const enabled = shouldRenderVerificationQr(firm);
  const publicToken = verificationPublicToken ?? invoiceToken ?? null;
  const legacyPayload = { docType, docNumber, recordId, createdAt };
  const qrContent =
    resolveVerificationQrUrl({
      publicToken,
      legacyPayload: publicToken ? undefined : legacyPayload,
    }) || verificationQrUrlFromPayload(payloadFor(legacyPayload));

  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!enabled) {
      setDataUrl("");
      return;
    }
    let cancelled = false;

    if (!publicToken) {
      void registerDocumentVerification({
        payload: legacyPayload,
        businessName: firm?.shopName || "Business",
        partyLabel,
        invoiceDate: createdAt ? new Date(createdAt).toISOString().slice(0, 10) : null,
        totalPaise,
        status: "verified",
      });
    }

    QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 3,
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
  }, [qrContent, size, enabled, publicToken, docType, docNumber, recordId, createdAt, partyLabel, totalPaise, firm?.shopName]);

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
