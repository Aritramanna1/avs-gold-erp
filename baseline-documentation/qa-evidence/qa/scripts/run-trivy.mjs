#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const docker = spawnSync("docker", ["--version"], { shell: true, encoding: "utf8" });
if (docker.status !== 0) {
  console.warn("[trivy] Docker not available — SKIPPED");
  process.exit(0);
}

// Targeted scans — avoid scanning .agents, node_modules, release artifacts
const targets = ["package-lock.json", "src", "supabase/functions", "supabase/migrations"];

let failed = 0;
for (const target of targets) {
  console.log(`\n▶ [trivy] ${target}`);
  const proc = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${root}:/src`,
      "aquasec/trivy:0.63.0",
      "fs",
      "--scanners",
      "vuln",
      "--severity",
      "CRITICAL,HIGH",
      "--timeout",
      "10m",
      "--skip-version-check",
      `/src/${target.replace(/\\/g, "/")}`,
    ],
    { cwd: root, shell: true, stdio: "inherit" },
  );
  if (proc.status !== 0) failed++;
}

process.exit(failed > 0 ? 1 : 0);
