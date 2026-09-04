import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PG_HOST = process.env.PG_HOST || "127.0.0.1";
const PG_PORT = process.env.PG_PORT || "54322";
const PG_USER = process.env.PG_USER || "postgres";
const PG_PASSWORD = process.env.PG_PASSWORD || "postgres";
const PG_DB = process.env.PG_DB || "postgres";

const targetFile = process.argv[2];

console.log("==================================================");
console.log("MTJ / AVS ERP — DATABASE RESTORE UTILITY");
console.log("==================================================");

if (!targetFile || !fs.existsSync(targetFile)) {
  console.error("Usage: node scripts/restore-db.mjs <path-to-sql-backup-file>");
  process.exit(1);
}

console.log(`Target DB: ${PG_HOST}:${PG_PORT}/${PG_DB}`);
console.log(`Source File: ${targetFile}`);

try {
  try {
    execSync(`docker exec -i supabase-db psql -U ${PG_USER} -d ${PG_DB} < "${targetFile}"`, {
      stdio: "pipe",
    });
  } catch {
    execSync(`psql -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${PG_DB} -f "${targetFile}"`, {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      stdio: "pipe",
    });
  }

  console.log("✓ Database restore completed successfully!");
  console.log("==================================================");
} catch (err) {
  console.error("✗ Restore failed:", err.message);
  process.exit(1);
}
