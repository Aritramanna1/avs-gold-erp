# Roadmap

Living document. Ordered by priority, not date. Update when scope changes.

## Done (recent)

- Notifications center — real operational alerts, unread state, owning-module navigation, and four-language UI.
- Catalog completion — configurable defaults, validated design workflow, customer provenance, encrypted reference attachments, and CSV export.
- Translation completion for Notifications and Catalog — full English/Hindi/Marathi/Bengali coverage with lazy loading and accurate global coverage reporting.
- Licensing foundation — Trial, Active, Expired, and Suspended status handling with mode-aware verification and branded renewal prompts; payments remain a future phase.
- Settings consolidation — runtime Brand Settings and all WhatsApp providers, WasenderAPI, templates, retries, and automation live inside `/settings`; legacy URLs redirect for compatibility.
- WasenderAPI WhatsApp provider — encrypted token + session API Key in Electron main; text + document send; deep-link fallback.
- Worker Gold Book → Material Book hub (Worker functional; Outside/Polishing/Meena Coming Soon).
- Daily Material Slip — consolidated per worker/day, `MTS-YYYYMMDD-NNN`, slip number threaded across ledgers.
- Our Gold Stock dashboard — drill-downs (Gold Held, Karigar, Finished, Customer), Print + Export, Record-Movement removed (overview only).
- Material Vault — per material×purity stock items with fine equivalent.
- Universal Print Engine — Daily Material Slip migrated (Phase 1 of print migration).
- WhatsApp messaging and local PDF generation are wired in Orders. Files remain local; public-URL document delivery is deferred unless a future approved provider can accept local binary uploads without cloud file persistence.

## In progress / next

1. **Print Engine expansion** — Version 1 frontend integration is complete; register future module documents through the same mapper/template engine and specialized barcode/thermal adapters.
2. **Gold Vault single-source-of-truth reconciliation** — audit every gold-writing module so no independent balance exists; add a reconciliation report.
3. **Dashboard optimization** — richer, scannable layout for the 7 KPI cards; comm widgets (WhatsApp Customer/Karigar) on delayed / due-soon jobs.
4. **WhatsApp document coverage** — extend send actions to Bills/Invoices, Delivery Challan, Statements, Material Issue Slips across modules.
5. **Communication workflow** — provider branding in settings, delivery-status surfacing, retry/queue polish.

## Later

- Outside Worker Book, Polishing Book, Meena Book implementations.
- Additional dashboard KPIs & analytics.
- Multi-material vault (silver, platinum, diamond, gemstone, consumables) — the `SlipMaterial` / `MATERIAL_PREFIX` seam is already in place.
- Barcode/label print consolidation review.
