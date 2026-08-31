import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LegalDocumentScrollView } from "@/components/compliance/LegalDocumentScrollView";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  getCurrentLegalDocuments,
} from "@/lib/compliance/legal-policies";
import { stashClientPendingAcceptance } from "@/lib/compliance/legal-acceptance-service";
import type { AcceptanceMethod } from "@/lib/compliance/legal-acceptance-service";
import { isNativeApp } from "@/lib/native/platform";
import { cn } from "@/lib/utils";

interface LegalConsentFieldsProps {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
  onTermsChange: (v: boolean) => void;
  onPrivacyChange: (v: boolean) => void;
  onMarketingChange: (v: boolean) => void;
  showMarketing?: boolean;
  /** How pre-auth scroll acceptance is tagged when synced after login. */
  acceptanceMethod?: AcceptanceMethod;
  /** High-contrast panel for Capacitor dark auth shells. */
  variant?: "default" | "nativeDark";
}

/**
 * Pre-auth consent: requires opening the full scrollable Terms+Privacy view
 * (Accept enabled only after scroll-to-end). Checkboxes alone are not enough.
 */
export function LegalConsentFields({
  termsAccepted,
  privacyAccepted,
  marketingOptIn,
  onTermsChange,
  onPrivacyChange,
  onMarketingChange,
  showMarketing = true,
  acceptanceMethod = "invite_pre_auth_scroll",
  variant,
}: LegalConsentFieldsProps) {
  const navigate = useNavigate();
  const native = isNativeApp();
  const dark = variant === "nativeDark" || (variant == null && native);
  const [open, setOpen] = useState(false);
  const both = termsAccepted && privacyAccepted;
  const combined = getCurrentLegalDocuments()
    .map((d) => `${d.title}\nVersion ${d.version} · Effective ${d.effectiveDate}\n\n${d.body}`)
    .join("\n\n————————————\n\n");

  function handleAcceptedFromScroll() {
    stashClientPendingAcceptance(acceptanceMethod);
    onTermsChange(true);
    onPrivacyChange(true);
    setOpen(false);
  }

  const labelCls = cn(
    "text-[11px] leading-snug font-normal",
    dark ? "text-white/90" : undefined,
  );

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-md border p-3",
        dark ? "border-white/20 bg-black/35" : "border-border bg-muted/20",
      )}
    >
      <p className={cn("text-[11px] leading-snug", dark ? "text-white/85" : "text-muted-foreground")}>
        Review the full Terms of Service (v{CURRENT_TERMS_VERSION}) and Privacy Policy (v
        {CURRENT_PRIVACY_VERSION}). Scroll to the end, then Accept &amp; Continue. This
        scroll-to-end step is AVS ERP explicit-consent UX — not a Google requirement.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "w-full",
          dark && "border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white",
        )}
        onClick={() => setOpen(true)}
        data-testid="legal-open-review"
      >
        {both ? "Reviewed — open again" : "Review Terms & Privacy"}
      </Button>
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-terms"
          checked={termsAccepted}
          disabled
          className={cn("mt-0.5", dark && "border-white/40 data-[state=checked]:bg-gold data-[state=checked]:text-slate-950")}
        />
        <Label htmlFor="consent-terms" className={labelCls}>
          Terms of Service accepted{" "}
          {native ? (
            <button
              type="button"
              className="text-[#B89454] underline"
              onClick={() => void navigate({ to: "/terms" })}
            >
              (open page)
            </button>
          ) : (
            <Link to="/terms" className="text-gold underline">
              (open page)
            </Link>
          )}
        </Label>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-privacy"
          checked={privacyAccepted}
          disabled
          className={cn("mt-0.5", dark && "border-white/40 data-[state=checked]:bg-gold data-[state=checked]:text-slate-950")}
        />
        <Label htmlFor="consent-privacy" className={labelCls}>
          Privacy Policy accepted{" "}
          {native ? (
            <button
              type="button"
              className="text-[#B89454] underline"
              onClick={() => void navigate({ to: "/privacy" })}
            >
              (open page)
            </button>
          ) : (
            <Link to="/privacy" className="text-gold underline">
              (open page)
            </Link>
          )}
        </Label>
      </div>
      {showMarketing && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="consent-marketing"
            checked={marketingOptIn}
            onCheckedChange={(v) => onMarketingChange(v === true)}
            className={cn("mt-0.5", dark && "border-white/40 data-[state=checked]:bg-gold data-[state=checked]:text-slate-950")}
          />
          <Label
            htmlFor="consent-marketing"
            className={cn(labelCls, "cursor-pointer")}
          >
            Send me product tips and updates (optional — WhatsApp/SMS require separate opt-in
            in-app).
          </Label>
        </div>
      )}

      {open ? (
        <div
          className={cn(
            "fixed inset-0 z-[90] flex items-center justify-center p-4 backdrop-blur-sm",
            dark ? "bg-black/85" : "bg-background/90",
          )}
        >
          <LegalDocumentScrollView
            title="Terms & Privacy"
            subtitle="Required before creating an account"
            variant={dark ? "nativeDark" : "default"}
            onAccept={handleAcceptedFromScroll}
            onDecline={() => setOpen(false)}
            declineLabel="Close"
          >
            {combined}
          </LegalDocumentScrollView>
        </div>
      ) : null}
    </div>
  );
}
