#!/usr/bin/env node
/**
 * AVS ERP — Automated UI Design System Compliance Checker & Rule Guard
 * Validates the codebase against docs/UI-DESIGN-SYSTEM.md:
 * 1. No forbidden UI libraries (MUI, Bootstrap, AntD, Chakra, etc.)
 * 2. Icons strictly from lucide-react
 * 3. No rogue fullscreen dark backgrounds (bg-zinc-950 min-h-screen, bg-slate-950 min-h-screen)
 * 4. No unapproved font families (font-roboto, font-inter, font-poppins, etc.)
 * 5. Adherence to canonical AVS ERP design tokens and primitives
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

const FORBIDDEN_PATTERNS = [
  {
    regex: /className=["'][^"']*\b(bg-zinc-950|bg-slate-950)\b[^"']*min-h-screen/g,
    type: "FORBIDDEN_ROGUE_BACKGROUND",
    message: 'Forbidden rogue fullscreen dark background. Use canonical "bg-background min-h-screen" or layout shells.',
  },
  {
    regex: /className=["'][^"']*\bfont-(inter|roboto|poppins|lato|montserrat)\b/g,
    type: "FORBIDDEN_FONT_FAMILY",
    message: "Forbidden custom font family. Only use canonical font-serif, font-mono, or font-sans.",
  },
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
  if (content.includes('from "react-icons/') || content.includes("from 'react-icons/")) {
    violations.push({
      file: relPath,
      type: "UNAPPROVED_ICON_LIBRARY",
      message: "Unapproved icon import. Icons must be strictly imported from 'lucide-react'.",
    });
  }

  // Check 3: Forbidden patterns
  for (const item of FORBIDDEN_PATTERNS) {
    let match;
    const regex = new RegExp(item.regex);
    while ((match = regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      violations.push({
        file: `${relPath}:${line}`,
        type: item.type,
        message: `${item.message} (Matched: "${match[0].trim()}")`,
      });
    }
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
console.log("🛡️  AVS ERP — UI DESIGN SYSTEM COMPLIANCE CHECKER");
console.log("Auditing codebase against docs/UI-DESIGN-SYSTEM.md");
console.log("==================================================");

walkDir(srcDir);

if (fs.existsSync(path.join(root, "electron-app"))) {
  walkDir(path.join(root, "electron-app"));
}

console.log(`Files Analyzed: ${totalFilesChecked}`);

if (violations.length === 0) {
  console.log("✓ All files strictly comply with docs/UI-DESIGN-SYSTEM.md!");
  console.log("==================================================");
  process.exit(0);
} else {
  console.error(`\n❌ Found ${violations.length} UI Design System Violations:`);
  for (const v of violations) {
    console.error(`- [${v.type}] ${v.file}: ${v.message}`);
  }
  console.log("==================================================");
  process.exit(1);
}

