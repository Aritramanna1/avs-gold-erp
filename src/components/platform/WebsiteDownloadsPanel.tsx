import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { updatePlatformSetting } from "@/lib/website/website-service";
import { toast } from "sonner";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import type { WebsiteDownloadItem } from "@/lib/website/types";

const DEFAULT_DOWNLOADS: WebsiteDownloadItem[] = [
  { id: "web", label: "Web App", platform: "web", url: "/login", enabled: true },
  { id: "desktop", label: "Desktop App", platform: "desktop", url: "", enabled: false },
  { id: "mobile", label: "Mobile App", platform: "mobile", url: "", enabled: false },
];

export function WebsiteDownloadsPanel() {
  const { data: bundle, refetch } = usePublicWebsiteBundle();
  const [items, setItems] = useState<WebsiteDownloadItem[]>(DEFAULT_DOWNLOADS);
  const [downloadsEnabled, setDownloadsEnabled] = useState(false);

  useEffect(() => {
    if (bundle?.downloads?.items?.length) setItems(bundle.downloads.items);
    if (bundle?.downloads?.enabled != null) setDownloadsEnabled(bundle.downloads.enabled);
  }, [bundle]);

  async function save() {
    const ok = await updatePlatformSetting("website.downloads", {
      items,
      enabled: downloadsEnabled,
    });
    if (ok) {
      toast.success("Download centre saved. Enable Downloads feature flag to publish.");
      void refetch();
    } else toast.error("Save failed.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Download centre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch checked={downloadsEnabled} onCheckedChange={setDownloadsEnabled} />
          <Label>Master enable (also turn on Downloads feature flag)</Label>
        </div>
        {items.map((item, i) => (
          <div key={item.id} className="grid gap-2 sm:grid-cols-4 rounded border p-3">
            <Input
              value={item.label}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...item, label: e.target.value };
                setItems(next);
              }}
            />
            <Input
              placeholder="Download URL (empty = hidden)"
              value={item.url}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...item, url: e.target.value };
                setItems(next);
              }}
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={item.enabled && !!item.url}
                disabled={!item.url}
                onCheckedChange={(v) => {
                  const next = [...items];
                  next[i] = { ...item, enabled: v };
                  setItems(next);
                }}
              />
              <span className="text-xs text-muted-foreground">Live link</span>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          No fake executables — links appear only when URL is set and enabled.
        </p>
        <Button type="button" onClick={() => void save()}>
          Save downloads
        </Button>
      </CardContent>
    </Card>
  );
}

export function WebsiteContentCmsPanel() {
  const [tab, setTab] = useState<"tutorial" | "blog" | "release">("tutorial");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");

  async function publishTutorial() {
    const { error } = await supabase.from("public_website_tutorials" as never).upsert({
      slug: slug || title.toLowerCase().replace(/\s+/g, "-"),
      title,
      description: body.slice(0, 200),
      body_md: body,
      is_published: false,
      video_provider: "none",
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success("Tutorial saved as draft (publish when video is ready).");
      setTitle("");
      setSlug("");
      setBody("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Content CMS (drafts)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {(["tutorial", "blog", "release"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Textarea
          rows={4}
          placeholder="Body / description"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {tab === "tutorial" && (
          <Button type="button" onClick={() => void publishTutorial()}>
            Save tutorial draft
          </Button>
        )}
        {tab !== "tutorial" && (
          <p className="text-xs text-muted-foreground">
            Blog and release editors: use SQL or next UI pass.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
