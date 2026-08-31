import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { MarketingSectionRenderer } from "@/components/marketing/MarketingSectionRenderer";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { getPageFromBundle } from "@/lib/website/website-service";
import { ABOUT_FALLBACK_SECTIONS, sectionsForPage } from "@/lib/website/fallback-pages";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · AVS ERP by Arivahly Venture Sphere" },
      {
        name: "description",
        content:
          "AVS ERP is jewellery manufacturing ERP from Arivahly Venture Sphere. Founder Aritra Manna.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  const page = getPageFromBundle(bundle, "about");

  return (
    <MarketingLayout>
      <div className="py-12">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Our story</p>
          <h1 className="mt-2 font-serif text-3xl md:text-4xl">About AVS ERP</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Jewellery manufacturing ERP from Arivahly Venture Sphere — built for factories that
            need gold they can audit.
          </p>
        </div>
        <div className="mt-10">
          <MarketingSectionRenderer sections={sectionsForPage(page, ABOUT_FALLBACK_SECTIONS)} />
        </div>
        <div className="mx-auto mt-12 max-w-3xl px-4 text-sm text-muted-foreground">
          <p>
            Company website:{" "}
            <a
              href="https://arivahly.in/"
              className="text-gold underline"
              target="_blank"
              rel="noreferrer"
            >
              arivahly.in
            </a>
            {" · "}
            Sales:{" "}
            <a href="mailto:sales@arivahly.in" className="text-gold underline">
              sales@arivahly.in
            </a>
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}
