/**
 * Deployment Mode — Offline / Hybrid / Online.
 *
 * Workshop V1.1 must run with zero network dependency in Offline mode: no
 * Supabase auth, no cloud sync. Hybrid/Online are seams for a future version
 * to complete (see the setup wizard) — for now they are identical to today's
 * unchanged Supabase-only behavior. The mode is chosen once, in the first-run
 * setup wizard, and persisted in local-db's `meta` table (same table
 * schema_version lives in) so it survives restarts without ever touching the
 * network.
 *
 * The wizard itself only appears when VITE_DEPLOYMENT_MODES_ENABLED="true" is
 * set at build time (the Workshop Offline edition's build config) — every
 * other build (today's cloud/demo product, e2e tests, `npm run dev`) resolves
 * straight to "online" with no wizard, byte-for-byte the same behavior as
 * before this feature existed. Gating on "is there local data yet" instead
 * would have been wrong: a signed-out or genuinely fresh browser profile of
 * the existing cloud product looks identical to a fresh Offline install, and
 * several existing e2e tests rely on a fresh/signed-out profile going
 * straight to the Supabase login form.
 */
import { create } from "zustand";
import { getMetaValue, setMetaValue, initLocalDb } from "@/lib/local-db";

export type DeploymentMode = "offline" | "hybrid" | "online";

const META_KEY = "deployment_mode";

function wizardEnabled(): boolean {
  return import.meta.env.VITE_DEPLOYMENT_MODES_ENABLED === "true";
}

/**
 * Fallback mode for builds that never run the setup wizard. V1 is offline-first:
 * normal workshop operation must never depend on the network, so an unconfigured
 * install lands in Offline, not Online. The cloud/demo/e2e builds — which DO
 * expect a Supabase login — opt back in explicitly with
 * VITE_DEFAULT_DEPLOYMENT_MODE="online".
 */
function fallbackMode(): DeploymentMode {
  const configured = import.meta.env.VITE_DEFAULT_DEPLOYMENT_MODE;
  if (configured === "offline" || configured === "hybrid" || configured === "online") {
    return configured;
  }
  return "offline";
}

function forceOnlineMode(): boolean {
  return import.meta.env.VITE_FORCE_ONLINE === "true";
}

export async function getDeploymentMode(): Promise<DeploymentMode | null> {
  await initLocalDb();
  // The hosted SaaS build must never inherit an offline/hybrid mode persisted
  // by an earlier browser session. Identity, RLS and platform roles must come
  // from the live Supabase project on the production domain.
  if (forceOnlineMode()) {
    setMetaValue(META_KEY, "online");
    return "online";
  }
  const value = getMetaValue(META_KEY);
  if (value === "offline" || value === "hybrid" || value === "online") return value;
  if (!wizardEnabled()) {
    const mode = fallbackMode();
    setMetaValue(META_KEY, mode);
    return mode;
  }
  // Wizard-enabled build, never configured — fresh install, wizard runs.
  return null;
}

export async function setDeploymentMode(mode: DeploymentMode): Promise<void> {
  await initLocalDb();
  setMetaValue(META_KEY, mode);
  useDeploymentMode.setState({ mode });
}

interface DeploymentModeState {
  /** null = not yet resolved (still booting) or never set (fresh install, wizard pending). */
  mode: DeploymentMode | null;
  hydrated: boolean;
}

export const useDeploymentMode = create<DeploymentModeState>()(() => ({
  mode: null,
  hydrated: false,
}));

/** Reads the persisted mode into the store once at boot. Call before rendering AuthGate/SetupWizard. */
export async function hydrateDeploymentMode(): Promise<void> {
  const mode = await getDeploymentMode();
  useDeploymentMode.setState({ mode, hydrated: true });
}

/** Synchronous convenience for call sites that just need to gate on "are we offline right now". */
export function isOfflineMode(): boolean {
  return useDeploymentMode.getState().mode === "offline";
}

export function isLocalFirstMode(): boolean {
  const mode = useDeploymentMode.getState().mode;
  return mode === "offline" || mode === "hybrid";
}

export function isHybridMode(): boolean {
  return useDeploymentMode.getState().mode === "hybrid";
}
