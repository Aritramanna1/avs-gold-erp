/**
 * Validates Supabase migration files without destructive DB operations.
 * Legacy naming/duplicate issues are reported as warnings (pre-existing debt).
 */
import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
if (!fs.existsSync(migrationsDir)) {
  console.error("supabase/migrations directory not found");
  process.exit(1);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No migration files found");
  process.exit(1);
}

const versionPattern = /^(\d{14})_/;
const versions = new Map();
const errors = [];
const warnings = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");

  if (content.includes("DROP DATABASE") || content.includes("DROP SCHEMA public")) {
    errors.push(`${file}: destructive DROP DATABASE/SCHEMA not allowed`);
  }
  if (/service_role_key\s*=\s*['"][^'"]+['"]/i.test(content)) {
    errors.push(`${file}: possible hardcoded service role key`);
  }

  const match = file.match(versionPattern);
  if (!match) {
    warnings.push(`${file}: non-canonical filename (legacy — should be YYYYMMDDHHMMSS_)`);
    continue;
  }

  const version = match[1];
  if (versions.has(version)) {
    warnings.push(`Duplicate version ${version}: ${versions.get(version)} and ${file}`);
  } else {
    versions.set(version, file);
  }
}

if (warnings.length) {
  console.warn("Migration warnings (non-blocking):");
  for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length) {
  console.error("Migration validation failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const sortedVersions = [...versions.keys()].sort();
console.log(
  `Migration validation passed: ${files.length} files` +
    (sortedVersions.length
      ? `, canonical versions ${sortedVersions[0]} → ${sortedVersions[sortedVersions.length - 1]}`
      : ""),
);
