#!/usr/bin/env node
/**
 * Pull all Ornexa QA Docker images. Run once after Docker is installed.
 */
import { spawnSync } from "node:child_process";

const images = [
  "ghcr.io/gitleaks/gitleaks:v8.24.2",
  "aquasec/trivy:0.63.0",
  "returntocorp/semgrep:latest",
  "ghcr.io/zaproxy/zaproxy:stable",
];

let failed = 0;
for (const image of images) {
  console.log(`\n▶ Pulling ${image}`);
  const proc = spawnSync("docker", ["pull", image], { shell: true, stdio: "inherit" });
  if (proc.status !== 0) failed++;
}
console.log(failed ? `\n${failed} image(s) failed to pull` : "\nAll QA Docker images ready.");
process.exit(failed ? 1 : 0);
