/**
 * Platform Owner — public website CMS & feature flags.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Save, ToggleLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  fetchPublicWebsiteBundle,
  updatePlatformSetting,
  updateWebsiteFeatureFlags,
} from "@/lib/website/website-service";
import type { WebsiteFeatureFlags } from "@/lib/website/types";
import { DEFAULT_FEATURE_FLAGS } from "@/lib/website/defaults";
import { WebsiteMediaPanel } from "@/components/platform/WebsiteMediaPanel";
import { WebsiteSocialSeoPanel } from "@/components/platform/WebsiteSocialSeoPanel";
import {
  WebsiteDownloadsPanel,
  WebsiteContentCmsPanel,
} from "@/components/platform/WebsiteDownloadsPanel";
import { getPublicSiteOrigin } from "@/lib/website/public-site-url";

const FLAG_LABELS: Record<keyof WebsiteFeatureFlags, string> = {
  homepage: "Homepage",
  features_page: "Features page",
  manufacturing_page: "Manufacturing solution",
  wholesale_page: "Wholesale solution",
  retail_page: "Retail solution",
  pricing: "Pricing",
  amc_display: "AMC / Platform Care display",
  free_trial_cta: "14-Day Free Trial CTA",
  request_demo: "Request Demo",
  contact: "Contact page",
  tutorials: "Tutorials",
  blog: "Blog",
  whats_new: "What's New",
  downloads: "Download centre",
  testimonials: "Testimonials",
  faq: "FAQ",
  whatsapp_chat: "WhatsApp chat button",
  social_links: "Social links",
  branded_loader: "Branded page loader",
  footer: "Footer",
};

export function PlatformWebsiteManager() {
  const qc = useQueryClient();
  const { data: bundle } = useQuery({
    queryKey: ["public-website-bundle"],
    queryFn: fetchPublicWebsiteBundle,
  });
  const [flags, setFlags] = useState<WebsiteFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [contact, setContact] = useState(bundle?.contact ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bundle?.feature_flags) setFlags(bundle.feature_flags);
    if (bundle?.contact) setContact(bundle.contact);
  }, [bundle]);

  async function saveAll() {
    setSaving(true);
    const okFlags = await updateWebsiteFeatureFlags(flags);
    const okContact = await updatePlatformSetting("website.contact", contact);
    setSaving(false);
    if (okFlags && okContact) {
      toast.success("Website settings saved.");
      void qc.invalidateQueries({ queryKey: ["public-website-bundle"] });
    } else {
      toast.error("Could not save all settings.");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-serif text-gold flex items-center gap-2">
          <Globe className="h-6 w-6" /> Website Manager
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Public site: <strong>{getPublicSiteOrigin()}</strong> — change domain via{" "}
          <code className="text-xs">VITE_PUBLIC_APP_URL</code> at deploy time.
        </p>
      </div>

      <Tabs defaultValue="flags">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="flags">Flags</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="media">Screenshots</TabsTrigger>
          <TabsTrigger value="seo">SEO & Social</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ToggleLeft className="h-4 w-4" /> Feature flags
              </CardTitle>
              <CardDescription>
                Disabled features are removed from navigation and return 404 on direct URL access.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(FLAG_LABELS) as Array<keyof WebsiteFeatureFlags>).map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded border p-3"
                >
                  <Label htmlFor={`flag-${key}`} className="text-sm">
                    {FLAG_LABELS[key]}
                  </Label>
                  <Switch
                    id={`flag-${key}`}
                    checked={!!flags[key]}
                    onCheckedChange={(v) => setFlags((f) => ({ ...f, [key]: v }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          <Button onClick={() => void saveAll()} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save flags & contact"}
          </Button>
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact & WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Sales email</Label>
                  <Input
                    value={contact.sales_email ?? ""}
                    onChange={(e) => setContact((c) => ({ ...c, sales_email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>WhatsApp phone (country code, no +)</Label>
                  <Input
                    value={contact.whatsapp_phone ?? ""}
                    onChange={(e) => setContact((c) => ({ ...c, whatsapp_phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>WhatsApp prefilled message</Label>
                <Textarea
                  rows={2}
                  value={contact.whatsapp_message ?? ""}
                  onChange={(e) => setContact((c) => ({ ...c, whatsapp_message: e.target.value }))}
                />
              </div>
              <Button onClick={() => void saveAll()} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                Save contact
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="mt-4">
          <WebsiteMediaPanel />
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <WebsiteSocialSeoPanel />
        </TabsContent>

        <TabsContent value="downloads" className="mt-4">
          <WebsiteDownloadsPanel />
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          <WebsiteContentCmsPanel />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Plan public visibility: Platform → Plans → &quot;Publicly visible&quot;. Legal pages in{" "}
        <code>public_legal_pages</code>.
      </p>
    </div>
  );
}
