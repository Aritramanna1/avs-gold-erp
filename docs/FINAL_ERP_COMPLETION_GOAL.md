# ORNEXA — MASTER IMPLEMENTATION & COMPLETION DIRECTIVE
**Authoritative Operational Directive for Complete Jwelly Capability Parity, Customization Rebuild, and Full ERP Implementation**
*Source: Canonical Documentation Suite (`docs/MASTER/*`)*
*Status: READY FOR AUTONOMOUS EXECUTION*

---

## 1. Single Master Execution Prompt for AI / Coding Agent

Copy and execute the following single master prompt to start complete ERP implementation:

```markdown
/goal COMPLETE JWELLY REFERENCE AUDIT + EMBED JEWELLERY BASICS INTO ORNEXA + REBUILD CUSTOMIZATION & SETTINGS ARCHITECTURE

You are working on the ORNEXA Jewellery Manufacturing ERP.

The architectural audit, capability extraction, and canonical master documentation suite are 100% complete, reconciled, and co-located in `docs/MASTER/`.

Your task is to IMPLEMENT the complete Ornexa ERP strictly according to the canonical documentation without deviating, inventing ad-hoc scope, or forking the codebase.

---

### Core Operating Principles & Permanent Rules:
1. **ONE PLATFORM. DIFFERENT COMMERCIAL ENTITLEMENTS. ONE AUTHORITATIVE DATA SOURCE. NO PRODUCT FORKS.** All tenants run on the single Supabase (PostgreSQL 15+, RLS, online-only) database.
2. **JWELLY IS A REFERENCE BENCHMARK; ORNEXA IS THE MODERN IMPLEMENTATION.** We extract mature capabilities without copying obsolete Windows forms, source code, branding, or local database sprawl. Consolidate into 8 universal engines: Masters, Transactions, Ledgers, Books, Reports, Customization, Documents, and Migration.
3. **SETTINGS CONFIGURES THE SYSTEM; CUSTOMIZATION ADAPTS THE BUSINESS.** Customization is a top-level workspace (`/control/customization`) with 11 organized categories. Terminology, custom dropdowns, dynamic forms, making charge rules, workflows, document templates, print profiles, and portal layouts belong under Customization.
4. **NO EMOJIS. NO AI SLOP. PROFESSIONAL JEWELLERY ERP IDENTITY.** Centralized low-radius (0–6px) design tokens, dense data tables (32px rows), keyboard-first power entry, and serious business ergonomics. No giant bubble cards, emoji icons, or fake AI gradient fluff.
5. **DEVICE ACCESS IS AN ENTITLEMENT:** Basic (1: Web/Desktop), Growth (1: Web/Desktop/Mobile), Pro (2 choices), Scale (2 choices), Max (all 3). Enforce server-side at auth/session gateway layer.
6. **1 BRANCH BASE IN EVERY PLAN:** All 5 base plans include 1 branch by default; additional branches are separate licensed add-ons (`ADDON_BRANCH_EXTRA`).
7. **NO HARDCODED PRICING:** All prices, AMC rates, setup fees, and quotas are configured dynamically in Platform Owner (`/platform/plans`).
8. **RETAIL FINANCIAL PRODUCTS FROZEN:** Do NOT implement Gold Savings Schemes, Girvi Pawn Loans, or Loyalty Points now. Keep them deferred as documented in `docs/MASTER/FUTURE_ROADMAP.md`.
9. **LOCALIZATION READY NOW, TRANSLATE LAST:** All components must use translation keys (`t('...')`) with zero hardcoded UI strings. Full vernacular language translation takes place at the final phase (Phase 7).
10. **INTERACTIVE TUTORIAL & PRACTICE MODE:** Implement role/mode-aware interactive tutorials, the 18-step Manufacturing Master Tutorial, the Training Centre (`/help`), and an isolated practice demo sandbox (`is_demo = true`).

---

### Master Specifications Index (Source of Truth):

Review and strictly adhere to the canonical documentation in `docs/MASTER/`:
- **Master Maps & Topology:** `ORNEXA_FULL_ERP_A_TO_Z_MAP.md`, `ORNEXA_MASTER_ARCHITECTURE_MAP.md`
- **Jwelly Reference, Gaps & Mandatory Baseline:** `JWELLY_REFERENCE_MASTER.md`, `JWELLY_TO_ORNEXA_GAP_MATRIX.md`, `JEWELLERY_INDUSTRY_BASELINE_MATRIX.md`
- **Customization & Configuration:** `CUSTOMIZATION_MASTER.md`, `CUSTOM_FIELDS_AND_FORMS_MASTER.md`, `DROPDOWN_AND_MASTER_ENGINE.md`, `CALCULATION_AND_RULE_ENGINE.md`, `WORKFLOW_CUSTOMIZATION_MASTER.md`, `JEWELLERY_TERMINOLOGY_MASTER.md`, `BUSINESS_PROFILE_ENGINE.md`, `SETTINGS_MASTER.md`
- **Commercial & Plans:** `BUSINESS_PRODUCT_AND_ENTITLEMENT_MASTER.md`, `DEVICE_ACCESS_MASTER.md`, `PLAN_BUILDER_MASTER.md`, `SAAS_ENTITLEMENT_AND_BILLING.md`, `TENANT_360_MASTER.md`
- **Onboarding, Tutorials & Learning:** `ONBOARDING_MASTER.md`, `ONBOARDING_AND_TUTORIAL_MASTER.md`, `TRAINING_CENTRE_MASTER.md`, `ADAPTIVE_TUTORIAL_MASTER.md`, `LOCALIZATION_MASTER.md`, `OPENING_BALANCE_AND_MIGRATION_MASTER.md`
- **Manufacturing & Gold Ledger:** `MANUFACTURING_LEDGER_MASTER.md`, `PARTY_360_MASTER.md`, `ITEM_AND_MATERIAL_MASTER.md`, `RATE_BOOK_MASTER.md`
- **Inventory & Traceability:** `TAGGING_AND_TRACEABILITY_MASTER.md`
- **Reporting & Accounting:** `REPORTING_ENGINE_MASTER.md`, `REPORT_CATALOGUE.md`, `REPORT_PRESET_MASTER.md`, `ACCOUNTING_AND_PERIOD_CONTROL.md`
- **Documents & Print:** `DOCUMENT_TEMPLATE_ENGINE.md`, `PRINT_PROFILE_MASTER.md`, `DOCUMENT_PRINTING_MASTER.md`
- **Security & Infrastructure:** `SESSION_AND_SECURITY_MASTER.md`, `BACKUP_RESTORE_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `DATABASE_AND_SUPABASE_MASTER.md`
- **UI, Presets & Portals:** `ADAPTIVE_UI_MASTER.md`, `KEYBOARD_AND_INPUT_MASTER.md`, `PORTAL_CONFIGURATION_MASTER.md`, `PORTAL_TERMINOLOGY_MASTER.md`, `WORKFLOW_PRESET_MASTER.md`, `TRANSACTION_PRESET_MASTER.md`
- **AI Operating Layer:** `ASSISTANT_MASTER.md`, `AI_RUNTIME_ARCHITECTURE.md`
- **Governance & Readiness:** `PRODUCT_MASTER.md`, `IMPLEMENTATION_MATRIX.md`, `RELEASE_READINESS.md`, `FUTURE_ROADMAP.md`

---

### Implementation Workstreams (Execute Streams A through L):

1. **Stream A — Jwelly Masters / Party 360 / Items / Purity / Diamond Stones**
   - Standardize `party_role_profiles`, `party_bank_accounts`, stamp fineness table (24K, 22K 916, 18K 750, 14K, 925), and diamond sieve/clarity matrices (`stock.stones`).
   - *References:* `PARTY_360_MASTER.md`, `ITEM_AND_MATERIAL_MASTER.md`, `RATE_BOOK_MASTER.md`.

2. **Stream B — Opening Balance & 13-Stage Migration Wizard**
   - 13-stage Migration Wizard (`/control/migration`) with CSV parsing, dry-run simulation, balance sheet checks, FTUX onboarding prompt (Start, Do Later, Start Fresh), and completion states (`NOT_STARTED` to `COMPLETED`/`SKIPPED`).
   - *Reference:* `OPENING_BALANCE_AND_MIGRATION_MASTER.md`.

3. **Stream C — Customization Engine**
   - Top-level Customization workspace (`/control/customization`) with 11 organized categories, centralized dropdown/master list engine, dynamic forms & custom fields (`custom_fields` JSONB), draft-publish versioning, and rollback.
   - *References:* `CUSTOMIZATION_MASTER.md`, `CUSTOM_FIELDS_AND_FORMS_MASTER.md`, `DROPDOWN_AND_MASTER_ENGINE.md`.

4. **Stream D — Calculation & Rule Engine**
   - 7-tier deterministic calculation engine (Making charges on Gross/Net/Pcs/%, worker labour, allowed wastage loss, chain wastage exclusions, stone deductions, and GST taxable valuation).
   - *Reference:* `CALCULATION_AND_RULE_ENGINE.md`.

5. **Stream E — Transactions / Voucher Engine**
   - Declarative voucher definitions, multi-ledger invariants (Money, Metal, Stock, Party, WIP, Tax), old gold purchases, bullion inward, B2B wholesale tax invoices, and retail counter billing.
   - *Reference:* `UNIVERSAL_TRANSACTION_ENGINE.md`.

6. **Stream F — Reports / Registers**
   - Central universal reporting engine with 4-dimensional aggregations (Money ₹, Gross Wt g, Fine Gold g, Diamond Cts), recursive drill-down graph down to source vouchers, and all 10 canonical report families.
   - *References:* `REPORTING_ENGINE_MASTER.md`, `REPORT_CATALOGUE.md`.

7. **Stream G — Tagging / Inventory**
   - Unique tag registry, Code 128 / QR barcodes, 6-character BIS HUID hallmarking, tray transfers, physical stock discrepancy analyzer (In-Place, Missing, Extra, Misplaced), and serial scale tare integration.
   - *Reference:* `TAGGING_AND_TRACEABILITY_MASTER.md`.

8. **Stream H — Manufacturing Books**
   - Complete 12-stage job card lifecycle, karigar bench custody balance, melting recovery assays, outside processing subsystem (Mina Book, Polish Book, Casting House), and Hisab Final settlements.
   - *Reference:* `MANUFACTURING_LEDGER_MASTER.md`.

9. **Stream I — Universal Document Engine & Print Profiles**
   - 10 professional document template families, controlled block component library, `.ornexa-template` package export, millimeter-calibrated print profiles (Laser A4, POS Thermal 80mm/58mm), and WhatsApp delivery.
   - *References:* `DOCUMENT_TEMPLATE_ENGINE.md`, `PRINT_PROFILE_MASTER.md`.

10. **Stream J — Portals / Invitations**
    - Customer VIP portal (CAD approvals, invoices), Karigar workshop portal (job bags, scrap return), Supplier bullion portal, Home screen portal launchpad, and secure cryptographic invitation workflows.
    - *References:* `PORTAL_CONFIGURATION_MASTER.md`, `AUTH_AND_INVITATION_MASTER.md`.

11. **Stream K — Settings Streamlining & Professional UX System**
    - Streamlined 10-category system settings (`/control/settings`), rebuilt branch management table and compact drawer, centralized low-radius (0–6px) design tokens, zero emoji, and zero AI-slop design.
    - *Reference:* `SETTINGS_MASTER.md`.

12. **Stream L — QA, Security & Performance**
    - Multi-tenant Row Level Security (RLS), configurable inactivity timeouts, "Clear This Browser Session", encrypted backup export/restore (`.ornexa.enc`), modular performance slicing (FCP < 1.2s, TTI < 1.8s), and automated Playwright test suites.
    - *References:* `SESSION_AND_SECURITY_MASTER.md`, `BACKUP_RESTORE_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `RELEASE_READINESS.md`.

---

### Verification & Completion Gates:
- Ensure TypeScript compiles cleanly: `npx tsc --noEmit` with **0 errors**.
- Verify responsive design (Desktop 1440px, Tablet 768px, Mobile 390px/375px).
- Verify server-side client device access gating and strict multi-tenant Row Level Security (RLS).
- Update `IMPLEMENTATION_MATRIX.md` and `RELEASE_READINESS.md` as workstreams pass quality gates.
```
