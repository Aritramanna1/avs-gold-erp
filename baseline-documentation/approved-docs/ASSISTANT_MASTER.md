# ORNEXA — AI ASSISTANT MASTER SPECIFICATION
**Authoritative Architectural Specification for the Permission-Aware AI Operating Layer, Multimodal Actions, Knowledge RAG, Credits & Communication Optimization**
*Version: 4.0.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Operating Philosophy & Architecture

### 1.1 The Fundamental AI Invariants
> **"THE ORNEXA ASSISTANT IS A PERMISSION-AWARE, TOOL-DRIVEN ERP OPERATING LAYER, NOT AN UNRESTRICTED CHATBOT."**
>
> 1. **AI Should Remove Clicks, Not Remove Controls.**
> 2. **The ERP Remains The Source of Truth.** All math, gold purity conversion, double-entry accounting, GST, inventory tracking, and ledger postings remain 100% deterministic (Layer 0).
> 3. **Fastest Intelligence Necessary:** Deterministic fast-path logic first, local context intelligence second, metered commercial cloud reasoning only when genuine reasoning adds value.
> 4. **Unified Credit & Usage Model:** Cloud AI, WhatsApp, and premium OCR consume from the tenant's unified credit wallet with graceful fallback to zero-cost standard intelligence.

```mermaid
graph TD
    UserQuery["User Input (Text / Voice / Image / Document)"] --> Router["Fast Query & Intent Router"]
    
    Router -->|Help / SOP / FAQ| Knowledge["Document Knowledge / RAG Engine"]
    Router -->|Read / Search / Report| ToolSelector["Universal ERP Tool Registry (12 Domains)"]
    Router -->|Multimodal Image / Doc| Multimodal["Multimodal Action Engine (Candidate Extraction)"]
    Router -->|Complex Multi-Step| CloudAI["Layer 2: Cloud LLM (Metered via Credit Wallet)"]
    
    ToolSelector --> PermCheck{"Permission Check (RBAC)"}
    Multimodal --> PermCheck
    CloudAI --> ToolSelector
    
    PermCheck -->|Authorized| Deterministic["Layer 0: Deterministic ERP Core (PostgreSQL, Dual Ledgers, RLS)"]
    Deterministic --> ActionDraft{"Requires User Confirmation?"}
    
    ActionDraft -->|No (Level 0 Read)| RichUI["Rich Visual Response (KPIs, Tables, Charts, Timelines)"]
    ActionDraft -->|Yes (Level 1-3 Write)| PreviewCard["Interactive Preview & Safe Action Confirmation Card"]
    
    PreviewCard -->|User Confirms| Execute["Deterministic Service Execution & Audit Trail"]
    Execute --> AuditLog["assistant_action_audit"]
```

---

## 2. Two Assistant Experiences

1. **Quick-Access Assistant Drawer (`Cmd/Ctrl+J` & Top Header Trigger):**
   - Lightweight slide-in drawer for rapid in-workflow lookups.
   - Screen-context aware (automatically detects active route e.g. `/workshop`, `/billing`, `/people`, `/stock`).
   - Quick suggested prompt chips.
2. **Dedicated Full-Screen Assistant Workspace (`/assistant`):**
   - Full-screen conversational AI workspace for desktop, tablet, and mobile.
   - Multi-session history with Search, Pin, Rename, Archive, and Delete.
   - Attachment composer (Invoice photos, receipt images, jewellery CAD designs, PDFs, CSVs).
   - Voice assistant with audio waves visualizer, automatic speech-end detection (VAD), speaker toggle, and instant speech interruption.
   - Intelligence mode switcher (Standard Zero-Cost vs Cloud AI Metered).
   - Real-time Credit Wallet balance and usage monitor.

---

## 3. Two Intelligence Paths

- **Path A — Ornexa Standard / Local Assistant (Zero API Cost):**
  - Instant latency, 100% offline-capable.
  - Answers from curated Knowledge Base (`PRODUCT_MASTER`, `WORKFLOW_MASTER`, `BUSINESS_RULES`, Settings documentation, FAQs, jewellery terminology).
  - Executes all Level 0 Read and Level 1 Draft ERP tools.
  - Remains fully functional without internet or cloud credits.
- **Path B — Premium Cloud AI (Metered Commercial Add-On):**
  - Engaged for complex cross-module synthesis, executive management summaries, deep multimodal invoice understanding, and multilingual conversations.
  - Consumes metered credits from the tenant's unified credit wallet.
  - Still constrained by strict ERP Tool Registry and deterministic calculation invariants.

---

## 4. 4-Tier Risk Model & Safe Action Confirmations

| Risk Level | Category | Actions Included | Confirmation Requirement |
|---|---|---|---|
| **Level 0** | **READ** | Search, Explain, Report, Where is my Gold, Outstanding Ageing, Stock Query | Instant execution |
| **Level 1** | **DRAFT** | Prepare Expense, Prepare Invoice, Prepare Job Card, Prepare Party Dossier | Draft preview generated |
| **Level 2** | **LOW-RISK WRITE** | Create Support Ticket, Save User Follow-up, Internal Note | Standard user review |
| **Level 3** | **FINANCIAL / METAL WRITE** | Gold Issue, Gold Receive, Invoice Posting, Payment, Settlement, WhatsApp Share | Explicit visual confirmation card + audit logging |
| **Level 4** | **HIGH-RISK** | Period Close, Permission Mutation, Backup Restore, Large Gold Adjustments | Strict dual-authorization |

---

## 5. Unified Credit Engine

- Single commercial usage wallet across Cloud AI, WhatsApp Business messaging, and premium OCR.
- Append-only credit transaction ledger.
- Graceful degradation: when credits reach 0, the Assistant seamlessly continues operating in Path A (Standard Local mode) without error.
