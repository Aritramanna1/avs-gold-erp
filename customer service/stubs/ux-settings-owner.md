# P1-7: Firm Owner Team & Settings Access Boundary (SETTINGS-02)

## Goal
Establish a clean, robust authorization boundary ensuring **firm Owners** (such as test account 777 for Maa Tara Jewellers) have complete, unrestricted administrative access over their own tenant-level settings (Team members, Staff invites, Users & Roles, Company Profile, Branch setup, Daily Bullion Rates, Print profiles, and Audit logs). Simultaneously enforce the strict domain rule: **account 777 must never be granted SaaS Admin permissions or see cross-tenant platform controls**, which are exclusively reserved for platform account 222.

## Current tip evidence (paths)
- **Role Resolution Engine**: [`src/lib/role-resolution.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/role-resolution.ts#L105)
  - `isAdminLikeRole`: Confers firm-level administrative privileges (`owner`, `owner_ceo`, `super_owner`, `administrator`).
  - Separation: SaaS Admin (`saas_admin`) explicitly segregated from firm roles.
- **Settings Hub Route**: [`src/routes/settings.index.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/settings.index.tsx)
  - Manages tenant configuration tabs (Company, Users, Branches, Rates, Document Vault).
- **Platform Admin Gate**: [`src/routes/saas-admin.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/saas-admin.tsx)
  - Strictly restricts cross-tenant plan editing, license generation, and database maintenance to account 222.
- **Account Identity Rule**: [`customer service/00-PROJECT-SCOPE.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/00-PROJECT-SCOPE.md#L33)
  - Formalizes roles: 222 = SaaS Admin; 777 = Firm Test (Never SaaS Admin).

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/routes/settings.index.tsx`: Ensure firm owners have unblocked access to "Users & Roles" and "Company Profile" tabs without false-positive permission locks.
   - `src/routes/saas-admin.tsx`: Guard with strict `isSaasAdminRole` check; any firm owner (including 777) navigating here is smoothly redirected to `/app` with an informational notice.
   - User Management: Firm user invites and role assignments restricted strictly to tenant boundaries (`where tenant_id = auth.tenant_id()`).
2. **Hostinger / Production**:
   - Verify token refresh and profile resolution accurately propagate firm owner role across sessions without session desync.

## Acceptance
- Account 777 logs into `https://erp.arivahly.in/settings` and can invite new staff, update company tax info, and set bullion rates.
- Account 777 cannot view or access `https://erp.arivahly.in/saas-admin`.
- Account 222 maintains access to platform administration and global subscription metrics.
- No cross-tenant data leakage occurs in team or audit registers.

## Out of scope
- Blending platform SaaS administration with firm-level shop management into a single composite role.

## Status: Done
