import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface LegalConsentFieldsProps {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
  onTermsChange: (v: boolean) => void;
  onPrivacyChange: (v: boolean) => void;
  onMarketingChange: (v: boolean) => void;
  showMarketing?: boolean;
}

export function LegalConsentFields({
  termsAccepted,
  privacyAccepted,
  marketingOptIn,
  onTermsChange,
  onPrivacyChange,
  onMarketingChange,
  showMarketing = true,
}: LegalConsentFieldsProps) {
  return (
    <div className="space-y-2.5 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-terms"
          checked={termsAccepted}
          onCheckedChange={(v) => onTermsChange(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="consent-terms"
          className="text-[11px] leading-snug font-normal cursor-pointer"
        >
          I agree to the{" "}
          <Link to="/terms" target="_blank" className="text-gold underline">
            Terms of Service
          </Link>{" "}
          and confirm I am authorised to register this business.
        </Label>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-privacy"
          checked={privacyAccepted}
          onCheckedChange={(v) => onPrivacyChange(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="consent-privacy"
          className="text-[11px] leading-snug font-normal cursor-pointer"
        >
          I have read the{" "}
          <Link to="/privacy" target="_blank" className="text-gold underline">
            Privacy Policy
          </Link>{" "}
          and consent to processing of account data per applicable law (including GDPR where
          applicable).
        </Label>
      </div>
      {showMarketing && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="consent-marketing"
            checked={marketingOptIn}
            onCheckedChange={(v) => onMarketingChange(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="consent-marketing"
            className="text-[11px] leading-snug font-normal cursor-pointer"
          >
            Send me product tips and updates (optional — WhatsApp/SMS require separate opt-in
            in-app).
          </Label>
        </div>
      )}
    </div>
  );
}
