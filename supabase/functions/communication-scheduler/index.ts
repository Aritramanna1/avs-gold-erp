/**
 * Communication Scheduler — scheduled report deliveries + pending job retry.
 * Invoke via cron (pg_cron / external) with service role or scheduled secret.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scheduler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function cronMatches(cron: string, now: Date): boolean {
  // Minimal matcher: "daily@07:00" | "weekly@monday@19:00" | "monthly@1@08:00"
  const parts = cron.split("@");
  const kind = parts[0];
  const hour = Number(parts[parts.length - 1]?.split(":")[0] ?? now.getHours());
  if (now.getHours() !== hour) return false;
  if (kind === "daily") return true;
  if (kind === "weekly") {
    const day = parts[1] ?? "monday";
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return days[now.getDay()] === day.toLowerCase();
  }
  if (kind === "monthly") return now.getDate() === Number(parts[1] ?? 1);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const schedulerSecret = Deno.env.get("COMMUNICATION_SCHEDULER_SECRET");
  const authHeader = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-scheduler-secret");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";

  const authorized =
    (schedulerSecret && headerSecret === schedulerSecret) || authHeader === `Bearer ${serviceKey}`;
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const now = new Date();
  const results = { reports: 0, retries: 0, errors: [] as string[] };

  // Scheduled report deliveries
  const { data: schedules } = await admin
    .from("scheduled_report_deliveries")
    .select("*")
    .eq("is_active", true);

  for (const row of schedules ?? []) {
    try {
      if (!cronMatches(String(row.schedule_cron), now)) continue;

      const recipients = (row.recipients ?? []) as Array<{ email?: string; name?: string }>;
      const reportKey = String(row.report_key);
      const eventKey = reportKey.includes("weekly")
        ? "report.weekly"
        : reportKey.includes("monthly")
          ? "report.monthly"
          : "report.daily";

      const { data: job, error: jobErr } = await admin
        .from("communication_jobs")
        .insert({
          product_id: row.product_id,
          firm_id: row.firm_id,
          branch_id: row.branch_id,
          event_key: eventKey,
          channels_requested: [row.channel ?? "email"],
          status: "pending",
          recipient: recipients[0] ?? { name: "Management" },
          payload: {
            report_name: row.report_name,
            report_key: row.report_key,
            format: row.format,
            tenant_name: "AVS",
          },
          reference_type: "scheduled_report",
          reference_id: String(row.id),
        })
        .select("id")
        .single();

      if (jobErr) throw new Error(jobErr.message);

      await admin
        .from("scheduled_report_deliveries")
        .update({
          last_run_at: now.toISOString(),
          last_job_id: job?.id,
          updated_at: now.toISOString(),
        })
        .eq("id", row.id);

      results.reports++;
    } catch (e) {
      results.errors.push(String(e instanceof Error ? e.message : e));
    }
  }

  // Retry failed email outbox
  const { data: outbox } = await admin
    .from("email_outbox")
    .select("id, retry_count, max_retries")
    .in("status", ["failed", "retrying"])
    .lt("retry_count", 3)
    .limit(20);

  for (const item of outbox ?? []) {
    if ((item.retry_count ?? 0) >= (item.max_retries ?? 3)) continue;
    await admin
      .from("email_outbox")
      .update({
        status: "queued",
        retry_count: (item.retry_count ?? 0) + 1,
        updated_at: now.toISOString(),
      })
      .eq("id", item.id);
    results.retries++;
  }

  // Retry failed email outbox + process queued outbox sends
  const { data: queuedEmails } = await admin
    .from("email_outbox")
    .select(
      "id, firm_id, recipient_email, subject, template_key, event_key, entity_type, entity_id",
    )
    .eq("status", "queued")
    .limit(25);

  for (const mail of queuedEmails ?? []) {
    try {
      const payload = (mail as { subject?: string }).subject ?? "Ornexa notification";
      const sendRes = await fetch(`${url}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: (mail as { recipient_email: string }).recipient_email,
          subject: payload,
          htmlBody: `<p>${payload}</p>`,
        }),
      });
      if (sendRes.ok) {
        await admin
          .from("email_outbox")
          .update({ status: "sent", sent_at: now.toISOString() })
          .eq("id", mail.id);
        results.retries++;
      }
    } catch (e) {
      results.errors.push(String(e instanceof Error ? e.message : e));
    }
  }

  // AMC renewal reminders + trial lifecycle sweep
  try {
    await admin.rpc("sweep_amc_renewals");
    await admin.rpc("sweep_trial_lifecycle");
  } catch (e) {
    results.errors.push(String(e instanceof Error ? e.message : e));
  }

  return json({ ok: true, ...results });
});
