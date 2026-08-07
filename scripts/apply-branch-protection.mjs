#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const repo = process.env.GITHUB_REPOSITORY || "Aritramanna1/avs-gold-erp";
const branches = ["master", "develop", "staging"];

const payload = {
  required_status_checks: {
    strict: true,
    contexts: [
      "PR Governance / Validate PR template",
      "PR Governance / Validate migration queue",
      "PR Governance / Apply PR labels",
      "Protected Branch Guard / Flag direct shared-branch push",
    ],
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    require_code_owner_reviews: true,
    require_last_push_approval: false,
  },
  restrictions: null,
  required_conversation_resolution: true,
  allow_force_pushes: false,
  allow_deletions: false,
};

function gh(args, input) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

for (const branch of branches) {
  try {
    gh(
      ["api", "--method", "PUT", `repos/${repo}/branches/${branch}/protection`, "--input", "-"],
      JSON.stringify(payload),
    );
    console.log(`Applied branch protection to ${repo}:${branch}`);
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    const stdout = error.stdout?.toString().trim();
    console.error(`Failed to apply branch protection to ${repo}:${branch}`);
    if (stderr) console.error(stderr);
    if (stdout) console.error(stdout);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error(
    "Branch protection was not fully applied. Check repository plan, visibility, and admin permissions.",
  );
}
