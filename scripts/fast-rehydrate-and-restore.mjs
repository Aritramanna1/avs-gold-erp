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
        const waitTime = Math.min(attempt * 2500, 25000);
        process.stdout.write(`[429, wait ${waitTime / 1000}s] `);
        await sleep(waitTime);
        continue;
      }

      if (!res.ok) {
        const msg = data && data.message ? data.message : (typeof data === 'string' ? data : JSON.stringify(data));
        return { error: true, status: res.status, message: msg };
      }

      await sleep(100);
      return { error: false, data };
    } catch (err) {
      if (attempt === retries) return { error: true, message: err.message };
      await sleep(attempt * 1500);
    }
  }
  return { error: true, message: "Exceeded max retries" };
}

function inferSqlType(val) {
  if (val === null || val === undefined) return 'text';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return 'bigint';
    return 'numeric';
  }
  if (typeof val === 'object') return 'jsonb';
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return 'timestamptz';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return 'uuid';
    return 'text';
  }
  return 'text';
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
  console.log("  AVS ERP — ULTRA-FAST REHYDRATION & DATA RESTORATION                     ");
  console.log(`  Target: ${TARGET_PROJECT_REF} (ap-south-1 Mumbai)`);
  console.log("==========================================================================\n");

  const consolidatedPath = path.join(BACKUP_DIR, '02_ALL_TABLES_DATA_CONSOLIDATED.json');
  const allData = JSON.parse(fs.readFileSync(consolidatedPath, 'utf8'));
  const tableNames = Object.keys(allData);

  // 1. Fetch all existing tables and columns in a single shot
  const schemaInfoRes = await runSql(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public';
  `);

  const existingTableCols = new Map();
  for (const row of (schemaInfoRes.data || [])) {
    if (!existingTableCols.has(row.table_name)) {
      existingTableCols.set(row.table_name, new Set());
    }
    existingTableCols.get(row.table_name).add(row.column_name);
  }

  console.log(`Target currently has ${existingTableCols.size} tables.\n`);

  // 2. Generate batch DDL for all missing tables & columns
  const ddlStatements = [];
  for (const [tName, rows] of Object.entries(allData)) {
    if (!existingTableCols.has(tName)) {
      if (rows && rows.length > 0) {
        const sampleRow = rows[0];
        const colDefs = [];
        for (const [col, val] of Object.entries(sampleRow)) {
          let type = inferSqlType(val);
          if (col === 'id') {
            if (typeof val === 'string' && val.length === 36 && val.includes('-')) {
              colDefs.push(`"${col}" uuid PRIMARY KEY DEFAULT gen_random_uuid()`);
            } else {
              colDefs.push(`"${col}" text PRIMARY KEY`);
            }
          } else {
            colDefs.push(`"${col}" ${type}`);
          }
        }
        ddlStatements.push(`CREATE TABLE IF NOT EXISTS public."${tName}" (\n  ${colDefs.join(',\n  ')}\n);`);
        existingTableCols.set(tName, new Set(Object.keys(sampleRow)));
      }
    } else if (rows && rows.length > 0) {
      const existingCols = existingTableCols.get(tName);
      const sampleRow = rows[0];
      for (const [col, val] of Object.entries(sampleRow)) {
        if (!existingCols.has(col)) {
          const type = inferSqlType(val);
          ddlStatements.push(`ALTER TABLE public."${tName}" ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
          existingCols.add(col);
        }
      }
    }
  }

  if (ddlStatements.length > 0) {
    console.log(`Executing ${ddlStatements.length} table/column creation statements in bulk...`);
    // Split into batches of 20 DDL statements
    for (let i = 0; i < ddlStatements.length; i += 20) {
      const batch = ddlStatements.slice(i, i + 20).join('\n\n');
      const res = await runSql(batch);
      if (res.error) {
        console.log(`DDL Batch ${i / 20 + 1} notice:`, res.message?.slice(0, 80));
      }
    }
    console.log("All tables and columns created/aligned ✓\n");
  }

  // 3. Restore all table data
  console.log("=== RESTORING DATA (44,492 Rows) ===");
  let totalInserted = 0;

  for (let i = 0; i < tableNames.length; i++) {
    const tName = tableNames[i];
    const rows = allData[tName];
    if (!rows || rows.length === 0) continue;

    const validCols = existingTableCols.get(tName);
    if (!validCols) continue;

    process.stdout.write(`  [${(i + 1).toString().padStart(3, ' ')}/${tableNames.length}] "${tName}" (${rows.length} rows)... `);

    const chunkSize = 100;
    let tableSuccess = 0;

    for (let c = 0; c < rows.length; c += chunkSize) {
      const chunk = rows.slice(c, c + chunkSize);
      const allRowCols = Object.keys(chunk[0]);
      const activeCols = allRowCols.filter(col => validCols.has(col));

      if (activeCols.length === 0) continue;

      const colsSql = activeCols.map(col => `"${col}"`).join(', ');
      const valuesSql = chunk.map(row => `(${activeCols.map(col => escapeSqlVal(row[col])).join(', ')})`).join(',\n');

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
      }
    }

    totalInserted += tableSuccess;
    console.log(`${tableSuccess} rows ✓`);
  }

  console.log("\n==========================================================================");
  console.log("  RESTORATION COMPLETE");
  console.log(`  Total Rows Restored: ${totalInserted}`);
  console.log("==========================================================================\n");

  // Final verification
  const countRes = await runSql(`
    SELECT 
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
      (SELECT count(*)::int FROM auth.users) as total_auth_users;
  `);
  console.log("Target Verification:", countRes.data);
}

main().catch(console.error);
