/**
 * Free-text WhatsApp send — the ONE call the UI should make for an ad-hoc
 * message (order confirmation, delivery reminder, "your piece is ready").
 *
 * Why this exists:
 *
 * The templated pipeline (commService.send) is for documents — it resolves a
 * template, attaches a PDF, logs against an invoice. A reminder the user just
 * typed into a textarea has none of that. Those call sites were therefore
 * building `wa.me` URLs and calling `window.open` THEMSELVES — in
 * doc-comm-actions, reminder-dialog, orders.new and the Communications
 * broadcast. That hard-codes the transport into the business logic: every one of
 * them would have to be found and rewritten the day OpenWA replaces deep links,
 * and any that were missed would keep silently opening browser tabs.
 *
 * This routes ad-hoc messages through the SAME provider registry and per-branch
 * provider config that everything else already uses. Switching a branch to
 * `whatsapp_openwa` in Provider Settings switches these too — with no change to
 * any calling screen.
 *
 * The signature is deliberately written for the harder future, not the easy
 * present: it is async and it can FAIL. A deep link can't really fail (the tab
 * opens, and whether the user presses send is beyond our knowledge). OpenWA very
 * much can — session dropped, daemon down, number not on WhatsApp. Callers that
 * treat this as fire-and-forget will report "sent" for messages that never left
 * the building, so `ok` must be honoured.
 */
import { createProvider } from "./provider-registry";
import { useCommSettings } from "./comm-settings-store";
import { isValidWaPhone } from "@/lib/wa-link";
import type { CommResult, ProviderType } from "./types";

export interface WhatsAppTextRequest {
  phone: string;
  message: string;
  recipientName?: string;
  branchId?: string;
  /** For the comm log — what this message was about. */
  linkedType?: "invoice" | "order" | "job" | "repair" | "estimate";
  linkedId?: string;
}

export interface WhatsAppTextResult {
  ok: boolean;
  error?: string;
  /**
   * `whatsapp_deep_link` means WE DID NOT SEND IT — the user's WhatsApp was
   * opened with the text pre-filled and they must press send. Anything else
   * means the message was actually dispatched. UI that claims "message sent"
   * must respect the difference.
   */
  via: ProviderType;
}

/** The WhatsApp provider configured for this branch, falling back to deep link. */
function activeWhatsAppProvider(branchId?: string): ProviderType {
  const configs = useCommSettings.getState().configs;
  const match = configs.find(
    (c) =>
      c.channel === "whatsapp" &&
      c.isActive &&
      (branchId ? c.branchId === branchId : true) &&
      c.providerType,
  );
  return (match?.providerType as ProviderType) ?? "whatsapp_deep_link";
}

/** Can we reach this number with the active transport at all? */
export function canSendWhatsApp(phone: string | undefined | null): boolean {
  return !!phone && isValidWaPhone(phone);
}

/**
 * Resolve + configure the branch's active WhatsApp provider once. Shared by the
 * text and document senders so both route through the same provider registry
 * and per-branch config (deep link when nothing is configured).
 */
export function resolveWhatsAppProvider(branchId?: string) {
  const providerType = activeWhatsAppProvider(branchId);
  const provider = createProvider(providerType);
  const config = useCommSettings
    .getState()
    .configs.find((c) => c.channel === "whatsapp" && c.providerType === providerType && c.isActive);
  provider.configure(
    config ?? {
      id: "adhoc",
      branchId: branchId ?? "MAIN",
      channel: "whatsapp",
      providerType,
      isActive: true,
      priority: 0,
      settings: {},
    },
  );
  return { provider, providerType };
}

export async function sendWhatsAppText(req: WhatsAppTextRequest): Promise<WhatsAppTextResult> {
  const providerType = activeWhatsAppProvider(req.branchId);

  if (!isValidWaPhone(req.phone)) {
    return {
      ok: false,
      error: `"${req.phone}" is not a valid WhatsApp number.`,
      via: providerType,
    };
  }

  try {
    const { provider } = resolveWhatsAppProvider(req.branchId);

    const result: CommResult = await provider.send(
      {
        channel: "whatsapp",
        // Ad-hoc text carries no document template; the body IS the message.
        template: "custom",
        branchId: req.branchId ?? "MAIN",
        recipient: { name: req.recipientName ?? "Customer", phone: req.phone },
        linkedId: req.linkedId ?? "",
        linkedType: req.linkedType ?? "order",
      },
      { textBody: req.message },
    );

    return {
      ok: result.success,
      error: result.error,
      via: providerType,
    };
  } catch (err) {
    // A provider that throws (misconfigured, unimplemented) must surface, not
    // vanish — the user needs to know the message did not go.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "WhatsApp send failed.",
      via: providerType,
    };
  }
}
