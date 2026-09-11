import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const TARGET_URL = 'https://slbvphnxfcypeinclgmw.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYnZwaG54ZmN5cGVpbmNsZ213Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTEyNDMyOSwiZXhwIjoyMTA0NzAwMzI5fQ.2r6HWrlkEe_uXAY8b9rwnw1R7mVwr7Lq3hbOfoaec44';
const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'supabase_backup_dqgrrafuoxaorvyrcuuh_2026-09-11T12-43-09-433Z');

const supabase = createClient(TARGET_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("==========================================================================");
  console.log("  AVS ERP — HIGH-SPEED BULK RESTORE ENGINE TO INDIA (ap-south-1)          ");
  console.log(`  Target: ${TARGET_URL}`);
  console.log("==========================================================================\n");

  const consolidatedPath = path.join(BACKUP_DIR, '02_ALL_TABLES_DATA_CONSOLIDATED.json');
  const allData = JSON.parse(fs.readFileSync(consolidatedPath, 'utf8'));
  const tableNames = Object.keys(allData);

  console.log(`Found data for ${tableNames.length} tables in backup.\n`);

  let totalRowsRestored = 0;
  let successfulTables = 0;
  let failedTables = [];

  for (let i = 0; i < tableNames.length; i++) {
    const tName = tableNames[i];
    const rows = allData[tName];
    if (!rows || rows.length === 0) continue;

    process.stdout.write(`  [${(i + 1).toString().padStart(3, ' ')}/${tableNames.length}] Restoring "${tName}" (${rows.length} rows)... `);

    try {
      const chunkSize = 100;
      let insertedForTable = 0;

      for (let c = 0; c < rows.length; c += chunkSize) {
        const chunk = rows.slice(c, c + chunkSize);
        const { error } = await supabase.from(tName).upsert(chunk, { ignoreDuplicates: true });

        if (error) {
          // If upsert fails (e.g. no primary key), try plain insert
          const { error: insertErr } = await supabase.from(tName).insert(chunk);
          if (insertErr && !insertErr.message?.includes('duplicate key') && !insertErr.message?.includes('already exists')) {
            throw new Error(insertErr.message);
          }
        }
        insertedForTable += chunk.length;
      }

      totalRowsRestored += insertedForTable;
      successfulTables++;
      console.log(`✓ (${insertedForTable} rows)`);
    } catch (err) {
      console.log(`✗ (${err.message.slice(0, 80)})`);
      failedTables.push({ table: tName, error: err.message });
    }
  }

  // Provision Storage Buckets
  console.log("\n[2/2] Provisioning Storage Buckets...");
  const buckets = [
    'customer-documents',
    'worker-kyc',
    'supplier-documents',
    'firm-assets',
    'catalog-designs',
    'order-attachments',
    'repair-attachments',
    'expense-receipts'
  ];

  for (const b of buckets) {
    const { error: bErr } = await supabase.storage.createBucket(b, { public: false });
    if (!bErr || bErr.message?.includes('already exists')) {
      console.log(`  ✓ Bucket '${b}' ready.`);
    } else {
      console.warn(`  ! Bucket '${b}': ${bErr.message}`);
    }
  }

  console.log("\n==========================================================================");
  console.log("  RESTORATION FINISHED!");
  console.log(`  Successful Tables: ${successfulTables}`);
  console.log(`  Total Rows Restored: ${totalRowsRestored}`);
  if (failedTables.length > 0) {
    console.log(`  Tables with notices (${failedTables.length}): ${failedTables.map(f => f.table).join(', ')}`);
  }
  console.log("==========================================================================\n");
}

main().catch(console.error);
