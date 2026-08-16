#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const guard = spawnSync("node", ["qa/scripts/staging-guard.mjs", "k6"], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (guard.status === 2) {
  console.error(guard.stdout || guard.stderr);
  process.exit(2);
}

const scenario = process.argv[2] || "smoke";
const script = `qa/performance/k6/${scenario}.js`;

const proc = spawnSync("k6", ["run", script], {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, QA_BASE_URL: process.env.QA_BASE_URL || "http://localhost:3000" },
  cwd: root,
});

if (proc.error?.code === "ENOENT") {
  console.warn("[k6] k6 CLI not in PATH — restart terminal after winget install.");
  process.exit(0);
}
process.exit(proc.status ?? 1);
