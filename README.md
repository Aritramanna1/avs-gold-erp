# AVS Gold ERP / Ornexa — Community Testing Release

> **Official Controlled Public Release for Community Testing & Evaluation (2–3 Month Testing Period)**  
> Developed by [Arivahly Venture Sphere](https://arivahly.in/).

---

## 🌟 Overview

**AVS Gold ERP** (Ornexa) is a modern, enterprise-grade jewellery manufacturing and workshop ERP designed with an **automation-first architecture** and an **AI intelligence layer**.

Unlike generic retail POS systems, AVS Gold ERP is purpose-built for:
- **Precision Three-Ledger Accounting**: Purity-isolated Gold Ledgers (Fine Gold grams), Cash & Bank Ledgers (₹), and Mixed Dual-Currency Customer Ledgers.
- **End-to-End Workshop Lifecycle**: Daily Material Slips, Karigar Issue & Receipt, Polish loss & Over-loss auditing, and Job Card Tracking.
- **Draft-First AI Intelligence**: 21 schema-bound ERP tools operating under strict 5-tier safety governance (Level 0 Read-Only to Level 4 Human Approval).
- **Automated Communication & Portals**: Dedicated portals for Karigars, Suppliers, and Customers with automated WhatsApp/Email dispatches.

---

## 🔒 Multi-Tenant Security & Credential Isolation Architecture

The repository enforces **strict per-tenant credential isolation** and **zero silent fallbacks**:

```text
                                AVS PLATFORM
                                     │
                   ┌─────────────────┴─────────────────┐
                   │                                   │
               Tenant A                            Tenant B
                   │                                   │
         ┌─────────┴─────────┐               ┌─────────┴─────────┐
         │ Own AI Key        │               │ Own AI Key        │
         │ Own WhatsApp Token│               │ Own WhatsApp Token│
         │ Own Email SMTP    │               │ Own Email SMTP    │
         │ Own Payment Keys  │               │ Own Payment Keys  │
         └───────────────────┘               └───────────────────┘
```

### 1. Zero Silent Platform Fallbacks
- Integrations (AI, WhatsApp, Email, SMS, Razorpay) are **unconfigured by default** for new tenants.
- Tenants configure their own external service credentials in **Settings → Integrations**.
- If unconfigured, the integration is marked `NOT CONFIGURED` and safely blocked with guidance prompts. The core ERP continues operating seamlessly.

### 2. Chargeable WhatsApp Integration
- WhatsApp is governed as a chargeable integration with plan tiers (`starter`: 500 msgs, `growth`: 5,000 msgs, `enterprise`: unlimited).
- Outbound dispatches check active subscription billing status (`active`, `past_due`, `cancelled`) and quota limits before dispatching.

### 3. Controlled MTJ Flagship Exception
- There is an explicit, server-side verified exception for the flagship reference instance (`mtj-flagship-001`, `tenant-mtj`).
- Only verified flagship instances are authorized to utilize designated centralized infrastructure. Standard community tenants cannot inherit or access central secrets.
- All secrets are masked (`maskSecret`) and scrubbed from client responses, logs, and telemetry.

---

## 🚀 Quickstart & Setup

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Aritramanna1/avs-gold-erp.git
cd avs-gold-erp

# 2. Switch to public-testing branch
git checkout release/community-testing-v1.1.2

# 3. Install dependencies
npm install

# 4. Configure environment variables
cp .env.example .env
```

### Environment Configuration

Supply your credentials in `.env` (or configure per-tenant keys inside the UI):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Storage / Cloudflare R2 Proxy (Optional)
VITE_R2_PROXY_URL=https://your-r2-proxy.workers.dev

# External Integrations (Optional / Per-Tenant)
VITE_GEMINI_API_KEY=
VITE_OPENAI_API_KEY=
```

### Running Locally

```bash
# Start Vite development server
npm run dev

# Run full QA test suite (69 suites / 537 tests)
npx vitest run qa/unit/

# Run Multi-Tenant Isolation & Security Suite
npx vitest run qa/unit/multi-tenant-isolation-security.test.ts

# Production build
npm run build
```

---

## 🧪 Testing & Quality Assurance

AVS Gold ERP includes comprehensive automated QA suites:

| Test Suite | Purpose | Status |
| :--- | :--- | :--- |
| `qa/unit/multi-tenant-isolation-security.test.ts` | Multi-tenant credential isolation & MTJ exception | **Passed (8/8)** |
| `qa/unit/ai-activation-production.test.ts` | AI 21-tool registry & draft-first financial safety | **Passed (11/11)** |
| `qa/unit/three-ledgers-reporting.test.ts` | Cash, Gold purity (22K/18K/Fine), Mixed ledgers | **Passed (12/12)** |
| `qa/unit/mtj-calculations.test.ts` | Karigar wastage, touch, and net weight parity | **Passed (17/17)** |
| `qa/unit/automation-engine.test.ts` | Triggers, actions, loop protection, execution logs | **Passed (12/12)** |
| **All Unit Test Suites** | Full system regression across 69 test files | **Passed (537/537)** |

---

## 🤝 Community Feedback & Contribution

During the **2–3 month testing period**, community feedback and fixes are welcomed:
1. Submit bug reports and feedback via **GitHub Issues**.
2. For code contributions, please submit clean PRs targeting `release/community-testing-v1.1.2`.
3. Community improvements will be reconciled and merged into the main upstream AVS production release following security and QA validation.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Copyright (c) 2026 **Arivahly Venture Sphere**.

