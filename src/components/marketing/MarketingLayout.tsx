import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { OrnexaBrandLogo, OrnexaParentAttribution } from "@/components/marketing/OrnexaBrandLogo";
import { WhatsAppFloatButton } from "@/components/marketing/WhatsAppFloatButton";
import { MarketingPublicSeo } from "@/components/marketing/MarketingPublicSeo";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WebsiteSocialConfig } from "@/lib/website/types";

export function MarketingLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { data: bundle } = usePublicWebsiteBundle();
  const flags = bundle.feature_flags;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const navLinks = [
    { label: "Product", to: "/product" },
    flags.features_page && { label: "Features", to: "/features" },
    { label: "Workflows", to: "/workflows" },
    { label: "About", to: "/about" },
    flags.manufacturing_page && { label: "Manufacturing", to: "/solutions/manufacturing" },
    flags.wholesale_page && { label: "Wholesale", to: "/solutions/wholesale" },
    flags.pricing && { label: "Pricing", to: "/pricing" },
    flags.tutorials && { label: "Tutorials", to: "/tutorials" },
    flags.blog && { label: "Blog", to: "/blog" },
    flags.whats_new && { label: "What's New", to: "/whats-new" },
    flags.downloads && { label: "Downloads", to: "/downloads" },
    flags.faq && { label: "FAQ", to: "/faq" },
    { label: "Support", to: "/support" },
    flags.contact && { label: "Contact", to: "/contact", search: { intent: "contact" } },
  ].filter(Boolean) as Array<{ label: string; to: string; search?: Record<string, string> }>;

  function openWorkspace() {
    void navigate({ to: "/app" });
  }

  return (
    <div className={cn("min-h-screen bg-[#faf8f4] text-foreground", className)}>
      <MarketingPublicSeo />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-[#faf8f4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="shrink-0">
            <OrnexaBrandLogo variant="horizontal" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                search={l.search}
                className="text-muted-foreground transition hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {hasSession ? (
              <Button variant="outline" size="sm" onClick={openWorkspace}>
                Open AVS ERP
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link to="/request-access">Request Access</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href="/login">Sign In</a>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>{children ?? <Outlet />}</main>

      {flags.footer && (
        <footer className="mt-20 border-t border-border bg-[#f3efe6]">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <OrnexaBrandLogo variant="stacked" />
                <OrnexaParentAttribution className="mt-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Product
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {flags.features_page && (
                    <li>
                      <Link to="/features">Features</Link>
                    </li>
                  )}
                  <li>
                    <Link to="/about">About</Link>
                  </li>
                  {flags.pricing && (
                    <li>
                      <Link to="/pricing">Pricing</Link>
                    </li>
                  )}
                  {flags.contact && (
                    <li>
                      <Link to="/contact" search={{ intent: "contact" }}>
                      Contact
                    </Link>
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Legal
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link to="/privacy">Privacy Policy</Link>
                  </li>
                  <li>
                    <Link to="/terms">Terms of Service</Link>
                  </li>
                  <li>
                    <Link to="/legal/$slug" params={{ slug: "refund" }}>
                      Refund Policy
                    </Link>
                  </li>
                </ul>
                {flags.social_links && <SocialLinks social={bundle.social} className="mt-6" />}
              </div>
            </div>
            <p className="mt-10 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Arivahly Venture Sphere. AVS ERP jewellery manufacturing
              ERP.{" "}
              <a href="https://arivahly.in/" className="underline hover:text-foreground">
                arivahly.in
              </a>
            </p>
          </div>
        </footer>
      )}

      {flags.whatsapp_chat && (
        <WhatsAppFloatButton contact={bundle.contact} currentPath={pathname} />
      )}
    </div>
  );
}

function SocialLinks({ social, className }: { social: WebsiteSocialConfig; className?: string }) {
  const links = [
    { key: "facebook" as const, Icon: Facebook },
    { key: "instagram" as const, Icon: Instagram },
    { key: "linkedin" as const, Icon: Linkedin },
    { key: "youtube" as const, Icon: Youtube },
  ].filter((l) => social[l.key]?.enabled && social[l.key]?.url);

  if (links.length === 0) return null;

  return (
    <div className={cn("flex gap-3", className)}>
      {links.map(({ key, Icon }) => (
        <a
          key={key}
          href={social[key]!.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground transition hover:text-gold"
          aria-label={key}
        >
          <Icon className="h-5 w-5" />
        </a>
      ))}
    </div>
  );
}
