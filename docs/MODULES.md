# Modules

Each module is a set of routes (`src/routes`) backed by services/stores (`src/lib`). Routes stay thin; behavior lives in the service.

## Pilot module status

| Module                           | Status                 | Notes                                                                                            |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| Our Gold Stock (`/ledger`)       | Active                 | Overview dashboard; drill-downs; configurable materials                                          |
| Worker Gold Book / Material Book | Active                 | Daily Material Slip workflow; Outside/Polishing/Meena = Coming Soon                              |
| Orders                           | Active                 | WhatsApp doc send wired                                                                          |
| Billing                          | Active                 | Jeweller Account; gold-first settlement                                                          |
| Manufacturing Books              | Active                 | Read-only ledgers                                                                                |
| People / KYC                     | Active                 |                                                                                                  |
| Communications                   | Active                 | WasenderAPI + email + weekly statements                                                          |
| Settings                         | Active                 | Runtime Brand Settings + consolidated WhatsApp providers/Wasender/templates/automation + License |
| Notifications                    | Active                 | Operational alerts from licensing, sync, communications, approvals, and gold-rate configuration  |
| Catalog                          | Active                 | Configurable design library, encrypted references, customer links, localized UI, CSV export      |
| Translations                     | Active                 | Lazy Hindi/Marathi/Bengali dictionaries with English fallback and coverage reporting             |
| Manufacturing                    | Coming Soon            | Bill store/routes intact                                                                         |
| Barcode & Tagging                | Coming Soon            | Label/thermal paths intact                                                                       |
| Ready Stock (was Stock)          | Coming Soon            | Stock store/routes intact                                                                        |
| Reports                          | Coming Soon            | Report pages + export engine intact                                                              |
| Expenses                         | Coming Soon            | Store intact                                                                                     |
| CEO Dashboard                    | Active (CEO role only) | Hidden from all other roles                                                                      |

"Coming Soon" = the landing shows a professional placeholder; the underlying store/routes are preserved so the workspace can be finished without re-architecting.

## Our Gold Stock (`/ledger`)

Management overview dashboard for all gold/materials owned or managed. Balance cards (Gold Held, Gold with Karigars, Finished Jewellery Stock, Advance/Customer Gold, Gold With Jewellers, Scrap) drill down into per-purity / per-worker / per-customer summaries with Print + Export. **Overview only** — no transaction entry except Opening Vault. Store: `ledger-store.ts` (bucket model = Gold Vault). Material Vault sub-panel: `material-vault-store.ts` (per material×purity stock, fine equivalent).

## Worker Gold Book / Material Book (`/workshop/gold-book`)

Material-movement ledger: Issue / Return of gold and materials to workers, auto worker custody balance. In-page **Material Book** hub with four books — **Worker Gold Book** (functional) and **Outside Worker Book / Polishing Book / Meena Book** (professional Coming Soon). **Daily Material Slip** (`daily-material-slip.ts`): one consolidated slip per worker per day, number `MTS-YYYYMMDD-NNN`, shown across ledgers and printable via the Print Engine. Store: `worker-gold-book-store.ts`.

## Manufacturing Books (`/workshop/*`)

Read-only per-purity ledgers compiled from transactions: Jeweller Books (`workshop-jeweller-period.ts`), Worker Books (`workshop-worker-books.ts`), Outside/Polishing party books (`workshop-outside-books.ts`, `workshop-polishing-books.ts`). Period-scoped view builder + weekly/monthly closing (`workshop-ledger.ts`). Slip numbers thread through `RawLedgerEntry.slipNo`.

## Orders (`/orders`)

Customer/jeweller manufacturing orders with multi-item lines, job-card creation, status workflow (`orders-store.ts`, `jobcards-store.ts`). Per-document WhatsApp send (Order Slip, Ledger, Job Card, Worker Statement) via the Print Engine → WasenderAPI.

## Manufacturing Bills (`/manufacturing.bill.*`)

Making-charge bills against completed jobs, consuming worker/material movements (`manufacturing-bill-store.ts`).

## Billing (`/billing/*`)

Manufacturing invoices, credit/debit notes, estimates, delivery challans, and gold settlements (`billing-store.ts`, `billing-documents-store.ts`). All documents render through the Universal Print Engine.

## Reports (`/reports/*`)

Daily close, gold summary/position, daily gold flow, vault reconciliation, communication analytics, inventory ageing. Export via `report-engine.ts`.

## People (`/people`)

Customers, jewellers, karigars/workers, vendors, employees. Gold/cash balances per party via `customer-account-ledger.ts` (`getPartyGoldBalance`, `getPartyCashBalance`).

## Catalog (`/catalog`)

Reusable jewellery design library with configured categories/tags/defaults, customer and order provenance, encrypted design/reference/technical attachments, validated weights, and Universal Export Engine CSV output. Catalog never owns a gold balance. See `CATALOG.md`.

## Notifications (`/notifications`)

Read-only operational attention center derived from the owning licensing, sync, communication queue, approval, and Settings state. See `NOTIFICATIONS.md`.

## Stock / Melt / Attendance / Settings

Inventory & tagging (`/stock`, `/barcode`), catalog designs, melt account, attendance, and configuration (`/settings`). Branding and all WhatsApp configuration are tabs inside the Settings hub; legacy WhatsApp settings URLs redirect there. See `SETTINGS.md`.

## Communication

`src/lib/comm/*`: provider registry, WasenderAPI client, `send-whatsapp-text.ts`, `send-whatsapp-document.ts`. Reusable UI: `doc-comm-actions.tsx`, `whatsapp-doc-menu.tsx`. Comm log: `comm-log-store.ts`.
