#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = ".github/labels.yml";
const labels = parseLabels(readFileSync(manifest, "utf8"));

function parseLabels(source) {
  const entries = [];
  let current = null;

  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith("- name:")) {
      current = { name: value(line) };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    if (line.trim().startsWith("color:")) current.color = value(line);
    if (line.trim().startsWith("description:")) {
      current.description = value(line);
    }
  }

  return entries;
}

function value(line) {
  return line.split(/:\s*/, 2)[1].replace(/^"|"$/g, "").trim();
}

for (const label of labels) {
  execFileSync(
    "gh",
    [
      "label",
      "create",
      label.name,
      "--color",
      label.color,
      "--description",
      label.description,
      "--force",
    ],
    { stdio: "inherit" },
  );
}
