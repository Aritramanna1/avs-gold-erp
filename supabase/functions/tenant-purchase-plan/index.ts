import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !serviceKey || !authorization) return json({ error: "Unauthorized" }, 401);

  const caller = createClient(url, anonKey ?? serviceKey, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(url, serviceKey);
  const { data: authData } = await caller.auth.getUser();
  if (!authData.user) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const planCode = String(body?.planCode ?? "growth").trim();
  const productId = String(body?.productId ?? "ORNEXA").trim();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("firm_id, full_name")
    .eq("auth_id", authData.user.id)
    .maybeSingle();
  const firmId = profile?.firm_id as string | undefined;
  if (!firmId) return json({ error: "No tenant profile" }, 400);

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", firmId)
    .maybeSingle();
  const { data: plan } = await admin
    .from("platform_plans")
    .select("id, name, price_minor")
    .eq("code", planCode)
    .maybeSingle();

  const amountPaise = Number(plan?.price_minor ?? 0) || 99900;
  const invoiceNo = `AVS-${Date.now().toString().slice(-8)}`;

  const { data: invoice, error: invErr } = await admin
    .from("platform_invoices")
    .insert({
      invoice_no: invoiceNo,
      firm_id: firmId,
      billing_name: String(org?.name ?? "Tenant"),
      item_type: "licence",
      subtotal_paise: amountPaise,
      tax_paise: 0,
      total_paise: amountPaise,
      status: "sent",
    })
    .select("id")
    .single();
  if (invErr || !invoice) return json({ error: invErr?.message ?? "Invoice failed" }, 400);

  await admin.from("platform_invoice_items").insert({
    invoice_id: invoice.id,
    description: `${plan?.name ?? planCode} — ${productId} licence`,
    item_type: "licence",
    quantity: 1,
    unit_price_paise: amountPaise,
    amount_paise: amountPaise,
    metadata: { plan_code: planCode, product_id: productId, plan_id: plan?.id },
  });

  const { data: keyRow } = await admin
    .from("platform_credentials")
    .select("secret_encrypted")
    .eq("key", "razorpay_key_id")
    .maybeSingle();
  const { data: secretRow } = await admin
    .from("platform_credentials")
    .select("secret_encrypted")
    .eq("key", "razorpay_key_secret")
    .maybeSingle();

  const keyId = keyRow?.secret_encrypted ?? Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = secretRow?.secret_encrypted ?? Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json({ error: "Razorpay not configured" }, 503);

  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: invoiceNo,
      notes: {
        firm_id: firmId,
        platform_invoice_id: invoice.id,
        product_id: productId,
        plan_code: planCode,
      },
    }),
  });
  const orderBody = await orderRes.json();
  if (!orderRes.ok)
    return json({ error: orderBody.error?.description ?? "Razorpay order failed" }, 400);

  await admin.from("razorpay_orders").insert({
    firm_id: firmId,
    platform_invoice_id: invoice.id,
    razorpay_order_id: orderBody.id,
    amount_paise: amountPaise,
    receipt: invoiceNo,
    notes: { product_id: productId, plan_code: planCode },
  });

  return json({
    ok: true,
    orderId: orderBody.id,
    amountPaise,
    keyId,
    invoiceId: invoice.id,
  });
});
