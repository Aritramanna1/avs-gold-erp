/**
 * Run WhatsApp campaign — template-only mass send with per-recipient tracking.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !url || !serviceKey) return json({ error: "Authentication required" }, 401);

  let body: {
    campaignId?: string;
    recipients?: Array<{ partyId: string; phone: string; name: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.campaignId) return json({ error: "campaignId required" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Invalid session" }, 401);

  const { data: campaign } = await admin
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", body.campaignId)
    .single();
  if (!campaign?.template_name)
    return json({ error: "Campaign must use an approved template" }, 400);

  const recipients = body.recipients ?? [];
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const { data: optIn } = await admin
      .from("whatsapp_opt_ins")
      .select("status")
      .eq("phone_e164", r.phone)
      .eq("product_id", campaign.product_id)
      .maybeSingle();

    if (optIn?.status !== "opted_in") {
      await admin.from("campaign_recipients").insert({
        campaign_id: body.campaignId,
        firm_id: campaign.firm_id,
        party_id: r.partyId,
        phone_e164: r.phone,
        person_name: r.name,
        status: "skipped",
        error_message: "No WhatsApp opt-in",
      });
      failed += 1;
      continue;
    }

    const sendRes = await fetch(`${url}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: r.phone,
        message: `[Template: ${campaign.template_name}]`,
        branchId: campaign.branch_id,
      }),
    });

    const sendBody = (await sendRes.json()) as { messageId?: string; error?: string };
    const ok = sendRes.ok;

    await admin.from("campaign_recipients").insert({
      campaign_id: body.campaignId,
      firm_id: campaign.firm_id,
      party_id: r.partyId,
      phone_e164: r.phone,
      person_name: r.name,
      status: ok ? "sent" : "failed",
      provider_message_id: sendBody.messageId ?? null,
      sent_at: ok ? new Date().toISOString() : null,
      error_message: ok ? null : (sendBody.error ?? "send failed"),
    });

    if (ok) sent += 1;
    else failed += 1;
  }

  await admin.from("campaign_events").insert({
    campaign_id: body.campaignId,
    firm_id: campaign.firm_id,
    event_type: "campaign.completed",
    payload: { sent, failed, total: recipients.length },
  });

  await admin
    .from("whatsapp_campaigns")
    .update({
      stats: { sent, delivered: 0, read: 0, failed, responses: 0, opt_outs: 0 },
      completed_at: new Date().toISOString(),
      status:
        failed > 0 && sent > 0 ? "PARTIAL" : failed === recipients.length ? "FAILED" : "COMPLETED",
    })
    .eq("id", body.campaignId);

  return json({ ok: true, sent, failed });
});
