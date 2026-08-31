/**
 * Upload and enable real stamp / signature assets for print & PDF output.
 * Customization → Printing & Profiles.
 */
import { useRef, useState } from "react";
import { ImageIcon, Loader2, Stamp, Upload, PenLine } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/lib/settings-store";
import { uploadFileToSupabase } from "@/lib/supabase-storage";
import { toast } from "sonner";
import { R2ObjectImage } from "@/components/storage/R2ObjectImage";

function AssetSlot({
  title,
  description,
  enabled,
  onEnabledChange,
  storagePath,
  onUploaded,
  onClear,
  icon: Icon,
  uploadFolder,
  uploadDocKey,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  storagePath?: string;
  onUploaded: (url: string, path: string) => void;
  onClear: () => void;
  icon: typeof Stamp;
  uploadFolder: string;
  uploadDocKey: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }
    setUploading(true);
    try {
      const { filePath, signedUrl } = await uploadFileToSupabase(
        "firm-assets",
        file,
        uploadFolder,
        uploadDocKey,
      );
      onUploaded(signedUrl, filePath);
      toast.success(`${title} uploaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-md border border-border p-4 space-y-3 bg-card/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 rounded-md bg-gold/10 text-gold grid place-items-center border border-gold/20 shrink-0">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor={`enable-${uploadDocKey}`} className="text-xs text-muted-foreground">
            Use on print
          </Label>
          <Switch
            id={`enable-${uploadDocKey}`}
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={!storagePath}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-20 w-28 rounded border border-border bg-muted/30 overflow-hidden grid place-items-center">
          {storagePath ? (
            <R2ObjectImage
              bucket="firm-assets"
              storagePath={storagePath}
              alt={title}
              className="object-contain w-full h-full p-1"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
          </Button>
          {storagePath && (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              Remove
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFileChange(e)}
          />
        </div>
      </div>
      {!storagePath && (
        <p className="text-[11px] text-amber-600/90">
          No image configured — documents will show signature lines only (no fake stamp).
        </p>
      )}
    </div>
  );
}

export function PrintBrandingAssetsPanel() {
  const { firm, setFirm } = useSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-gold">Stamp & Signature Assets</CardTitle>
        <CardDescription>
          Upload your real company stamp and authorized signature. They appear on invoices and
          documents only when enabled here — never a simulated placeholder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AssetSlot
          title="Manual Stamp Image"
          description="Scanned rubber stamp or official seal — not auto-generated text."
          enabled={!!firm.printStampEnabled}
          onEnabledChange={(printStampEnabled) => setFirm({ printStampEnabled })}
          storagePath={firm.stampImageStoragePath}
          onUploaded={(_url, stampImageStoragePath) =>
            setFirm({ stampImageStoragePath, printStampEnabled: true })
          }
          onClear={() => setFirm({ stampImageStoragePath: "", printStampEnabled: false })}
          icon={Stamp}
          uploadFolder="print_assets"
          uploadDocKey="manual_stamp"
        />

        <AssetSlot
          title="Authorized Signature"
          description="Signatory scan for printed invoices and vouchers."
          enabled={!!firm.printSignatureEnabled}
          onEnabledChange={(printSignatureEnabled) => setFirm({ printSignatureEnabled })}
          storagePath={firm.authorizedSignatureStoragePath}
          onUploaded={(_url, authorizedSignatureStoragePath) =>
            setFirm({ authorizedSignatureStoragePath, printSignatureEnabled: true })
          }
          onClear={() =>
            setFirm({ authorizedSignatureStoragePath: "", printSignatureEnabled: false })
          }
          icon={PenLine}
          uploadFolder="print_assets"
          uploadDocKey="authorized_signature"
        />

        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Bill verification QR codes</strong> are disabled by default (legacy feature).
            Enable only if your firm uses online document verification.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Switch
              id="print-verification-qr"
              checked={!!firm.printVerificationQrEnabled}
              onCheckedChange={(printVerificationQrEnabled) =>
                setFirm({ printVerificationQrEnabled })
              }
            />
            <Label htmlFor="print-verification-qr">Enable verification QR on documents</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
