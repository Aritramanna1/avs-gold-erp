# ORNEXA — AUTHENTICATION, INVITATIONS & USER PROVISIONING MASTER
**Authoritative Specification for User Onboarding, Invitations & Access Lifecycles**
*Version: 3.0.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Core Authentication & Provisioning Architecture

Ornexa enforces a strict separation between **Internal ERP Operators** (staff, managers, accountants, CEOs) and **External Subsystem Portal Users** (customers, artisans, suppliers).

```mermaid
graph TD
    TenantAdmin["Tenant Owner / CEO / HR Admin"] --> InternalInvite["1. Internal ERP User Invitation"]
    Party360["Party 360 Directory (Customer / Karigar / Supplier)"] --> ExternalInvite["2. External Portal Invitation"]
    
    InternalInvite --> CentralEmail["Central Email Service / (Optional WhatsApp)"]
    ExternalInvite --> CentralEmail
    
    CentralEmail --> TokenVerify["Single-Use Cryptographic Invitation Token"]
    TokenVerify --> AccountCreation["Account Creation & Password Setup"]
    
    AccountCreation --> InternalPath["Internal ERP Workspace (Scoped by Role & Branch)"]
    AccountCreation --> CustomerPath["Customer Portal (/customer/*) — portal_identities + portal_party_links"]
    AccountCreation --> KarigarPath["Karigar Portal (/karigar/*) — portal_identities + portal_party_links"]
    AccountCreation --> SupplierPath["Supplier Portal (/supplier/*) — portal_identities + portal_party_links"]
```

> **Portal provisioning invariant:** External portal accounts must receive a `portal_identities` row (tenant + portal type) and at least one active `portal_party_links` row before portal RPCs succeed. Legacy `user_profiles.customer_person_id` is backfilled automatically but must not be trusted from the browser.

---

## 2. Password Login & Multi-Factor Support

All Ornexa entry points support standard **Email / Identifier + Password Authentication**:
1. **Primary Authentication:** Registered Email / Phone + Secure Password.
2. **Optional OTP Login:** OTP via SMS/WhatsApp is an optional secondary method (configurable per tenant policy), not a mandatory barrier for every session.
3. **Session Management:** Secure Supabase JWT sessions with automatic token refresh during active use.
4. **Account Recovery:** Self-service "Forgot Password" flow with single-use expiring reset links, anti-enumeration security, and active session invalidation upon password change.
5. **Account Lockouts:** Automatic temporary lock after 5 consecutive failed password attempts with administrative unlock controls.

---

## 3. The Central Invitation Lifecycle Engine

Every invitation generated across Ornexa is tracked through an immutable state machine:

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Admin prepares invite
    DRAFT --> SENT: Email / WhatsApp dispatched
    SENT --> DELIVERED: Provider confirms delivery
    DELIVERED --> OPENED: Recipient clicks secure link
    OPENED --> ACCEPTED: Account created & password set
    ACCEPTED --> [*]
    
    SENT --> EXPIRED: 72-hour window elapsed
    DELIVERED --> EXPIRED: 72-hour window elapsed
    OPENED --> EXPIRED: 72-hour window elapsed
    
    DRAFT --> REVOKED: Admin cancels invitation
    SENT --> REVOKED: Admin cancels invitation
    DELIVERED --> REVOKED: Admin cancels invitation
    
    SENT --> FAILED: Invalid address / bounce
```

### 3.1 Invitation Audit Record Attributes
- `id:` Unique UUID.
- `tenant_id` & `branch_id:` Exact firm and branch scope.
- `party_id:` Linked Party 360 record (for external portal users).
- `portal_type:` `internal_erp`, `customer_portal`, `karigar_portal`, `supplier_portal`.
- `recipient_email` & `recipient_phone:` Target contact info.
- `role_id:` Pre-assigned role and permissions.
- `token_hash:` Cryptographically secure, salted, single-use token hash.
- `expires_at:` Expiration timestamp (default: 72 hours).
- `created_by:` Admin user identity.
- `status:` `DRAFT`, `SENT`, `DELIVERED`, `OPENED`, `ACCEPTED`, `EXPIRED`, `REVOKED`, `FAILED`.
- `created_user_id:` Generated Supabase `auth.users` ID upon acceptance.

---

## 4. Portal-Specific Invitation Workflows

### 4.1 Customer Portal Invitation
- **Trigger:** Initiated from **Customer 360** → `[Invite to Customer Portal]`.
- **Workflow:** Admin selects primary contact email/phone → System dispatches branded invitation email → Customer clicks link, sets password → Account maps strictly to that customer's `party_id`.
- **Security Boundary:** The customer has zero visibility into any other customer's records, internal manufacturing margins, or artisan costs.

### 4.2 Karigar Portal Invitation
- **Trigger:** Initiated from **Karigar 360** → `[Invite to Karigar Portal]`.
- **Workflow:** Admin sends invitation link → Artisan sets password on mobile device → Account links strictly to that `karigar_id`.
- **Security Boundary:** Artisan accesses only assigned bench jobs, personal metal custody, and labour wages.

### 4.3 Supplier Portal Invitation
- **Trigger:** Initiated from **Supplier 360** → `[Invite to Supplier Portal]`.
- **Workflow:** Admin sends invitation link → Vendor registers password → Account links to `supplier_id`.
- **Security Boundary:** Vendor accesses only issued Purchase Orders, dispatch notices, and supplier statements.

---

## 5. Internal ERP User Provisioning (CEO / Admin Control)

Internal operators are **never provisioned by manual database edits**. They are managed exclusively through the **CEO Portal / User Administration Console**:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as CEO / Tenant Owner
    participant UI as CEO User Admin Console
    participant Engine as Invitation Service
    participant Email as Central Email Service
    actor Staff as New Employee (e.g. Manager)
    participant Auth as Supabase Auth

    Admin->>UI: Enters Name, Email, Phone
    Admin->>UI: Assigns Role (e.g. Manager, Billing, Workshop)
    Admin->>UI: Assigns Branch Scope (Single Branch / Multi-Branch)
    Admin->>UI: Selects Custom Permission Overrides
    Admin->>UI: Clicks "Send Internal Invitation"
    UI->>Engine: Creates invitation with assigned role & branch metadata
    Engine->>Email: Dispatches official Staff Onboarding Email
    Email-->>Staff: Delivers invitation link
    Staff->>UI: Clicks link, verifies token & sets secure password
    UI->>Auth: Provisions user account & assigns user_roles
    Auth-->>Staff: Issues authenticated session into Main ERP Workspace
```

---

## 6. Strict Portal-Role Isolation

> **CRITICAL ARCHITECTURAL BOUNDARY:**
> External portal accounts must **NEVER** inherit internal ERP operational permissions.

- A **Customer Portal user** cannot access internal manufacturing, billing, or inventory screens.
- A **Karigar Portal user** cannot access counter billing, company financial reports, or customer directories.
- A **Supplier Portal user** cannot access customer orders or internal workshop schedules.
- If a person holds multiple roles in real life (e.g. a customer who is also a subcontractor), they must use distinct role-scoped portal sessions linked to their respective records.

---

## 7. Account Lifecycle & Audit Preservation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ACCOUNT LIFECYCLE                                 │
│                                                                             │
│    [INVITED]  ──▶  [ACTIVE]  ──▶  [SUSPENDED]  ──▶  [DEACTIVATED]          │
│                       ▲                  │                                  │
│                       └──────────────────┘ (Reactivated)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Preservation Rule:** Never delete user records from the database when access is revoked. Revoking access transitions the account to `SUSPENDED` or `DEACTIVATED`, preserving all historical transaction signatures, audit references, and creation logs.
