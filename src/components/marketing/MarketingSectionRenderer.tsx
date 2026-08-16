import { Link } from "@tanstack/react-router";
import type { WebsiteSection } from "@/lib/website/types";
import { Button } from "@/components/ui/button";

export function MarketingSectionRenderer({ sections }: { sections: WebsiteSection[] }) {
  return (
    <div className="space-y-16 md:space-y-24">
      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <section key={section.id} className="mx-auto max-w-6xl px-4 pt-8 md:pt-16">
                <div className="grid gap-10 md:grid-cols-2 md:items-center">
                  <div>
                    <h1 className="font-serif text-3xl leading-tight text-foreground md:text-5xl">
                      {section.heading}
                    </h1>
                    {section.subheading && (
                      <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                        {section.subheading}
                      </p>
                    )}
                    <div className="mt-8 flex flex-wrap gap-3">
                      {section.primary_cta && (
                        <Button
                          asChild
                          size="lg"
                          className="bg-gold text-slate-950 hover:bg-gold/90"
                        >
                          <Link to={section.primary_cta.href}>{section.primary_cta.label}</Link>
                        </Button>
                      )}
                      {section.secondary_cta && (
                        <Button asChild size="lg" variant="outline">
                          <Link to={section.secondary_cta.href}>{section.secondary_cta.label}</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  {section.image_path ? (
                    <img
                      src={section.image_path}
                      alt=""
                      className="rounded-lg border border-border shadow-sm"
                    />
                  ) : (
                    <div className="aspect-[4/3] rounded-lg border border-dashed border-gold/30 bg-[#faf8f4] p-6">
                      <p className="text-sm text-muted-foreground">
                        Product screenshots can be uploaded from Platform Owner → Website Manager.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            );
          case "pillars":
            return (
              <section key={section.id} className="mx-auto max-w-6xl px-4">
                <div className="grid gap-6 md:grid-cols-3">
                  {section.items.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-border bg-card p-6 shadow-sm"
                    >
                      <h3 className="font-serif text-lg text-gold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          case "feature_grid":
            return (
              <section key={section.id} className="mx-auto max-w-6xl px-4">
                {section.heading && (
                  <h2 className="mb-8 font-serif text-2xl text-foreground md:text-3xl">
                    {section.heading}
                  </h2>
                )}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <div key={item.title} className="border-t border-gold/40 pt-4">
                      <h3 className="font-medium text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          case "rich_text":
            return (
              <section
                key={section.id}
                className="mx-auto max-w-3xl px-4 prose prose-sm dark:prose-invert"
              >
                {section.heading && <h2>{section.heading}</h2>}
                {section.body_md && <p className="whitespace-pre-wrap">{section.body_md}</p>}
              </section>
            );
          case "testimonials":
            return (
              <section key={section.id} className="mx-auto max-w-6xl px-4">
                <div className="grid gap-6 md:grid-cols-2">
                  {section.items.map((t) => (
                    <blockquote
                      key={t.author}
                      className="rounded-lg border border-border bg-card p-6 text-sm"
                    >
                      <p className="italic text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
                      <footer className="mt-4 font-medium text-foreground">
                        {t.author}
                        {t.company ? ` — ${t.company}` : ""}
                      </footer>
                    </blockquote>
                  ))}
                </div>
              </section>
            );
          case "faq":
            return (
              <section key={section.id} className="mx-auto max-w-3xl px-4 space-y-4">
                {section.items.map((item) => (
                  <details key={item.question} className="rounded-md border border-border p-4">
                    <summary className="cursor-pointer font-medium">{item.question}</summary>
                    <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
                  </details>
                ))}
              </section>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
