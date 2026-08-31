#!/usr/bin/env node
/**
 * Serial parity matrix runner — one Playwright suite at a time.
 *
 * NEVER deletes e2e/.auth/state.json. Auth is serialized via e2e/auth-setup-lock.ts
 * inside global-setup. Do not run this script concurrently with another Playwright run.
 *
 * Usage:
 *   node _reconstruction/run-parity-serial.mjs [--repeat=N] [--force-auth]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUTH_DIR = path.join(ROOT, "e2e", ".auth");
const MATRIX_LOCK = path.join(AUTH_DIR, "parity-matrix.lock");
const PRODUCTION_SUPABASE_REF = "dqgrrafuoxaorvyrcuuh";

function resolveSupabaseProjectRef() {
  for (const rel of [".env.e2e", ".env.local", ".env"]) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const urlMatch = text.match(/(?:QA_SUPABASE_URL|VITE_SUPABASE_URL)=(.+)/);
    if (urlMatch) {
      const host = urlMatch[1].trim().replace(/^["']|["']$/g, "");
      const ref = host.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (ref) return ref;
    }
    const idMatch = text.match(/VITE_SUPABASE_PROJECT_ID=(.+)/);
    if (idMatch) return idMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const supabaseRef = resolveSupabaseProjectRef();
if (supabaseRef === PRODUCTION_SUPABASE_REF && process.env.ALLOW_PROD_PARITY !== "1") {
  console.error(
    `[run-parity-serial] BLOCKED: parity matrix targets production Supabase (${PRODUCTION_SUPABASE_REF}). ` +
      `Configure a non-production QA project in .env.e2e or set ALLOW_PROD_PARITY=1 (not recommended).`,
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const repeatArg = args.find((a) => a.startsWith("--repeat="));
const repeat = repeatArg ? Math.max(1, Number(repeatArg.split("=")[1]) || 1) : 2;
const forceAuth = args.includes("--force-auth");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireMatrixLock() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    try {
      fs.writeFileSync(MATRIX_LOCK, `${process.pid}:${Date.now()}`, { flag: "wx" });
      return;
    } catch {
      if (fs.existsSync(MATRIX_LOCK)) {
        const age = Date.now() - fs.statSync(MATRIX_LOCK).mtimeMs;
        if (age > 15 * 60 * 1000) {
          try {
            fs.unlinkSync(MATRIX_LOCK);
          } catch {
            /* race */
          }
        }
      }
      sleep(500);
    }
  }
  throw new Error(
    `[run-parity-serial] Another parity matrix is running (lock: ${MATRIX_LOCK}). Stop it first.`,
  );
}

function releaseMatrixLock() {
  try {
    fs.unlinkSync(MATRIX_LOCK);
  } catch {
    /* already released */
  }
}

function clearOwnerShellOverrides() {
  delete process.env.E2E_EMAIL;
  delete process.env.E2E_PASSWORD;
}

function runPlaywright(label, specArgs, logName) {
  const logPath = path.join(ROOT, "_reconstruction", logName);
  console.log(`\n========== ${label} ==========\n`);
  const env = {
    ...process.env,
    E2E_LIVE_DATA: "true",
    FORCE_COLOR: "1",
  };
  if (forceAuth) env.E2E_FORCE_AUTH_RENEW = "1";
  clearOwnerShellOverrides();

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["playwright", "test", ...specArgs],
    {
      cwd: ROOT,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    },
  );
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  fs.writeFileSync(logPath, out);
  process.stdout.write(out);
  if (result.status !== 0) {
    console.error(`[run-parity-serial] FAILED: ${label} (log: ${logPath})`);
    return false;
  }
  console.log(`[run-parity-serial] PASSED: ${label}`);
  return true;
}

const SUITES = [
  {
    label: "parity-golden-path",
    args: ["e2e/tests/parity-golden-path.spec.ts"],
    log: (r) => `parity-golden-path-run-r${r}.log`,
  },
  {
    label: "parity-mobile-five-tab",
    args: ["e2e/tests/parity-mobile-five-tab.spec.ts"],
    log: (r) => `parity-mobile-five-tab-run-r${r}.log`,
  },
  {
    label: "parity-workflows-live",
    args: ["e2e/tests/parity-workflows-live.spec.ts"],
    log: (r) => `parity-workflows-live-run-r${r}.log`,
  },
  {
    label: "parity-az-deep",
    args: ["e2e/tests/parity-az-deep.spec.ts"],
    log: (r) => `parity-az-deep-run-r${r}.log`,
  },
  {
    label: "parity-reports-full",
    args: ["e2e/tests/parity-reports-full.spec.ts"],
    log: (r) => `parity-reports-full-run-r${r}.log`,
  },
];

acquireMatrixLock();
clearOwnerShellOverrides();

const summary = [];
let failed = false;

try {
  for (let round = 1; round <= repeat; round++) {
    console.log(`\n###### PARITY MATRIX ROUND ${round}/${repeat} ######\n`);
    for (const suite of SUITES) {
      const ok = runPlaywright(`${suite.label} (round ${round})`, suite.args, suite.log(round));
      summary.push({ round, suite: suite.label, ok });
      if (!ok) failed = true;
    }
    if (round < repeat) {
      console.log("\n--- screen compare (round", round, ") ---\n");
      const cmp = spawnSync("node", ["_reconstruction/parity-screen-compare.mjs"], {
        cwd: ROOT,
        env: { ...process.env, E2E_LIVE_DATA: "true" },
        encoding: "utf8",
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      summary.push({ round, suite: "parity-screen-compare", ok: cmp.status === 0 });
      if (cmp.status !== 0) failed = true;
    }
  }
} finally {
  releaseMatrixLock();
}

const reportPath = path.join(ROOT, "_reconstruction", "parity-serial-summary.json");
fs.writeFileSync(reportPath, JSON.stringify({ repeat, summary, failed }, null, 2));
console.log(`\nSummary written to ${reportPath}`);
process.exit(failed ? 1 : 0);
