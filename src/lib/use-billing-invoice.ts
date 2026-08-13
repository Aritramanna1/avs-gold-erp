import { useEffect, useState } from "react";
import { fetchBillingInvoiceById } from "@/lib/billing-query";
import { useBilling, type Invoice } from "@/lib/billing-store";

export function useBillingInvoiceById(id: string): {
  invoice: Invoice | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const cached = useBilling((state) => state.invoices.find((row) => row.id === id));
  const [remote, setRemote] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBillingInvoiceById(id)
      .then((invoice) => {
        if (cancelled) return;
        setRemote(invoice);
        if (invoice) {
          useBilling.setState((state) => ({
            invoices: state.invoices.some((row) => row.id === invoice.id)
              ? state.invoices.map((row) => (row.id === invoice.id ? invoice : row))
              : [invoice, ...state.invoices],
          }));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRemote(null);
        setError(err instanceof Error ? err.message : "Could not load invoice.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  return {
    invoice: cached ?? remote,
    loading,
    error,
    retry: () => setReloadKey((value) => value + 1),
  };
}
