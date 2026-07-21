/**
 * MTJ ERP — Multi-Branch Store
 *
 * Every data record should carry a branchId.
 * RLS in Supabase enforces isolation server-side.
 * Client-side: all store queries must filter by useBranch().currentBranchId.
 *
 * Branch DEFINITIONS (id/name/active) are NOT owned here — they live in
 * settings-store.ts's `branches` array, the same list the real Branch
 * Management screen (routes/branches.index.tsx) creates/edits/deletes
 * through. This file used to keep its own hardcoded 3-branch array,
 * completely disconnected from that real list — a branch created via
 * Branch Management was invisible everywhere this file's BRANCHES was
 * consumed (Communications settings' branch picker, WhatsApp settings),
 * and there were two different "default branch" seeds that never agreed.
 * getAllBranches() below is now the single place that reads the real list
 * and adapts it to this file's own Branch shape — so adding a branch via
 * the UI needs zero code changes, matching what this file's own comment
 * already (incorrectly) claimed.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSettings } from "./settings-store";

// ── Branch definitions ────────────────────────────────────────────────────────
export interface Branch {
  id: string;
  name: string;
  shortName: string;
  type: "retail" | "manufacturing";
  city: string;
  state: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  invoicePrefix: string; // e.g. "MTJ-RET-"
  barcodePrefix: string; // e.g. "R"
  active: boolean;
}

/**
 * The live branch list, adapted from settings-store.ts's real `branches`
 * (the one Branch Management actually writes to) into this file's Branch
 * shape. `type`/`city`/`state`/`invoicePrefix`/`barcodePrefix` have no
 * equivalent in the real settings-store record — nothing outside this file
 * ever reads those fields (verified: only `.id`/`.name`/`.active` are
 * consumed by any caller), so they're filled with harmless, unused
 * defaults rather than invented as new UI/data to manage.
 */
// Memoized on the source array's identity: settings-store only replaces
// `branches` when it's actually mutated, so returning the same output array
// (and same element references) for an unchanged source keeps this safe to
// call from a Zustand selector. Without this, every call built brand-new
// Branch objects even when nothing changed, which broke referential
// stability for any selector reading it (e.g. `getAccessibleBranches()`
// below via `useShallow`) and caused an infinite re-render loop ("Maximum
// update depth exceeded") on every screen with a branch picker.
type SettingsBranches = ReturnType<typeof useSettings.getState>["branches"];
let _allBranchesCache: { source: SettingsBranches; result: Branch[] } | null = null;
export function getAllBranches(): Branch[] {
  const source = useSettings.getState().branches;
  if (_allBranchesCache && _allBranchesCache.source === source) {
    return _allBranchesCache.result;
  }
  const result = source.map((b) => ({
    id: b.id,
    name: b.name,
    shortName: b.code || b.name,
    type: "retail" as const,
    city: "",
    state: "",
    invoicePrefix: b.invoiceSeries ?? "",
    barcodePrefix: "",
    active: b.active,
  }));
  _allBranchesCache = { source, result };
  return result;
}

// ── User roles ────────────────────────────────────────────────────────────────
export type UserRole =
  | "owner_ceo" // Global read + analytics; cannot do operations
  | "branch_manager" // Full access to assigned branch
  | "billing_staff" // Billing + customers for assigned branch
  | "workshop_staff" // Workshop + gold book for assigned branch
  | "accountant" // Reports + daily close for assigned branch
  | "readonly"; // View only

export interface BranchPermission {
  branchId: string;
  role: UserRole;
}

// ── Access rules ─────────────────────────────────────────────────────────────
export const ROLE_CAPABILITIES: Record<UserRole, string[]> = {
  owner_ceo: ["dashboard.ceo", "reports.*", "analytics.*", "audit.*"],
  branch_manager: [
    "billing.*",
    "orders.*",
    "stock.*",
    "workshop.*",
    "attendance.*",
    "expenses.*",
    "reports.*",
    "settings.branch",
  ],
  billing_staff: ["billing.*", "orders.view", "orders.create", "stock.view", "customers.*"],
  workshop_staff: ["workshop.*", "stock.*", "orders.view", "gold_book.*"],
  accountant: ["billing.view", "reports.*", "expenses.*", "daily_close.*", "passbook.*"],
  readonly: ["billing.view", "orders.view", "stock.view"],
};

export function canDo(role: UserRole, action: string): boolean {
  const caps = ROLE_CAPABILITIES[role] ?? [];
  return caps.some((cap) => {
    if (cap.endsWith(".*")) return action.startsWith(cap.slice(0, -2));
    return cap === action;
  });
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface BranchState {
  /** Currently selected branch for operations */
  currentBranchId: string;
  /** Branches the logged-in user has access to (populated from auth/Supabase) */
  accessibleBranchIds: string[];
  /** Current user's role in each branch */
  userPermissions: BranchPermission[];
  /** Whether this session has CEO-level global access */
  isGlobalAccess: boolean;

  setCurrent(branchId: string): void;
  /** `globalAccess` (SAD §7): Owner/Admin see every branch; omit to leave the flag unchanged. */
  setAccessible(ids: string[], permissions: BranchPermission[], globalAccess?: boolean): void;
  getCurrentBranch(): Branch | undefined;
  getAccessibleBranches(): Branch[];
  hasAccess(branchId: string): boolean;
  canDoAction(action: string, branchId?: string): boolean;
}

// Matches settings-store.ts's own default-seeded branch id — used only as
// a safe fallback before that store has hydrated its real branch list.
const FALLBACK_BRANCH_ID = "MAIN";

export const useBranch = create<BranchState>()(
  persist(
    (set, get) => ({
      currentBranchId: FALLBACK_BRANCH_ID,
      accessibleBranchIds: [], // populated from getAllBranches() as soon as settings-store hydrates; isGlobalAccess defaulting true means this doesn't gate anything meanwhile
      userPermissions: [],
      isGlobalAccess: true, // default true until Supabase auth is wired up

      setCurrent(branchId) {
        const accessible = get().accessibleBranchIds;
        if (accessible.includes(branchId) || get().isGlobalAccess) {
          set({ currentBranchId: branchId });
        }
      },

      setAccessible(ids, permissions, globalAccess) {
        set({ accessibleBranchIds: ids, userPermissions: permissions });
        if (globalAccess !== undefined) set({ isGlobalAccess: globalAccess });
        // If current branch is no longer accessible, switch to first accessible
        if (!get().isGlobalAccess && !ids.includes(get().currentBranchId)) {
          set({ currentBranchId: ids[0] ?? FALLBACK_BRANCH_ID });
        }
      },

      getCurrentBranch() {
        return getAllBranches().find((b) => b.id === get().currentBranchId);
      },

      getAccessibleBranches() {
        const ids = get().accessibleBranchIds;
        const all = getAllBranches();
        // isGlobalAccess (CEO/Owner/single-user default) sees every active
        // branch regardless of the accessibleBranchIds allow-list — matches
        // hasAccess()'s/canDoAction()'s existing isGlobalAccess short-circuit.
        return all.filter((b) => b.active && (get().isGlobalAccess || ids.includes(b.id)));
      },

      hasAccess(branchId) {
        return get().isGlobalAccess || get().accessibleBranchIds.includes(branchId);
      },

      canDoAction(action, branchId) {
        const bid = branchId ?? get().currentBranchId;
        if (get().isGlobalAccess) {
          // CEO: only allowed CEO actions, not operational ones
          return canDo("owner_ceo", action);
        }
        const perm = get().userPermissions.find((p) => p.branchId === bid);
        return perm ? canDo(perm.role, action) : false;
      },
    }),
    { name: "mtj-branch-v1" },
  ),
);

/** Convenience hook: returns currentBranchId for store queries */
export function useCurrentBranchId(): string {
  return useBranch((s) => s.currentBranchId);
}
