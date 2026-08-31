import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.resolve(import.meta.dirname, ".auth");
const LOCK_PATH = path.join(AUTH_DIR, "playwright-setup.lock");
const STATE_PATH = path.join(AUTH_DIR, "state.json");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockIsStale(): boolean {
  if (!fs.existsSync(LOCK_PATH)) return true;
  try {
    const age = Date.now() - fs.statSync(LOCK_PATH).mtimeMs;
    return age > 10 * 60 * 1000;
  } catch {
    return true;
  }
}

/** Serialize global-setup so parallel Playwright invocations cannot clobber state.json. */
export async function acquireAuthSetupLock(maxWaitMs = 180_000): Promise<() => void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      fs.writeFileSync(LOCK_PATH, `${process.pid}:${Date.now()}`, { flag: "wx" });
      return () => {
        try {
          fs.unlinkSync(LOCK_PATH);
        } catch {
          /* already released */
        }
      };
    } catch {
      if (lockIsStale()) {
        try {
          fs.unlinkSync(LOCK_PATH);
        } catch {
          /* race — retry */
        }
      }
      await sleep(400);
    }
  }
  throw new Error(
    `[auth-setup-lock] Timed out waiting for ${LOCK_PATH}. Run Playwright suites serially.`,
  );
}

export function authStatePath(): string {
  return STATE_PATH;
}

/** Reuse session when another serial suite just authenticated (never cross-firm). */
export function shouldReuseExistingAuthState(): boolean {
  if (process.env.E2E_FORCE_AUTH_RENEW === "1") return false;
  if (!fs.existsSync(STATE_PATH)) return false;
  try {
    const age = Date.now() - fs.statSync(STATE_PATH).mtimeMs;
    return age < 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function writeAuthStateAtomically(state: object): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const tmp = `${STATE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_PATH);
}
