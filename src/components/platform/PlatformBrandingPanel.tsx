/**
 * Platform branding — logo upload and company information.
 */
import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fileToDataUrl,
  loadPlatformBrandingSettings,
  savePlatformBrandingSettings,
  type PlatformBrandingSettings,
} from "@/lib/platform-branding";

type LogoSlot = "logoPrimary" | "logoCompact" | "logoDocument";

const LOGO_LABELS: Record<LogoSlot, string> = {
  logoPrimary: "Primary Logo",
  logoCompact: "Compact Logo / Icon",
  logoDocument: "Document Logo (PDF)",
};

export function PlatformBrandingPanel() {
  const [settings, setSettings] = useState<PlatformBrandingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<LogoSlot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPlatformBrandingSettings().then(setSettings);
  }, []);

  async function handleSave() {
    if (!settings || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await savePlatformBrandingSettings(settings);
      setMessage("Branding settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save branding settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(slot: LogoSlot, file: File | null) {
    if (!file || !settings) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a PNG or JPEG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be under 2 MB.");
      return;
    }
    setUploading(slot);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const next = { ...settings, [slot]: dataUrl };
      setSettings(next);
      await savePlatformBrandingSettings({ [slot]: dataUrl });
      setMessage(`${LOGO_LABELS[slot]} updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function removeLogo(slot: LogoSlot) {
    if (!settings) return;
    const next = { ...settings, [slot]: null };
    setSettings(next);
    await savePlatformBrandingSettings({ [slot]: null });
    setMessage(`${LOGO_LABELS[slot]} removed.`);
  }

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading branding…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(LOGO_LABELS) as LogoSlot[]).map((slot) => (
          <div
            key={slot}
            className="erp-surface rounded-md border border-border bg-card p-4 space-y-3"
          >
            <h4 className="text-xs font-semibold text-gold">{LOGO_LABELS[slot]}</h4>
            <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border bg-muted/20">
              {settings[slot] ? (
                <img
                  src={settings[slot]!}
                  alt={LOGO_LABELS[slot]}
                  className="max-h-16 max-w-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-muted-foreground">No logo uploaded</span>
              )}
            </div>
            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploading === slot}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleLogoUpload(slot, f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1"
                  disabled={uploading === slot}
                  asChild
                >
                  <span>
                    {uploading === slot ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    Upload
                  </span>
                </Button>
              </label>
              {settings[slot] && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => void removeLogo(slot)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4">
        <h3 className="font-serif font-bold text-base text-gold">Company / Platform Information</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <Field
            label="Platform Name"
            value={settings.appName}
            onChange={(v) => setSettings({ ...settings, appName: v })}
          />
          <Field
            label="Legal / Display Name"
            value={settings.legalName}
            onChange={(v) => setSettings({ ...settings, legalName: v })}
          />
          <Field
            label="Tagline"
            value={settings.tagline}
            onChange={(v) => setSettings({ ...settings, tagline: v })}
          />
          <Field
            label="Email"
            value={settings.email}
            onChange={(v) => setSettings({ ...settings, email: v })}
          />
          <Field
            label="Phone"
            value={settings.phone}
            onChange={(v) => setSettings({ ...settings, phone: v })}
          />
          <Field
            label="Website"
            value={settings.website}
            onChange={(v) => setSettings({ ...settings, website: v })}
          />
          <Field
            label="GSTIN"
            value={settings.gstin}
            onChange={(v) => setSettings({ ...settings, gstin: v })}
          />
          <Field
            label="CIN / Registration"
            value={settings.cin}
            onChange={(v) => setSettings({ ...settings, cin: v })}
          />
          <div className="sm:col-span-2">
            <Field
              label="Address"
              value={settings.address}
              onChange={(v) => setSettings({ ...settings, address: v })}
              multiline
            />
          </div>
        </div>
        <Button size="sm" disabled={saving} onClick={() => void handleSave()} className="text-xs">
          {saving ? "Saving…" : "Save Branding"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase text-muted-foreground font-mono">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background p-2 text-xs"
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
      )}
    </label>
  );
}
