# Roadmap

Living document. Ordered by priority, not date. Update when scope changes.

## Done (recent)

- WasenderAPI WhatsApp provider — encrypted token + session API Key in Electron main; text + document send; deep-link fallback.
- Worker Gold Book → Material Book hub (Worker functional; Outside/Polishing/Meena Coming Soon).
- Daily Material Slip — consolidated per worker/day, `MTS-YYYYMMDD-NNN`, slip number threaded across ledgers.
- Our Gold Stock dashboard — drill-downs (Gold Held, Karigar, Finished, Customer), Print + Export, Record-Movement removed (overview only).
- Material Vault — per material×purity stock items with fine equivalent.
- Universal Print Engine — Daily Material Slip migrated (Phase 1 of print migration).
- WhatsApp document sending — Print Engine PDF → Supabase Storage → WasenderAPI, wired in Orders.

## In progress / next

1. **Print Engine migration (phased)** — remaining self-contained document prints: receive slip, filings slip, Material Issue Slip, Our Gold Stock print, remaining reports, daily close. Labels/barcode/thermal stay on hardware paths.
2. **Gold Vault single-source-of-truth reconciliation** — audit every gold-writing module so no independent balance exists; add a reconciliation report.
3. **Dashboard optimization** — richer, scannable layout for the 7 KPI cards; comm widgets (WhatsApp Customer/Karigar) on delayed / due-soon jobs.
4. **WhatsApp document coverage** — extend send actions to Bills/Invoices, Delivery Challan, Statements, Material Issue Slips across modules.
5. **Communication workflow** — provider branding in settings, delivery-status surfacing, retry/queue polish.

## Later

- Outside Worker Book, Polishing Book, Meena Book implementations.
- Additional dashboard KPIs & analytics.
- Multi-material vault (silver, platinum, diamond, gemstone, consumables) — the `SlipMaterial` / `MATERIAL_PREFIX` seam is already in place.
- Barcode/label print consolidation review.
