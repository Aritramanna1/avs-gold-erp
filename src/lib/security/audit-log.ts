/**
 * Immutable, hash-chained, digitally-signed audit log (Plan 1 Step 8).
 *
 * Every entry's `hash` covers every other column including `prev_hash` — the
 * hash of the entry immediately before it — so the entries form a chain: 1
 * -> 2 -> 3 -> ... Altering, deleting, or reordering a historical row (by
 * any means, including editing the SQLite file directly, not just through
 * this app) breaks the chain from that point forward. `verifyAuditChain()`
 * walks the whole table and reports exactly where a break occurs.
 *
 * Each entry is additionally signed with HMAC-SHA256 using a device-local
 * signing key (getOrCreateSigningKey() in local-db.ts) that never leaves
 * this machine. This is deliberately NOT an asymmetric digital signature
 * (no public/private keypair, no third-party verification) — that would
 * require a PKI/certificate-issuance story this ERP doesn't have yet. What
 * this DOES prove: an entry's hash+signature can only have been produced by
 * a process holding this device's signing key, so a corrupted/hand-edited
 * database row (hash recomputed by an attacker without the key) is still
 * detectable via signature mismatch even in the hash-only-tampered case.
 * True multi-party non-repudiation is a documented follow-up, not built here.
 */
import {
  runLocal,
  getDb,
  queryTable,
  sha256Hex,
  getOrCreateSigningKey,
  initLocalDb,
} from "@/lib/local-db";

export interface AuditEntryInput {
  actorId: string | null;
  actorEmail: string | null;
  action: string; // e.g. "invoice.create", "ledger.adjust", "settings.update"
  entityType: string; // e.g. "invoice", "ledger_entry", "user"
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  deviceId?: string | null;
}

export interface AuditEntry {
  seq: number;
  id: string;
  ts: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  deviceId: string | null;
  prevHash: string;
  hash: string;
  signature: string;
}

const GENESIS_HASH = "0".repeat(64);

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `al_${crypto.randomUUID()}`;
  return `al_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return bytes;
}

function canonicalPayload(fields: {
  id: string;
  ts: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  deviceId: string | null;
  prevHash: string;
}): string {
  // Fixed key order — this string is what gets hashed, so its shape must
  // never depend on object-key iteration order.
  return JSON.stringify([
    fields.id,
    fields.ts,
    fields.actorId,
    fields.actorEmail,
    fields.action,
    fields.entityType,
    fields.entityId,
    fields.beforeJson,
    fields.afterJson,
    fields.deviceId,
    fields.prevHash,
  ]);
}

function parseRow(row: Record<string, unknown>): AuditEntry {
  return {
    seq: Number(row.seq),
    id: row.id as string,
    ts: row.ts as string,
    actorId: (row.actor_id as string) ?? null,
    actorEmail: (row.actor_email as string) ?? null,
    action: row.action as string,
    entityType: row.entity_type as string,
    entityId: (row.entity_id as string) ?? null,
    before: row.before_json ? JSON.parse(row.before_json as string) : null,
    after: row.after_json ? JSON.parse(row.after_json as string) : null,
    deviceId: (row.device_id as string) ?? null,
    prevHash: row.prev_hash as string,
    hash: row.hash as string,
    signature: row.signature as string,
  };
}

function getLastEntry(): Record<string, unknown> | null {
  const rows = queryTable("audit_log", "", []) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  // queryTable has no implicit order guarantee — sort by seq explicitly.
  return rows.reduce((max, r) => (Number(r.seq) > Number(max.seq) ? r : max));
}

/**
 * Appends one entry to the chain. Never throws on a logging-only failure
 * mode by design elsewhere in this codebase (see comm-log-store.ts) — but
 * the audit log is different: a financial action whose audit entry silently
 * failed to write is exactly the failure mode this table exists to prevent,
 * so append() DOES throw on failure. Callers recording a financial action
 * should treat an append() failure as "the action itself did not complete
 * an auditable state" and surface it, not swallow it.
 */
export async function append(input: AuditEntryInput): Promise<AuditEntry> {
  await initLocalDb();
  const prev = getLastEntry();
  const prevHash = prev ? (prev.hash as string) : GENESIS_HASH;

  const id = makeId();
  const ts = new Date().toISOString();
  const beforeJson = input.before !== undefined ? JSON.stringify(input.before) : null;
  const afterJson = input.after !== undefined ? JSON.stringify(input.after) : null;

  const payload = canonicalPayload({
    id,
    ts,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson,
    afterJson,
    deviceId: input.deviceId ?? null,
    prevHash,
  });

  const hash = await sha256Hex(new TextEncoder().encode(payload));

  const signingKey = await getOrCreateSigningKey();
  const signatureBuf = await window.crypto.subtle.sign(
    "HMAC",
    signingKey,
    new TextEncoder().encode(hash) as unknown as BufferSource,
  );
  const signature = toHex(signatureBuf);

  await runLocal(() => {
    getDb().run(
      `INSERT INTO audit_log (id, ts, actor_id, actor_email, action, entity_type, entity_id, before_json, after_json, device_id, prev_hash, hash, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        ts,
        input.actorId,
        input.actorEmail,
        input.action,
        input.entityType,
        input.entityId,
        beforeJson,
        afterJson,
        input.deviceId ?? null,
        prevHash,
        hash,
        signature,
      ],
    );
  });

  return {
    seq: -1, // unknown until re-read; callers needing seq should re-query
    id,
    ts,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    deviceId: input.deviceId ?? null,
    prevHash,
    hash,
    signature,
  };
}

export interface ChainVerificationResult {
  ok: boolean;
  entriesChecked: number;
  brokenAtSeq: number | null;
  issues: string[];
}

/**
 * Walks the entire chain in sequence order, recomputing each entry's hash
 * from its stored fields and verifying it matches both the stored `hash`
 * AND that `prev_hash` matches the previous entry's `hash` — catching both
 * "this row's content was altered" and "a row was deleted/reordered/
 * inserted out of band" (the latter breaks the prev_hash link even if the
 * altered/inserted row's own hash is internally self-consistent). Also
 * re-verifies each entry's HMAC signature against the current signing key.
 */
export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  await initLocalDb();
  const rows = (queryTable("audit_log", "", []) as Record<string, unknown>[]).sort(
    (a, b) => Number(a.seq) - Number(b.seq),
  );

  const issues: string[] = [];
  let brokenAtSeq: number | null = null;
  let expectedPrevHash = GENESIS_HASH;
  const signingKey = await getOrCreateSigningKey();

  for (const row of rows) {
    const seq = Number(row.seq);
    const prevHash = row.prev_hash as string;
    const storedHash = row.hash as string;
    const signature = row.signature as string;

    if (prevHash !== expectedPrevHash) {
      issues.push(
        `seq ${seq}: prev_hash does not match the preceding entry's hash — chain broken.`,
      );
      if (brokenAtSeq === null) brokenAtSeq = seq;
    }

    const payload = canonicalPayload({
      id: row.id as string,
      ts: row.ts as string,
      actorId: (row.actor_id as string) ?? null,
      actorEmail: (row.actor_email as string) ?? null,
      action: row.action as string,
      entityType: row.entity_type as string,
      entityId: (row.entity_id as string) ?? null,
      beforeJson: (row.before_json as string) ?? null,
      afterJson: (row.after_json as string) ?? null,
      deviceId: (row.device_id as string) ?? null,
      prevHash,
    });
    const recomputedHash = await sha256Hex(new TextEncoder().encode(payload));

    if (recomputedHash !== storedHash) {
      issues.push(
        `seq ${seq}: stored hash does not match recomputed hash — entry content was altered.`,
      );
      if (brokenAtSeq === null) brokenAtSeq = seq;
    }

    const signatureValid = await window.crypto.subtle.verify(
      "HMAC",
      signingKey,
      hexToBytes(signature) as unknown as BufferSource,
      new TextEncoder().encode(storedHash) as unknown as BufferSource,
    );
    if (!signatureValid) {
      issues.push(
        `seq ${seq}: HMAC signature invalid — entry hash was rewritten without the device signing key.`,
      );
      if (brokenAtSeq === null) brokenAtSeq = seq;
    }

    expectedPrevHash = storedHash;
  }

  return { ok: issues.length === 0, entriesChecked: rows.length, brokenAtSeq, issues };
}

export async function getAuditEntries(filter?: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
}): Promise<AuditEntry[]> {
  await initLocalDb();
  let rows: Record<string, unknown>[];
  if (filter?.entityType && filter?.entityId) {
    rows = queryTable("audit_log", "entity_type = ? AND entity_id = ?", [
      filter.entityType,
      filter.entityId,
    ]);
  } else if (filter?.actorId) {
    rows = queryTable("audit_log", "actor_id = ?", [filter.actorId]);
  } else {
    rows = queryTable("audit_log", "", []);
  }
  return rows.map(parseRow).sort((a, b) => a.seq - b.seq);
}
