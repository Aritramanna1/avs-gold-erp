import { useEffect, useState } from "react";
import {
  type CreditNote,
  type DebitNote,
  type DeliveryChallan,
  type Estimate,
  useCreditNotes,
  useDebitNotes,
  useDeliveryChallans,
  useEstimates,
} from "@/lib/billing-documents-store";
import { fetchBillingDocumentById } from "@/lib/billing-documents-query";

type BillingDocumentKind = "credit_note" | "debit_note" | "estimate" | "delivery_challan";

type BillingDocumentByKind<K extends BillingDocumentKind> = K extends "credit_note"
  ? CreditNote
  : K extends "debit_note"
    ? DebitNote
    : K extends "estimate"
      ? Estimate
      : DeliveryChallan;

export function useBillingDocumentById<K extends BillingDocumentKind>(
  kind: K,
  id: string,
): {
  document: BillingDocumentByKind<K> | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const creditNote = useCreditNotes((state) =>
    kind === "credit_note" ? state.notes.find((row) => row.id === id) : undefined,
  );
  const debitNote = useDebitNotes((state) =>
    kind === "debit_note" ? state.notes.find((row) => row.id === id) : undefined,
  );
  const estimate = useEstimates((state) =>
    kind === "estimate" ? state.estimates.find((row) => row.id === id) : undefined,
  );
  const deliveryChallan = useDeliveryChallans((state) =>
    kind === "delivery_challan" ? state.challans.find((row) => row.id === id) : undefined,
  );
  const [remote, setRemote] = useState<BillingDocumentByKind<K> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const table =
      kind === "credit_note"
        ? "credit_notes"
        : kind === "debit_note"
          ? "debit_notes"
          : kind === "estimate"
            ? "estimates"
            : "delivery_challans";
    fetchBillingDocumentById<BillingDocumentByKind<K>>(table, id)
      .then((document) => {
        if (cancelled) return;
        setRemote(document);
        if (document) {
          if (kind === "credit_note") {
            useCreditNotes.setState((state) => ({
              notes: state.notes.some((row) => row.id === document.id)
                ? state.notes.map((row) =>
                    row.id === document.id ? (document as CreditNote) : row,
                  )
                : [document as CreditNote, ...state.notes],
            }));
          } else if (kind === "debit_note") {
            useDebitNotes.setState((state) => ({
              notes: state.notes.some((row) => row.id === document.id)
                ? state.notes.map((row) => (row.id === document.id ? (document as DebitNote) : row))
                : [document as DebitNote, ...state.notes],
            }));
          } else if (kind === "estimate") {
            useEstimates.setState((state) => ({
              estimates: state.estimates.some((row) => row.id === document.id)
                ? state.estimates.map((row) =>
                    row.id === document.id ? (document as Estimate) : row,
                  )
                : [document as Estimate, ...state.estimates],
            }));
          } else {
            useDeliveryChallans.setState((state) => ({
              challans: state.challans.some((row) => row.id === document.id)
                ? state.challans.map((row) =>
                    row.id === document.id ? (document as DeliveryChallan) : row,
                  )
                : [document as DeliveryChallan, ...state.challans],
            }));
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRemote(null);
        setError(err instanceof Error ? err.message : "Could not load billing document.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, id, reloadKey]);

  return {
    document: ((kind === "credit_note"
      ? creditNote
      : kind === "debit_note"
        ? debitNote
        : kind === "estimate"
          ? estimate
          : deliveryChallan) ??
      remote ??
      null) as BillingDocumentByKind<K> | null,
    loading,
    error,
    retry: () => setReloadKey((value) => value + 1),
  };
}
