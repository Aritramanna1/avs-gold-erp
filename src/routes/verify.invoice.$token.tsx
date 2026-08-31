/**
 * Public invoice verification — /verify/invoice/:token
 *
 * QR codes on GST/retail invoices encode this URL. Guests verify without ERP login
 * via the `verify_public_document` RPC (tenant-isolated server check).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { verifyPublicDocument, type PublicVerifyResult } from "@/lib/document-verification";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/verify/invoice/$token")({
  head: () => ({ meta: [{ title: "Verify Invoice · AVS ERP" }] }),
  component: PublicInvoiceVerifyPage,
});

function formatInr(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function VerifyResultCard({ result }: { result: PublicVerifyResult }) {
  const ok = result.ok && result.status === "verified";
  const expired = !!result.accessExpired;
  const cancelled = result.status === "cancelled" || result.status === "revoked";

  return (
    <div
      className={`rounded-lg border p-6 space-y-4 ${
        ok
          ? "border-emerald-500/40 bg-emerald-500/10"
          : cancelled
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-destructive/40 bg-destructive/10"
      }`}
    >
      <div className="flex items-center gap-3">
        {ok ? (
          <ShieldCheck className="h-8 w-8 text-emerald-500 shrink-0" />
        ) : cancelled ? (
          <ShieldAlert className="h-8 w-8 text-amber-500 shrink-0" />
        ) : (
          <ShieldX className="h-8 w-8 text-destructive shrink-0" />
        )}
        <div>
          <h1 className="font-serif text-lg">
            {ok ? "Verified Invoice" : cancelled ? "Invoice Cancelled" : "Verification Failed"}
          </h1>
          <p className="text-sm text-muted-foreground">{result.message}</p>
        </div>
      </div>

      {ok && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {result.businessName && (
            <div>
              <dt className="text-muted-foreground">Business</dt>
              <dd className="font-medium">{result.businessName}</dd>
            </div>
          )}
          {result.docNumber && (
            <div>
              <dt className="text-muted-foreground">Invoice No</dt>
              <dd className="font-medium">{result.docNumber}</dd>
            </div>
          )}
          {result.partyLabel && (
            <div>
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="font-medium">{result.partyLabel}</dd>
            </div>
          )}
          {result.invoiceDate && (
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-medium">{result.invoiceDate}</dd>
            </div>
          )}
          {result.totalPaise != null && (
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-medium">{formatInr(result.totalPaise)}</dd>
            </div>
          )}
          {result.itemSummary && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Items</dt>
              <dd className="font-medium">{result.itemSummary}</dd>
            </div>
          )}
        </dl>
      )}

      {expired && (
        <p className="text-xs text-amber-600">
          This verification link has expired
          {result.accessExpiresAt ? ` (${result.accessExpiresAt})` : ""}.
        </p>
      )}
    </div>
  );
}

function PublicInvoiceVerifyPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PublicVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const decoded = decodeURIComponent(token.trim());
        const verified = await verifyPublicDocument(decoded);
        if (active) setResult(verified);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Verification request failed.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-1">
          <h1 className="font-serif text-xl text-gold">AVS Document Verification</h1>
          <p className="text-xs text-muted-foreground">Public invoice authenticity check</p>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
            <p className="text-sm text-muted-foreground">Verifying invoice…</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && result && <VerifyResultCard result={result} />}

        <div className="text-center pt-2">
          <Link to="/verify">
            <Button variant="ghost" size="sm">
              Open full verify tool
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
