/**
 * Safe Offline Operation Queue — types.
 *
 * Supabase remains authoritative. Queued ops are drafts until the server
 * revalidates and returns the canonical record. Never a second ledger.
 */

export type OfflineCapability =
  | "OFFLINE_SAFE"
  | "OFFLINE_CAPTURE_THEN_VALIDATE"
  | "ONLINE_REQUIRED";

export type OfflineOpStatus =
  | "pending_sync"
  | "syncing"
  | "synced"
  | "needs_attention"
  | "discarded";

/** Domain families used for ordering + gold/accounting safety. */
export type OfflineDomain =
  | "party"
  | "order"
  | "photo"
  | "note"
  | "stock_meta"
  | "gold"
  | "billing"
  | "treasury"
  | "settlement"
  | "inventory_mutation"
  | "settings"
  | "other";

export type OfflineOperation = {
  /** Local idempotency / UUID — never reused */
  localId: string;
  /** Stable key sent to server to prevent duplicate apply */
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  domain: OfflineDomain;
  action: string;
  capability: OfflineCapability;
  status: OfflineOpStatus;
  /** Human label for Sync Centre */
  title: string;
  /** Local-only preview summary (no secrets) */
  summary: string;
  /** Payload for the canonical domain service (no passwords / service keys) */
  payload: Record<string, unknown>;
  /** Local IDs this op depends on (must sync first) */
  dependsOnLocalIds: string[];
  /** After sync, map local UUID → server UUID for dependents */
  resultServerIds?: Record<string, string>;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastError?: string;
  conflictReason?: string;
  /** Optional local encrypted photo asset id */
  localAssetId?: string;
};

export type OfflineAsset = {
  localId: string;
  createdAt: string;
  mimeType: string;
  fileName: string;
  /** AES-GCM ciphertext as base64 */
  cipherBase64: string;
  ivBase64: string;
  status: OfflineOpStatus;
  linkedOperationLocalId?: string;
  serverObjectKey?: string;
};

export type OfflineQueueSnapshot = {
  operations: OfflineOperation[];
  assets: OfflineAsset[];
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
};
