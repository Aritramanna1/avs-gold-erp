# MTJ ERP Project Constitution

This document is the governing architectural and business standard for MTJ ERP. Every new feature, migration, integration, and refactor must be evaluated against it before implementation.

## Product direction

MTJ ERP is a manufacturing-first jewellery enterprise platform. It must preserve complete traceability of every gram of gold, every financial transaction, every operational document, and every material correction across firms, branches, users, devices, and future SaaS tenants.

## Non-negotiable principles

### 1. Ledger-first architecture

Transactions never directly mutate balances. The required flow is:

`Action -> Validation -> Immutable ledger entries -> Derived balances -> Reports`

Gold issue/receipt, conversion, settlement, adjustment, payment, and inventory movement must all produce ledger entries.

### 2. Event-based accounting

Business actions create named events such as Gold Issued, Gold Received, Conversion Completed, Settlement Posted, Barcode Printed, Invoice Generated, and Stock Adjusted. Inventory, balances, dashboards, and reports are derived from these events wherever practical.

### 3. Immutable audit trail

Financial, gold, inventory, and legally relevant records are never deleted or silently edited. Corrections use reversal, void, cancellation, or explicit adjustment workflows. Audit records capture before/after values, user, device, IP when available, timestamp, reason, and related document.

### 4. Double-entry gold ledger

Gold movements must have balanced sources and destinations. For example, a 100g issue debits the vault by 100g and credits the karigar ledger by 100g. System gold must not change without an explicit purchase, sale, conversion, loss, or other approved event.

### 5. Financial ledger integration

Money follows the same ledger discipline. Ledgers must distinguish cash, bank, UPI, customer advances, karigar advances, labour payables, vendor payables, and receivables, keeping operational and accounting records synchronized.

### 6. Configurable workflows

Manufacturing, repair, polish, stone, KDM, meena, casting, and future processes should be represented by configurable workflow definitions, states, validations, roles, and transitions rather than module-specific hardcoding.

### 7. Common document engine

Invoices, job cards, issue/return slips, settlements, barcodes, labels, challans, and receipts use a shared document engine supporting dynamic templates, firm/branch branding, language selection, thermal/A4 layouts, and custom fields.

### 8. Central notification engine

Domain events trigger notifications through one service. Supported channels may include WhatsApp, email, SMS, in-app, and push notifications. Modules must not embed channel-specific delivery logic.

### 9. Background jobs

PDF and barcode generation, WhatsApp delivery, large report exports, backups, inventory recalculation, and reminders run asynchronously. The UI must remain responsive and expose job status and failures.

### 10. Universal search

Search must be available globally across customers, karigars, orders, barcodes, job cards, hallmark IDs, phone/GST numbers, deposits, inventory, ready stock, and transactions, with tenant and permission boundaries enforced.

### 11. Actionable dashboards

Dashboards prioritize operational decisions: gold with karigars, vault gold, outstanding customer gold, excess loss, delayed orders, ready-stock value, production, settlements, pending deliveries, negative cash, and audit exceptions.

### 12. Backup and disaster recovery

Provide automatic and manual backups, encryption, retention policies, restore verification, and backup-health monitoring. A backup is not considered valid until restoration has been verified.

### 13. Extension readiness

New capabilities must be addable through stable interfaces and bounded modules. Anticipated extensions include CRM, e-commerce, B2B portals, mobile apps, hallmark APIs, accounting, courier, and payment integrations.

## Security and tenancy

Use least-privilege permissions, row-level security, encryption for sensitive data, signed storage URLs, rate limiting, session timeout, device/session management, and comprehensive audit logging. Tenant, firm, branch, and role scope must be explicit in data access and background jobs.

## Performance targets

- Dashboard load: under 2 seconds for normal operating data
- Universal search: under 300 ms for normal queries
- Barcode scan response: under 100 ms where hardware permits
- Standard form save: under 500 ms excluding external delivery
- Large reports: asynchronous generation with visible progress
- UI: responsive during all background operations

## Feature gate

Before implementation, every feature must answer:

1. What business event does it create?
2. What immutable ledger entries does it create?
3. Which balances and reports are derived from those entries?
4. What reversal, void, cancellation, and adjustment paths exist?
5. What audit fields and permissions are required?
6. Which workflow, document, notification, or background-job abstractions does it reuse?
7. How does it preserve tenant/branch isolation and the performance targets?
8. How will it be tested for reconciliation, security, and failure recovery?

If a feature cannot answer these questions, its design is incomplete.

## Relationship to other project documents

This constitution governs direction and invariants. Detailed implementation guidance remains in `architecture.md`, `business-rules.md`, `database.md`, `docs/WORKFLOW_RULES.md`, and `SECURITY.md`. When those documents conflict, the constitution's invariants take precedence and the conflict must be resolved explicitly.
