/**
 * Meta WhatsApp Cloud API Webhook — signature validation, status updates, idempotency.
 * GET: hub.verify_token challenge
 * POST: message status events (sent, delivered, read, failed)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appSecret = Deno.env.get("META_APP_SECRET") ?? Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
  const verifyToken =
    Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Meta verification handshake
  if (req.method === "GET") {
    const u = new URL(req.url);
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: cors });
    }
    return json({ error: "Verification failed" }, 403);
  }

  if (req.method !== "POST") return json({ error: "GET or POST only" }, 405);

  const rawBody = await req.text();

  // Signature validation when secret configured
  if (appSecret) {
    const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + (await hmacSha256Hex(appSecret, rawBody));
    if (sigHeader !== expected) {
      return json({ error: "Invalid signature" }, 401);
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const entries = (payload.entry ?? []) as Record<string, unknown>[];
  const processed: string[] = [];

  for (const entry of entries) {
    const changes = (entry.changes ?? []) as Record<string, unknown>[];
    for (const change of changes) {
      const value = (change.value ?? {}) as Record<string, unknown>;
      const metadata = (value.metadata ?? {}) as Record<string, unknown>;
      const phoneNumberId = String(metadata.phone_number_id ?? "");
      const statuses = (value.statuses ?? []) as Record<string, unknown>[];
      const messages = (value.messages ?? []) as Record<string, unknown>[];
      const contacts = (value.contacts ?? []) as Record<string, unknown>[];

      // --- Inbound customer messages → persist to inbox ---
      for (const msg of messages) {
        const providerMessageId = String(msg.id ?? "");
        if (!providerMessageId) continue;

        const { data: existingMsg } = await admin
          .from("whatsapp_messages")
          .select("id")
          .eq("provider_message_id", providerMessageId)
          .maybeSingle();
        if (existingMsg) continue;

        const fromPhone = String(msg.from ?? "");
        const contactName = String((contacts[0]?.profile as Record<string, unknown>)?.name ?? "");
        const msgType = String(msg.type ?? "text");
        let bodyText = "";
        let mediaUrl: string | null = null;
        if (msgType === "text") {
          bodyText = String((msg.text as Record<string, unknown>)?.body ?? "");
        } else if (["image", "document", "audio", "video"].includes(msgType)) {
          const media = (msg[msgType] as Record<string, unknown>) ?? {};
          bodyText = String(media.caption ?? `[${msgType}]`);
          mediaUrl = media.id ? String(media.id) : null;
        }

        const { data: conn } = await admin
          .from("whatsapp_connections")
          .select("id, firm_id, product_id, connection_mode")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();

        if (!conn?.firm_id || conn.connection_mode !== "managed_partner") continue;

        const productId = String(conn.product_id ?? "ORNEXA");
        const { data: convId } = await admin.rpc("resolve_whatsapp_conversation", {
          p_firm_id: conn.firm_id,
          p_product_id: productId,
          p_connection_id: conn.id,
          p_contact_phone: fromPhone,
          p_contact_name: contactName || null,
          p_party_id: null,
        });

        if (!convId) continue;

        await admin.from("whatsapp_messages").insert({
          firm_id: conn.firm_id,
          product_id: productId,
          conversation_id: convId,
          direction: "inbound",
          message_type: msgType,
          provider_message_id: providerMessageId,
          reply_to_provider_id: (msg.context as Record<string, unknown>)?.id
            ? String((msg.context as Record<string, unknown>).id)
            : null,
          body_text: bodyText,
          media_url: mediaUrl,
          status: "received",
          sender_type: "customer",
          metadata: { raw: msg },
        });

        const { data: convRow } = await admin
          .from("whatsapp_conversations")
          .select("unread_count")
          .eq("id", convId)
          .single();

        await admin
          .from("whatsapp_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: bodyText.slice(0, 200),
            last_message_direction: "inbound",
            unread_count: Number(convRow?.unread_count ?? 0) + 1,
            status: "waiting_internal",
            updated_at: new Date().toISOString(),
          })
          .eq("id", convId);

        processed.push(`inbound:${providerMessageId}`);
      }

      for (const st of statuses) {
        const externalId = String(st.id ?? "");
        const status = String(st.status ?? "");
        const eventType = `whatsapp.status.${status}`;

        // Idempotency
        let webhookEventId: string | null = null;
        if (externalId) {
          const { data: existing } = await admin
            .from("communication_webhook_events")
            .select("id")
            .eq("provider", "whatsapp_cloud_api")
            .eq("external_id", externalId + ":" + status)
            .maybeSingle();
          if (existing) continue;
        }

        const { data: insertedEvent } = await admin
          .from("communication_webhook_events")
          .insert({
            provider: "whatsapp_cloud_api",
            event_type: eventType,
            external_id: externalId ? externalId + ":" + status : null,
            payload: { entry, change, status: st, phone_number_id: phoneNumberId },
            processed: false,
          })
          .select("id")
          .single();
        webhookEventId = insertedEvent?.id ?? null;

        // Update channel results by external_message_id
        if (externalId && ["sent", "delivered", "read", "failed"].includes(status)) {
          const mapStatus =
            status === "sent"
              ? "sent"
              : status === "delivered"
                ? "delivered"
                : status === "read"
                  ? "read"
                  : "failed";

          const { data: results } = await admin
            .from("communication_channel_results")
            .select("id, job_id")
            .eq("external_message_id", externalId)
            .eq("channel", "whatsapp")
            .limit(1);

          const row = results?.[0];
          if (row) {
            const patch: Record<string, unknown> = { status: mapStatus };
            if (mapStatus === "sent") patch.sent_at = new Date().toISOString();
            if (mapStatus === "delivered") patch.delivered_at = new Date().toISOString();
            if (mapStatus === "read") patch.read_at = new Date().toISOString();
            if (mapStatus === "failed") {
              const errs = (st.errors ?? []) as Record<string, unknown>[];
              patch.error_message = String(errs[0]?.message ?? errs[0]?.title ?? "delivery failed");
            }
            await admin.from("communication_channel_results").update(patch).eq("id", row.id);

            // Update whatsapp_connections stats if we can resolve firm
            if (phoneNumberId) {
              const { data: conn } = await admin
                .from("whatsapp_connections")
                .select(
                  "id, firm_id, messages_sent_count, messages_delivered_count, messages_failed_count",
                )
                .eq("phone_number_id", phoneNumberId)
                .maybeSingle();
              if (conn) {
                const inc: Record<string, unknown> = {
                  last_webhook_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                if (mapStatus === "sent")
                  inc.messages_sent_count = (conn.messages_sent_count ?? 0) + 1;
                if (mapStatus === "delivered")
                  inc.messages_delivered_count = (conn.messages_delivered_count ?? 0) + 1;
                if (mapStatus === "failed")
                  inc.messages_failed_count = (conn.messages_failed_count ?? 0) + 1;
                await admin.from("whatsapp_connections").update(inc).eq("id", conn.id);

                // Credit deduction on delivered status only (idempotent via billing ledger)
                if (mapStatus === "delivered" && externalId && conn.firm_id) {
                  await admin.rpc("record_whatsapp_billing_from_webhook", {
                    p_firm_id: conn.firm_id,
                    p_connection_id: conn.id,
                    p_provider: "meta_whatsapp_cloud",
                    p_message_id: externalId,
                    p_message_category: "utility",
                    p_destination_market: "IN",
                    p_reference_event: "delivered",
                    p_webhook_event_id: webhookEventId,
                    p_product_id: "ORNEXA",
                  });
                }
              }
            }
          }
        }

        processed.push(externalId || eventType);
      }
    }
  }

  // Mark webhook events processed
  await admin
    .from("communication_webhook_events")
    .update({ processed: true })
    .eq("provider", "whatsapp_cloud_api")
    .eq("processed", false);

  return json({ ok: true, processed: processed.length });
});
