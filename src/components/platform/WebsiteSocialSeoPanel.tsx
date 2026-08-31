import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { updatePlatformSetting } from "@/lib/website/website-service";
import { toast } from "sonner";
import type { WebsiteSocialConfig } from "@/lib/website/types";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { getPublicSiteOrigin } from "@/lib/website/public-site-url";

const SOCIAL_KEYS = ["facebook", "instagram", "linkedin", "youtube"] as const;

export function WebsiteSocialSeoPanel() {
  const { data: bundle, refetch } = usePublicWebsiteBundle();
  const [social, setSocial] = useState<WebsiteSocialConfig>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");

  useEffect(() => {
    if (bundle?.social) setSocial(bundle.social);
    if (bundle?.seo_default?.title) setSeoTitle(bundle.seo_default.title);
    if (bundle?.seo_default?.description) setSeoDesc(bundle.seo_default.description);
  }, [bundle]);

  async function save() {
    const ok1 = await updatePlatformSetting("website.social", social);
    const ok2 = await updatePlatformSetting("website.seo_default", {
      title: seoTitle,
      description: seoDesc,
      og_image_path: bundle?.seo_default?.og_image_path ?? "/assets/ornexa-brand-master.png",
    });
    if (ok1 && ok2) {
      toast.success("Social & SEO defaults saved.");
      void refetch();
    } else toast.error("Save failed.");
  }

  const previewUrl = getPublicSiteOrigin();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOCIAL_KEYS.map((key) => (
            <div key={key} className="flex flex-wrap items-center gap-3 rounded border p-3">
              <Switch
                checked={!!social[key]?.enabled}
                onCheckedChange={(v) =>
                  setSocial((s) => ({ ...s, [key]: { enabled: v, url: s[key]?.url ?? "" } }))
                }
              />
              <Label className="w-24 capitalize">{key}</Label>
              <Input
                className="flex-1 min-w-[200px]"
                placeholder="https://"
                value={social[key]?.url ?? ""}
                onChange={(e) =>
                  setSocial((s) => ({
                    ...s,
                    [key]: { enabled: s[key]?.enabled ?? false, url: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEO defaults & ad preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Default title</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </div>
          <div>
            <Label>Meta description (155 chars recommended)</Label>
            <Input value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Canonical base: {previewUrl}</p>
          <div className="rounded border bg-white p-4 text-black max-w-lg">
            <p className="text-xs text-green-700">{previewUrl}</p>
            <p className="text-lg text-blue-800 leading-snug">
              {seoTitle || "Ornexa — Jewellery Ecosystem ERP"}
            </p>
            <p className="text-sm text-gray-600 line-clamp-2">{seoDesc}</p>
          </div>
          <Button type="button" onClick={() => void save()}>
            Save social & SEO
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
