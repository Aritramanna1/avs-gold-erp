import { useEffect } from "react";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import {
  KYC_DOC_LABELS,
  PORTAL_KYC_DOC_KEYS,
  markPortalKycDoc,
  pullPortalPartyAttachments,
  type PortalKycPortalType,
} from "@/lib/portal/portal-kyc-service";
import type { KycDocKey } from "@/lib/people-store";
import { ShieldCheck } from "lucide-react";

export type PortalKycPanelProps = {
  partyId: string;
  displayName: string;
  portalType: PortalKycPortalType;
  /** Bump when the active jeweller / firm changes so attachments reload. */
  scopeVersion?: number;
  docKeys?: KycDocKey[];
};

export function PortalKycPanel({
  partyId,
  displayName,
  portalType,
  scopeVersion = 0,
  docKeys = PORTAL_KYC_DOC_KEYS,
}: PortalKycPanelProps) {
  useEffect(() => {
    if (!partyId) return;
    void pullPortalPartyAttachments(partyId);
  }, [partyId, scopeVersion]);

  return (
    <section className="bg-card rounded-md border border-border shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-gold shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground font-serif">KYC documents</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload your identity documents here. Files are stored securely in Cloudflare R2 and
              linked to your party record for the jeweller to review on People KYC.
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {docKeys.map((k) => (
          <div
            key={k}
            className="rounded-md border border-border p-3 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="text-sm">{KYC_DOC_LABELS[k]}</div>
              <div className="text-[10px] text-muted-foreground">R2 storage · own-party upload</div>
            </div>
            <AttachmentButton
              entityType="person"
              entityId={partyId}
              docKey={k}
              docLabel={KYC_DOC_LABELS[k]}
              title={`${displayName} — ${KYC_DOC_LABELS[k]}`}
              requireR2Upload
              portalType={portalType}
              onSaved={(next) => {
                if (next.filed) {
                  void markPortalKycDoc(partyId, k, true);
                } else {
                  void markPortalKycDoc(partyId, k, false);
                }
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
