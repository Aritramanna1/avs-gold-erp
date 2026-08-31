/**
 * Static audit: report print roots must not include loading spinners or filter controls.
 * Run: node scripts/audit-report-print-sources.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const routesDir = join(ROOT, "src/routes");

const FORBIDDEN_IN_PRINT_SOURCE = [
  /animate-spin/,
  /Loading delivered settlements/,
  /<select[\s\S]*?Party/,
  /Select party/,
];

const files = readdirSync(routesDir).filter(
  (f) => f.startsWith("reports.") && f.endsWith(".tsx"),
);

let failed = 0;

for (const file of files) {
  const src = readFileSync(join(routesDir, file), "utf8");
  if (!src.includes('data-testid="report-print-source"')) continue;

  const match = src.match(
    /data-testid="report-print-source"[^>]*>([\s\S]*?)(<\/div>\s*){1,3}(?=\s*<\/(?:div|ReportShell)>|\s*\)\s*;)/,
  );
  if (!match) continue;
  const block = match[1];

  for (const pattern of FORBIDDEN_IN_PRINT_SOURCE) {
    if (pattern.test(block)) {
      console.error(`FAIL ${file}: print source contains forbidden pattern ${pattern}`);
      failed++;
      break;
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} report print-source violation(s).`);
  process.exit(1);
}

console.log(`OK — ${files.length} report routes scanned, print-source hygiene passed.`);
