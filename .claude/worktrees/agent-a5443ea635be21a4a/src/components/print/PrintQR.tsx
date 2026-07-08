import { QRCodeBlock } from "./QRCodeBlock";

interface PrintQRProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Reusable vector-crisp Document Verification QR Block.
 * Standardizes branding elements and offline checksum layout across A4 and thermal templates.
 */
export function PrintQR({
  value,
  size = 96,
  label = "Scan to Verify",
  className = "",
}: PrintQRProps) {
  if (!value) return null;

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      data-testid="print-qr-composite"
    >
      <QRCodeBlock value={value} size={size} label={label} />
    </div>
  );
}
