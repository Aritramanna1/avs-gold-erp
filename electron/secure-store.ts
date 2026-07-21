import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

const ALLOWED_KEYS = new Set([
  "local-session",
  "license-entitlement",
  "local-data-key",
  "local-signing-key",
]);
const MAX_VALUE_BYTES = 64 * 1024;
let writeQueue: Promise<void> = Promise.resolve();

interface SecureStoreFile {
  version: 1;
  values: Record<string, string>;
}

function assertAllowedKey(key: string): void {
  if (!ALLOWED_KEYS.has(key)) throw new Error("Secure-store key is not allowed.");
}

function storePath(): string {
  return path.join(app.getPath("userData"), "secure-store.json");
}

async function readStore(): Promise<SecureStoreFile> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath(), "utf8")) as SecureStoreFile;
    return parsed?.version === 1 && parsed.values && typeof parsed.values === "object"
      ? parsed
      : { version: 1, values: {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, values: {} };
    throw new Error("The protected credential store could not be read.");
  }
}

async function writeStore(store: SecureStoreFile): Promise<void> {
  const target = storePath();
  const temp = `${target}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(store), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temp, target);
}

function requireEncryption(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Operating-system credential encryption is unavailable.");
  }
}

export async function secureStoreGet(key: string): Promise<string | null> {
  assertAllowedKey(key);
  requireEncryption();
  const encrypted = (await readStore()).values[key];
  if (!encrypted) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    throw new Error("Protected credential data is corrupted or belongs to another Windows user.");
  }
}

export async function secureStoreSet(key: string, value: string): Promise<void> {
  assertAllowedKey(key);
  requireEncryption();
  if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES) {
    throw new Error("Protected credential value is too large.");
  }
  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    store.values[key] = safeStorage.encryptString(value).toString("base64");
    await writeStore(store);
  });
  return writeQueue;
}

export async function secureStoreDelete(key: string): Promise<void> {
  assertAllowedKey(key);
  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    delete store.values[key];
    await writeStore(store);
  });
  return writeQueue;
}
