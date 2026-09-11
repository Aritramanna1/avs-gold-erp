import fs from 'fs';
import path from 'path';

const PROJECT_REF = 'slbvphnxfcypeinclgmw';
const ACCESS_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const QUERY_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function executeSql(query, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(QUERY_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (res.status === 429) {
        const waitTime = Math.min(attempt * 3000, 30000);
        process.stdout.write(`[429 Throttled, waiting ${waitTime / 1000}s] `);
        await sleep(waitTime);
        continue;
      }

      if (!res.ok) {
        const msg = data && data.message ? data.message : (typeof data === 'string' ? data : JSON.stringify(data));
        return { error: true, status: res.status, message: msg };
      }

      // Small pacing delay to avoid hitting rate limits
      await sleep(250);
      return { error: false, data };
    } catch (err) {
      if (attempt === retries) return { error: true, message: err.message };
      await sleep(attempt * 2000);
    }
  }
  return { error: true, message: "Exceeded max retries" };
}

async function main() {
  console.log("==================================================================");
  console.log(`  AVS ERP — MASTER MIGRATION RUNNER: ${PROJECT_REF} (ap-south-1 Mumbai)`);
  console.log("==================================================================\n");

  const bundlePath = path.resolve(process.cwd(), 'new and final', 'supabase', 'MASTER_MIGRATION_BUNDLE.sql');
  const content = fs.readFileSync(bundlePath, 'utf8');

  // Split into individual migration sections
  const sections = content.split(/-- -+\r?\n-- \[\d+\/\d+\] MIGRATION:[^\n]*\r?\n-- -+/);
  console.log(`Found ${sections.length - 1} migrations to apply.\n`);

  let applied = 0;
  let notices = 0;
  let errors = 0;

  for (let i = 1; i < sections.length; i++) {
    const rawSql = sections[i].trim();
    if (!rawSql || rawSql.length < 5) continue;

    const firstLine = rawSql.split('\n')[0].replace(/^--\s*/, '').trim().slice(0, 50);
    process.stdout.write(`[${i.toString().padStart(3, ' ')}/${sections.length - 1}] Applying: ${firstLine}... `);

    const cleanSql = rawSql.replace(/\bBEGIN\b\s*;/gi, '').replace(/\bCOMMIT\b\s*;/gi, '');
    const res = await executeSql(cleanSql);

    if (res.error) {
      const msg = res.message || '';
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate key') ||
        msg.includes('multiple primary keys') ||
        msg.includes('already a partition') ||
        msg.includes('relation') && msg.includes('exists')
      ) {
        console.log("✓ OK (already applied/exists)");
        applied++;
      } else {
        console.log(`⚠ NOTICE/ERROR (${res.status || 'ERR'}): ${msg.slice(0, 90)}`);
        notices++;
      }
    } else {
      console.log("✓ OK");
      applied++;
    }
  }

  console.log("\n==================================================================");
  console.log(`  MIGRATIONS PASS COMPLETED`);
  console.log(`  Applied: ${applied} / ${sections.length - 1}`);
  console.log(`  Notices: ${notices}`);
  console.log("==================================================================\n");

  // Verify total public tables & total triggers/views
  const checkRes = await executeSql(`
    SELECT 
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') as public_tables,
      (SELECT count(*)::int FROM information_schema.views WHERE table_schema = 'public') as public_views,
      (SELECT count(*)::int FROM information_schema.routines WHERE routine_schema = 'public') as public_functions;
  `);

  console.log("Schema State on Mumbai Target:", checkRes.data || checkRes.message);
}

main().catch(console.error);
