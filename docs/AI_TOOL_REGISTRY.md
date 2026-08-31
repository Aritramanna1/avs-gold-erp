# ORNEXA — UNIVERSAL ERP TOOL REGISTRY
**Authoritative Architectural Specification for Permission-Aware ERP Tools Across 12 Domains**
*Version: 4.0.0*

---

## 1. Domain Coverage Matrix

| Domain | Tool Identifier | Risk Level | Description | Required Permissions |
|---|---|---|---|---|
| **Gold** | `GetWhereIsMyGold` | Level 0 | Multi-location physical gold breakdown (Vault, Showroom, WIP) | `inventory.view`, `workshop.view` |
| **Gold** | `GetGoldPosition` | Level 0 | Firm net gold exposure vs customer liabilities | `accounts.view`, `owner` |
| **Gold** | `GetKarigarGoldBalance` | Level 0 | Karigar custody, issued jobs, and pending scrap | `workshop.view`, `accounts.view` |
| **Gold** | `GetCustomerGoldBalance` | Level 0 | Customer metal advances and open orders | `billing.view`, `sales.view` |
| **Parties** | `SearchParty` | Level 0 | Finds parties by name, phone, GSTIN, or alias | `party.view` |
| **Parties** | `GetParty360` | Level 0 | Full financial & gold 360-degree party dossier | `party.view` |
| **Manufacturing** | `SearchJobs` | Level 0 | Manufacturing jobs by status, karigar, category | `production.view` |
| **Manufacturing** | `GetJobTimeline` | Level 0 | Milestone production timeline for a Job Card | `production.view` |
| **Manufacturing** | `prepare_gold_issue_draft` | Level 3 | Draft gold issue slip requiring user confirmation | `workshop.view` |
| **Inventory** | `SearchReadyStock` | Level 0 | Showroom tagged stock by category, karat, weight | `stock.view` |
| **Accounts** | `SearchInvoices` | Level 0 | Sales invoices, estimates, credit notes | `billing.view` |
| **Accounts** | `GetOutstanding` | Level 0 | Receivables/payables ageing analysis (<30 to >90d) | `accounts.view` |
| **Accounts** | `create_expense_draft` | Level 1 | Prepares expense voucher with GST breakdown | `accounts.view` |
| **Documents** | `GetDocument` | Level 0 | PDF invoice preview, download, and share | `document.view` |
| **Catalogue** | `SearchCatalogue` | Level 0 | B2B/B2C design catalogue items | `sales.view` |
| **Communication** | `prepare_whatsapp_invoice_action` | Level 2 | Prepares WhatsApp invoice dispatch preview | `billing.view` |
| **Support** | `create_support_ticket` | Level 2 | Submits technical support ticket with diagnostics | None (Open to all staff) |
| **Knowledge** | `query_knowledge_base` | Level 0 | Searches curated ERP manuals, SOPs, and FAQs | None (Open to all staff) |
