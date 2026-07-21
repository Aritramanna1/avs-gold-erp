import initSqlJs from "sql.js/dist/sql-wasm.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { Database, SqlJsStatic, SqlValue } from "sql.js";

const SQLITE_DB_KEY = "mtj_erp_local_db";
const SQLITE_DB_VERSION = 4;
const ATTACHMENT_KEY_STORE = "mtj_erp_crypto_key";
const DESKTOP_DATA_KEY = "local-data-key" as const;
const DESKTOP_SIGNING_KEY = "local-signing-key" as const;

type DesktopKeyName = typeof DESKTOP_DATA_KEY | typeof DESKTOP_SIGNING_KEY;
interface DesktopKeyStore {
  get: (key: DesktopKeyName) => Promise<string | null>;
  set: (key: DesktopKeyName, value: string) => Promise<void>;
}

function getDesktopKeyStore(): DesktopKeyStore | null {
  return (
    (window as unknown as { mtjDesktop?: { secureStore?: DesktopKeyStore } }).mtjDesktop
      ?.secureStore ?? null
  );
}

function toBase64Bytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64Bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deleteLegacyIndexedKey(idb: IDBDatabase, key: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = idb.transaction("crypto", "readwrite").objectStore("crypto").delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
const DB_CHECKSUM_META_KEY = "db_checksum_sha256";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbReady: Promise<void> | null = null;

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value as SqlValue;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" && (key === "data" || key === "parsed")) {
      try {
        normalized[key] = JSON.parse(value);
        continue;
      } catch {
        // keep raw string if JSON parse fails
      }
    }
    normalized[key] = value;
  }
  return normalized;
}

// A fresh window.indexedDB.open() per call (the previous approach) leaked one
// live IDBDatabase connection per call site — persistDatabase() alone runs on
// every runLocal() transaction commit, so a normal session accumulated an
// unbounded number of never-closed connections. That both degrades the app
// over a long session and means indexedDB.deleteDatabase() (factory reset)
// can never complete, since deletion blocks until every open connection to
// the database closes. Caching a single shared connection — closed only by
// clearLocalDatabase() — matches the singleton pattern already used for the
// sql.js `db`/`dbReady` state above.
let idbConnection: Promise<IDBDatabase> | null = null;

function openIndexedDb(): Promise<IDBDatabase> {
  if (idbConnection) return idbConnection;
  idbConnection = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(SQLITE_DB_KEY, SQLITE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sqlite")) {
        db.createObjectStore("sqlite");
      }
      if (!db.objectStoreNames.contains("crypto")) {
        db.createObjectStore("crypto");
      }
    };
    request.onerror = () => {
      idbConnection = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      const idb = request.result;
      idb.onclose = () => {
        idbConnection = null;
      };
      resolve(idb);
    };
  });
  return idbConnection;
}

const DEVICE_ID_KEY = "mtj_erp_device_id";

/**
 * Gets this machine's persistent device id from IndexedDB, or stores
 * `generatedId` as the new one if none exists yet (first launch on this
 * machine). Lives in the same `crypto` store as the encryption/signing keys
 * since it's the same "one persistent value per install" pattern, not
 * because it's itself a cryptographic key.
 */
export function openIndexedDbForDeviceId(generatedId: string): Promise<string> {
  return openIndexedDb().then(
    (idb) =>
      new Promise<string>((resolve, reject) => {
        const tx = idb.transaction("crypto", "readwrite");
        const store = tx.objectStore("crypto");
        const getReq = store.get(DEVICE_ID_KEY);
        getReq.onerror = () => reject(getReq.error);
        getReq.onsuccess = () => {
          if (typeof getReq.result === "string") {
            resolve(getReq.result);
            return;
          }
          const putReq = store.put(generatedId, DEVICE_ID_KEY);
          putReq.onerror = () => reject(putReq.error);
          putReq.onsuccess = () => resolve(generatedId);
        };
      }),
  );
}

interface StoredDbRecord {
  encryptedBlob: Uint8Array;
  iv: Uint8Array;
  checksum: string; // SHA-256 hex of the DECRYPTED plaintext SQLite bytes
  schemaVersion: number;
  savedAt: string;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getRawDbRecord(): Promise<StoredDbRecord | null> {
  const idb = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction("sqlite", "readonly");
    const store = tx.objectStore("sqlite");
    const request = store.get("db");
    request.onsuccess = () => resolve((request.result as StoredDbRecord) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function putRawDbRecord(record: StoredDbRecord): Promise<void> {
  const idb = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction("sqlite", "readwrite");
    const store = tx.objectStore("sqlite");
    const request = store.put(record, "db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads the persisted database, decrypting it and verifying its checksum.
 * Returns null if nothing has been persisted yet. Throws IntegrityError if a
 * persisted record exists but fails checksum verification (corruption) —
 * callers must not silently fall back to a fresh empty DB on that path, per
 * the "no silent data loss" requirement.
 */
export class LocalDbIntegrityError extends Error {}

async function getPersistedDatabase(): Promise<Uint8Array | null> {
  const record = await getRawDbRecord();
  if (!record) return null;
  const key = await getOrCreateMasterKey();
  const plaintext = await decryptData(key, record.encryptedBlob, record.iv);
  const actualChecksum = await sha256Hex(plaintext);
  if (actualChecksum !== record.checksum) {
    throw new LocalDbIntegrityError(
      `Local database checksum mismatch (expected ${record.checksum}, got ${actualChecksum}) — ` +
        `the persisted database appears corrupted. Refusing to load it silently.`,
    );
  }
  return plaintext;
}

async function persistDatabase(bytes: Uint8Array, schemaVersion: number): Promise<void> {
  const key = await getOrCreateMasterKey();
  const checksum = await sha256Hex(bytes);
  const { blob, iv } = await encryptData(key, bytes);
  await putRawDbRecord({
    encryptedBlob: blob,
    iv,
    checksum,
    schemaVersion,
    savedAt: new Date().toISOString(),
  });
}

async function initSqlJsEngine(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  // Resolving locateFile relative to this module's own import.meta.url (the
  // previous approach) pointed at a path under src/lib/ that doesn't exist as
  // a static asset, so Vite's dev server served the SPA fallback index.html
  // instead of the actual wasm binary — sql.js then failed to instantiate
  // ("expected magic word ... found <!do", i.e. HTML). The `?url` import
  // resolves to the wasm file's real emitted/served location in both dev and
  // production builds.
  SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });
  return SQL;
}

function createSql(schemaSql: string): void {
  if (!db) throw new Error("SQLite DB not initialized");
  db.run(schemaSql);
}

function createTables(): void {
  if (!db) throw new Error("SQLite DB not initialized");
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA synchronous = FULL;");

  db.run(`CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    name TEXT,
    code TEXT,
    address TEXT,
    phone TEXT,
    manager_name TEXT,
    gstin TEXT,
    active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    notes TEXT,
    data TEXT,
    updated_at TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS workshops (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    branch_id TEXT,
    active INTEGER DEFAULT 1,
    description TEXT,
    data TEXT,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    scope TEXT,
    data TEXT,
    updated_at TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS branch_settings (
    branch_id TEXT PRIMARY KEY,
    address TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    invoice_series TEXT,
    receipt_series TEXT,
    barcode_series TEXT,
    smtp_host TEXT,
    smtp_port TEXT,
    smtp_user TEXT,
    smtp_password TEXT,
    smtp_from_name TEXT,
    smtp_from_email TEXT,
    wa_phone_number TEXT,
    thermal_printer_ip TEXT,
    thermal_printer_port TEXT,
    default_karat INTEGER,
    gold_rate_source TEXT,
    invoice_template_id TEXT,
    receipt_template_id TEXT,
    logo_url TEXT,
    logo_storage_path TEXT,
    wa_config TEXT,
    wa_automations TEXT,
    updated_at TEXT,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    type TEXT,
    active INTEGER DEFAULT 1,
    full_name TEXT,
    phone TEXT,
    village_city TEXT,
    current_address TEXT,
    permanent_address TEXT,
    gstin TEXT,
    pan TEXT,
    aadhaar_masked TEXT,
    work_type TEXT,
    notes TEXT,
    branch_id TEXT,
    data TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS gold_ledger (
    id TEXT PRIMARY KEY,
    ts TEXT,
    movement TEXT,
    net_fine_mg INTEGER,
    bucket_deltas TEXT,
    reference TEXT,
    note TEXT,
    gross_mg INTEGER,
    purity INTEGER,
    fine_mg INTEGER,
    form TEXT,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT,
    type TEXT,
    status TEXT,
    customer_id TEXT,
    karigar_id TEXT,
    expected_delivery TEXT,
    priority TEXT,
    source TEXT,
    whatsapp_source_id TEXT,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(customer_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(karigar_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS job_cards (
    id TEXT PRIMARY KEY,
    job_no TEXT,
    order_id TEXT,
    karigar_id TEXT,
    status TEXT,
    template_key TEXT,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY(karigar_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    item_code TEXT,
    barcode TEXT,
    huid TEXT,
    item_name TEXT,
    category TEXT,
    purity INTEGER,
    gross_mg INTEGER,
    net_mg INTEGER,
    status TEXT,
    location TEXT,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    ts TEXT,
    kind TEXT,
    from_location TEXT,
    to_location TEXT,
    note TEXT,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_no TEXT,
    customer_id TEXT,
    order_id TEXT,
    status TEXT,
    gst TEXT,
    subtotal_paise INTEGER,
    cgst_paise INTEGER,
    sgst_paise INTEGER,
    gst_paise INTEGER,
    adjustment_paise INTEGER,
    grand_total_paise INTEGER,
    paid_paise INTEGER,
    balance_paise INTEGER,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(customer_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT,
    ts TEXT,
    mode TEXT,
    amount_paise INTEGER,
    reference TEXT,
    notes TEXT,
    gold_gross_mg INTEGER,
    gold_purity INTEGER,
    gold_fine_mg INTEGER,
    gold_rate_per_gram_paise INTEGER,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    worker_id TEXT,
    date TEXT,
    status TEXT,
    hours INTEGER,
    data TEXT,
    FOREIGN KEY(worker_id) REFERENCES people(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS salary_rules (
    id TEXT PRIMARY KEY,
    name TEXT,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS worker_transactions (
    id TEXT PRIMARY KEY,
    worker_id TEXT,
    kind TEXT,
    ts TEXT,
    amount_paise INTEGER,
    gold_mg INTEGER,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(worker_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS worker_settlements (
    id TEXT PRIMARY KEY,
    worker_id TEXT,
    period_from TEXT,
    period_to TEXT,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(worker_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS catalog_designs (
    id TEXT PRIMARY KEY,
    design_no TEXT,
    name TEXT,
    category TEXT,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS rate_cut_records (
    id TEXT PRIMARY KEY,
    rate_cut_no TEXT,
    karigar_id TEXT,
    job_id TEXT,
    overloss_fine_mg INTEGER,
    gold_rate_per_gram_paise INTEGER,
    penalty_paise INTEGER,
    settlement_mode TEXT,
    data TEXT,
    FOREIGN KEY(karigar_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(job_id) REFERENCES job_cards(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS repairs (
    id TEXT PRIMARY KEY,
    repair_no TEXT,
    customer_id TEXT,
    kind TEXT,
    status TEXT,
    received_gross_mg INTEGER,
    estimated_charge_paise INTEGER,
    advance_paise INTEGER,
    branch_id TEXT,
    data TEXT,
    FOREIGN KEY(customer_id) REFERENCES people(id) ON DELETE SET NULL,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS daily_close (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS print_logs (
    id TEXT PRIMARY KEY,
    doc_type TEXT,
    doc_number TEXT,
    linked_id TEXT,
    linked_label TEXT,
    printed_by TEXT,
    first_printed_at TEXT,
    last_printed_at TEXT,
    reprint_count INTEGER,
    history TEXT,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS whatsapp_inbox (
    id TEXT PRIMARY KEY,
    sender_name TEXT,
    sender_phone TEXT,
    raw_text TEXT,
    status TEXT,
    parsed TEXT,
    converted_order_id TEXT,
    linked_person_id TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS communication_logs (
    id TEXT PRIMARY KEY,
    channel TEXT,
    direction TEXT,
    status TEXT,
    phone TEXT,
    body TEXT,
    linked_id TEXT,
    linked_table TEXT,
    data TEXT,
    created_at TEXT,
    updated_at TEXT
  );`);

  // Generic Approval Workflow Engine (Priority 5) — one row per request,
  // full domain object in `data` like the other generic tables here;
  // `entity_type`/`status` are pulled out as real columns purely so
  // getPendingApprovals()/getApprovalHistory() can filter without a full
  // table scan-and-parse.
  db.run(`CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    entity_type TEXT,
    entity_id TEXT,
    status TEXT,
    data TEXT,
    updated_at TEXT
  );`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(entity_type, status);`,
  );

  // Stone / Diamond Tracking (Priority 5) — one row per stone entry,
  // linked to a stock item by stock_item_id (a StockItem can have several).
  db.run(`CREATE TABLE IF NOT EXISTS stone_details (
    id TEXT PRIMARY KEY,
    stock_item_id TEXT,
    data TEXT,
    updated_at TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stone_details_item ON stone_details(stock_item_id);`);

  // Lot / Batch Management (Priority 5).
  db.run(`CREATE TABLE IF NOT EXISTS lot_batches (
    id TEXT PRIMARY KEY,
    data TEXT,
    updated_at TEXT
  );`);

  // Saved Filters / Custom Views (Priority 5).
  db.run(`CREATE TABLE IF NOT EXISTS saved_filters (
    id TEXT PRIMARY KEY,
    data TEXT,
    updated_at TEXT
  );`);

  // Billing & Printing audit: Credit/Debit Notes, Estimates, Delivery Challans.
  db.run(
    `CREATE TABLE IF NOT EXISTS credit_notes (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS debit_notes (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(`CREATE TABLE IF NOT EXISTS estimates (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`);
  db.run(
    `CREATE TABLE IF NOT EXISTS delivery_challans (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS order_issues (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS worker_returns (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS material_vault_movements (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS outside_work_transactions (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS polishing_transactions (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS manufacturing_barcodes (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS outside_work_labour_charges (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS outside_work_payments (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS customer_settlements (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);`,
  );

  // Local Authentication (Deployment Modes — Offline Mode): credentials for
  // logging in with zero network dependency, entirely separate from Supabase
  // auth.users. Only populated when deployment mode is "offline"/"hybrid" —
  // see src/lib/local-auth.ts and src/lib/deployment-mode.ts.
  db.run(`CREATE TABLE IF NOT EXISTS local_users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    role TEXT,
    branch_id TEXT,
    password_hash TEXT,
    password_salt TEXT,
    last_password_change TEXT,
    failed_login_count INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    is_super_owner INTEGER DEFAULT 0,
    recovery_question_1 TEXT,
    recovery_answer_hash_1 TEXT,
    recovery_question_2 TEXT,
    recovery_answer_hash_2 TEXT,
    recovery_key_hash TEXT,
    created_at TEXT,
    updated_at TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_local_users_email ON local_users(email);`);

  // Auth sessions (SAD §5): one row per login, holding the exact fields the
  // spec requires a session to carry. Ends on logout (ended_at set) — kept,
  // not deleted, so the audit trail of who was signed in when survives.
  db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT,
    branch_id TEXT,
    login_at TEXT,
    ended_at TEXT,
    device_id TEXT,
    deployment_mode TEXT,
    FOREIGN KEY(user_id) REFERENCES local_users(id) ON DELETE CASCADE
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);`);

  db.run(`CREATE TABLE IF NOT EXISTS module_states (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    module_key TEXT,
    enabled INTEGER,
    updated_at TEXT,
    data TEXT,
    FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE SET NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS dropdown_masters (
    id TEXT PRIMARY KEY,
    master_key TEXT,
    value TEXT,
    active INTEGER,
    sort_order INTEGER,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS manufacturing_bills (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS melt_jobs (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS gold_settlements (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS crm_leads_opportunities (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS crm_tasks_meetings (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS crm_interactions (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    file_name TEXT,
    kind TEXT,
    linked_id TEXT,
    linked_table TEXT,
    storage_path TEXT,
    bucket TEXT,
    size_bytes INTEGER,
    mime_type TEXT,
    data TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS attachment_files (
    attachment_id TEXT PRIMARY KEY,
    encrypted_blob BLOB,
    iv BLOB,
    mime_type TEXT,
    size_bytes INTEGER,
    FOREIGN KEY(attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
  );`);

  // Plan 1 Step 6 — Local File Storage (content-addressed, superset of
  // attachment_files above which stays untouched for backward compat).
  // Blobs are keyed by SHA-256 checksum so identical file content uploaded
  // for two different attachments (e.g. the same hallmark cert PDF attached
  // to two invoices) is stored physically once, referenced twice.
  db.run(`CREATE TABLE IF NOT EXISTS file_blobs (
    checksum TEXT PRIMARY KEY,
    encrypted_blob BLOB NOT NULL,
    iv BLOB NOT NULL,
    size_bytes INTEGER NOT NULL,
    mime_type TEXT,
    ref_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_verified_at TEXT,
    corrupted INTEGER NOT NULL DEFAULT 0
  );`);

  // Automatic, rotated database backups (Database Hardening Priority 4).
  // Each row is a full encrypted BackupSnapshot (see createBackupSnapshot).
  // Separate from the ad hoc disaster-recovery drill (which verifies but
  // discards) — these rows are the actual retained backups a restore reads
  // from. `valid=1` only once verifyBackupRestorable() has passed on it.
  db.run(`CREATE TABLE IF NOT EXISTS auto_backups (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    valid INTEGER NOT NULL DEFAULT 0,
    encrypted_blob BLOB NOT NULL,
    iv BLOB NOT NULL
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_auto_backups_created ON auto_backups(created_at);`);

  // One row per (attachment, version). `is_current=1` marks the active
  // version; older versions are retained for history, never deleted by a
  // new upload — only by an explicit prune, which isn't implemented yet.
  db.run(`CREATE TABLE IF NOT EXISTS file_versions (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    file_name TEXT,
    version INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    created_by TEXT,
    cloud_backed_up INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(checksum) REFERENCES file_blobs(checksum)
  );`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_file_versions_attachment ON file_versions(attachment_id);`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_file_versions_current ON file_versions(attachment_id, is_current);`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_file_versions_entity ON file_versions(entity_type, entity_id);`,
  );

  // Immutable, hash-chained audit log (Plan 1 Step 8). Append-only: no
  // UPDATE/DELETE statement anywhere in this codebase targets this table.
  // `prev_hash` links each row to the one before it and `hash` covers every
  // other column plus `prev_hash` — altering or deleting a historical row
  // (including via direct SQLite file tampering, not just through the app)
  // breaks the chain from that point forward, which verifyAuditChain() in
  // src/lib/security/audit-log.ts detects deterministically.
  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    ts TEXT NOT NULL,
    actor_id TEXT,
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_json TEXT,
    after_json TEXT,
    device_id TEXT,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    signature TEXT NOT NULL
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts);`);

  // Device Registration (Plan 1 Step 8): every install of the desktop app
  // gets a persistent device id (generated once, stored in IndexedDB — see
  // device-registry.ts) recorded here on first audited action from that
  // device, so historical audit entries can always be traced back to which
  // physical machine produced them.
  db.run(`CREATE TABLE IF NOT EXISTS device_registry (
    device_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    platform TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    trusted INTEGER NOT NULL DEFAULT 1
  );`);

  // Escalation Ladder (Step 9): tracks how long an unresolved business
  // condition (outstanding balance, pending gold settlement, etc.) has been
  // open, so the daily reminder sweeps know which escalation tier is next
  // due (Day 1/3/7/15 -> responsible staff -> manager -> owner) instead of
  // re-sending the same first-tier reminder forever.
  db.run(`CREATE TABLE IF NOT EXISTS escalation_state (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    first_flagged_at TEXT NOT NULL,
    last_tier_index INTEGER NOT NULL DEFAULT -1,
    last_sent_at TEXT,
    PRIMARY KEY (entity_type, entity_id)
  );`);

  // Print Job Queue (Priority 5): every print attempt is durably recorded
  // here — never just fired and forgotten. `status` moves pending ->
  // printed | pdf_fallback | failed. A job that fails printing to a
  // physical device automatically becomes `pdf_fallback` (a real PDF was
  // generated and saved/downloaded instead) rather than `failed` — printing
  // truly fails only when even PDF generation itself throws, which should
  // essentially never happen since it's pure client-side rendering.
  db.run(`CREATE TABLE IF NOT EXISTS print_jobs (
    id TEXT PRIMARY KEY,
    doc_type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    pdf_file_name TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);`);

  // Unified Print Engine (Phase 0): one row per template, generic
  // id/data/updated_at shape — same pattern as print_logs and the other
  // 15+ JSON-blob tables in this file, so it works with createRepository()
  // unchanged. `data` holds the full PrintTemplate (see
  // src/lib/print-engine/types.ts), including its own version history.
  db.run(`CREATE TABLE IF NOT EXISTS print_templates (
    id TEXT PRIMARY KEY,
    data TEXT,
    updated_at TEXT
  );`);

  // Gold Reconciliation Engine (Priority 6): one row per reconciliation run,
  // storing the full report (including every exception found) so past runs
  // remain reviewable even after the underlying bills change — the report
  // itself is a permanent record, in addition to each exception separately
  // getting its own audit_log entry (see gold-reconciliation.ts).
  db.run(`CREATE TABLE IF NOT EXISTS gold_reconciliation_reports (
    id TEXT PRIMARY KEY,
    generated_at TEXT NOT NULL,
    branch_id TEXT,
    total_checked INTEGER NOT NULL,
    exception_count INTEGER NOT NULL,
    report_json TEXT NOT NULL
  );`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_gold_recon_generated ON gold_reconciliation_reports(generated_at);`,
  );

  // Background Scheduler (Plan 1 Step 9): one row per registered recurring
  // job (daily/weekly/monthly report, reminder sweep, etc.), tracking when it
  // last ran so the scheduler survives app restart — a job due while the app
  // was closed runs on the next check rather than being skipped.
  db.run(`CREATE TABLE IF NOT EXISTS scheduled_jobs (
    job_key TEXT PRIMARY KEY,
    last_run_at TEXT,
    last_status TEXT,
    last_error TEXT
  );`);

  // Communication Queue: every send() attempt that fails after exhausting
  // its provider fallback chain lands here instead of being dropped —
  // retried with backoff, surviving app restart, until it succeeds or
  // permanently exhausts MAX_ATTEMPTS (see comm-queue.ts). Never the queue
  // of record for a *successful* send — those are logged directly to
  // communication_logs; this table exists only for retryable failures.
  db.run(`CREATE TABLE IF NOT EXISTS comm_queue (
    id TEXT PRIMARY KEY,
    request TEXT NOT NULL,
    log_event_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_attempt_at TEXT,
    next_attempt_at TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_comm_queue_status ON comm_queue(status);`);

  db.run(`CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    last_attempt_at TEXT,
    created_at TEXT NOT NULL,
    base_updated_at TEXT,
    next_attempt_at TEXT
  );`);

  // Conflict Detection & Resolution (Plan 1 Step 4): a row a push discovers
  // has been changed remotely since our last known sync of it — never
  // silently overwritten, always recorded here for review/resolution.
  db.run(`CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    local_payload TEXT,
    remote_payload TEXT,
    detected_at TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    resolution TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved);`);

  // Per-table sync bookkeeping: last successful pull/push time (delta sync
  // basis) and the row's last-known-synced version, used to distinguish "we
  // pushed this" from "someone else changed it remotely" on the next push.
  db.run(`CREATE TABLE IF NOT EXISTS sync_meta (
    table_name TEXT PRIMARY KEY,
    last_pulled_at TEXT,
    last_pushed_at TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS row_sync_state (
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    last_synced_updated_at TEXT,
    PRIMARY KEY (table_name, row_id)
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS financial_lock_periods (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    period TEXT,
    data TEXT
  );`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_financial_lock_periods_branch_period ON financial_lock_periods(branch_id, period);`,
  );

  db.run(`CREATE TABLE IF NOT EXISTS physical_stock_counts (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    status TEXT,
    data TEXT
  );`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_physical_stock_counts_branch_id ON physical_stock_counts(branch_id);`,
  );

  db.run(`CREATE TABLE IF NOT EXISTS stock_lots (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    lot_number TEXT,
    status TEXT,
    data TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stock_lots_branch_id ON stock_lots(branch_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stock_lots_lot_number ON stock_lots(lot_number);`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_stones (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    item_id TEXT,
    stone_type TEXT,
    certificate_number TEXT,
    data TEXT
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stock_stones_branch_id ON stock_stones(branch_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stock_stones_item_id ON stock_stones(item_id);`);

  db.run(`CREATE TABLE IF NOT EXISTS hallmark_batches (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    batch_number TEXT,
    status TEXT,
    data TEXT
  );`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_hallmark_batches_branch_id ON hallmark_batches(branch_id);`,
  );
  db.run(`CREATE INDEX IF NOT EXISTS idx_hallmark_batches_status ON hallmark_batches(status);`);

  // Soft-delete marker: a row stays physically in its table (so FK
  // references and history remain intact, and the row is still available if
  // a delete needs to be undone before it syncs) until the sync engine
  // confirms the delete against Supabase and hard-purges it. Deliberately a
  // side table rather than a `_deleted` column on every table — avoids an
  // invasive ALTER TABLE migration across all 28 tables for Step 3.
  db.run(`CREATE TABLE IF NOT EXISTS deleted_rows (
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (table_name, row_id)
  );`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deleted_rows_table ON deleted_rows(table_name);`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_outbox_table_row ON outbox(table_name, row_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_branches_is_default ON branches(is_default);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_workshops_branch_id ON workshops(branch_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_branch_id ON invoices(branch_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_people_type ON people(type);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_people_phone ON people(phone);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_people_full_name ON people(full_name);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_people_branch_id ON people(branch_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_job_cards_order_id ON job_cards(order_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_job_cards_karigar_id ON job_cards(karigar_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_job_cards_status ON job_cards(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_worker_transactions_worker_id ON worker_transactions(worker_id);`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_worker_settlements_worker_id ON worker_settlements(worker_id);`,
  );
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON attendance(worker_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_repairs_customer_id ON repairs(customer_id);`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_rate_cut_records_karigar_id ON rate_cut_records(karigar_id);`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_attachments_linked ON attachments(linked_table, linked_id);`,
  );
}

/**
 * Versioned migration steps, applied in order from the database's current
 * stored schema_version up to SQLITE_DB_VERSION. Each entry's `up` runs
 * inside the same transaction as the version bump — either the whole step
 * commits or none of it does. createTables() itself is idempotent (CREATE
 * TABLE/INDEX IF NOT EXISTS) and always runs first, so migrations here are
 * for changes CREATE-IF-NOT-EXISTS can't express (column additions, data
 * backfills, etc.) — empty for schema v1 since this is the initial schema.
 */
/** ALTER TABLE ADD COLUMN is not idempotent — skip when the column already exists. */
function addColumnIfMissing(
  database: Database,
  table: string,
  column: string,
  definition: string,
): void {
  const stmt = database.prepare(`PRAGMA table_info(${table});`);
  const existing: string[] = [];
  while (stmt.step()) existing.push(String(stmt.getAsObject().name));
  stmt.free();
  if (existing.includes(column)) return;
  database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

const MIGRATIONS: { version: number; up: (database: Database) => void }[] = [
  // v2 — Auth module conformance (SAD §4/§5): branch assignment, password-age
  // and failed-login tracking on local_users. New databases already get these
  // from createTables(); this back-fills databases created at schema v1.
  {
    version: 2,
    up: (database) => {
      addColumnIfMissing(database, "local_users", "branch_id", "TEXT");
      addColumnIfMissing(database, "local_users", "last_password_change", "TEXT");
      addColumnIfMissing(database, "local_users", "failed_login_count", "INTEGER DEFAULT 0");
    },
  },
  // v3 records the complete current table/index baseline. Existing v1/v2
  // databases run idempotent createTables() once during upgrade; subsequent
  // launches can skip hundreds of CREATE IF NOT EXISTS statements entirely.
  { version: 3, up: () => {} },
  {
    version: 4,
    up: (database) => {
      addColumnIfMissing(database, "local_users", "recovery_question_1", "TEXT");
      addColumnIfMissing(database, "local_users", "recovery_answer_hash_1", "TEXT");
      addColumnIfMissing(database, "local_users", "recovery_question_2", "TEXT");
      addColumnIfMissing(database, "local_users", "recovery_answer_hash_2", "TEXT");
      addColumnIfMissing(database, "local_users", "recovery_key_hash", "TEXT");
    },
  },
];

function getSchemaVersion(database: Database): number {
  const stmt = database.prepare("SELECT value FROM meta WHERE key = 'schema_version';");
  const version = stmt.step() ? Number(stmt.getAsObject().value) : 0;
  stmt.free();
  return version;
}

function setSchemaVersion(database: Database, version: number): void {
  database.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?);", [
    String(version),
  ]);
}

/** Generic key/value read from the `meta` table (same table schema_version lives in). */
export function getMetaValue(key: string): string | null {
  const database = getDb();
  const stmt = database.prepare("SELECT value FROM meta WHERE key = ?;");
  stmt.bind([key]);
  const value = stmt.step() ? String(stmt.getAsObject().value) : null;
  stmt.free();
  return value;
}

/** Generic key/value write to the `meta` table. */
export function setMetaValue(key: string, value: string): void {
  const database = getDb();
  database.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);", [key, value]);
}

/** Runs every pending migration in ascending version order. Idempotent. */
function runMigrations(database: Database): void {
  const current = getSchemaVersion(database);
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );
  for (const migration of pending) {
    database.run("BEGIN IMMEDIATE;");
    try {
      migration.up(database);
      setSchemaVersion(database, migration.version);
      database.run("COMMIT;");
    } catch (err) {
      database.run("ROLLBACK;");
      throw new Error(
        `Migration to schema version ${migration.version} failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Runs SQLite's own consistency check plus (implicitly, via
 * getPersistedDatabase's checksum verification on load) a tamper/corruption
 * check against the last persisted snapshot. Call after any operation where
 * silent corruption would be unacceptable (e.g. before a backup, or as a
 * periodic health check).
 */
export function runIntegrityCheck(): { ok: boolean; issues: string[] } {
  const database = getDb();
  const stmt = database.prepare("PRAGMA integrity_check;");
  const issues: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const result = String(row.integrity_check ?? "");
    if (result && result !== "ok") issues.push(result);
  }
  stmt.free();
  return { ok: issues.length === 0, issues };
}

async function initializeDatabase(): Promise<void> {
  const sql = await initSqlJsEngine();
  let persisted: Uint8Array | null;
  try {
    persisted = await getPersistedDatabase();
  } catch (err) {
    if (err instanceof LocalDbIntegrityError) {
      // Never silently discard a corrupted database and start fresh — that
      // would be exactly the kind of silent data loss this layer must avoid.
      // Surface the error to the caller so recovery (restore-from-backup, or
      // an explicit user-approved reset) can be handled deliberately.
      throw err;
    }
    throw err;
  }
  db = persisted ? new sql.Database(persisted) : new sql.Database();
  const previousVersion = persisted ? getSchemaVersion(db) : 0;
  const schemaChanged = !persisted || previousVersion < SQLITE_DB_VERSION;
  if (schemaChanged) createTables();
  // SQLite no-ops `PRAGMA foreign_keys = ON` if issued before the schema's
  // CREATE TABLE statements settle in some sql.js/WASM builds — asserting it
  // again after schema creation is what actually makes it stick for this
  // connection. Verified via PRAGMA foreign_keys readback during validation.
  db.run("PRAGMA foreign_keys = ON;");
  if (!persisted) {
    setSchemaVersion(db, SQLITE_DB_VERSION);
  } else {
    runMigrations(db);
  }
  const integrity = runIntegrityCheck();
  if (!integrity.ok) {
    throw new LocalDbIntegrityError(
      `SQLite PRAGMA integrity_check failed: ${integrity.issues.join("; ")}`,
    );
  }
  // Exporting, encrypting, hashing, and writing the entire SQLite database is
  // unnecessary on an unchanged launch. Persist only new/upgraded schemas;
  // normal writes continue to persist transactionally through runLocal().
  if (schemaChanged) {
    await persistDatabase(new Uint8Array(db.export()), getSchemaVersion(db));
  }
}

/** Hard ceiling on DB init. It should take well under a second; this only
 * exists so a genuinely stuck WASM instantiate / IndexedDB open / crypto step
 * converts to a rejection the boot path can recover from, instead of an
 * unbounded hang that wedges the whole app on the loading skeleton. */
const INIT_TIMEOUT_MS = 20_000;

export async function initLocalDb(): Promise<void> {
  if (dbReady) return dbReady;
  const attempt = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Local database initialization timed out")),
        INIT_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([initializeDatabase(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  })();
  dbReady = attempt;
  try {
    await attempt;
  } catch (err) {
    // Never cache a rejected/timed-out init: clearing dbReady lets the next
    // caller retry instead of every future DB op replaying the same failure
    // for the whole session.
    dbReady = null;
    throw err;
  }
}

/**
 * Permanently deletes the local encrypted SQLite database (every table:
 * orders, gold_ledger, outbox, sync_meta, audit_log, the lot) AND the
 * IndexedDB-stored encryption/signing keys and device id, since they live in
 * the same underlying IndexedDB database (see openIndexedDb's "sqlite" +
 * "crypto" object stores). This is the actual data source
 * base-repository.ts's local-first read()/readAll() serve from — clearing
 * only the flat localStorage keys in settings-store.ts's clearPilotData()
 * left this database untouched, so stale rows kept surviving both a Supabase
 * wipe and that button. Next initLocalDb() call starts completely fresh: new
 * device id, new keys, empty schema. Irreversible — caller is responsible for
 * confirming with the user first.
 */
export async function clearLocalDatabase(): Promise<void> {
  db = null;
  dbReady = null;
  SQL = null;
  if (idbConnection) {
    const idb = await idbConnection.catch(() => null);
    idb?.close();
    idbConnection = null;
  }
  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(SQLITE_DB_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve(); // another tab/connection is open — deletion completes once it closes
  });
}

export function getDb(): Database {
  if (!db) throw new Error("SQLite DB is not initialized");
  // Defensive reassertion: observed during Step 2 validation that the
  // foreign_keys pragma can read back as OFF on this connection after an
  // async gap elsewhere in initialization, even though it was just set ON
  // moments earlier in the same function. Root cause not conclusively
  // isolated (suspected sql.js/WASM connection-state timing quirk); since
  // `PRAGMA foreign_keys = ON` is idempotent and cheap, every access through
  // getDb() reasserts it rather than trusting it stuck once at open time —
  // this is what actually keeps FK enforcement reliably on for every caller.
  db.run("PRAGMA foreign_keys = ON;");
  return db;
}

// sql.js is a single in-process connection — it has no notion of concurrent
// transactions at all. Several independent features (audit-log, device
// registry, comm-queue, escalation, ...) each call runLocal() on their own
// schedule, often clustered right at app startup; the `await fn()` below
// yields at least one microtask even when `fn` is synchronous, which is
// enough of a gap for a second runLocal() call to slip its own
// `BEGIN IMMEDIATE` in before the first one's `COMMIT` — sql.js then throws
// "cannot start a transaction within a transaction". Serializing every call
// through this single promise chain (a queue, not a lock the caller can
// forget to release) makes concurrent runLocal() calls queue instead of race.
let runLocalQueue: Promise<unknown> = Promise.resolve();
// True while a runLocal() transaction is open. A runLocal() called from INSIDE
// another runLocal()'s fn (e.g. a helper that appends an audit row mid-write)
// must NOT queue behind the outer call — the outer is awaiting the inner while
// still holding the queue slot, so queueing would deadlock both forever (an
// unresolvable Promise = the exact startup hang this guards against). Instead
// the reentrant call joins the transaction already in progress: it runs its fn
// directly, and the outer BEGIN/COMMIT still bracket the whole thing.
let inTransaction = false;

export function runLocal<T>(fn: () => T | Promise<T>): Promise<T> {
  if (inTransaction) {
    // Reentrant: already inside a transaction — just run the work, no nested
    // BEGIN (sql.js has no nested transactions) and no second COMMIT/persist.
    return Promise.resolve().then(fn);
  }
  const run = runLocalQueue.then(async () => {
    await initLocalDb();
    const database = getDb();
    database.run("BEGIN IMMEDIATE;");
    inTransaction = true;
    try {
      const result = await fn();
      database.run("COMMIT;");
      await persistDatabase(new Uint8Array(database.export()), getSchemaVersion(database));
      return result;
    } catch (err) {
      database.run("ROLLBACK;");
      throw err;
    } finally {
      inTransaction = false;
    }
  });
  // Queue advances on both success and failure — one failed caller must
  // never wedge every subsequent runLocal() call behind a rejected promise.
  runLocalQueue = run.catch(() => {});
  return run;
}

export function selectAll(table: string): any[] {
  const database = getDb();
  const stmt = database.prepare(`SELECT * FROM ${table}`);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(normalizeRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

export function selectById(table: string, id: string): Record<string, unknown> | null {
  const database = getDb();
  const stmt = database.prepare(`SELECT * FROM ${table} WHERE id = ?`);
  stmt.bind([id]);
  const row = stmt.step() ? normalizeRow(stmt.getAsObject()) : null;
  stmt.free();
  return row;
}

export function deleteRow(table: string, id: string): void {
  const database = getDb();
  database.run(`DELETE FROM ${table} WHERE id = ?;`, [id]);
}

export function upsertRow(table: string, row: Record<string, unknown>): void {
  const database = getDb();
  const keys = Object.keys(row);
  const columns = keys.map((k) => k).join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  const values = keys.map((k) => toSqlValue(row[k]));
  database.run(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${keys
      .filter((k) => k !== "id")
      .map((k) => `${k} = excluded.${k}`)
      .join(", ")};`,
    values,
  );
}

/** Upserts many rows of the SAME table shape in a single prepared-statement loop. Caller wraps in runLocal() for atomicity. */
export function bulkUpsertRows(table: string, rows: Record<string, unknown>[]): void {
  for (const row of rows) upsertRow(table, row);
}

/**
 * Marks a row soft-deleted without physically removing it — the row stays
 * queryable via selectById/direct SQL (for FK integrity, undo, and so the
 * pending outbox delete still has a row to reference) but is excluded from
 * `selectAllLive`/`queryTableLive`. Idempotent.
 */
export function softDeleteRow(table: string, id: string): void {
  const database = getDb();
  database.run(
    `INSERT OR REPLACE INTO deleted_rows (table_name, row_id, deleted_at) VALUES (?, ?, ?);`,
    [table, id, new Date().toISOString()],
  );
}

export function isRowSoftDeleted(table: string, id: string): boolean {
  const database = getDb();
  const stmt = database.prepare(`SELECT 1 FROM deleted_rows WHERE table_name = ? AND row_id = ?;`);
  stmt.bind([table, id]);
  const found = stmt.step();
  stmt.free();
  return found;
}

/** Undoes a soft delete (e.g. user cancels a delete before it syncs). */
export function undeleteRow(table: string, id: string): void {
  const database = getDb();
  database.run(`DELETE FROM deleted_rows WHERE table_name = ? AND row_id = ?;`, [table, id]);
}

/** Physically removes a row that was soft-deleted, once sync has confirmed the delete against Supabase. Not yet called by anything — Step 4 (sync engine) scope. */
export function purgeSoftDeletedRow(table: string, id: string): void {
  const database = getDb();
  database.run(`DELETE FROM ${table} WHERE id = ?;`, [id]);
  database.run(`DELETE FROM deleted_rows WHERE table_name = ? AND row_id = ?;`, [table, id]);
}

/** Same as selectAll, but excludes soft-deleted rows. */
export function selectAllLive(table: string): any[] {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT t.* FROM ${table} t WHERE NOT EXISTS (SELECT 1 FROM deleted_rows d WHERE d.table_name = ? AND d.row_id = t.id)`,
  );
  stmt.bind([table]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(normalizeRow(stmt.getAsObject()));
  stmt.free();
  return rows;
}

export function queryTable<T = any>(table: string, whereClause = "", params: any[] = []): T[] {
  const database = getDb();
  const sql = whereClause
    ? `SELECT * FROM ${table} WHERE ${whereClause}`
    : `SELECT * FROM ${table}`;
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(normalizeRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

export function getPendingOutbox(): any[] {
  return queryTable("outbox", "status = ?", ["pending"]);
}

/** Best-effort extraction of a row's updatedAt/updated_at timestamp, for conflict-detection base versions. */
export function extractUpdatedAt(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const raw = row.updatedAt ?? row.updated_at;
  if (raw == null) return null;
  return typeof raw === "number" ? new Date(raw).toISOString() : String(raw);
}

export function enqueueOutbox(
  id: string,
  tableName: string,
  rowId: string,
  operation: "insert" | "update" | "delete",
  payload: unknown,
  baseUpdatedAt?: string | null,
): void {
  const createdAt = new Date().toISOString();
  upsertRow("outbox", {
    id,
    table_name: tableName,
    row_id: rowId,
    operation,
    payload: payload == null ? null : JSON.stringify(payload),
    status: "pending",
    attempts: 0,
    last_error: null,
    last_attempt_at: null,
    created_at: createdAt,
    base_updated_at: baseUpdatedAt ?? null,
    next_attempt_at: createdAt,
  });
}

export function markOutboxStatus(
  id: string,
  status: "pending" | "in_progress" | "failed" | "synced",
  error?: string,
): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.run(
    `UPDATE outbox SET status = ?, attempts = attempts + 1, last_error = ?, last_attempt_at = ? WHERE id = ?;`,
    [status, error ?? null, now, id],
  );
}

export async function encryptData(
  key: CryptoKey,
  data: Uint8Array,
): Promise<{ blob: Uint8Array; iv: Uint8Array }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  // lib.dom's BufferSource now requires ArrayBufferView<ArrayBuffer> specifically
  // (excluding the wider ArrayBufferLike/SharedArrayBuffer union); Uint8Array's
  // backing buffer is typed as the broader ArrayBufferLike, so a cast is needed
  // here even though a plain Uint8Array is exactly what SubtleCrypto expects.
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource,
  );
  return {
    blob: new Uint8Array(encrypted),
    iv,
  };
}

export async function decryptData(
  key: CryptoKey,
  blob: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    blob as unknown as BufferSource,
  );
  return new Uint8Array(decrypted);
}

export async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const desktopStore = getDesktopKeyStore();
  if (desktopStore) {
    const protectedKey = await desktopStore.get(DESKTOP_DATA_KEY);
    if (protectedKey) {
      return window.crypto.subtle.importKey(
        "raw",
        fromBase64Bytes(protectedKey) as unknown as BufferSource,
        "AES-GCM",
        true,
        ["encrypt", "decrypt"],
      );
    }
  }
  const idb = await openIndexedDb();
  const keyRaw = await new Promise<ArrayBuffer | null>((resolve, reject) => {
    const tx = idb.transaction("crypto", "readwrite");
    const store = tx.objectStore("crypto");
    const request = store.get(ATTACHMENT_KEY_STORE);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  if (keyRaw instanceof ArrayBuffer) {
    if (desktopStore) {
      await desktopStore.set(DESKTOP_DATA_KEY, toBase64Bytes(new Uint8Array(keyRaw)));
      await deleteLegacyIndexedKey(idb, ATTACHMENT_KEY_STORE);
    }
    return window.crypto.subtle.importKey("raw", keyRaw, "AES-GCM", true, ["encrypt", "decrypt"]);
  }
  const newKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const exported = await window.crypto.subtle.exportKey("raw", newKey);
  if (desktopStore) {
    await desktopStore.set(DESKTOP_DATA_KEY, toBase64Bytes(new Uint8Array(exported)));
    return newKey;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction("crypto", "readwrite");
    const store = tx.objectStore("crypto");
    const request = store.put(exported, ATTACHMENT_KEY_STORE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return newKey;
}

const SIGNING_KEY_STORE = "mtj_erp_signing_key";

/**
 * Dedicated HMAC-SHA256 signing key (Plan 1 Step 8), separate from the
 * AES-256-GCM attachment/database encryption key above — this key only ever
 * signs, never encrypts, so a future rotation or export of one key can never
 * accidentally weaken the other. Persisted the same way (IndexedDB `crypto`
 * store), generated once per install.
 */
export async function getOrCreateSigningKey(): Promise<CryptoKey> {
  const desktopStore = getDesktopKeyStore();
  if (desktopStore) {
    const protectedKey = await desktopStore.get(DESKTOP_SIGNING_KEY);
    if (protectedKey) {
      return window.crypto.subtle.importKey(
        "raw",
        fromBase64Bytes(protectedKey) as unknown as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        true,
        ["sign", "verify"],
      );
    }
  }
  const idb = await openIndexedDb();
  const keyRaw = await new Promise<ArrayBuffer | null>((resolve, reject) => {
    const tx = idb.transaction("crypto", "readwrite");
    const store = tx.objectStore("crypto");
    const request = store.get(SIGNING_KEY_STORE);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  if (keyRaw instanceof ArrayBuffer) {
    if (desktopStore) {
      await desktopStore.set(DESKTOP_SIGNING_KEY, toBase64Bytes(new Uint8Array(keyRaw)));
      await deleteLegacyIndexedKey(idb, SIGNING_KEY_STORE);
    }
    return window.crypto.subtle.importKey("raw", keyRaw, { name: "HMAC", hash: "SHA-256" }, true, [
      "sign",
      "verify",
    ]);
  }
  const newKey = await window.crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, true, [
    "sign",
    "verify",
  ]);
  const exported = await window.crypto.subtle.exportKey("raw", newKey);
  if (desktopStore) {
    await desktopStore.set(DESKTOP_SIGNING_KEY, toBase64Bytes(new Uint8Array(exported)));
    return newKey;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction("crypto", "readwrite");
    const store = tx.objectStore("crypto");
    const request = store.put(exported, SIGNING_KEY_STORE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return newKey;
}

export interface KeyRotationResult {
  rotated: boolean;
  filesReencrypted: number;
}

/**
 * Key Management: rotates the AES-256-GCM master key used for the
 * persisted database snapshot AND every attachment blob in `file_blobs`
 * (Step 6). Unlike the HMAC signing key (audit-log.ts), which never needs
 * rotation because old entries only ever need to verify against the key
 * that signed them, this key ACTIVELY decrypts data on every read — a
 * rotation must re-encrypt every existing ciphertext under the new key or
 * that data becomes unreadable. Sequence, deliberately in this order:
 *   1. Decrypt the persisted DB snapshot and every file_blobs row with the
 *      CURRENT key (whatever it is right now).
 *   2. Only once all plaintext is safely held in memory, overwrite the
 *      stored key with a freshly generated one.
 *   3. Re-encrypt and persist the DB snapshot and every file_blobs row
 *      under the NEW key.
 * If step 1 fails for any row, rotation aborts before step 2 ever touches
 * the stored key — a partially-completed rotation must never leave the
 * app with some data encrypted under a key that's already been discarded.
 */
export async function rotateMasterKey(): Promise<KeyRotationResult> {
  await initLocalDb();
  const oldKey = await getOrCreateMasterKey();

  // Step 1: decrypt everything under the current key first.
  const dbRecord = await getRawDbRecord();
  const dbPlaintext = dbRecord
    ? await decryptData(oldKey, dbRecord.encryptedBlob, dbRecord.iv)
    : null;
  const dbSchemaVersion = dbRecord?.schemaVersion;

  const blobRows = queryTable("file_blobs", "", []) as Array<{
    checksum: string;
    encrypted_blob: Uint8Array;
    iv: Uint8Array;
  }>;
  const decryptedBlobs: Array<{ checksum: string; plaintext: Uint8Array }> = [];
  for (const row of blobRows) {
    const plaintext = await decryptData(oldKey, row.encrypted_blob, row.iv);
    decryptedBlobs.push({ checksum: row.checksum, plaintext });
  }

  // Step 2: only now overwrite the stored key — all plaintext above is
  // already safely in memory, so nothing becomes unreadable partway.
  const idb = await openIndexedDb();
  const newKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const exportedNewKey = await window.crypto.subtle.exportKey("raw", newKey);
  const desktopStore = getDesktopKeyStore();
  if (desktopStore) {
    await desktopStore.set(DESKTOP_DATA_KEY, toBase64Bytes(new Uint8Array(exportedNewKey)));
  }
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction("crypto", "readwrite");
    const store = tx.objectStore("crypto");
    const request = desktopStore
      ? store.delete(ATTACHMENT_KEY_STORE)
      : store.put(exportedNewKey, ATTACHMENT_KEY_STORE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Step 3: re-encrypt and persist everything under the new key.
  if (dbPlaintext && dbSchemaVersion !== undefined) {
    await persistDatabase(dbPlaintext, dbSchemaVersion);
  }
  for (const { checksum, plaintext } of decryptedBlobs) {
    const { blob, iv } = await encryptData(newKey, plaintext);
    await runLocal(() => {
      getDb().run(`UPDATE file_blobs SET encrypted_blob = ?, iv = ? WHERE checksum = ?;`, [
        blob,
        iv,
        checksum,
      ]);
    });
  }

  return { rotated: true, filesReencrypted: decryptedBlobs.length };
}

export async function saveEncryptedAttachment(
  attachmentId: string,
  data: Uint8Array,
  mimeType: string,
): Promise<void> {
  const key = await getOrCreateMasterKey();
  const { blob, iv } = await encryptData(key, data);
  upsertRow("attachment_files", {
    attachment_id: attachmentId,
    encrypted_blob: blob,
    iv,
    mime_type: mimeType,
    size_bytes: data.byteLength,
  });
}

export async function loadEncryptedAttachment(attachmentId: string): Promise<Uint8Array | null> {
  const row = selectById("attachment_files", attachmentId);
  if (!row) return null;
  const blob = row.encrypted_blob as Uint8Array | null;
  const iv = row.iv as Uint8Array | null;
  if (!blob || !iv) return null;
  const key = await getOrCreateMasterKey();
  return decryptData(key, blob, iv);
}

// ============================================================================
// Backup preparation / restore
// ============================================================================

export interface BackupSnapshot {
  schemaVersion: number;
  checksum: string;
  createdAt: string;
  /** Encrypted SQLite database bytes — same at-rest encryption as normal persistence. */
  encryptedBlob: Uint8Array;
  iv: Uint8Array;
}

/**
 * Produces a self-contained, encrypted snapshot of the current database
 * state, verified against a fresh integrity check first so a corrupted
 * database is never backed up silently as if it were good.
 */
export async function createBackupSnapshot(): Promise<BackupSnapshot> {
  await initLocalDb();
  const database = getDb();
  const integrity = runIntegrityCheck();
  if (!integrity.ok) {
    throw new LocalDbIntegrityError(
      `Refusing to create a backup of a database that failed integrity_check: ${integrity.issues.join("; ")}`,
    );
  }
  const bytes = new Uint8Array(database.export());
  const checksum = await sha256Hex(bytes);
  const key = await getOrCreateMasterKey();
  const { blob, iv } = await encryptData(key, bytes);
  return {
    schemaVersion: getSchemaVersion(database),
    checksum,
    createdAt: new Date().toISOString(),
    encryptedBlob: blob,
    iv,
  };
}

/**
 * Restores the database from a previously-created snapshot, verifying the
 * checksum before replacing the live database — never swaps in unverified
 * bytes. This is a destructive operation on the caller's behalf (it
 * overwrites the current local database); callers must obtain explicit user
 * confirmation before invoking it.
 */
export async function restoreFromBackupSnapshot(snapshot: BackupSnapshot): Promise<void> {
  const sql = await initSqlJsEngine();
  const key = await getOrCreateMasterKey();
  const bytes = await decryptData(key, snapshot.encryptedBlob, snapshot.iv);
  const actualChecksum = await sha256Hex(bytes);
  if (actualChecksum !== snapshot.checksum) {
    throw new LocalDbIntegrityError(
      `Backup snapshot checksum mismatch (expected ${snapshot.checksum}, got ${actualChecksum}) — refusing to restore a corrupted backup.`,
    );
  }
  const candidate = new sql.Database(bytes);
  const candidateCheck = candidate.prepare("PRAGMA integrity_check;");
  const issues: string[] = [];
  while (candidateCheck.step()) {
    const result = String(candidateCheck.getAsObject().integrity_check ?? "");
    if (result && result !== "ok") issues.push(result);
  }
  candidateCheck.free();
  if (issues.length > 0) {
    candidate.close();
    throw new LocalDbIntegrityError(
      `Backup snapshot failed PRAGMA integrity_check after decryption: ${issues.join("; ")}`,
    );
  }
  db?.close();
  db = candidate;
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA journal_mode = WAL;");
  await persistDatabase(bytes, snapshot.schemaVersion);
}

export interface BackupVerificationResult {
  ok: boolean;
  checksumVerified: boolean;
  integrityCheckPassed: boolean;
  sizeBytes: number;
  issues: string[];
}

/**
 * Disaster Recovery Validation (Step 8/Priority 6): proves a backup is
 * genuinely restorable WITHOUT touching the live database — decrypts,
 * verifies checksum, opens the bytes as a throwaway sql.js Database, runs
 * PRAGMA integrity_check, then discards the candidate. This is what a
 * scheduled/automatic recovery drill should call (see
 * disaster-recovery.ts) — restoreFromBackupSnapshot() itself stays
 * destructive-by-design (swaps the live db) and is reserved for a real,
 * user-confirmed restore action, never something run automatically.
 */
export async function verifyBackupRestorable(
  snapshot: BackupSnapshot,
): Promise<BackupVerificationResult> {
  const issues: string[] = [];
  let checksumVerified = false;
  let integrityCheckPassed = false;
  let sizeBytes = 0;

  try {
    const key = await getOrCreateMasterKey();
    const bytes = await decryptData(key, snapshot.encryptedBlob, snapshot.iv);
    sizeBytes = bytes.byteLength;
    const actualChecksum = await sha256Hex(bytes);
    checksumVerified = actualChecksum === snapshot.checksum;
    if (!checksumVerified) {
      issues.push(`Checksum mismatch (expected ${snapshot.checksum}, got ${actualChecksum}).`);
    }

    const sql = await initSqlJsEngine();
    const candidate = new sql.Database(bytes);
    try {
      const check = candidate.prepare("PRAGMA integrity_check;");
      const checkIssues: string[] = [];
      while (check.step()) {
        const result = String(check.getAsObject().integrity_check ?? "");
        if (result && result !== "ok") checkIssues.push(result);
      }
      check.free();
      integrityCheckPassed = checkIssues.length === 0;
      issues.push(...checkIssues);
    } finally {
      candidate.close(); // never swapped into the live `db` — this is a read-only drill
    }
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }

  return {
    ok: checksumVerified && integrityCheckPassed,
    checksumVerified,
    integrityCheckPassed,
    sizeBytes,
    issues,
  };
}

// ============================================================================
// Retained automatic backups (auto_backups table) — Database Hardening
// Priority 4. Distinct from the disaster-recovery drill: rows here are the
// actual backups a restore reads from, with configurable retention/rotation.
// ============================================================================

export interface AutoBackupEntry {
  id: string;
  createdAt: string;
  schemaVersion: number;
  checksum: string;
  sizeBytes: number;
  valid: boolean;
}

function autoBackupId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `bkp_${crypto.randomUUID()}`
    : `bkp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Creates a snapshot, verifies it's genuinely restorable (never trusts a
 * backup that hasn't proven it decrypts + passes integrity_check), and
 * retains it as a row. Rotation happens after: oldest backups beyond
 * `retainCount` are removed, but the single most recent VALID backup is
 * never removed even if retention would otherwise drop it (never leaves the
 * install with zero good backups).
 */
export async function createAndRetainBackup(retainCount: number): Promise<AutoBackupEntry> {
  await initLocalDb();
  const database = getDb();
  const snapshot = await createBackupSnapshot();
  const verification = await verifyBackupRestorable(snapshot);
  const id = autoBackupId();
  database.run(
    `INSERT INTO auto_backups (id, created_at, schema_version, checksum, size_bytes, valid, encrypted_blob, iv)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      snapshot.createdAt,
      snapshot.schemaVersion,
      snapshot.checksum,
      verification.sizeBytes,
      verification.ok ? 1 : 0,
      snapshot.encryptedBlob,
      snapshot.iv,
    ],
  );
  await persistDatabase(new Uint8Array(database.export()), snapshot.schemaVersion);
  await rotateAutoBackups(Math.max(1, retainCount));
  return {
    id,
    createdAt: snapshot.createdAt,
    schemaVersion: snapshot.schemaVersion,
    checksum: snapshot.checksum,
    sizeBytes: verification.sizeBytes,
    valid: verification.ok,
  };
}

/** Newest first. */
export function listAutoBackups(): AutoBackupEntry[] {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, created_at, schema_version, checksum, size_bytes, valid FROM auto_backups ORDER BY created_at DESC;`,
  );
  const rows: AutoBackupEntry[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: String(r.id),
      createdAt: String(r.created_at),
      schemaVersion: Number(r.schema_version),
      checksum: String(r.checksum),
      sizeBytes: Number(r.size_bytes),
      valid: Number(r.valid) === 1,
    });
  }
  stmt.free();
  return rows;
}

/** Loads a retained backup's full snapshot for restore. */
export function getAutoBackupSnapshot(id: string): BackupSnapshot | null {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT schema_version, checksum, created_at, encrypted_blob, iv FROM auto_backups WHERE id = ?;`,
  );
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject();
  stmt.free();
  return {
    schemaVersion: Number(r.schema_version),
    checksum: String(r.checksum),
    createdAt: String(r.created_at),
    encryptedBlob: r.encrypted_blob as Uint8Array,
    iv: r.iv as Uint8Array,
  };
}

/**
 * Keeps the newest `retainCount` backups. Always keeps at least the single
 * newest VALID backup regardless of count, so rotation can never leave the
 * install with zero good backups to fall back on.
 */
async function rotateAutoBackups(retainCount: number): Promise<void> {
  const database = getDb();
  const all = listAutoBackups(); // newest first
  const newestValidId = all.find((b) => b.valid)?.id;
  const toDelete = all
    .slice(retainCount)
    .filter((b) => b.id !== newestValidId)
    .map((b) => b.id);
  for (const id of toDelete) {
    database.run(`DELETE FROM auto_backups WHERE id = ?;`, [id]);
  }
  if (toDelete.length > 0) {
    await persistDatabase(new Uint8Array(database.export()), getSchemaVersion(database));
  }
}

// ============================================================================
// Local Database Manager — single entry point bundling open/schema/migrate/
// integrity/backup responsibilities, per Plan 1 Step 2's requirements.
// Existing named exports above remain available for direct use; this object
// is the recommended surface for new callers (e.g. a future sync engine).
// ============================================================================

export const LocalDatabaseManager = {
  /** Opens the database, creating schema and running migrations if needed. */
  open: initLocalDb,
  /** Returns the live sql.js Database handle (throws if not yet opened). */
  getDatabase: getDb,
  /** Runs `fn` inside a transaction; commits + persists on success, rolls back on error. */
  runTransaction: runLocal,
  /** Current schema version of the open database. */
  getSchemaVersion: () => getSchemaVersion(getDb()),
  /** Target schema version this build of the app expects. */
  getTargetSchemaVersion: () => SQLITE_DB_VERSION,
  /** SQLite's own PRAGMA integrity_check, plus checksum verification on load. */
  checkIntegrity: runIntegrityCheck,
  /** Encrypted, checksum-verified snapshot of the current database. */
  createBackup: createBackupSnapshot,
  /** Restores from a snapshot, verifying checksum + integrity before swapping in. */
  restoreBackup: restoreFromBackupSnapshot,
} as const;
