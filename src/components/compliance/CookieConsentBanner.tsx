import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useConsentStore } from "@/lib/compliance/consent-store";

export function CookieConsentBanner() {
  const decided = useConsentStore((s) => s.hasDecided());
  const acceptAll = useConsentStore((s) => s.acceptAll);
  const rejectNonEssential = useConsentStore((s) => s.rejectNonEssential);
  const [showDetails, setShowDetails] = useState(false);

  if (decided) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[200] border-t border-border bg-card/95 backdrop-blur-md p-4 md:p-5 shadow-lg lg:bottom-4 lg:left-4 lg:right-auto lg:max-w-md lg:rounded-md lg:border"
    >
      <p className="text-sm font-medium text-foreground">Cookies &amp; privacy</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        We use essential cookies for sign-in and security. Optional cookies help improve the
        product. See our{" "}
        <Link to="/privacy" className="text-gold underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link to="/terms" className="text-gold underline">
          Terms
        </Link>
        .
      </p>
      {showDetails && (
        <ul className="mt-2 text-[10px] text-muted-foreground space-y-1 list-disc pl-4">
          <li>
            <strong>Essential</strong> — authentication, session, fraud prevention (always on)
          </li>
          <li>
            <strong>Functional</strong> — language, theme, keyboard preferences
          </li>
          <li>
            <strong>Analytics</strong> — anonymous usage to improve reliability
          </li>
          <li>
            <strong>Marketing</strong> — product updates (email/WhatsApp only with separate opt-in)
          </li>
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="h-8" onClick={acceptAll}>
          Accept all
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={rejectNonEssential}>
          Essential only
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? "Hide details" : "Manage"}
        </Button>
      </div>
    </div>
  );
}
