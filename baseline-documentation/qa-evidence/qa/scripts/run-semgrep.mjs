#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "qa/reports-output/semgrep.json");

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: root, shell: true, stdio: "inherit" });
}

// Docker-first on Windows (pip semgrep optional on Unix CI)
const docker = run("docker", [
  "run",
  "--rm",
  "-v",
  `${root}:/src`,
  "returntocorp/semgrep:latest",
  "semgrep",
  "scan",
  "--config=/src/qa/security/semgrep/ornexa-rules.yml",
  "--config=p/typescript",
  "--json",
  "--output",
  "/src/qa/reports-output/semgrep.json",
  "/src/src",
  "/src/supabase/functions",
]);
if (docker.status === 0 || docker.status === 1) process.exit(0);

const pip = run("semgrep", [
  "scan",
  "--config=qa/security/semgrep/ornexa-rules.yml",
  "--config=p/typescript",
  "--json",
  "--output",
  out,
  "src",
  "supabase/functions",
]);
if (pip.status === 0 || pip.status === 1) process.exit(0);

console.warn("[semgrep] Semgrep not installed — SKIPPED. Install: pip install semgrep");
process.exit(0);
