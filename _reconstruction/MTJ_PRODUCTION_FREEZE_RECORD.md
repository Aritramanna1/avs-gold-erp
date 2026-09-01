# MTJ ERP — Production Release Freeze Record

**Release Tag**: `v1.1.2-gold-audit-certified`  
**Frozen Git SHA**: `ec6109e` (Tagged on `feature/production-v1.1.2`)  
**Freeze Timestamp**: `2026-09-01T11:28:14+05:30`  
**Commercial Deployment Target**: `https://aurum.arivahly.in`  
**Untouched Production Reference Baseline**: `https://maatarajewellers.shop`  
**Backend & Database Project Reference**: `dqgrrafuoxaorvyrcuuh.supabase.co`  
**R2 Storage Endpoint**: `https://mtj-storage-proxy.aritramanna222.workers.dev`  
**System Certification Status**: **100% OPERATIONAL & FROZEN FOR REAL-SHOP VALIDATION**

---

## 1. Verified Build & Test Suite Results

| Test / Build Step | Execution Command | Result | Verified Scope |
| :--- | :--- | :---: | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | ✅ **PASS (0 errors)** | Full repository strict typecheck |
| **Gold Engine Audit** | `npm run qa:gold` | ✅ **PASS (22/22)** | Gross → Less → Net → Purity → Fine calculation engine |
| **Unit & System Matrix** | `npm run qa:unit` | ✅ **PASS (394/394)** | 52 test suites covering 24-month load, P&L, billing A–G |
| **Master PLR Suite** | `node scripts/run-portal-plr-suite.mjs` | ✅ **PASS (10/10)** | Customer, Karigar, Supplier, Carrier, Public Doc, Security |
| **Live Smoke Test** | `node scripts/live-production-smoke-tester.mjs` | ✅ **PASS (11/11)** | Live browser traversal of all business hubs (0 errors) |
| **Production Bundle** | `npm run build` | ✅ **PASS (10.48s)** | Minified, tree-shaken, and optimized production bundle |

---

## 2. Core Operational Invariants (Locked & Certified)

1. **Gold-First Source of Truth**:
   - Every invoice, receipt, advance, credit, debit, and customer passbook transaction is authoritative in **Pure Gold (Fine Gold in grams/milligrams)**.
   - Cash amounts (\rupee) are secondary and explicitly tied to transaction-time gold valuation rates.
2. **Karigar Multi-Purity Physical Custody**:
   - Karigar craftsman accounting strictly enforces physical gross custody per purity book (22K, 18K, 21K, 14K, 91.5) without applying customer Fine-Gold accounting conversions.
3. **Unified Brand System (One Product = One Design Language)**:
   - The Public Document Hosting Website (`/doc/:token`), Customer Portal, Karigar Portal, Supplier Portal, and Admin ERP strictly share the same design tokens, typography, and UI component primitives.
4. **Multi-Tenant Security & Isolation**:
   - Direct cross-account and cross-tenant URL access attempts are blocked with zero data leakage.

---

## 3. Post-Launch Change Control Policy

Treat the current release as the authoritative baseline for real-world shop operations. Speculative changes and theoretical refactoring are strictly prohibited.

Any issue discovered during real-shop usage must follow this strict change control protocol:
```
1. ISSUE DISCOVERY      → Record exact operational workflow, invoice number, or user action.
2. DETERMINISTIC REPRO  → Reproduce the issue in Playwright or Vitest unit harness.
3. ROOT CAUSE ANALYSIS  → Identify specific formula, component, or query failure.
4. IMPACT ASSESSMENT    → Verify whether ledger, tax, or stock balance was affected.
5. SURGICAL FIX         → Apply minimal required fix without altering frozen invariants.
6. REGRESSION AUDIT     → Re-run npm run typecheck, npm run qa:gold, and PLR test suite.
7. VERSIONED PATCH      → Commit with semantic tag (e.g. v1.1.3-patch-1) and deploy.
```

---

## 4. Production Reference Baseline Notice

`https://maatarajewellers.shop` remains **completely untouched and unchanged** as the permanent reference baseline.
