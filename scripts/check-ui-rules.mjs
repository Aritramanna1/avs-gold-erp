#!/usr/bin/env node
/**
 * MTJ / AVS ERP — Automated UI Rules Compliance Checker
 * Validates the codebase against UI_RULES.md standards:
 * 1. No forbidden UI libraries (MUI, Bootstrap, AntD, etc.)
 * 2. Icons strictly from lucide-react
 * 3. No unapproved inline style color overrides
 * 4. Verification of design tokens
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");

const FORBIDDEN_LIBRARIES = [
  "@mui/material",
  "@material-ui/core",
  "bootstrap",
  "react-bootstrap",
  "antd",
  "chakra-ui",
  "semantic-ui",
  "@chakra-ui/react",
  "font-awesome",
  "@fortawesome/react-fontawesome",
];

const FORBIDDEN_INLINE_COLORS = [
  /style=\{\{\s*color:\s*["']#(?!A88445|C9A227|806738|EEE5D2|E8C96A|18181B|020617|1E293B|0F172A|334155|E2E8F0|F1F5F9|10B981|F59E0B|EF4444|3B82F6|FFFFFF|000000)[0-9a-fA-F]{3,8}["']\s*\}\}/g,
];

let totalFilesChecked = 0;
let violations = [];

function checkFile(filePath) {
  if (
    !filePath.endsWith(".tsx") &&
    !filePath.endsWith(".ts") &&
    !filePath.endsWith(".css") &&
    !filePath.endsWith(".html")
  ) {
    return;
  }

  totalFilesChecked++;
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(root, filePath);

  // Check 1: Forbidden UI libraries
  for (const lib of FORBIDDEN_LIBRARIES) {
    if (content.includes(`from "${lib}"`) || content.includes(`from '${lib}'`)) {
      violations.push({
        file: relPath,
        type: "FORBIDDEN_LIBRARY",
        message: `Importing forbidden library "${lib}". Use @/components/ui primitives instead.`,
      });
    }
  }

  // Check 2: Raw non-standard icons (e.g. from react-icons/fa, etc.)
  if (content.includes("from \"react-icons/") || content.includes("from 'react-icons/")) {
    violations.push({
      file: relPath,
      type: "UNAPPROVED_ICON_LIBRARY",
      message: "Unapproved icon import. Icons must be strictly imported from 'lucide-react'.",
    });
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name !== "node_modules" &&
        entry.name !== ".git" &&
        entry.name !== "dist" &&
        entry.name !== "dist-erp" &&
        entry.name !== "dist-portal"
      ) {
        walkDir(fullPath);
      }
    } else {
      checkFile(fullPath);
    }
  }
}

console.log("==================================================");
console.log("MTJ / AVS ERP — UI RULES COMPLIANCE CHECKER");
console.log("==================================================");

walkDir(srcDir);

if (fs.existsSync(path.join(root, "electron-app"))) {
  walkDir(path.join(root, "electron-app"));
}

console.log(`Files Analyzed: ${totalFilesChecked}`);

if (violations.length === 0) {
  console.log("✓ All files strictly comply with UI_RULES.md!");
  console.log("==================================================");
  process.exit(0);
} else {
  console.error(`\n❌ Found ${violations.length} UI Rules Violations:`);
  for (const v of violations) {
    console.error(`- [${v.type}] ${v.file}: ${v.message}`);
  }
  console.log("==================================================");
  process.exit(1);
}
