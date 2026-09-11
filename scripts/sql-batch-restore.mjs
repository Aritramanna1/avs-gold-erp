import fs from 'fs';
import path from 'path';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const TARGET_PROJECT_REF = 'slbvphnxfcypeinclgmw';
const QUERY_API = `https://api.supabase.com/v1/projects/${TARGET_PROJECT_REF}/database/query`;
const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'supabase_backup_dqgrrafuoxaorvyrcuuh_2026-09-11T12-43-09-433Z');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runSql(query, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(QUERY_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (res.status === 429) {
        const waitTime = Math.min(attempt * 3000, 25000);
        process.stdout.write(`[429, wait ${waitTime / 1000}s] `);
        await sleep(waitTime);
        continue;
      }

      if (!res.ok) {
        const msg = data && data.message ? data.message : (typeof data === 'string' ? data : JSON.stringify(data));
        return { error: true, status: res.status, message: msg };
      }

      await sleep(150);
      return { error: false, data };
    } catch (err) {
      if (attempt === retries) return { error: true, message: err.message };
      await sleep(attempt * 1500);
    }
  }
  return { error: true, message: "Exceeded max retries" };
}

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  console.log("==========================================================================");
  console.log("  AVS ERP — RESILIENT SQL BATCH RESTORE (ap-south-1 Mumbai)               ");
  console.log(`  Target: ${TARGET_PROJECT_REF}`);
  console.log("==========================================================================\n");

  const consolidatedPath = path.join(BACKUP_DIR, '02_ALL_TABLES_DATA_CONSOLIDATED.json');
  const allData = JSON.parse(fs.readFileSync(consolidatedPath, 'utf8'));
  const tableNames = Object.keys(allData);

  // Fetch target public tables
  const checkRes = await runSql("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';");
  const existingTables = new Set((checkRes.data || []).map(r => r.table_name));

  console.log(`Found ${tableNames.length} tables in backup. Target has ${existingTables.size} active tables.\n`);

  let totalInserted = 0;
  let skippedTables = 0;
  let errorCount = 0;

  for (let i = 0; i < tableNames.length; i++) {
    const tName = tableNames[i];
    const rows = allData[tName];
    if (!rows || rows.length === 0) continue;

    if (!existingTables.has(tName)) {
      skippedTables++;
      continue;
    }

    process.stdout.write(`  [${(i + 1).toString().padStart(3, ' ')}/${tableNames.length}] Restoring "${tName}" (${rows.length} rows)... `);

    // Get column types / column list from destination table schema
    const colsRes = await runSql(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tName}';`);
    const validColNames = new Set((colsRes.data || []).map(c => c.column_name));

    const chunkSize = 50;
    let tableSuccess = 0;
    let tableErr = null;

    for (let c = 0; c < rows.length; c += chunkSize) {
      const chunk = rows.slice(c, c + chunkSize);
      
      // Filter columns that actually exist in the table schema
      const allRowCols = Object.keys(chunk[0]);
      const activeCols = allRowCols.filter(col => validColNames.has(col));

      if (activeCols.length === 0) continue;

      const colsSql = activeCols.map(col => `"${col}"`).join(', ');

      const valuesSql = chunk.map(row => {
        return `(${activeCols.map(col => escapeSqlVal(row[col])).join(', ')})`;
      }).join(',\n');

      const insertSql = `
        SET session_replication_role = 'replica';
        INSERT INTO public."${tName}" (${colsSql})
        VALUES ${valuesSql}
        ON CONFLICT DO NOTHING;
        SET session_replication_role = 'origin';
      `;

      const res = await runSql(insertSql);
      if (!res.error) {
        tableSuccess += chunk.length;
      } else {
        tableErr = res.message;
      }
    }

    if (tableErr && tableSuccess === 0) {
      console.log(`⚠ ERR: ${tableErr.slice(0, 60)}`);
      errorCount++;
    } else {
      totalInserted += tableSuccess;
      console.log(`${tableSuccess} rows ✓`);
    }
  }

  console.log("\n==========================================================================");
  console.log("  DATA RESTORATION COMPLETED");
  console.log(`  Total Rows Restored: ${totalInserted}`);
  console.log(`  Tables Processed:    ${tableNames.length - skippedTables}`);
  console.log("==========================================================================\n");
}

main().catch(console.error);
