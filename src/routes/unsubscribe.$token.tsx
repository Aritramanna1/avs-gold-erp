import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { resolvePublicUnsubscribe } from "@/lib/comm/email-suppressions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe/$token")({
  head: () => ({ meta: [{ title: "Unsubscribe · AVS ERP" }] }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<"loading" | "opted_out" | "opted_in" | "error">("loading");
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    void resolvePublicUnsubscribe(token, "opt_out").then((r) => {
      if (!r?.ok) {
        setStatus("error");
        return;
      }
      setEmail(r.email);
      setStatus("opted_out");
    });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <h1 className="text-lg font-semibold">Email preferences</h1>
        {status === "loading" ? <p className="text-sm text-muted-foreground">Updating…</p> : null}
        {status === "error" ? (
          <p className="text-sm text-destructive">This unsubscribe link is invalid or expired.</p>
        ) : null}
        {status === "opted_out" ? (
          <>
            <p className="text-sm">
              {email ? (
                <>
                  <span className="font-medium">{email}</span> will no longer receive promotional
                  emails from this firm.
                </>
              ) : (
                "You have been unsubscribed from promotional emails."
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Transactional messages (invoices, receipts, portal notices) may still be sent when
              required for your account.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void resolvePublicUnsubscribe(token, "opt_in").then((r) => {
                  if (r?.ok) setStatus("opted_in");
                })
              }
            >
              Opt back in to promotions
            </Button>
          </>
        ) : null}
        {status === "opted_in" ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            You have opted back in to promotional emails.
          </p>
        ) : null}
      </div>
    </div>
  );
}
