# Ornexa / AVS Product Constitution

## Product Identity

Ornexa / AVS Jewellery Manufacturing ERP is an integrated jewellery operating system for manufacturing-heavy jewellery businesses, beginning with Maa Tara Jewellers workflows. It is not merely POS, inventory, accounting, or manufacturing software.

The product objective is traceability: every gram, rupee, piece, job, document, custody change, communication, approval, and important business event must be explainable where relevant.

## Authority Hierarchy

1. Explicit Product Owner decisions.
2. This product constitution.
3. Approved existing AVS / Ornexa business behavior.
4. Master business rules.
5. Current verified database/code behavior.
6. APPIT / Jwelly / JewelAcc research.
7. New agent inference.

Research references do not automatically override Ornexa. Conflicts must be recorded with current behavior, researched alternative, business impact, data impact, recommendation, and owner decision required.

## Non-Destruction Rule

Do not replace AVS with a clone of any reference system. The target is old AVS plus preserved historical data, preserved legitimate workflows, approved new capabilities, better configuration, stronger traceability, better mobile UX, portals, communication, AI, and security.

Never casually drop, truncate, reset, reseed, overwrite, renumber historical transactions, delete ledgers, or recalculate history using new rules.

## SaaS Architecture

The architecture supports software owner, tenant, branch, workshop/location, and users/roles/permissions. Supabase Auth, Supabase PostgreSQL, Supabase RLS, and approved Supabase-compatible storage/service architecture are the authoritative production stack.

Do not shift Ornexa back to offline-first, local-auth, local-database, or Hybrid-as-authoritative architecture. Older offline/Hybrid documents may preserve historical context and business-rule knowledge, but they do not override the Product Owner decision that production Ornexa uses the Supabase online structure. Removing old application state means removing obsolete local/offline architecture, not deleting historical ERP business data or legitimate AVS workflows.

Frontend hiding is not security. Tenant, branch, user, role, permission, ownership, custody, and entitlement controls must be enforced server-side/RLS where sensitive.

## UX Philosophy

Normal users should not see 100 modules at once. Role workspaces should expose approximately Workshop, Business/Parties, Billing & Accounts, and Control & Insights, with progressive disclosure, search, recent, favorites, notifications, assistant, and quick actions.

Desktop and mobile must both be first-class. Mobile workflows should prioritize owner dashboard, approvals, karigar, workshop, inventory checks, customer portal, follow-up, notifications, assistant, and documents.

## Transaction Philosophy

Any legitimate business transaction should be recordable through configurable transaction definitions, not hundreds of unrelated CRUD forms. Preferred lifecycle: draft, validate, calculate, rule check, preview, approval if required, post, audit, document, notification.

Posted transactions should be immutable where appropriate. Corrections use reversal or compensating entries, not silent edits.

Known transaction workflows may be optimized, but the architecture must remain extensible for legitimate new jewellery business transactions. Transaction records should carry firm, branch, type, number, date/time, party, user, metal dimensions, value, tax, references, linked documents/jobs/orders, status, attachments, and audit metadata where applicable.

## Web App Quality Gate

Checklist Design Web App guidance is a release-quality reference for forms, tables, search, navigation, loading, skeletons, empty states, error states, upload flows, saving, authentication, support, maintenance, responsive behavior, and UX copy. Ornexa applies only ERP-relevant checks, tracked in `docs/ORNEXA_WEBAPP_COMPLETENESS_CHECKLIST.md`.

## Jewellery Accounting Principle

Money, metal, fine metal, physical weight, pieces, stones/diamonds, labour, and custody are distinct dimensions. Never merge cash and metal into a fake single balance.

Every gram must be explainable. Every rupee must be explainable. Every important action must be traceable.
