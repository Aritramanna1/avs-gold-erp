/**
 * Key Management (Step 8) — thin, audited wrapper around local-db.ts's
 * rotateMasterKey(). Rotation itself is a low-level, careful operation
 * (decrypt-then-swap-then-reencrypt, see local-db.ts's docstring); this
 * module's only job is to make every rotation a traceable, deliberate,
 * logged event rather than something that could happen invisibly.
 */
import { rotateMasterKey, type KeyRotationResult } from "@/lib/local-db";
import { append as appendAuditEntry } from "./audit-log";

export async function rotateEncryptionKey(actorEmail: string | null): Promise<KeyRotationResult> {
  const result = await rotateMasterKey();
  await appendAuditEntry({
    actorId: null,
    actorEmail,
    action: "key_management.master_key_rotated",
    entityType: "key_management",
    entityId: new Date().toISOString(),
    before: null,
    after: result,
    deviceId: null,
  });
  return result;
}
