/**
 * AVS ERP — Manufacturing RBAC & Approval Security Engine
 *
 * Comprehensive Role-Based Access Control (RBAC), Approval Workflow, and Data-Access Architecture:
 * - 24 Dedicated Manufacturing Roles
 * - Granular Permissions: Module -> View, Create, Edit, Delete/Void, Post, Approve, Reverse, Export, Print, Assign, Finalize
 * - Field-Level Security: Internal Cost, Supplier Cost, Gross Margin, Internal Karigar Notes, Gold Balances
 * - Maker-Checker Enforcement: Creator cannot self-approve sensitive high-risk transactions
 * - Dual Approval & Thresholds (both Currency Amount in INR and Gold Fine Weight in grams)
 * - Temporary Permissions with auto-expiration
 * - Controlled Emergency Audited Overrides
 * - Isolated Context: Manufacturing staff cannot bypass to Retail CRM/Store data
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ManufacturingRole =
  | "manufacturing_super_admin"
  | "manufacturing_manager"
  | "production_manager"
  | "production_operator"
  | "inventory_manager"
  | "inventory_operator"
  | "karigar_manager"
  | "karigar_operator"
  | "karigar_settlement_officer"
  | "quality_control"
  | "hallmark_compliance_operator"
  | "barcode_nfc_operator"
  | "manufacturing_sales_commercial"
  | "manufacturing_accounts"
  | "payroll_officer"
  | "owner_finance_approver"
  | "owner_transaction_user"
  | "expense_user"
  | "delivery_operator"
  | "manufacturing_customer_service"
  | "manufacturing_customer_portal_admin"
  | "reporting_analytics_user"
  | "auditor_readonly_admin"
  | "system_administrator";

export type SecurityModule =
  | "production"
  | "inventory"
  | "karigar_transactions"
  | "karigar_settlement"
  | "hallmark_huid"
  | "barcode_nfc"
  | "owner_transactions"
  | "payroll"
  | "accounting_ledger"
  | "customer_service"
  | "portal_config"
  | "system_admin";

export type SecurityAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "post"
  | "approve"
  | "reverse"
  | "export"
  | "print"
  | "assign"
  | "finalize";

export type SensitiveField =
  | "internal_cost"
  | "supplier_cost"
  | "gross_margin"
  | "internal_karigar_notes"
  | "gold_balances";

export interface TemporaryPermissionGrant {
  id: string;
  userId: string;
  module: SecurityModule;
  action: SecurityAction;
  grantedBy: string;
  reason: string;
  expiresAt: string;
}

export interface EmergencyAccessLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  recordType: string;
  recordId: string;
  reason: string;
  timestamp: string;
}

export interface ApprovalThresholdConfig {
  maxAutoApprovalAmountPaise: number; // e.g. 50,000 INR
  managerMaxApprovalAmountPaise: number; // e.g. 5,00,000 INR
  ownerApprovalRequiredAbovePaise: number; // e.g. > 5,00,000 INR
  managerMaxGoldWeightGrams: number; // e.g. 50g
  ownerApprovalRequiredAboveGoldGrams: number; // e.g. > 50g
}

export interface ApprovalRequestRecord {
  id: string;
  transactionType: "karigar_settlement" | "over_loss" | "gold_adjustment" | "owner_withdrawal" | "discount_override";
  recordId: string;
  requestedByUserId: string;
  requestedByUserName: string;
  amountPaise?: number;
  fineGoldWeightGrams?: number;
  details: string;
  status: "pending" | "approved" | "rejected";
  firstApproverId?: string;
  firstApproverRole?: ManufacturingRole;
  secondApproverId?: string;
  secondApproverRole?: ManufacturingRole;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface ManufacturingRbacState {
  approvalThresholds: ApprovalThresholdConfig;
  temporaryGrants: TemporaryPermissionGrant[];
  emergencyLogs: EmergencyAccessLog[];
  approvalRequests: ApprovalRequestRecord[];

  // RBAC Engine methods
  canAccessModule: (role: ManufacturingRole, module: SecurityModule) => boolean;
  hasPermission: (
    role: ManufacturingRole,
    module: SecurityModule,
    action: SecurityAction,
    userId?: string,
  ) => boolean;
  canViewSensitiveField: (role: ManufacturingRole, field: SensitiveField) => boolean;
  requiresOwnerApproval: (amountPaise?: number, goldWeightGrams?: number) => boolean;
  createApprovalRequest: (input: {
    transactionType: ApprovalRequestRecord["transactionType"];
    recordId: string;
    requestedByUserId: string;
    requestedByUserName: string;
    amountPaise?: number;
    fineGoldWeightGrams?: number;
    details: string;
  }) => ApprovalRequestRecord;
  approveRequest: (
    requestId: string,
    approverUserId: string,
    approverRole: ManufacturingRole,
  ) => { approved: boolean; fullyApproved: boolean; error?: string };
  rejectRequest: (
    requestId: string,
    rejecterUserId: string,
    reason: string,
  ) => void;
  grantTemporaryPermission: (grant: Omit<TemporaryPermissionGrant, "id">) => TemporaryPermissionGrant;
  logEmergencyAccess: (log: Omit<EmergencyAccessLog, "id" | "timestamp">) => EmergencyAccessLog;
}

/**
 * Base Matrix defining allowed actions for each manufacturing role
 */
const ROLE_PERMISSIONS_MAP: Record<ManufacturingRole, Partial<Record<SecurityModule, SecurityAction[]>>> = {
  manufacturing_super_admin: {
    production: ["view", "create", "edit", "delete", "post", "approve", "reverse", "export", "print", "assign", "finalize"],
    inventory: ["view", "create", "edit", "delete", "post", "approve", "reverse", "export", "print", "assign", "finalize"],
    karigar_transactions: ["view", "create", "edit", "delete", "post", "approve", "reverse", "export", "print", "assign", "finalize"],
    karigar_settlement: ["view", "create", "edit", "delete", "post", "approve", "reverse", "export", "print", "assign", "finalize"],
    hallmark_huid: ["view", "create", "edit", "delete", "post", "approve", "reverse", "export", "print", "assign", "finalize"],
    barcode_nfc: ["view", "create", "edit", "delete", "post", "approve", "reverse", "export", "print", "assign", "finalize"],
    owner_transactions: ["view", "create", "edit", "post", "approve", "reverse", "export", "print", "finalize"],
    payroll: ["view", "create", "edit", "post", "approve", "export", "print", "finalize"],
    accounting_ledger: ["view", "create", "edit", "post", "approve", "reverse", "export", "print", "finalize"],
    customer_service: ["view", "create", "edit", "export", "print", "assign", "finalize"],
    portal_config: ["view", "create", "edit", "delete", "post", "approve", "export"],
    system_admin: ["view", "create", "edit", "delete", "post", "approve", "export", "assign"],
  },
  manufacturing_manager: {
    production: ["view", "create", "edit", "post", "approve", "export", "print", "assign", "finalize"],
    inventory: ["view", "create", "edit", "post", "approve", "export", "print", "assign", "finalize"],
    karigar_transactions: ["view", "create", "edit", "post", "approve", "export", "print", "assign", "finalize"],
    karigar_settlement: ["view", "create", "edit", "post", "approve", "export", "print", "finalize"],
    hallmark_huid: ["view", "create", "edit", "post", "approve", "export", "print", "finalize"],
    barcode_nfc: ["view", "create", "edit", "post", "approve", "export", "print", "finalize"],
    owner_transactions: ["view"],
    accounting_ledger: ["view", "print", "export"],
    customer_service: ["view", "create", "edit", "assign", "finalize"],
  },
  production_manager: {
    production: ["view", "create", "edit", "post", "approve", "export", "print", "assign", "finalize"],
    barcode_nfc: ["view", "create", "print"],
    inventory: ["view", "create", "post"],
    hallmark_huid: ["view", "create"],
  },
  production_operator: {
    production: ["view", "create", "edit", "print"],
    barcode_nfc: ["view", "print"],
  },
  inventory_manager: {
    inventory: ["view", "create", "edit", "post", "approve", "export", "print", "assign", "finalize"],
    barcode_nfc: ["view", "create", "edit", "print", "finalize"],
  },
  inventory_operator: {
    inventory: ["view", "create", "edit", "print"],
    barcode_nfc: ["view", "print"],
  },
  karigar_manager: {
    karigar_transactions: ["view", "create", "edit", "post", "approve", "export", "print", "assign", "finalize"],
    karigar_settlement: ["view", "create", "edit", "post", "print"],
  },
  karigar_operator: {
    karigar_transactions: ["view", "create", "edit", "print"],
  },
  karigar_settlement_officer: {
    karigar_transactions: ["view", "print"],
    karigar_settlement: ["view", "create", "edit", "post", "print", "finalize"],
  },
  quality_control: {
    production: ["view", "edit", "approve", "finalize"],
    hallmark_huid: ["view"],
  },
  hallmark_compliance_operator: {
    hallmark_huid: ["view", "create", "edit", "post", "print", "finalize"],
    production: ["view"],
  },
  barcode_nfc_operator: {
    barcode_nfc: ["view", "create", "edit", "post", "print", "finalize"],
    inventory: ["view"],
    production: ["view"],
  },
  manufacturing_sales_commercial: {
    production: ["view", "create", "print"],
    customer_service: ["view", "create", "edit", "print"],
  },
  manufacturing_accounts: {
    accounting_ledger: ["view", "create", "edit", "post", "reverse", "export", "print", "finalize"],
    karigar_settlement: ["view", "post", "print"],
    owner_transactions: ["view", "create", "print"],
  },
  payroll_officer: {
    payroll: ["view", "create", "edit", "post", "approve", "export", "print", "finalize"],
  },
  owner_finance_approver: {
    owner_transactions: ["view", "create", "edit", "post", "approve", "reverse", "export", "print", "finalize"],
    karigar_settlement: ["view", "approve", "reverse", "finalize"],
    inventory: ["view", "approve", "reverse"],
    accounting_ledger: ["view", "approve", "reverse", "export", "print"],
    payroll: ["view", "approve"],
  },
  owner_transaction_user: {
    owner_transactions: ["view", "create", "edit", "print"],
  },
  expense_user: {
    accounting_ledger: ["view", "create", "print"],
  },
  delivery_operator: {
    production: ["view", "finalize"],
    barcode_nfc: ["view"],
  },
  manufacturing_customer_service: {
    customer_service: ["view", "create", "edit", "print", "finalize"],
    production: ["view"],
  },
  manufacturing_customer_portal_admin: {
    portal_config: ["view", "create", "edit", "post", "approve"],
    customer_service: ["view", "export"],
  },
  reporting_analytics_user: {
    production: ["view", "export", "print"],
    inventory: ["view", "export", "print"],
    karigar_transactions: ["view", "export", "print"],
    karigar_settlement: ["view", "export", "print"],
    accounting_ledger: ["view", "export", "print"],
  },
  auditor_readonly_admin: {
    production: ["view", "export", "print"],
    inventory: ["view", "export", "print"],
    karigar_transactions: ["view", "export", "print"],
    karigar_settlement: ["view", "export", "print"],
    accounting_ledger: ["view", "export", "print"],
    payroll: ["view", "export", "print"],
    owner_transactions: ["view", "export", "print"],
    system_admin: ["view", "export"],
  },
  system_administrator: {
    system_admin: ["view", "create", "edit", "delete", "post", "export", "assign"],
    portal_config: ["view", "edit"],
  },
};

export const useManufacturingRbacStore = create<ManufacturingRbacState>()(
  persist(
    (set, get) => ({
      approvalThresholds: {
        maxAutoApprovalAmountPaise: 5000000, // ₹50,000
        managerMaxApprovalAmountPaise: 50000000, // ₹5,00,000
        ownerApprovalRequiredAbovePaise: 50000000, // > ₹5,00,000
        managerMaxGoldWeightGrams: 50, // 50g
        ownerApprovalRequiredAboveGoldGrams: 50, // > 50g
      },
      temporaryGrants: [],
      emergencyLogs: [],
      approvalRequests: [],

      canAccessModule: (role, module) => {
        const roleConfig = ROLE_PERMISSIONS_MAP[role];
        return !!roleConfig && !!roleConfig[module] && (roleConfig[module]?.length ?? 0) > 0;
      },

      hasPermission: (role, module, action, userId) => {
        // 1. Check permanent role permissions
        const roleConfig = ROLE_PERMISSIONS_MAP[role];
        const allowedActions = roleConfig?.[module] || [];
        if (allowedActions.includes(action)) return true;

        // 2. Check active temporary grants
        if (userId) {
          const now = new Date().toISOString();
          const hasTemp = get().temporaryGrants.some(
            (g) =>
              g.userId === userId &&
              g.module === module &&
              g.action === action &&
              g.expiresAt > now,
          );
          if (hasTemp) return true;
        }

        return false;
      },

      canViewSensitiveField: (role, field) => {
        if (role === "manufacturing_super_admin") return true;

        switch (field) {
          case "internal_cost":
            return ["owner_finance_approver", "manufacturing_accounts"].includes(role);
          case "supplier_cost":
            return ["owner_finance_approver", "manufacturing_accounts", "manufacturing_manager"].includes(role);
          case "gross_margin":
            return ["owner_finance_approver", "manufacturing_accounts"].includes(role);
          case "internal_karigar_notes":
            return ["karigar_manager", "manufacturing_manager", "karigar_settlement_officer"].includes(role);
          case "gold_balances":
            return [
              "manufacturing_manager",
              "inventory_manager",
              "karigar_manager",
              "karigar_settlement_officer",
              "manufacturing_accounts",
              "owner_finance_approver",
            ].includes(role);
          default:
            return false;
        }
      },

      requiresOwnerApproval: (amountPaise = 0, goldWeightGrams = 0) => {
        const { ownerApprovalRequiredAbovePaise, ownerApprovalRequiredAboveGoldGrams } = get().approvalThresholds;
        return (
          amountPaise > ownerApprovalRequiredAbovePaise ||
          goldWeightGrams > ownerApprovalRequiredAboveGoldGrams
        );
      },

      createApprovalRequest: (input) => {
        const newReq: ApprovalRequestRecord = {
          id: `appr-${Date.now()}`,
          transactionType: input.transactionType,
          recordId: input.recordId,
          requestedByUserId: input.requestedByUserId,
          requestedByUserName: input.requestedByUserName,
          amountPaise: input.amountPaise,
          fineGoldWeightGrams: input.fineGoldWeightGrams,
          details: input.details,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((s) => ({
          approvalRequests: [newReq, ...s.approvalRequests],
        }));

        return newReq;
      },

      approveRequest: (requestId, approverUserId, approverRole) => {
        const req = get().approvalRequests.find((r) => r.id === requestId);
        if (!req) return { approved: false, fullyApproved: false, error: "Request not found." };

        // Maker-Checker enforcement: Creator cannot approve their own high-risk request
        if (req.requestedByUserId === approverUserId) {
          return {
            approved: false,
            fullyApproved: false,
            error: "Maker-Checker Violation: You cannot approve your own transaction request.",
          };
        }

        const isOwnerApprovalNeeded = get().requiresOwnerApproval(
          req.amountPaise,
          req.fineGoldWeightGrams,
        );

        let fullyApproved = false;

        if (isOwnerApprovalNeeded) {
          // Dual or Owner-only approval required
          if (approverRole === "owner_finance_approver" || approverRole === "manufacturing_super_admin") {
            fullyApproved = true;
          } else {
            // Partial approval by manager, awaiting final owner approval
            fullyApproved = false;
          }
        } else {
          // Standard manager level approval sufficient
          fullyApproved = true;
        }

        set((s) => ({
          approvalRequests: s.approvalRequests.map((r) => {
            if (r.id !== requestId) return r;
            if (!r.firstApproverId) {
              return {
                ...r,
                firstApproverId: approverUserId,
                firstApproverRole: approverRole,
                status: fullyApproved ? "approved" : "pending",
                updatedAt: new Date().toISOString(),
              };
            }
            return {
              ...r,
              secondApproverId: approverUserId,
              secondApproverRole: approverRole,
              status: "approved",
              updatedAt: new Date().toISOString(),
            };
          }),
        }));

        return { approved: true, fullyApproved };
      },

      rejectRequest: (requestId, _rejecterUserId, reason) => {
        set((s) => ({
          approvalRequests: s.approvalRequests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "rejected",
                  rejectionReason: reason,
                  updatedAt: new Date().toISOString(),
                }
              : r,
          ),
        }));
      },

      grantTemporaryPermission: (grant) => {
        const newGrant: TemporaryPermissionGrant = {
          id: `temp-${Date.now()}`,
          ...grant,
        };
        set((s) => ({
          temporaryGrants: [...s.temporaryGrants, newGrant],
        }));
        return newGrant;
      },

      logEmergencyAccess: (log) => {
        const newLog: EmergencyAccessLog = {
          id: `emerg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...log,
        };
        set((s) => ({
          emergencyLogs: [...s.emergencyLogs, newLog],
        }));
        return newLog;
      },
    }),
    {
      name: "avs_manufacturing_rbac_store_v1",
    },
  ),
);
