# AVS / Aurum ERP — Multi-Account & Environment Control Plane
**Directory**: `/docs/control-plane/`  
**Purpose**: Authoritative Excel-based operational Source of Truth for accounts, environments, repositories, Cloudflare edge, services, and release deployments.  
**Audience**: Platform Administrators, DevOps Engineers, and AI Agents.  
**Last Verified Release**: `v1.1.2-online-production-hardened` (`bf0c7c75043b13fcb10b112ed981ef54a39f44f0`)

---

## 1. Master Control Structure

This control plane eliminates ambiguity across multi-account, multi-environment operations. Every operational entity has a unique cross-referenced ID:

| File Name | Primary Purpose | Authoritative Scope |
| :--- | :--- | :--- |
| **`00_MASTER_CONTROL_INDEX.xlsx`** | Master index, control map, naming conventions, platform topology, and AI operating rules. | Global platform topology & navigation index. |
| **`01_ACCOUNT_REGISTRY.xlsx`** | Master inventory of all cloud, hosting, and vendor accounts. | GitHub, Hostinger, Cloudflare, Supabase, R2, Razorpay accounts. |
| **`02_ENVIRONMENT_REGISTRY.xlsx`** | Strict environment boundaries, allowed connections, and variable key schemas. | `ONLINE_PRODUCTION`, `BASELINE_BACKUP`, `SELF_HOSTED`. |
| **`03_REPOSITORY_REGISTRY.xlsx`** | Git repositories, branches, sync relationships, and immutable release tags. | `avs-gold-erp`, `avs-erp-hostinger-live`, `avs-erp-baseline-backup`. |
| **`04_DOMAIN_CLOUDFLARE_REGISTRY.xlsx`** | DNS zone records, Cloudflare proxying, WAF rules, and public URL inventory. | `maatarajewellers.shop`, DNS, WAF, Bot Fight Mode, Public URLs. |
| **`05_SERVICE_INTEGRATION_REGISTRY.xlsx`**| Backend services, HMAC webhook endpoints, retry queues, and email dispatchers. | Supabase PG, Supabase Auth, Cloudflare R2, PHP Mail, Webhooks. |
| **`06_DEPLOYMENT_RELEASE_REGISTRY.xlsx`**| Release verification logs, 16-point production checklist, and release history. | Production deployment tracking & certification matrix. |

---

## 2. Core Operational Constraints & Security Policy

### A. Zero Secrets Policy
> [!IMPORTANT]
> **NEVER STORE SECRETS IN THESE EXCEL FILES.**  
> No passwords, API keys, Supabase service-role keys, R2 secret access keys, SMTP passwords, webhook signing secrets, or private certificates may be entered into these spreadsheets. All records use `Credential_Reference` placeholders pointing to secure host environments.

### B. AI Operating Directives
1. **Never Infer Relationships**: Never assume two similarly named accounts, services, or repos are identical without matching `Account_ID` or `Service_ID`.
2. **Environment Separation**: `PRODUCTION` is never interchangeable with `SELF_HOSTED`, `BASELINE`, `DEVELOPMENT`, or `STAGING`.
3. **Tenant vs. Platform Separation**:
   - **Platform Layer** (Controlled here): Accounts, Repositories, Environments, Domains, DNS, Server APIs.
   - **Tenant Layer** (Customer ERP Data): Companies, Branches, Users, Customers, Karigars, Ledgers, Invoices, Stock. Customer business data is never stored in platform control files.
4. **No Guessing**: `UNKNOWN` or `NEEDS_VERIFICATION` is strictly required when data is unverified. Never fabricate accounts or environments.
5. **Mandatory Resolution Hierarchy**:
   $$\text{Account} \longrightarrow \text{Environment} \longrightarrow \text{Service} \longrightarrow \text{Resource} \longrightarrow \text{Domain} \longrightarrow \text{Deployment}$$

---

## 3. Standard Identifier Naming Conventions

- **Accounts**: `ACC-<PROVIDER>-<ENV>` (e.g., `ACC-HOSTINGER-PROD`, `ACC-CLOUDFLARE-PROD`, `ACC-SUPABASE-PROD`)
- **Environments**: `ENV-<LINE>-<TYPE>` (e.g., `ENV-ONLINE-PROD`, `ENV-SELF-HOSTED`, `ENV-BASELINE-BACKUP`)
- **Repositories**: `REPO-<ROLE>-<NAME>` (e.g., `REPO-HOSTINGER-LIVE`, `REPO-UPSTREAM-MAIN`, `REPO-BASELINE-BACKUP`)
- **Domains**: `DOM-<NAME>-<ENV>` (e.g., `DOM-MAATARA-PROD`, `DOM-MAATARA-WWW`)
- **Services**: `SVC-<PROVIDER>-<TYPE>` (e.g., `SVC-SUPABASE-POSTGRES`, `SVC-CLOUDFLARE-R2`, `SVC-HOSTINGER-MAIL`)
- **Deployments**: `DEP-<ENV>-<YYYYMMDD>-<INDEX>` (e.g., `DEP-ONLINE-20260905-01`)
- **Releases**: `REL-<ENV>-<TAG>` (e.g., `REL-PROD-V1.1.2`)

---

## 4. Verification & Audit Summary

- **Total Workbooks**: 7
- **Total Worksheets**: 24
- **Verification Status**: 100% Verified against live production domain `https://maatarajewellers.shop`.
- **Blocked Endpoints**: Future MCP Service (`SVC-FUTURE-MCP`) is intentionally marked `BLOCKED / DISABLED` per edge security policy.
