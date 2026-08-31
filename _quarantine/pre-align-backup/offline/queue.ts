/**
 * Offline operation queue API — enqueue, dependency order, status updates.
 * Apply happens only via sync-runner → canonical server services.
 */
import { classifyOfflineAction } from "./classifier";
import { loadQueueSnapshot, saveQueueSnapshot, encryptBytes } from "./storage";
import type { OfflineAsset, OfflineCapability, OfflineOperation } from "./types";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export type EnqueueInput = {
  action: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  dependsOnLocalIds?: string[];
  /** Force capability (otherwise classifier) */
  capability?: OfflineCapability;
  localAssetId?: string;
};

export class OnlineRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnlineRequiredError";
  }
}

export async function enqueueOfflineOperation(input: EnqueueInput): Promise<OfflineOperation> {
  const classified = classifyOfflineAction(input.action);
  const capability = input.capability ?? classified.capability;

  if (capability === "ONLINE_REQUIRED") {
    throw new OnlineRequiredError(
      classified.onlineMessage ?? "Internet connection required for this action.",
    );
  }

  const now = new Date().toISOString();
  const localId = uuid();
  const op: OfflineOperation = {
    localId,
    idempotencyKey: `idem_${localId}`,
    createdAt: now,
    updatedAt: now,
    domain: classified.domain,
    action: input.action,
    capability,
    status: "pending_sync",
    title: input.title,
    summary: input.summary,
    payload: {
      ...input.payload,
      offlineLocalId: localId,
      idempotencyKey: `idem_${localId}`,
    },
    dependsOnLocalIds: input.dependsOnLocalIds ?? [],
    attemptCount: 0,
    nextAttemptAt: now,
    localAssetId: input.localAssetId,
  };

  const snap = await loadQueueSnapshot();
  snap.operations.unshift(op);
  await saveQueueSnapshot(snap);
  return op;
}

export async function enqueueOfflinePhoto(opts: {
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
  title?: string;
  linkedPayload?: Record<string, unknown>;
  dependsOnLocalIds?: string[];
}): Promise<{ operation: OfflineOperation; asset: OfflineAsset }> {
  const { cipherBase64, ivBase64 } = await encryptBytes(opts.bytes);
  const now = new Date().toISOString();
  const assetId = uuid();
  const asset: OfflineAsset = {
    localId: assetId,
    createdAt: now,
    mimeType: opts.mimeType,
    fileName: opts.fileName,
    cipherBase64,
    ivBase64,
    status: "pending_sync",
  };

  const operation = await enqueueOfflineOperation({
    action: "photo.upload",
    title: opts.title ?? "Photo waiting to upload",
    summary: opts.fileName,
    payload: {
      ...(opts.linkedPayload ?? {}),
      fileName: opts.fileName,
      mimeType: opts.mimeType,
    },
    dependsOnLocalIds: opts.dependsOnLocalIds,
    capability: "OFFLINE_SAFE",
    localAssetId: assetId,
  });

  asset.linkedOperationLocalId = operation.localId;
  const snap = await loadQueueSnapshot();
  snap.assets.unshift(asset);
  // Re-link op from latest snap
  const op = snap.operations.find((o) => o.localId === operation.localId);
  if (op) op.localAssetId = assetId;
  await saveQueueSnapshot(snap);
  return { operation, asset };
}

/** Topological-ish order: ops whose deps are synced (or absent) come first. */
export function orderReadyOperations(ops: OfflineOperation[]): OfflineOperation[] {
  const byId = new Map(ops.map((o) => [o.localId, o]));
  const synced = new Set(
    ops.filter((o) => o.status === "synced").map((o) => o.localId),
  );
  const pending = ops.filter(
    (o) => o.status === "pending_sync" || o.status === "needs_attention",
  );

  const ready: OfflineOperation[] = [];
  const blocked: OfflineOperation[] = [];

  for (const op of pending) {
    const depsOk = op.dependsOnLocalIds.every((dep) => {
      if (synced.has(dep)) return true;
      const d = byId.get(dep);
      return !d || d.status === "synced";
    });
    if (depsOk) ready.push(op);
    else blocked.push(op);
  }

  // Domain priority: party → order → photo → others; gold/billing last among ready
  const rank = (d: string) => {
    const order = ["party", "order", "note", "photo", "stock_meta", "other", "inventory_mutation", "billing", "treasury", "settlement", "gold", "settings"];
    const i = order.indexOf(d);
    return i < 0 ? 50 : i;
  };
  ready.sort((a, b) => rank(a.domain) - rank(b.domain) || a.createdAt.localeCompare(b.createdAt));
  return [...ready, ...blocked];
}

export async function updateOperation(
  localId: string,
  patch: Partial<OfflineOperation>,
): Promise<void> {
  const snap = await loadQueueSnapshot();
  const idx = snap.operations.findIndex((o) => o.localId === localId);
  if (idx < 0) return;
  snap.operations[idx] = {
    ...snap.operations[idx]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveQueueSnapshot(snap);
}

export async function discardOperation(localId: string): Promise<void> {
  await updateOperation(localId, { status: "discarded" });
}

export async function getQueueStats(): Promise<{
  pending: number;
  syncing: number;
  needsAttention: number;
  synced: number;
  pendingUploads: number;
  lastSuccessfulSyncAt: string | null;
}> {
  const snap = await loadQueueSnapshot();
  return {
    pending: snap.operations.filter((o) => o.status === "pending_sync").length,
    syncing: snap.operations.filter((o) => o.status === "syncing").length,
    needsAttention: snap.operations.filter((o) => o.status === "needs_attention").length,
    synced: snap.operations.filter((o) => o.status === "synced").length,
    pendingUploads: snap.assets.filter((a) => a.status === "pending_sync" || a.status === "syncing")
      .length,
    lastSuccessfulSyncAt: snap.lastSuccessfulSyncAt,
  };
}
