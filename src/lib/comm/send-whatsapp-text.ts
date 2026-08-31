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
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface WhatsAppTextRequest {
  phone: string;
  message: string;
  recipientName?: string;
  branchId?: string;
  /** For the comm log — what this message was about. */
  linkedType?:
    | "invoice"
    | "order"
    | "job"
    | "repair"
    | "estimate"
    | "portal_invitation"
    | "delivery_challan"
    | "credit_note"
    | "debit_note"
    | "gold_settlement";
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

import { useWaAutomation } from "@/lib/wa-automation-store";
import { WHATSAPP_KEYS } from "./types";

/** The WhatsApp provider configured for this branch, falling back to deep link. Returns null if disabled. */
export function activeWhatsAppProvider(branchId?: string): ProviderType | null {
  const bId = branchId || "MAIN";

  // 1. Check if WhatsApp is enabled in wa-automation-store
  const waConfig = useWaAutomation.getState().getConfig(bId);
  if (!waConfig.enabled) {
    return null; // WhatsApp is disabled!
  }

  // 2. Check if Wasender API is active in comm-settings
  const commConfigs = useCommSettings.getState().configs;
  const wasenderConfig = commConfigs.find(
    (c) =>
      c.branchId === bId &&
      c.channel === "whatsapp" &&
      c.providerType === "whatsapp_wasender" &&
      c.isActive,
  );
  if (wasenderConfig) {
    return "whatsapp_wasender";
  }

  // 3. Otherwise, return the configured provider type (which defaults to whatsapp_deep_link)
  return waConfig.providerType || "whatsapp_deep_link";
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
  if (!providerType) {
    throw new Error("WhatsApp is disabled in settings.");
  }
  const provider = createProvider(providerType);

  const bId = branchId || "MAIN";
  const waConfig = useWaAutomation.getState().getConfig(bId);
  const settings: Record<string, string> = {
    [WHATSAPP_KEYS.phoneNumberId]: waConfig.phoneNumberId || "",
    [WHATSAPP_KEYS.accessToken]: waConfig.accessToken || "",
    [WHATSAPP_KEYS.businessAccountId]: waConfig.businessAccountId || "",
    [WHATSAPP_KEYS.webhookVerifyToken]: waConfig.webhookVerifyToken || "",
    [WHATSAPP_KEYS.apiBaseUrl]: waConfig.apiBaseUrl || "",
    [WHATSAPP_KEYS.apiVersion]: waConfig.apiVersion || "",

    // BSP fields
    [WHATSAPP_KEYS.apiKey]: waConfig.accessToken || "",
    [WHATSAPP_KEYS.apiUrl]: waConfig.apiBaseUrl || "",
    [WHATSAPP_KEYS.senderPhone]: waConfig.phoneNumberId || "",

    // Template mappings
    template_invoice: waConfig.templateInvoice || "",
    template_receipt: waConfig.templateReceipt || "",
    template_order_ready: waConfig.templateOrderReady || "",
    template_repair_ready: waConfig.templateRepairReady || "",
    template_payment_reminder: waConfig.templatePaymentReminder || "",
    template_mfg_bill: waConfig.templateMfgBill || "",
    template_gold_issue: waConfig.templateGoldIssue || "",
    template_birthday: waConfig.templateBirthday || "",
    template_festival: waConfig.templateFestival || "",
    template_order_confirm: waConfig.templateOrderConfirm || "",
  };

  const config =
    providerType === "whatsapp_wasender"
      ? useCommSettings
          .getState()
          .configs.find(
            (c) => c.channel === "whatsapp" && c.providerType === providerType && c.isActive,
          )
      : {
          id: "wa_automation",
          branchId: bId,
          channel: "whatsapp" as const,
          providerType,
          isActive: true,
          priority: 0,
          settings,
        };

  provider.configure(
    config ?? {
      id: "adhoc",
      branchId: bId,
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

  if (!providerType) {
    return {
      ok: false,
      error: "WhatsApp is disabled in settings.",
      via: "whatsapp_deep_link",
    };
  }

  if (!isValidWaPhone(req.phone)) {
    return {
      ok: false,
      error: `"${req.phone}" is not a valid WhatsApp number.`,
      via: providerType,
    };
  }

  try {
    if (providerType !== "whatsapp_deep_link") {
      const { data, error } = await (supabase as any).functions.invoke("send-whatsapp", {
        body: { branchId: req.branchId ?? "MAIN", phone: req.phone, message: req.message },
      });
      const ok = !error && data?.ok === true;
      if (ok) {
        // Record credit usage asynchronously
        void (supabase as any).rpc("deduct_tenant_credits", {
          p_service_code: "wa_utility",
          p_units: 1,
          p_reference_id: req.linkedId || null,
          p_description: `WhatsApp message to ${req.phone}`,
        });
      }
      return {
        ok,
        error: error?.message || data?.error,
        via: providerType,
      };
    }
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

    if (result.success) {
      void (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: "wa_utility",
        p_units: 1,
        p_reference_id: req.linkedId || null,
        p_description: `WhatsApp message via ${providerType} to ${req.phone}`,
      });
    }

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
