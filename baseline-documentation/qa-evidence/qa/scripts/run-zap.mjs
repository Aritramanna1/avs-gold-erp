#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const guard = spawnSync("node", ["qa/scripts/staging-guard.mjs", "zap"], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (guard.status === 2) {
  console.error(guard.stdout || guard.stderr);
  process.exit(2);
}

let target = process.env.QA_BASE_URL || process.env.E2E_BASE_URL || "http://localhost:3000";
// Docker containers cannot reach host localhost — use host.docker.internal on Windows/Mac
if (/localhost|127\.0\.0\.1/.test(target)) {
  target = target.replace(/localhost|127\.0\.0\.1/, "host.docker.internal");
}

const auth = process.argv.includes("--auth");
const zapImage = "ghcr.io/zaproxy/zaproxy:stable";
const report = auth ? "qa/reports-output/zap-report.html" : "qa/reports-output/zap-baseline.html";
const cmd = auth
  ? ["zap-full-scan.py", "-t", target, "-r", report]
  : ["zap-baseline.py", "-t", target, "-r", report];

console.log(`[zap] Scanning ${target} (auth=${auth})`);

const proc = spawnSync(
  "docker",
  ["run", "--rm", "-v", `${root}:/zap/wrk:rw`, "-t", zapImage, ...cmd],
  { cwd: root, shell: true, stdio: "inherit" },
);
// ZAP exits 2 when warnings found (no FAIL) — treat as reviewable pass
if (proc.status === 2) {
  console.warn("[zap] Completed with warnings — review qa/reports-output/zap-baseline.html");
  process.exit(0);
}
process.exit(proc.status ?? 1);
