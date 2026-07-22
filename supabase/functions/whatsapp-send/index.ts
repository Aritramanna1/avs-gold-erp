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

function requireText(value: unknown, label: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

async function providerRequest(path: string, init: RequestInit = {}) {
  const apiKey = requireText(Deno.env.get("WASENDER_API_KEY"), "WASENDER_API_KEY secret");
  const baseUrl = (Deno.env.get("WASENDER_API_URL") || "https://www.wasenderapi.com/api").replace(
    /\/$/,
    "",
  );
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST is required." }, 405);

  try {
    const body = await req.json();
    const to = requireText(body.to, "to");
    const text = typeof body.text === "string" ? body.text : "";
    let documentUrl = typeof body.documentUrl === "string" ? body.documentUrl : "";

    if (body.base64) {
      const upload = await providerRequest("/upload", {
        body: JSON.stringify({ base64: body.base64, mimetype: body.mimeType || "application/pdf" }),
      });
      const uploadBody = await upload.json().catch(() => ({}));
      if (!upload.ok || !uploadBody.publicUrl) {
        return json(
          { error: uploadBody.message || "WhatsApp media upload failed.", provider: uploadBody },
          502,
        );
      }
      documentUrl = uploadBody.publicUrl;
      if (body.uploadOnly) return json({ success: true, publicUrl: documentUrl });
    }

    if (!text && !documentUrl) return json({ error: "text or documentUrl is required." }, 400);

    const payload: Record<string, string> = { to };
    if (text) payload.text = text;
    if (documentUrl) {
      payload.documentUrl = documentUrl;
      if (body.fileName) payload.fileName = String(body.fileName);
    }

    const response = await providerRequest("/send-message", { body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    return json(result, response.status);
  } catch (error) {
    console.error("[whatsapp-send] request failed", error);
    return json({ error: error instanceof Error ? error.message : "WhatsApp send failed." }, 500);
  }
});
