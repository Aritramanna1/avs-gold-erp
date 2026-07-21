"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureStoreGet = secureStoreGet;
exports.secureStoreSet = secureStoreSet;
exports.secureStoreDelete = secureStoreDelete;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const ALLOWED_KEYS = new Set([
    "local-session",
    "license-entitlement",
    "local-data-key",
    "local-signing-key",
]);
const MAX_VALUE_BYTES = 64 * 1024;
let writeQueue = Promise.resolve();
function assertAllowedKey(key) {
    if (!ALLOWED_KEYS.has(key))
        throw new Error("Secure-store key is not allowed.");
}
function storePath() {
    return node_path_1.default.join(electron_1.app.getPath("userData"), "secure-store.json");
}
async function readStore() {
    try {
        const parsed = JSON.parse(await promises_1.default.readFile(storePath(), "utf8"));
        return parsed?.version === 1 && parsed.values && typeof parsed.values === "object"
            ? parsed
            : { version: 1, values: {} };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { version: 1, values: {} };
        throw new Error("The protected credential store could not be read.");
    }
}
async function writeStore(store) {
    const target = storePath();
    const temp = `${target}.tmp`;
    await promises_1.default.mkdir(node_path_1.default.dirname(target), { recursive: true });
    await promises_1.default.writeFile(temp, JSON.stringify(store), { encoding: "utf8", mode: 0o600 });
    await promises_1.default.rename(temp, target);
}
function requireEncryption() {
    if (!electron_1.safeStorage.isEncryptionAvailable()) {
        throw new Error("Operating-system credential encryption is unavailable.");
    }
}
async function secureStoreGet(key) {
    assertAllowedKey(key);
    requireEncryption();
    const encrypted = (await readStore()).values[key];
    if (!encrypted)
        return null;
    try {
        return electron_1.safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    }
    catch {
        throw new Error("Protected credential data is corrupted or belongs to another Windows user.");
    }
}
async function secureStoreSet(key, value) {
    assertAllowedKey(key);
    requireEncryption();
    if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES) {
        throw new Error("Protected credential value is too large.");
    }
    writeQueue = writeQueue.then(async () => {
        const store = await readStore();
        store.values[key] = electron_1.safeStorage.encryptString(value).toString("base64");
        await writeStore(store);
    });
    return writeQueue;
}
async function secureStoreDelete(key) {
    assertAllowedKey(key);
    writeQueue = writeQueue.then(async () => {
        const store = await readStore();
        delete store.values[key];
        await writeStore(store);
    });
    return writeQueue;
}
