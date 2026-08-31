/**
 * Ornexa QA tenant fixtures — Tenant A / Tenant B with branches and role users.
 * Seeded via qa/scripts/seed-qa-tenants.mjs against TEST/STAGING Supabase only.
 */
export const QA_RUN_TAG_PREFIX = "qa-run:";

export const QA_TENANTS = {
  firmA: { id: "qa-firm-a", name: "QA Firm Alpha", slug: "qa-firm-alpha" },
  firmB: { id: "qa-firm-b", name: "QA Firm Beta", slug: "qa-firm-beta" },
} as const;

export const QA_BRANCHES = {
  a1: { id: "qa-branch-a1", firmId: QA_TENANTS.firmA.id, name: "Alpha Main" },
  a2: { id: "qa-branch-a2", firmId: QA_TENANTS.firmA.id, name: "Alpha Workshop" },
} as const;

export const QA_ROLES = [
  "owner",
  "admin",
  "ceo",
  "manager",
  "accounts",
  "inventory",
  "production",
  "qc",
  "karigar",
  "customer",
  "supplier",
] as const;

export type QaRole = (typeof QA_ROLES)[number];

export interface QaUserFixture {
  email: string;
  role: QaRole;
  firmId: string;
  branchId?: string;
  portal?: "erp" | "customer" | "karigar" | "supplier" | "ceo";
}

/** Env-backed credentials — never hardcode passwords in repo. */
export function getQaUser(role: QaRole, firm: "A" | "B" = "A"): QaUserFixture | null {
  const prefix = firm === "A" ? "QA_" : "QA_B_";
  const email = process.env[`${prefix}${role.toUpperCase()}_EMAIL`];
  if (!email) return null;
  return {
    email,
    role,
    firmId: firm === "A" ? QA_TENANTS.firmA.id : QA_TENANTS.firmB.id,
    branchId: firm === "A" ? QA_BRANCHES.a1.id : undefined,
  };
}

export function qaRecordTag(runId: string): string {
  return `${QA_RUN_TAG_PREFIX}${runId}`;
}
