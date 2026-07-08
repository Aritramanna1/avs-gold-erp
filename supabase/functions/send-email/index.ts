// MTJ ERP — Unified Email Edge Function (Nodemailer / Hostinger SMTP)
// ---------------------------------------------------------------------------
// This is the SINGLE backend used by every email the ERP sends: invitations,
// job cards, manufacturing bills, invoices, receipts, reports/notifications,
// SMTP connection tests, and one-off diagnostics. There is no other email
// edge function — do not create a second one.
//
// Uses Nodemailer (via npm: specifier) instead of a raw Deno SMTP client,
// which is far more resilient across providers and encryption modes
// (implicit TLS on 465, STARTTLS on 587).
//
// SECURITY: This function holds NO hardcoded credentials. SMTP settings are
// read from the `app_settings` table (row id = "comm_configs", the same store
// Settings → Communications persists to) using the service-role key. The
// caller may optionally pass an `smtp` override in the request body (e.g. to
// test unsaved edits before Save, or when a caller already has its own SMTP
// config loaded) — if omitted, the persisted settings are used.
//
// Modes:
//   { verifyOnly: true, smtp?: {...}, branchId?: string }
//     → connect + EHLO + AUTH only, no email is sent ("Test SMTP Connection")
//   { to, subject, htmlBody, textBody?, smtp?: {...}, branchId?: string }
//     → sends a real email (test dispatch, invitation, invoice, job card, ...)
// ---------------------------------------------------------------------------
// NOTE: deliberately avoids deno.land/std imports — that registry has proven
// unreliable to fetch during bundling on this project's deploy infra (it has
// caused edge functions to silently fail to deploy). Deno.serve is a built-in
// global in the Supabase Edge Function runtime, no import needed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SmtpConfig {
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  encryption?: string; // "ssl" | "tls" | "starttls" | "none" | "" (auto from port)
  use_ssl?: string | boolean;
}

/** Reads the persisted SMTP settings from app_settings.comm_configs (the same
 *  row Settings → Communications writes to), picking the active email_smtp
 *  provider config, optionally scoped to a branch. */
async function readSmtpConfigFromDb(
  supabaseUrl: string,
  serviceKey: string,
  branchId?: string,
): Promise<SmtpConfig | null> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("app_settings")
    .select("data")
    .eq("id", "comm_configs")
    .maybeSingle();

  if (error) {
    console.error("[send-email] Failed to read comm_configs from app_settings:", error);
    throw new Error(`Could not read SMTP settings from the database: ${error.message}`);
  }

  const configs: any[] = Array.isArray(data?.data?.configs) ? data.data.configs : [];
  if (configs.length === 0) return null;

  const candidates = configs.filter(
    (c) => c?.channel === "email" && c?.providerType === "email_smtp" && c?.isActive,
  );
  const scoped = branchId ? candidates.filter((c) => c.branchId === branchId) : candidates;
  const match = scoped[0] ?? candidates[0];
  if (!match) return null;

  return (match.settings ?? {}) as SmtpConfig;
}

// Resolve whether the connection is implicit-TLS (465) or upgraded via STARTTLS (587/25).
function resolveSecurity(cfg: SmtpConfig): { secure: boolean; requireTLS: boolean } {
  const enc = String(cfg.encryption || "")
    .toLowerCase()
    .trim();
  const port = Number(cfg.port) || 0;

  if (enc === "ssl" || enc === "tls") return { secure: true, requireTLS: false };
  if (enc === "starttls") return { secure: false, requireTLS: true };
  if (enc === "none") return { secure: false, requireTLS: false };
  if (String(cfg.use_ssl).toLowerCase() === "true") return { secure: true, requireTLS: false };

  // Auto-detect from port when no explicit encryption mode was set.
  if (port === 465) return { secure: true, requireTLS: false };
  if (port === 587 || port === 25) return { secure: false, requireTLS: true };
  return { secure: false, requireTLS: true };
}

function validateConfig(cfg: SmtpConfig): string | null {
  if (!cfg.host || !String(cfg.host).trim()) return "SMTP host is required.";
  const port = Number(cfg.port);
  if (!port || port <= 0 || port > 65535) return "A valid SMTP port is required.";
  if (!cfg.username || !String(cfg.username).trim()) return "SMTP username is required.";
  if (!cfg.password || !String(cfg.password).trim()) return "SMTP password is required.";
  if (!cfg.from_email || !String(cfg.from_email).trim()) return "From email address is required.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    console.error("[send-email] Invalid JSON body:", err);
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    let smtp: SmtpConfig | null = body.smtp && Object.keys(body.smtp).length > 0 ? body.smtp : null;

    if (!smtp) {
      if (!supabaseUrl || !serviceKey) {
        return json(
          { error: "Server is not configured with database access to read SMTP settings." },
          500,
        );
      }
      try {
        smtp = await readSmtpConfigFromDb(supabaseUrl, serviceKey, body.branchId);
      } catch (dbErr) {
        return json({ error: dbErr instanceof Error ? dbErr.message : String(dbErr) }, 500);
      }
      if (!smtp) {
        return json(
          { error: "No active SMTP configuration was found in Settings → Communications." },
          400,
        );
      }
    }

    const validationError = validateConfig(smtp);
    if (validationError) {
      console.warn("[send-email] Validation failed:", validationError);
      return json({ error: validationError }, 400);
    }

    const port = Number(smtp.port);
    const { secure, requireTLS } = resolveSecurity(smtp);
    const fromEmail = String(smtp.from_email).trim();
    const fromName = smtp.from_name?.trim() || "MTJ ERP";

    console.log(
      `[send-email] Connecting to ${smtp.host}:${port} (secure=${secure}, requireTLS=${requireTLS}) as ${smtp.username}`,
    );

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port,
      secure,
      requireTLS,
      auth: { user: smtp.username, pass: smtp.password },
      tls: { rejectUnauthorized: true },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    // ── Mode 1: connection test only (no email sent) ─────────────────────────
    if (body.verifyOnly) {
      try {
        await transporter.verify();
        console.log(`[send-email] Verified connection to ${smtp.host}:${port} successfully.`);
        return json({ success: true, message: "Connected & authenticated successfully." });
      } catch (err) {
        console.error("[send-email] Connection verification failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
      }
    }

    // ── Mode 2: send an email ─────────────────────────────────────────────────
    const to = String(body.to || "").trim();
    if (!to || !to.includes("@")) {
      return json({ error: "A valid recipient email address is required." }, 400);
    }

    const subject = String(body.subject || "").trim();
    const htmlBody = typeof body.htmlBody === "string" ? body.htmlBody : undefined;
    const textBody = typeof body.textBody === "string" ? body.textBody : undefined;
    if (!subject || !(htmlBody || textBody)) {
      return json({ error: "Missing required parameters (subject, htmlBody or textBody)." }, 400);
    }

    try {
      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to,
        replyTo: smtp.reply_to || undefined,
        subject,
        text: textBody || "Please view this message in an HTML-capable client.",
        html: htmlBody || undefined,
      });
      console.log(`[send-email] Email sent to ${to}. messageId=${info?.messageId}`);
      return json({
        success: true,
        message: "Email sent successfully.",
        messageId: info?.messageId,
      });
    } catch (err) {
      console.error("[send-email] Failed to send email:", err);
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 500);
    }
  } catch (err) {
    console.error("[send-email] Unhandled exception:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
