/**
 * MTJ ERP — Local Document Management (Plan 1, Step 6)
 *
 * Content-addressed, encrypted, versioned local file storage for every
 * attachment type (KYC docs, hallmark certs, bills, photos, CAD files,
 * manufacturing drawings, etc.) — a superset of the single-file encrypted
 * attachment helpers built in Step 2 (saveEncryptedAttachment/
 * loadEncryptedAttachment in local-db.ts), which remain untouched for
 * backward compatibility. Not called from any route/component yet — dormant,
 * tested infrastructure, consistent with Plan 1's phased rollout.
 *
 * Design:
 *  - Content-addressed dedup: files are keyed by SHA-256 checksum in
 *    file_blobs. Identical content uploaded under two different attachments
 *    is physically stored once (ref-counted), referenced twice.
 *  - Version history: file_versions has one row per (attachment, version);
 *    uploading a new file for the same attachment never deletes the old
 *    version — it's superseded (is_current=0) but retained.
 *  - Atomicity: every save is one SQLite transaction (via runLocal) — a
 *    crash mid-save leaves either the old version intact or the new version
 *    fully committed, never a half-written blob or orphaned version row.
 *  - Corruption detection: every read re-hashes the decrypted bytes and
 *    compares to the recorded checksum. A mismatch marks the blob
 *    `corrupted` rather than silently serving bad data.
 *  - Repair: if a blob is corrupted locally and a cloud-backed-up copy is
 *    known to exist (file_versions.cloud_backed_up), repairFile() is the
 *    documented extension point for re-downloading it — the actual cloud
 *    fetch is intentionally left as a TODO wired to whatever storage
 *    integration (Supabase Storage / hostinger-storage.ts) Step 9's
 *    communication/attachment sync work formalizes, rather than guessing at
 *    an untested bucket/path scheme here.
 */
import {
  runLocal,
  getDb,
  encryptData,
  decryptData,
  getOrCreateMasterKey,
  sha256Hex,
} from "@/lib/local-db";
import { isValidMime, getMaxSize, defaultValidationOptions } from "@/lib/upload-validation";

export interface FileVersionRecord {
  id: string;
  attachment_id: string;
  entity_type: string | null;
  entity_id: string | null;
  file_name: string | null;
  version: number;
  checksum: string;
  is_current: number;
  created_at: string;
  created_by: string | null;
  cloud_backed_up: number;
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getCurrentVersionRow(attachmentId: string): FileVersionRecord | null {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT * FROM file_versions WHERE attachment_id = ? AND is_current = 1 LIMIT 1;`,
  );
  stmt.bind([attachmentId]);
  const row = stmt.step() ? (stmt.getAsObject() as unknown as FileVersionRecord) : null;
  stmt.free();
  return row;
}

function getBlobRow(
  checksum: string,
): { checksum: string; encrypted_blob: Uint8Array; iv: Uint8Array; corrupted: number } | null {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM file_blobs WHERE checksum = ?;`);
  stmt.bind([checksum]);
  const row = stmt.step() ? (stmt.getAsObject() as any) : null;
  stmt.free();
  return row;
}

export interface SaveFileResult {
  attachmentId: string;
  version: number;
  checksum: string;
  deduped: boolean; // true if identical content already existed locally (blob reused, not re-encrypted/re-stored)
}

export class UploadValidationError extends Error {}

/**
 * Saves a file for `attachmentId`, atomically. If identical content
 * (by SHA-256) already exists locally for ANY attachment, the existing
 * encrypted blob is reused (ref-counted) instead of storing a duplicate —
 * the new version row still gets its own history entry.
 */
export async function saveFile(
  attachmentId: string,
  bytes: Uint8Array,
  options: {
    fileName?: string;
    mimeType?: string;
    entityType?: string;
    entityId?: string;
    createdBy?: string;
  } = {},
): Promise<SaveFileResult> {
  // Enforce the same mime/size whitelist for every caller of this shared
  // storage layer — previously unenforced here (see upload-validation.ts,
  // which existed but nothing called it), so any file of any type/size could
  // be persisted encrypted. A caller intentionally storing something outside
  // the default whitelist (e.g. a raw camera JPEG with a nonstandard MIME
  // string) should widen `defaultValidationOptions`, not bypass this check.
  if (options.mimeType) {
    if (!isValidMime(options.mimeType, defaultValidationOptions)) {
      throw new UploadValidationError(`File type "${options.mimeType}" is not permitted for upload.`);
    }
    const maxSize = getMaxSize(options.mimeType, defaultValidationOptions);
    if (maxSize > 0 && bytes.byteLength > maxSize) {
      throw new UploadValidationError(
        `File exceeds the maximum allowed size of ${(maxSize / (1024 * 1024)).toFixed(0)} MB for this file type.`,
      );
    }
  }

  const checksum = await sha256Hex(bytes);
  const key = await getOrCreateMasterKey();

  return runLocal(async () => {
    const db = getDb();
    const nowIso = new Date().toISOString();
    let deduped = false;

    const existingBlob = getBlobRow(checksum);
    if (existingBlob) {
      deduped = true;
      db.run(`UPDATE file_blobs SET ref_count = ref_count + 1 WHERE checksum = ?;`, [checksum]);
    } else {
      const { blob, iv } = await encryptData(key, bytes);
      db.run(
        `INSERT INTO file_blobs (checksum, encrypted_blob, iv, size_bytes, mime_type, ref_count, created_at, last_verified_at, corrupted)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0);`,
        [checksum, blob, iv, bytes.byteLength, options.mimeType ?? null, nowIso, nowIso],
      );
    }

    const current = getCurrentVersionRow(attachmentId);
    const nextVersion = current ? current.version + 1 : 1;
    if (current) {
      db.run(`UPDATE file_versions SET is_current = 0 WHERE id = ?;`, [current.id]);
    }

    const versionId = makeId("fv");
    db.run(
      `INSERT INTO file_versions (id, attachment_id, entity_type, entity_id, file_name, version, checksum, is_current, created_at, created_by, cloud_backed_up)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0);`,
      [
        versionId,
        attachmentId,
        options.entityType ?? null,
        options.entityId ?? null,
        options.fileName ?? null,
        nextVersion,
        checksum,
        nowIso,
        options.createdBy ?? null,
      ],
    );

    return { attachmentId, version: nextVersion, checksum, deduped };
  });
}

export class FileCorruptionError extends Error {}

/**
 * Loads the current version's bytes, verifying integrity on every read.
 * Returns null if the attachment has no saved file. Throws
 * FileCorruptionError (rather than returning corrupted bytes) if the
 * decrypted content's checksum no longer matches what was recorded at
 * save time — and marks the blob `corrupted` for repairFile()/reporting.
 */
export async function loadFile(attachmentId: string): Promise<Uint8Array | null> {
  const current = getCurrentVersionRow(attachmentId);
  if (!current) return null;
  return loadFileVersion(current.checksum);
}

async function loadFileVersion(checksum: string): Promise<Uint8Array> {
  const blobRow = getBlobRow(checksum);
  if (!blobRow) {
    throw new FileCorruptionError(`No blob found for checksum ${checksum} — version history is inconsistent.`);
  }
  const key = await getOrCreateMasterKey();

  // Two distinct corruption signals, both handled the same way: (1)
  // WebCrypto itself rejects malformed/truncated ciphertext outright (a
  // stronger signal than a checksum mismatch — the bytes are unrecoverable,
  // not just unexpected), or (2) decryption "succeeds" but the recovered
  // bytes don't hash to what was recorded at save time. Either way, the blob
  // is marked corrupted and a FileCorruptionError is thrown — never a
  // silent pass-through of bad data.
  let bytes: Uint8Array;
  try {
    bytes = await decryptData(key, blobRow.encrypted_blob, blobRow.iv);
  } catch (err) {
    await runLocal(() => {
      getDb().run(`UPDATE file_blobs SET corrupted = 1 WHERE checksum = ?;`, [checksum]);
    });
    throw new FileCorruptionError(
      `File corruption detected: decryption failed for checksum ${checksum} (${err instanceof Error ? err.message : String(err)}).`,
    );
  }
  const actualChecksum = await sha256Hex(bytes);
  if (actualChecksum !== checksum) {
    await runLocal(() => {
      getDb().run(`UPDATE file_blobs SET corrupted = 1 WHERE checksum = ?;`, [checksum]);
    });
    throw new FileCorruptionError(
      `File corruption detected: expected checksum ${checksum}, got ${actualChecksum}.`,
    );
  }
  await runLocal(() => {
    getDb().run(`UPDATE file_blobs SET last_verified_at = ? WHERE checksum = ?;`, [
      new Date().toISOString(),
      checksum,
    ]);
  });
  return bytes;
}

export interface FileVaultEntry extends FileVersionRecord {
  size_bytes: number | null;
  mime_type: string | null;
  corrupted: number;
}

/** Every attachment's current (latest) version, newest-uploaded first — for a document browser/vault UI. */
export function listCurrentFiles(): FileVaultEntry[] {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT fv.*, fb.size_bytes as size_bytes, fb.mime_type as mime_type, fb.corrupted as corrupted
     FROM file_versions fv
     LEFT JOIN file_blobs fb ON fb.checksum = fv.checksum
     WHERE fv.is_current = 1
     ORDER BY fv.created_at DESC;`,
  );
  const rows: FileVaultEntry[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as FileVaultEntry);
  stmt.free();
  return rows;
}

/** Every version of a given attachment's file, newest first. */
export function getFileVersionHistory(attachmentId: string): FileVersionRecord[] {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT * FROM file_versions WHERE attachment_id = ? ORDER BY version DESC;`,
  );
  stmt.bind([attachmentId]);
  const rows: FileVersionRecord[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as FileVersionRecord);
  stmt.free();
  return rows;
}

/** Re-verifies a specific version's integrity without necessarily loading its bytes into the caller. Safe to call periodically as a health check. */
export async function verifyFileIntegrity(
  attachmentId: string,
  version?: number,
): Promise<{ ok: boolean; checksum: string | null; error?: string }> {
  const db = getDb();
  const stmt = db.prepare(
    version != null
      ? `SELECT checksum FROM file_versions WHERE attachment_id = ? AND version = ?;`
      : `SELECT checksum FROM file_versions WHERE attachment_id = ? AND is_current = 1;`,
  );
  stmt.bind(version != null ? [attachmentId, version] : [attachmentId]);
  const row = stmt.step() ? (stmt.getAsObject() as { checksum: string }) : null;
  stmt.free();
  if (!row) return { ok: false, checksum: null, error: "No such version" };
  try {
    await loadFileVersion(row.checksum);
    return { ok: true, checksum: row.checksum };
  } catch (err) {
    return { ok: false, checksum: row.checksum, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Attempts to repair a corrupted local file. Currently only covers the case
 * where a byte-identical blob happens to already exist locally under a
 * DIFFERENT checksum entry that isn't actually corrupted (defensive re-check
 * — handles a false-positive corruption flag from a transient read glitch).
 * Re-downloading from cloud backup is the documented extension point for a
 * genuine repair, deferred to when Step 9's attachment-sync wiring exists
 * (see module docstring) — this function returns `false` with a clear
 * reason in that case rather than pretending to have restored the file.
 */
export async function repairFile(
  attachmentId: string,
): Promise<{ repaired: boolean; reason: string }> {
  const current = getCurrentVersionRow(attachmentId);
  if (!current) return { repaired: false, reason: "No file recorded for this attachment." };

  const verify = await verifyFileIntegrity(attachmentId);
  if (verify.ok) return { repaired: false, reason: "File was not actually corrupted." };

  // Older versions of the SAME attachment might still be intact — falling
  // back to the most recent verified-good prior version is a legitimate,
  // safe local repair (surfaces old content rather than nothing, and never
  // fabricates data).
  const history = getFileVersionHistory(attachmentId);
  for (const versionRow of history) {
    if (versionRow.id === current.id) continue;
    const check = await verifyFileIntegrity(attachmentId, versionRow.version);
    if (check.ok) {
      await runLocal(() => {
        const db = getDb();
        db.run(`UPDATE file_versions SET is_current = 0 WHERE attachment_id = ?;`, [attachmentId]);
        db.run(`UPDATE file_versions SET is_current = 1 WHERE id = ?;`, [versionRow.id]);
      });
      return {
        repaired: true,
        reason: `Current version was corrupted; reverted to last known-good version ${versionRow.version}.`,
      };
    }
  }

  return {
    repaired: false,
    reason:
      "No intact local version available. Repair from cloud backup requires Step 9's attachment-sync wiring (not yet implemented) — flag this attachment for manual re-upload.",
  };
}
