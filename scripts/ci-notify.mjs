/**
 * Jenkins CI notification hook — sends engineering alerts via configured SMTP.
 * Credentials via env (Jenkins injects from credential store):
 *   CI_NOTIFY_SMTP_URL, CI_NOTIFY_FROM, CI_NOTIFY_TO, CI_NOTIFY_DEPLOY_TO
 */
const event = process.argv.find((a) => a.startsWith("--event="))?.split("=")[1] ?? "build-failed";

const smtpUrl = process.env.CI_NOTIFY_SMTP_URL;
const from = process.env.CI_NOTIFY_FROM ?? "ci@avs.local";
const to =
  event === "deploy-success"
    ? (process.env.CI_NOTIFY_DEPLOY_TO ?? process.env.CI_NOTIFY_TO)
    : process.env.CI_NOTIFY_TO;

const branch = process.env.GIT_BRANCH_NAME ?? process.env.BRANCH_NAME ?? "unknown";
const commit = process.env.GIT_COMMIT_SHORT ?? process.env.GIT_COMMIT?.slice(0, 7) ?? "unknown";
const buildUrl = process.env.BUILD_URL ?? "";
const jobName = process.env.JOB_NAME ?? "ornexa-erp";

if (!smtpUrl || !to) {
  console.log(`ci-notify: skipped (${event}) — CI_NOTIFY_SMTP_URL or CI_NOTIFY_TO not configured`);
  process.exit(0);
}

const subjects = {
  "build-failed": `[FAILED] ${jobName} — ${branch} @ ${commit}`,
  "deploy-success": `[DEPLOYED] ${jobName} production — ${commit}`,
};

const bodies = {
  "build-failed": `Build failed.\n\nBranch: ${branch}\nCommit: ${commit}\n${buildUrl}`,
  "deploy-success": `Production deployment completed.\n\nCommit: ${commit}\n${buildUrl}`,
};

async function send() {
  try {
    const nodemailer = await import("nodemailer").catch(() => null);
    if (!nodemailer) {
      console.log("ci-notify: nodemailer not installed — log only");
      console.log(subjects[event], bodies[event]);
      return;
    }
    const transport = nodemailer.createTransport(smtpUrl);
    await transport.sendMail({
      from,
      to,
      subject: subjects[event] ?? `[CI] ${jobName}`,
      text: bodies[event] ?? `Event: ${event}`,
    });
    console.log(`ci-notify: sent ${event} to ${to}`);
  } catch (err) {
    console.warn("ci-notify failed (non-blocking):", err instanceof Error ? err.message : err);
  }
}

void send();
