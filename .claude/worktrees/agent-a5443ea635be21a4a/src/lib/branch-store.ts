/**
 * MTJ ERP — Multi-Branch Store
 *
 * Three independent business units:
 *   BRANCH_RETAIL_ICH  — MTJ Retail, Ichalkaranji
 *   BRANCH_MFG_ICH     — MTJ Manufacturing, Ichalkaranji
 *   BRANCH_MFG_GKP     — MTJ Manufacturing, Gorakhpur
 *
 * Every data record should carry a branchId.
 * RLS in Supabase enforces isolation server-side.
 * Client-side: all store queries must filter by useBranch().currentBranchId.
 *
 * To add a fourth branch: insert a new Branch record — no code changes needed.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export const BRANCHES: Branch[] = [
  {
    id: "branch_retail_ich",
    name: "MTJ Retail — Ichalkaranji",
    shortName: "Retail ICH",
    type: "retail",
    city: "Ichalkaranji",
    state: "Maharashtra",
    invoicePrefix: "RET-",
    barcodePrefix: "R",
    active: true,
  },
  {
    id: "branch_mfg_ich",
    name: "MTJ Manufacturing — Ichalkaranji",
    shortName: "Mfg ICH",
    type: "manufacturing",
    city: "Ichalkaranji",
    state: "Maharashtra",
    invoicePrefix: "MFG-",
    barcodePrefix: "M",
    active: true,
  },
  {
    id: "branch_mfg_gkp",
    name: "MTJ Manufacturing — Gorakhpur",
    shortName: "Mfg GKP",
    type: "manufacturing",
    city: "Gorakhpur",
    state: "Uttar Pradesh",
    invoicePrefix: "GKP-",
    barcodePrefix: "G",
    active: true,
  },
];

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
  setAccessible(ids: string[], permissions: BranchPermission[]): void;
  getCurrentBranch(): Branch | undefined;
  getAccessibleBranches(): Branch[];
  hasAccess(branchId: string): boolean;
  canDoAction(action: string, branchId?: string): boolean;
}

export const useBranch = create<BranchState>()(
  persist(
    (set, get) => ({
      currentBranchId: BRANCHES[0].id,
      accessibleBranchIds: BRANCHES.map((b) => b.id), // default: all (single-user mode)
      userPermissions: BRANCHES.map((b) => ({
        branchId: b.id,
        role: "branch_manager" as UserRole,
      })),
      isGlobalAccess: true, // default true until Supabase auth is wired up

      setCurrent(branchId) {
        const accessible = get().accessibleBranchIds;
        if (accessible.includes(branchId) || get().isGlobalAccess) {
          set({ currentBranchId: branchId });
        }
      },

      setAccessible(ids, permissions) {
        set({ accessibleBranchIds: ids, userPermissions: permissions });
        // If current branch is no longer accessible, switch to first accessible
        if (!ids.includes(get().currentBranchId)) {
          set({ currentBranchId: ids[0] ?? BRANCHES[0].id });
        }
      },

      getCurrentBranch() {
        return BRANCHES.find((b) => b.id === get().currentBranchId);
      },

      getAccessibleBranches() {
        const ids = get().accessibleBranchIds;
        return BRANCHES.filter((b) => b.active && ids.includes(b.id));
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
