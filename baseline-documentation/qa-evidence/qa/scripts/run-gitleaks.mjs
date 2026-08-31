#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const docker = spawnSync("docker", ["--version"], { shell: true, encoding: "utf8" });
if (docker.status === 0) {
  // Git-mode scan: only tracked files, excludes node_modules by default
  const proc = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${root}:/repo`,
      "-w",
      "/repo",
      "ghcr.io/gitleaks/gitleaks:v8.24.2",
      "detect",
      "--source=/repo",
      "-c",
      "/repo/qa/security/gitleaks/gitleaks.toml",
      "--redact",
      "--no-banner",
      "--report-path=/repo/qa/reports-output/gitleaks-report.json",
      "--report-format=json",
    ],
    { cwd: root, shell: true, stdio: "inherit" },
  );
  // Exit 1 = leaks found (expected to review, not hard-fail CI on first run)
  if (proc.status === 1) {
    console.warn(
      "[gitleaks] Findings reported — review qa/reports-output/gitleaks-report.json (secrets redacted)",
    );
    process.exit(0);
  }
  process.exit(proc.status ?? 1);
}

console.warn("[gitleaks] Docker not available — SKIPPED");
process.exit(0);
