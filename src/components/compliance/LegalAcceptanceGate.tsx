import { useCallback, useEffect, useState, type ReactNode } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { BootProgressShell } from "@/components/boot-progress-shell";
import { LegalDocumentScrollView } from "@/components/compliance/LegalDocumentScrollView";
import {
  clientPendingMatchesCurrent,
  clearClientPendingAcceptance,
  fetchPendingLegalDocuments,
  readClientPendingAcceptance,
  recordAllCurrentLegalAcceptances,
  type PendingLegalDocument,
} from "@/lib/compliance/legal-acceptance-service";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  getLegalDocument,
} from "@/lib/compliance/legal-policies";

/**
 * Blocks authenticated app chrome until current Terms + Privacy are accepted
 * (first signup or material policy revision). Decline signs the user out.
 */
export function LegalAcceptanceGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState<PendingLegalDocument[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const clientPending = readClientPendingAcceptance();
      if (clientPendingMatchesCurrent(clientPending) && clientPending) {
        const sync = await recordAllCurrentLegalAcceptances(clientPending.method);
        if (sync.ok) {
          setPending([]);
          setChecking(false);
          return;
        }
      }

      const rows = await fetchPendingLegalDocuments();
      setPending(rows);
    } catch (e) {
      const { loadErpSessionCache, legalCacheMatchesCurrent } = await import(
        "@/lib/offline/erp-session-cache"
      );
      const cached = await loadErpSessionCache();
      if (legalCacheMatchesCurrent(cached?.legalCleared)) {
        setPending([]);
        setChecking(false);
        return;
      }
      setError(e instanceof Error ? e.message : "Could not load legal requirements.");
      // Fail closed for material consent: show local current docs.
      setPending([
        {
          document_type: "terms",
          version: CURRENT_TERMS_VERSION,
          title: getLegalDocument("terms").title,
          body_md: getLegalDocument("terms").body,
          effective_at: getLegalDocument("terms").effectiveDate,
        },
        {
          document_type: "privacy",
          version: CURRENT_PRIVACY_VERSION,
          title: getLegalDocument("privacy").title,
          body_md: getLegalDocument("privacy").body,
          effective_at: getLegalDocument("privacy").effectiveDate,
        },
      ]);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    const res = await recordAllCurrentLegalAcceptances("scroll_gate");
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save acceptance.");
      return;
    }
    setPending([]);
  }

  async function handleDecline() {
    setBusy(true);
    clearClientPendingAcceptance();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (checking) {
    return <BootProgressShell title="Checking legal acceptance" />;
  }

  if (pending && pending.length > 0) {
    const combined = pending
      .map(
        (d) =>
          `${d.title}\nVersion ${d.version} · Effective ${d.effective_at}\n\n${d.body_md}`,
      )
      .join("\n\n————————————\n\n");

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
        <LegalDocumentScrollView
          title="Review Terms & Privacy"
          subtitle={
            pending.some((p) => p.version !== CURRENT_TERMS_VERSION && p.document_type === "terms")
              ? "Updated policies require renewed acceptance"
              : "Required before using AVS ERP"
          }
          busy={busy}
          onAccept={handleAccept}
          onDecline={handleDecline}
        >
          {combined}
          {error ? (
            <p className="mt-4 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </LegalDocumentScrollView>
      </div>
    );
  }

  return <>{children}</>;
}
