# ERP Gold Pilot Guide

AVS Gold ERP `1.0.0-testing.1` is an internal jewellery-manufacturing test build, not a retail POS and not a public production release.

## First run

Choose Offline (recommended) or Hybrid. Online/SaaS is future work. Both modes validate an Arivahly-issued license before creating the Super Owner. Offline asks for no Supabase information and then uses SQLite plus local files. Hybrid remains local-first and synchronizes structured data only after the owner applies the master SQL and validates Project URL, anon key, and a temporary service-role key.

Create the first account carefully: it becomes the permanent Super Owner. Complete firm, branch, document, gold, print, backup, user, and optional WhatsApp settings before entering real workshop transactions.

## Pilot rules

- Gold Vault is the single source of truth.
- Use only Universal Print and Universal Export controls.
- Files never leave the customer computer through Hybrid sync.
- Coming Soon modules are visible plans, not usable workflows.
- Back up before setup changes, imports, Hybrid activation, and each test day.
- Stop and preserve data on corruption, restore failure, sync conflict, or unexplained gold variance.

## Licensing

The UI supports Trial, Active, Expired, Suspended, and signed Lifetime entitlements with branded renewal prompts and no payment flow. Customers edit only the license key. Central database credentials and signing private keys never enter the ERP.

## Two-day acceptance focus

Test first-run setup, restart persistence, Super Owner access, each completed module, search/filter/forms, all print/export flows, camera/printers, backup and restore, queued WhatsApp recovery, Offline operation with network disabled, and Hybrid interruption/conflict recovery. Record version, mode, exact steps, time, and non-sensitive screenshots for every defect.

DevTools, developer menus, debug overlays, live compliance runners, and renderer test harnesses are not shipped as application UI. Playwright is intentionally not part of this release run.
