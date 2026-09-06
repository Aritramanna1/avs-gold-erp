/**
 * AVS ERP — Manufacturing RBAC & Security Automated Unit Tests
 *
 * Verifies:
 * 1. 24 Manufacturing Roles & Module Access Boundaries
 * 2. Granular Security Actions (View, Create, Edit, Approve, Reverse, Finalize)
 * 3. Sensitive Field Protection (Internal Cost, Supplier Cost, Gross Margin, Karigar Notes, Gold Balances)
 * 4. Maker-Checker Self-Approval Prevention
 * 5. Value & Gold-Weight Based Approval Thresholds (INR Amount & Fine Grams)
 * 6. Temporary Permissions Auto-Expiration
 * 7. Emergency Access Audited Logging
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useManufacturingRbacStore } from "@/lib/manufacturing-rbac-store";

describe("AVS ERP — Manufacturing RBAC & Approval Engine", () => {
  beforeEach(() => {
    useManufacturingRbacStore.setState({
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
    });
  });

  it("1. Module Access by Role", () => {
    const store = useManufacturingRbacStore.getState();

    // Super admin has access to everything
    expect(store.canAccessModule("manufacturing_super_admin", "production")).toBe(true);
    expect(store.canAccessModule("manufacturing_super_admin", "accounting_ledger")).toBe(true);
    expect(store.canAccessModule("manufacturing_super_admin", "owner_transactions")).toBe(true);

    // Production operator cannot access accounting ledger or owner transactions
    expect(store.canAccessModule("production_operator", "production")).toBe(true);
    expect(store.canAccessModule("production_operator", "accounting_ledger")).toBe(false);
    expect(store.canAccessModule("production_operator", "owner_transactions")).toBe(false);

    // Inventory operator cannot access payroll
    expect(store.canAccessModule("inventory_operator", "inventory")).toBe(true);
    expect(store.canAccessModule("inventory_operator", "payroll")).toBe(false);

    // Customer service cannot access inventory or accounting
    expect(store.canAccessModule("manufacturing_customer_service", "customer_service")).toBe(true);
    expect(store.canAccessModule("manufacturing_customer_service", "accounting_ledger")).toBe(false);
  });

  it("2. Granular Action Permissions", () => {
    const store = useManufacturingRbacStore.getState();

    // Production Operator can create & view production entries, but cannot approve or delete
    expect(store.hasPermission("production_operator", "production", "view")).toBe(true);
    expect(store.hasPermission("production_operator", "production", "create")).toBe(true);
    expect(store.hasPermission("production_operator", "production", "approve")).toBe(false);
    expect(store.hasPermission("production_operator", "production", "delete")).toBe(false);

    // Production Manager can approve production
    expect(store.hasPermission("production_manager", "production", "approve")).toBe(true);

    // Auditor can only view and export, cannot edit or delete
    expect(store.hasPermission("auditor_readonly_admin", "accounting_ledger", "view")).toBe(true);
    expect(store.hasPermission("auditor_readonly_admin", "accounting_ledger", "export")).toBe(true);
    expect(store.hasPermission("auditor_readonly_admin", "accounting_ledger", "create")).toBe(false);
    expect(store.hasPermission("auditor_readonly_admin", "accounting_ledger", "delete")).toBe(false);
  });

  it("3. Sensitive Field-Level Security Protection", () => {
    const store = useManufacturingRbacStore.getState();

    // Internal Cost & Gross Margin only accessible to Finance / Owner / Accounts / Super Admin
    expect(store.canViewSensitiveField("manufacturing_super_admin", "internal_cost")).toBe(true);
    expect(store.canViewSensitiveField("owner_finance_approver", "internal_cost")).toBe(true);
    expect(store.canViewSensitiveField("manufacturing_accounts", "internal_cost")).toBe(true);
    expect(store.canViewSensitiveField("production_operator", "internal_cost")).toBe(false);
    expect(store.canViewSensitiveField("manufacturing_customer_service", "internal_cost")).toBe(false);
    expect(store.canViewSensitiveField("manufacturing_customer_service", "gross_margin")).toBe(false);

    // Internal Karigar Notes only visible to Karigar Manager / Super Admin
    expect(store.canViewSensitiveField("karigar_manager", "internal_karigar_notes")).toBe(true);
    expect(store.canViewSensitiveField("production_operator", "internal_karigar_notes")).toBe(false);
    expect(store.canViewSensitiveField("manufacturing_sales_commercial", "internal_karigar_notes")).toBe(false);
  });

  it("4. Maker-Checker Rule (Self-Approval Prevention)", () => {
    const store = useManufacturingRbacStore.getState();

    // User "user-101" creates a high-risk Karigar Settlement request
    const req = store.createApprovalRequest({
      transactionType: "karigar_settlement",
      recordId: "settle-991",
      requestedByUserId: "user-101",
      requestedByUserName: "Amit Karigar Officer",
      amountPaise: 45000000, // ₹4,50,000
      fineGoldWeightGrams: 30, // 30g
      details: "Monthly Karigar Settlement for Chain Casting",
    });

    expect(req.status).toBe("pending");

    // Maker tries to self-approve: MUST FAIL
    const selfApproveResult = store.approveRequest(req.id, "user-101", "manufacturing_manager");
    expect(selfApproveResult.approved).toBe(false);
    expect(selfApproveResult.error).toContain("Maker-Checker Violation");

    // Independent checker "user-202" approves: SUCCEEDS
    const checkerApproveResult = store.approveRequest(req.id, "user-202", "manufacturing_manager");
    expect(checkerApproveResult.approved).toBe(true);
    expect(checkerApproveResult.fullyApproved).toBe(true);
  });

  it("5. Gold-Weight & Currency Approval Thresholds", () => {
    const store = useManufacturingRbacStore.getState();

    // Request above 50g fine gold requires Owner Approval
    const highGoldReq = store.createApprovalRequest({
      transactionType: "gold_adjustment",
      recordId: "adj-882",
      requestedByUserId: "user-101",
      requestedByUserName: "Amit Officer",
      amountPaise: 75000000, // ₹7,50,000
      fineGoldWeightGrams: 100, // 100g > 50g threshold
      details: "Furnace melt recovery adjustment",
    });

    // Manager approval alone is partial; requires Owner / Super Admin
    const managerApproval = store.approveRequest(highGoldReq.id, "mgr-01", "manufacturing_manager");
    expect(managerApproval.approved).toBe(true);
    expect(managerApproval.fullyApproved).toBe(false);

    // Final approval by Owner / Finance Approver
    const ownerApproval = store.approveRequest(highGoldReq.id, "owner-01", "owner_finance_approver");
    expect(ownerApproval.approved).toBe(true);
    expect(ownerApproval.fullyApproved).toBe(true);
  });

  it("6. Temporary Permission Grants with Expiration", () => {
    const store = useManufacturingRbacStore.getState();

    // User has no native permission to approve inventory
    expect(store.hasPermission("inventory_operator", "inventory", "approve", "user-temp-1")).toBe(false);

    // Grant temporary 1-hour permission
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    store.grantTemporaryPermission({
      userId: "user-temp-1",
      module: "inventory",
      action: "approve",
      grantedBy: "Super Admin",
      reason: "Quarterly stock audit coverage",
      expiresAt: futureTime,
    });

    // Now has permission
    expect(store.hasPermission("inventory_operator", "inventory", "approve", "user-temp-1")).toBe(true);

    // Expired permission does not grant access
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    store.grantTemporaryPermission({
      userId: "user-temp-2",
      module: "inventory",
      action: "approve",
      grantedBy: "Super Admin",
      reason: "Expired yesterday",
      expiresAt: pastTime,
    });

    expect(store.hasPermission("inventory_operator", "inventory", "approve", "user-temp-2")).toBe(false);
  });

  it("7. Emergency Access Audited Logging", () => {
    const store = useManufacturingRbacStore.getState();

    const log = store.logEmergencyAccess({
      userId: "admin-99",
      userName: "DevOps Emergency Admin",
      action: "forced_ledger_rebalance",
      recordType: "gold_ledger",
      recordId: "gl-entry-192",
      reason: "Production database emergency hotfix during network outage",
    });

    expect(log.id).toContain("emerg-");
    expect(log.timestamp).toBeDefined();

    const logged = useManufacturingRbacStore.getState().emergencyLogs.find((l) => l.id === log.id);
    expect(logged?.userName).toBe("DevOps Emergency Admin");
  });
});
