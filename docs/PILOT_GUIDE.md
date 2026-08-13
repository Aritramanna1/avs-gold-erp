# ERP Gold Pilot Guide

> Superseded historical testing guide. This document described the old
> Offline/Hybrid Version 1 pilot and must not be used as current production
> setup guidance. Ornexa / AVS production is Supabase-online only; use
> `docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md`, `docs/ARCHITECTURE.md`, and
> `docs/DATABASE.md` for current architecture.

AVS Gold ERP `1.0.0-testing.1` is an internal jewellery-manufacturing test build, not a retail POS and not a public production release.

## First run

Use the current Supabase-online setup flow for any active pilot. The retired Version 1 Offline and Hybrid choices are preserved only as historical context and must not be offered in production or new pilot onboarding.

Create the first account carefully: it becomes the permanent Super Owner. Complete firm, branch, document, gold, print, backup, user, and optional WhatsApp settings before entering real workshop transactions.

## Pilot rules

- Gold Vault is the single source of truth.
- Use only Universal Print and Universal Export controls.
- Files and documents follow the approved Supabase-compatible storage and RLS model.
- Coming Soon modules are visible plans, not usable workflows.
- Back up before setup changes, imports, and each test day.
- Stop and preserve data on corruption, restore failure, authorization failure, or unexplained gold variance.

## Licensing

The UI supports Trial, Active, Expired, Suspended, and signed Lifetime entitlements with branded renewal prompts and no payment flow. Customers edit only the license key. Central database credentials and signing private keys never enter the ERP.

## Two-day acceptance focus

Test first-run setup, restart persistence, Super Owner access, each completed module, search/filter/forms, all print/export flows, camera/printers, backup and restore, queued WhatsApp recovery, Supabase connectivity loss/retry behavior, and RLS/role restrictions. Record version, exact steps, time, and non-sensitive screenshots for every defect.

DevTools, developer menus, debug overlays, live compliance runners, and renderer test harnesses are not shipped as application UI. Playwright is intentionally not part of this release run.
