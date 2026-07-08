# MTJ ERP — Architecture Blueprint

This document details the layered system architecture, modular design patterns, service integrations, and runtime boundaries of the MTJ ERP platform.

---

## 1. Layered Architecture Overview

MTJ ERP is structured as a decoupled, layered application designed to isolate concerns, maximize performative layout transitions, and enforce strict state consistency.

```text
┌────────────────────────────────────────────────────────┐
│                        UI Layer                        │
│      React 18+  ·  Tailwind CSS  ·  Radix Primitive    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                     Business Layer                     │
│      Zustand Stores  ·  Gold/Tax Math  ·  Type System  │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Service & HAL Layer                  │
│    WebUSB/Serial HAL  ·  Print Template Engine  ·  Auth│
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                     Database Layer                     │
│   PostgreSQL Schema  ·  RLS Policies  ·  REST/RPCs     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Module Boundaries

To keep compile and hot-reload times efficient, the system enforces clean boundaries between domains:

- **Billing (Checkout)**: Processes invoice line calculations, customer credit, payment records, and ledger balances. No direct state mutation is allowed outside the designated `useBilling` and `useDraft` stores.
- **Stock & Inventory**: Unique tracking of items using unique, tamper-proof serial numbers or barcodes. Items are locked when marked `assigned` (to an order) or `sold` (to an invoice).
- **Workshop**: Manages the cyclical gold balance between the shop vault and external Karigars, capturing scrap gold inputs, filing waste weights, and final ornament weights.
- **People (CRM)**: Simple contacts manager isolating customers from Karigars while allowing overlapping roles.

---

## 3. UI Layer (Presentation)

- **SPA Routing**: Client-side routing with optimized state hydration.
- **Component Standards**: Simple layout containers with isolated state props. Large interactive components must be decoupled into independent sub-components inside `/src/components/` (e.g., `CounterBillingWizard`).
- **Theming**: Integrated theme providers utilizing Tailwind standard variables. All styles are declared in Tailwind classes; inline styles are forbidden unless calculating dynamic graphic dimensions.

## 4. Business Layer (Domain Logic)

- **Precision Calculations**: Standard mathematical functions for gold conversions (gross to fine based on purities) and financial taxations are located in `/src/lib/gold.ts` and `/src/lib/billing-store.ts`. Enforces clean division by constants and zero-rounding protections.
- **Zustand State Engines**: Decentralized state slices syncing selectively with persistent storage engines.

## 5. Database Layer (Persistence)

- **Supabase / PostgreSQL Server-Side Routing**: The database acts as a durable, single source of truth. All structural schemas and security constraints are defined in `database.md`.
- **Row-Level Security (RLS)**: Enforces business-level multi-tenant and multi-branch data boundaries. Users can only fetch and update records belonging to their active group ID.

## 6. Hardware Abstraction Layer (HAL)

- **Physical Communications**: Houses standard wrapper functions designed to interact with physical peripherals. Bridges the gap between browser sandbox rules and external COM or USB assets.
- **Mock Failbacks**: Transparent fallbacks ensuring the system remains fully operational (using manual inputs) if hardware is physically disconnected or disabled.

## 7. Service Layer

- **Notification Dispatchers**: High-level, event-driven modules that generate message payloads (such as custom transaction receipts, balance summaries, or delivery alerts) and push them through configured gateways like WhatsApp and email servers.

## 8. Authentication

- **JWT Identity Checking**: Session tokens issued by the server are cached securely in client memory. All API calls append authorization headers, validating roles and branch-level access permissions on every database statement execution.

## 9. Printing

- **Print-Friendly Views**: Native browser `@media print` CSS overrides and raw ESC/POS-compliant thermal stream formatting. Allows cashiers to effortlessly toggle between printing formal A4 customer invoices on laser printers or quick voucher receipts on compact receipt terminals.

## 10. Reporting

- **Transactional Audits**: Daily close triggers summarize total cash drawers, bank deposits, physical gold changes, and total GST liabilities. All reporting data is computed dynamically on the database using optimized indexes to maintain responsiveness as rows scale.
