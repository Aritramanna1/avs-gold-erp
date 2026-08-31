#!/usr/bin/env node
/**
 * One-shot installer: Docker images + verifies k6 + runs quick smoke checks.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

console.log("═══ Ornexa QA Tool Installer ═══\n");

spawnSync("node", ["qa/scripts/docker-pull-images.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

const k6 = spawnSync("k6", ["version"], { shell: true, encoding: "utf8" });
console.log(
  k6.stdout || (k6.error ? "[k6] Not in PATH — restart terminal after winget install" : ""),
);

console.log("\n▶ Verifying Docker scanners...");
for (const cmd of [
  ["node", ["qa/scripts/run-semgrep.mjs"]],
  ["node", ["qa/scripts/run-gitleaks.mjs"]],
]) {
  spawnSync(cmd[0], cmd[1], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, QA_BASE_URL: "http://localhost:3000" },
  });
}

console.log("\n✓ QA tooling install complete. Run: npm run qa:smoke");
