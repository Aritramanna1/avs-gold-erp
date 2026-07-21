# Version 1 Test Release Notes

Version: `1.0.0-testing.1` — internal two-day test release, not a public production release.

This build covers the offline-first jewellery manufacturing ERP shell, dashboard, parties, orders/job cards, billing, Gold Vault/stock, worker and manufacturing books within the documented module status, settings, users/permissions, local storage, Universal Print/Export integration, notifications, catalog, translations, hardware surfaces, WhatsApp queue/provider integration, and owner-managed Hybrid synchronization.

Important limitations:

- Online/SaaS provider is future work.
- Licensing uses the Arivahly API provider and signed, device-bound offline entitlements. A real production endpoint/public key must be supplied at build time and integration-tested before distribution.
- Hybrid master SQL has static/build validation but still requires a clean live-project acceptance test.
- Hybrid automatic fresh-schema installation remains blocked: a service-role key cannot execute arbitrary DDL through the Data API. Owner-applied SQL is the current safe workflow.
- Hybrid broad anon-role RLS is not approved for paying-customer production; an authenticated sync principal is required.
- Files never sync; Wasender document delivery cannot publish local PDFs and falls back to text/caption behavior.
- Installer is unsigned until a code-signing certificate is configured.
- Automated Playwright testing was intentionally not run for this release; manual regression is required.

Internal testers should prioritize first-run setup, restart persistence, backup/restore, Super Owner access, gold invariants, all print/export routes, queued WhatsApp recovery, network-loss Hybrid behavior, sync conflicts, and installer upgrade/uninstall behavior.
