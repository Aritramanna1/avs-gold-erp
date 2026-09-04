import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PG_HOST = process.env.PG_HOST || "127.0.0.1";
const PG_PORT = process.env.PG_PORT || "54322";
const PG_USER = process.env.PG_USER || "postgres";
const PG_PASSWORD = process.env.PG_PASSWORD || "postgres";
const PG_DB = process.env.PG_DB || "postgres";

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(BACKUP_DIR, `mtj_erp_backup_${timestamp}.sql`);

console.log("==================================================");
console.log("MTJ / AVS ERP — DATABASE BACKUP UTILITY");
console.log("==================================================");
console.log(`Target: ${PG_HOST}:${PG_PORT}/${PG_DB}`);
console.log(`Destination: ${backupFile}`);

try {
  // Use docker exec on supabase-db container or local pg_dump
  try {
    execSync(`docker exec supabase-db pg_dump -U ${PG_USER} -d ${PG_DB} --clean --if-exists > "${backupFile}"`, {
      stdio: "pipe",
    });
  } catch {
    execSync(`pg_dump -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${PG_DB} -f "${backupFile}"`, {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      stdio: "pipe",
    });
  }

  const stats = fs.statSync(backupFile);
  console.log(`✓ Backup completed successfully! Size: ${stats.size} bytes`);
  console.log("==================================================");
} catch (err) {
  console.error("✗ Backup failed:", err.message);
  process.exit(1);
}
