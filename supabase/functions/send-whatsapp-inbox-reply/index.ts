/**
 * Send WhatsApp inbox reply — service window policy + persistence.
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
    conversationId?: string;
    phone?: string;
    message?: string;
    branchId?: string;
    templateName?: string;
    templateParams?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Invalid session" }, 401);

  const { data: profile } = await admin
    .from("user_profiles")
    .select("firm_id,branch_id,active,status")
    .eq("auth_id", auth.user.id)
    .maybeSingle();
  if (!profile?.firm_id || !profile.active || profile.status !== "active") {
    return json({ error: "Active tenant membership required" }, 403);
  }

  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", body.conversationId)
    .eq("firm_id", profile.firm_id)
    .maybeSingle();
  if (!conv) return json({ error: "Conversation not found" }, 404);

  const phone = body.phone ?? conv.contact_phone;
  const branchId = body.branchId ?? conv.branch_id ?? profile.branch_id;

  const { data: lastInbound } = await admin
    .from("whatsapp_messages")
    .select("created_at")
    .eq("conversation_id", conv.id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const windowOpen =
    lastInbound?.created_at &&
    Date.now() - new Date(String(lastInbound.created_at)).getTime() < 24 * 60 * 60 * 1000;

  if (!windowOpen && !body.templateName) {
    return json(
      {
        error:
          "24-hour service window closed. Use an approved template message for business-initiated outreach.",
        requiresTemplate: true,
      },
      400,
    );
  }

  const sendRes = await fetch(`${url}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      branchId,
      phone,
      message: body.message,
    }),
  });
  const sendBody = (await sendRes.json()) as { ok?: boolean; error?: string; messageId?: string };
  if (!sendRes.ok) return json({ error: sendBody.error ?? "Send failed" }, 502);

  await admin.from("whatsapp_messages").insert({
    firm_id: profile.firm_id,
    product_id: conv.product_id,
    conversation_id: conv.id,
    direction: "outbound",
    message_type: body.templateName ? "template" : "text",
    provider_message_id: sendBody.messageId ?? null,
    body_text: body.message,
    template_name: body.templateName ?? null,
    template_params: body.templateParams ?? null,
    status: "sent",
    sender_type: "agent",
    sender_user_id: auth.user.id,
    sent_at: new Date().toISOString(),
  });

  await admin
    .from("whatsapp_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: (body.message ?? "").slice(0, 200),
      last_message_direction: "outbound",
      status: "waiting_customer",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conv.id);

  return json({ ok: true, messageId: sendBody.messageId });
});
