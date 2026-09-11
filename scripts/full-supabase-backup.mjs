import fs from 'fs';
import path from 'path';
import https from 'https';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const PROJECT_REF = 'dqgrrafuoxaorvyrcuuh';
const BACKUP_DIR = path.resolve(process.cwd(), 'backups', `supabase_backup_${PROJECT_REF}_${new Date().toISOString().replace(/[:.]/g, '-')}`);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function runSql(query) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query });
    const req = https.request(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            resolve({ error: true, status: res.statusCode, message: data });
          } else {
            const parsed = JSON.parse(data);
            resolve({ error: false, data: parsed });
          }
        } catch (e) {
          resolve({ error: true, parseError: e.message, raw: data });
        }
      });
    });
    req.on('error', err => resolve({ error: true, message: err.message }));
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("==========================================================================");
  console.log("  AVS ERP — FULL COMPLETE SUPABASE BACKUP & REPLICATION ENGINE           ");
  console.log(`  Source Project: ${PROJECT_REF} (AVS ERP)`);
  console.log(`  Target Directory: ${BACKUP_DIR}`);
  console.log("==========================================================================\n");

  const manifest = {
    projectRef: PROJECT_REF,
    timestamp: new Date().toISOString(),
    authUsersCount: 0,
    tablesCount: 0,
    totalRowsDumped: 0,
    tables: []
  };

  // 1. DUMP AUTH USERS & IDENTITIES
  console.log("[1/6] Exporting all Auth Users & Identities...");
  const usersRes = await runSql(`
    SELECT 
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      invited_at, confirmation_token, confirmation_sent_at, recovery_token,
      recovery_sent_at, email_change_token_new, email_change, email_change_sent_at,
      last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
      created_at, updated_at, phone, phone_confirmed_at, confirmation_token,
      banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user,
      deleted_at, is_anonymous
    FROM auth.users;
  `);

  if (!usersRes.error && Array.isArray(usersRes.data)) {
    manifest.authUsersCount = usersRes.data.length;
    fs.writeFileSync(path.join(BACKUP_DIR, '00_AUTH_USERS.json'), JSON.stringify(usersRes.data, null, 2));
    console.log(`  ✓ Successfully exported ${usersRes.data.length} Auth Users to 00_AUTH_USERS.json`);
  } else {
    console.warn("  ⚠ Auth users query warning:", usersRes);
  }

  const identitiesRes = await runSql(`SELECT * FROM auth.identities;`);
  if (!identitiesRes.error && Array.isArray(identitiesRes.data)) {
    fs.writeFileSync(path.join(BACKUP_DIR, '00_AUTH_IDENTITIES.json'), JSON.stringify(identitiesRes.data, null, 2));
    console.log(`  ✓ Successfully exported ${identitiesRes.data.length} Auth Identities`);
  }

  // 2. DUMP ENUMS & CUSTOM TYPES
  console.log("\n[2/6] Exporting Custom Types, Enums & Domains...");
  const typesRes = await runSql(`
    SELECT t.typname AS enum_name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname;
  `);
  if (!typesRes.error) {
    fs.writeFileSync(path.join(BACKUP_DIR, '01_ENUM_TYPES.json'), JSON.stringify(typesRes.data, null, 2));
    console.log(`  ✓ Exported ${typesRes.data?.length || 0} Custom Enum definitions`);
  }

  // 3. GET LIST OF ALL PUBLIC TABLES
  console.log("\n[3/6] Fetching all Public Schema Tables...");
  const tablesRes = await runSql(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tablesDir = path.join(BACKUP_DIR, 'tables');
  if (!fs.existsSync(tablesDir)) {
    fs.mkdirSync(tablesDir, { recursive: true });
  }

  if (tablesRes.error || !Array.isArray(tablesRes.data)) {
    console.error("  ✗ Failed to fetch table list:", tablesRes);
    process.exit(1);
  }

  const tableNames = tablesRes.data.map(t => t.table_name);
  manifest.tablesCount = tableNames.length;
  console.log(`  ✓ Found ${tableNames.length} tables in public schema.\n`);

  // 4. DUMP DATA FOR EVERY TABLE
  console.log("[4/6] Exporting data from all tables...");
  const allTableData = {};
  let totalRows = 0;

  for (let i = 0; i < tableNames.length; i++) {
    const tName = tableNames[i];
    process.stdout.write(`  [${(i + 1).toString().padStart(3, ' ')}/${tableNames.length}] Exporting "${tName}"... `);
    
    // Count rows first
    const countRes = await runSql(`SELECT count(*) FROM public."${tName}";`);
    const count = countRes.error ? 0 : parseInt(countRes.data[0].count, 10);

    let rows = [];
    if (count > 0) {
      // Dump rows
      const dataRes = await runSql(`SELECT * FROM public."${tName}";`);
      if (!dataRes.error && Array.isArray(dataRes.data)) {
        rows = dataRes.data;
      }
    }

    totalRows += rows.length;
    allTableData[tName] = rows;
    manifest.tables.push({ table: tName, rows: rows.length });

    fs.writeFileSync(path.join(tablesDir, `${tName}.json`), JSON.stringify(rows, null, 2));
    console.log(`${rows.length} rows`);
  }

  manifest.totalRowsDumped = totalRows;
  fs.writeFileSync(path.join(BACKUP_DIR, '02_ALL_TABLES_DATA_CONSOLIDATED.json'), JSON.stringify(allTableData, null, 2));
  console.log(`\n  ✓ Successfully exported ${totalRows} total rows across all ${tableNames.length} tables!`);

  // 5. DUMP STORAGE BUCKETS
  console.log("\n[5/6] Exporting Storage Buckets & Metadata...");
  const bucketsRes = await runSql(`SELECT * FROM storage.buckets;`);
  if (!bucketsRes.error && Array.isArray(bucketsRes.data)) {
    fs.writeFileSync(path.join(BACKUP_DIR, '03_STORAGE_BUCKETS.json'), JSON.stringify(bucketsRes.data, null, 2));
    console.log(`  ✓ Exported ${bucketsRes.data.length} Storage Buckets`);
  }

  const objectsRes = await runSql(`SELECT id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata FROM storage.objects;`);
  if (!objectsRes.error && Array.isArray(objectsRes.data)) {
    fs.writeFileSync(path.join(BACKUP_DIR, '03_STORAGE_OBJECTS_METADATA.json'), JSON.stringify(objectsRes.data, null, 2));
    console.log(`  ✓ Exported ${objectsRes.data.length} Storage Object references`);
  }

  // 6. DUMP FUNCTIONS & TRIGGERS
  console.log("\n[6/6] Exporting Stored Procedures, Functions & Triggers...");
  const funcRes = await runSql(`
    SELECT routine_name, routine_definition, routine_type, data_type
    FROM information_schema.routines
    WHERE routine_schema = 'public';
  `);
  if (!funcRes.error && Array.isArray(funcRes.data)) {
    fs.writeFileSync(path.join(BACKUP_DIR, '04_STORED_FUNCTIONS.json'), JSON.stringify(funcRes.data, null, 2));
    console.log(`  ✓ Exported ${funcRes.data.length} Stored Functions/RPCs`);
  }

  // WRITE MANIFEST
  fs.writeFileSync(path.join(BACKUP_DIR, 'BACKUP_MANIFEST.json'), JSON.stringify(manifest, null, 2));

  console.log("\n==========================================================================");
  console.log("  FULL BACKUP COMPLETED SUCCESSFULLY!");
  console.log(`  Location:           ${BACKUP_DIR}`);
  console.log(`  Auth Users:         ${manifest.authUsersCount}`);
  console.log(`  Public Tables:      ${manifest.tablesCount}`);
  console.log(`  Total Rows Dumped:  ${manifest.totalRowsDumped}`);
  console.log("==========================================================================\n");
}

main().catch(err => {
  console.error("FATAL BACKUP ERROR:", err);
  process.exit(1);
});
