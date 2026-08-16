import { useCallback, useRef, useState } from "react";
import { resolveSubscriptionAccess } from "@/lib/identity/subscription-access-service";
import { useCreditStore } from "@/lib/credit-service";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type PaymentConfirmationTarget =
  { kind: "subscription" } | { kind: "invoice"; invoiceId: string } | { kind: "credits" };

export type PaymentConfirmationState = "idle" | "polling" | "confirmed" | "pending" | "failed";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 12;

export function usePaymentConfirmation() {
  const [state, setState] = useState<PaymentConfirmationState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState("idle");
    setMessage(null);
  }, []);

  const waitForConfirmation = useCallback(async (target: PaymentConfirmationTarget) => {
    abortRef.current = false;
    setState("polling");
    setMessage("Confirming your payment…");

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (abortRef.current) return false;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      if (target.kind === "subscription") {
        const access = await resolveSubscriptionAccess();
        if (access.status === "ACTIVE") {
          setState("confirmed");
          setMessage("Your subscription is now active.");
          return true;
        }
      }

      if (target.kind === "invoice") {
        const { data } = await supabase
          .from("platform_invoices" as never)
          .select("status, balance_paise")
          .eq("id", target.invoiceId)
          .maybeSingle();
        const row = data as { status?: string; balance_paise?: number } | null;
        if (row?.status === "paid" || Number(row?.balance_paise ?? 1) <= 0) {
          setState("confirmed");
          setMessage("Invoice paid successfully.");
          return true;
        }
      }

      if (target.kind === "credits") {
        const before = useCreditStore.getState().wallet?.balance_credits;
        await useCreditStore.getState().fetchWallet();
        const after = useCreditStore.getState().wallet?.balance_credits;
        if (after !== undefined && before !== undefined && Number(after) > Number(before)) {
          setState("confirmed");
          setMessage("Credits have been added to your wallet.");
          return true;
        }
        const recent = useCreditStore.getState().wallet?.usage?.recent_entries?.[0];
        if (
          recent &&
          Number(recent.amount_credits) > 0 &&
          Date.now() - new Date(recent.created_at).getTime() < 180_000
        ) {
          setState("confirmed");
          setMessage("Credits have been added to your wallet.");
          return true;
        }
      }
    }

    setState("pending");
    setMessage(
      "Payment received — activation may take a minute. Refresh this page if your status does not update.",
    );
    return false;
  }, []);

  const markFailed = useCallback((reason?: string) => {
    setState("failed");
    setMessage(reason ?? "Payment could not be completed. Please try again.");
  }, []);

  return { state, message, waitForConfirmation, markFailed, reset };
}
