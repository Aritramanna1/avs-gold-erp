#!/usr/bin/env node
/**
 * AVS ERP UI Design System Consistency Linter / Guard
 * Enforces docs/UI-DESIGN-SYSTEM.md rules across the codebase.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const FORBIDDEN_PATTERNS = [
  {
    pattern: /className=["'][^"']*\b(bg-zinc-950|bg-slate-950)\b[^"']*min-h-screen/g,
    message: 'Forbidden rogue fullscreen dark background. Use canonical "bg-background min-h-screen" or layout shells.',
    severity: 'error',
  },
  {
    pattern: /className=["'][^"']*\bfont-(inter|roboto|poppins|lato|montserrat)\b/g,
    message: 'Forbidden custom font family. Only use canonical font-serif, font-mono, or font-sans.',
    severity: 'error',
  },
  {
    pattern: /style=\{\{[^}]*(backgroundColor|background):\s*['"]#(0f172a|020617|000000|18181b)['"][^}]*\}\}/g,
    message: 'Forbidden hardcoded inline background color. Use theme classes (bg-card, bg-background, bg-muted).',
    severity: 'error',
  }
];

let totalFilesChecked = 0;
let violations = [];

function walk(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      if (file.name !== 'node_modules' && file.name !== 'dist' && file.name !== '.git') {
        walk(fullPath);
      }
    } else if (/\.(tsx|ts|jsx|js)$/.test(file.name) && !file.name.endsWith('.d.ts')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  totalFilesChecked++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

  FORBIDDEN_PATTERNS.forEach(({ pattern, message, severity }) => {
    let match;
    const regex = new RegExp(pattern);
    while ((match = regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      violations.push({
        file: relPath,
        line,
        match: match[0].trim(),
        message,
        severity
      });
    }
  });
}

console.log('====================================================');
console.log(' 🛡️  AVS ERP UI DESIGN SYSTEM LINTER (RULE GUARD)');
console.log('====================================================');
console.log(`Auditing directory: src/ against docs/UI-DESIGN-SYSTEM.md`);

walk(srcDir);

console.log(`\nChecked ${totalFilesChecked} source files.`);

const errors = violations.filter(v => v.severity === 'error');

if (errors.length > 0) {
  console.error(`\n❌ Found ${errors.length} UI design system violations:\n`);
  errors.forEach(e => {
    console.error(`  [${e.file}:${e.line}] ${e.message}`);
    console.error(`    Found: "${e.match}"\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All files comply with canonical AVS ERP UI Design System tokens and rules!\n');
  process.exit(0);
}
