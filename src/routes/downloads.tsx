import { createFileRoute, notFound } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { Button } from "@/components/ui/button";
import { publicSiteUrl } from "@/lib/website/public-site-url";

export const Route = createFileRoute("/downloads")({
  component: DownloadsPage,
});

function DownloadsPage() {
  const { data: bundle } = usePublicWebsiteBundle();

  if (!bundle.feature_flags.downloads) throw notFound();

  const items = bundle.downloads?.items ?? [];
  const live = items.filter((i) => i.enabled && i.url);

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl text-foreground">Download Ornexa</h1>
        <p className="mt-2 text-muted-foreground">
          Use Ornexa in the browser today. Desktop and mobile builds appear here when released.
        </p>
        <ul className="mt-8 space-y-4">
          {live.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Web app is available at{" "}
              <a href={publicSiteUrl("/login")} className="text-gold underline">
                {publicSiteUrl("/login")}
              </a>
              . Additional downloads will be listed by Platform Owner when ready.
            </li>
          ) : (
            live.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs capitalize text-muted-foreground">{item.platform}</p>
                </div>
                <Button asChild className="gap-2 bg-gold text-slate-950 hover:bg-gold/90">
                  <a
                    href={item.url.startsWith("http") ? item.url : publicSiteUrl(item.url)}
                    rel="noopener"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>
    </MarketingLayout>
  );
}
