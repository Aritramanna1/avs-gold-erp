import { Link } from "@tanstack/react-router";
import { ExternalLink, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  /** Customization hub tab key (see /control/customization search schema). */
  tab?: string;
};

/** Redirects tenant admins to the authoritative Customization hub instead of duplicating config in Settings. */
export function CustomizationDeepLink({ title, description, tab }: Props) {
  return (
    <Card className="p-6 space-y-4 border-dashed border-gold/30 bg-gold/5">
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20 shrink-0">
          <Sliders className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <h3 className="font-serif text-lg text-gold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground">
            Business rules, templates, and masters are maintained in one place — Customization — so
            operators never configure the same thing twice.
          </p>
        </div>
      </div>
      <Button asChild variant="default" className="bg-gold hover:bg-gold/90 text-black gap-2">
        <Link to="/control/customization" search={tab ? { tab } : undefined}>
          Open in Customization
          <ExternalLink className="h-4 w-4" />
        </Link>
      </Button>
    </Card>
  );
}
