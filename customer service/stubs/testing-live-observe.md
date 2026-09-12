# Testing live observe

**Date:** 2026-09-12  
**Observer:** Testing (Grok Bot)  
**Site:** https://erp.arivahly.in  
**Firm session:** 777 (Maa Tara Jewellers / Owner / Main Branch / FY 2026-27 / app v1.1.1)

## Method (accounts used: 777 firm / 222 SaaS if needed - never paste passwords)

- Click UI only from https://erp.arivahly.in (root to login to app). No pasted deep URLs for module paths.
- Observe-only: describe what live chrome and landings show. Do not invent defects.
- Account: **777 firm** only this pass (`aritramanna777` / Owner). **222 SaaS admin not used.**
- Align notes to locked AVS-4 (Home / Sell / Customers / Stock / Make / Money / Reports / More; Stock opens on Gold first) and customer service pack `00-PROJECT-SCOPE.md` / `01-IMPROVEMENTS.md`.
- Passwords never stored in this file or Notion.

## Pre-auth (login chrome)

- Root redirects to `/login`.
- Branding: ORNEXA JEWELRY ECOSYSTEM; title "AVS ERP - Jewellery Ecosystem ERP".
- Form: **STANDARD SIGN IN** - Corporation Email, Password, Keep me signed in, primary **Secure Sign In**.
- Secondary: Sign In with OTP, Forgot Password, Accept Invitation Code.
- Footer: invitation-only ERP copy.
- Cookie banner: Accept all / Essential only / Manage (Essential only used).
- No firm/company code field on login (tenant comes from account).
- No captcha / MFA on this path. Failed attempt showed plain "Invalid email or password." then Owner signed in on box screen.

## Post-login walk (Home to Sell to Customers to Stock to Make to Money to Reports to More to Settings)

**Common chrome (all modules)**  
- Top nav labels (exact order): **Home / Sell / Customers / Stock / Make / Money / Reports / More**  
- Rate chip: **GOLD RATE Rs. NOT SET** (persistent)  
- Search: Search (Ctrl+K)... / **+ New** / Firm: Maa Tara Jewellers  
- Attention/bell: red badge **1**  
- Credits: not on top chrome; seen under Settings > Billing & Usage as **Credits left** / **Buy credits**  
- Footer: Online / company / FY / user / Owner / Main Branch / Ready

### Home
- **Default landing:** Good day / Daily operations overview (module cards).
- **Gold-vs-cash:** No GOLD TODAY / CASH TODAY number blocks. Cards note gold/cash stay separate; Money card mentions Cash | Gold @995; TODAY'S SNAPSHOT is gold-leaning (Vault Gold, Gold With Karigar, Finished Stock, Party/Grahak Gold Held, Open Orders, Today's Billing).
- **Primary CTAs / shortcuts:** New sale, Orders, Customers, Who owes, Stock, Scan tag, Jobs, Give metal, Meena, Gold vault, Cash book, Receipts, Day done, Sales, Firm, Company, Rates; also Gold Rate Not Set attention card.
- **Rate / credits / bell:** chip NOT SET; no Credits chip on Home; bell = 1.

### Sell
- **Default landing:** Billing (Gold-First).
- **Gold-vs-cash:** Gold-first summary (Fine Gold / Gold / Gold Due); cash as Cash Equiv Rs.
- **Primary CTAs:** + New Settlement, + New Invoice (two strong actions). Sub-nav: Invoices Register, POS Billing F2, Quotations & Estimates, Customer Orders, Design Catalogue, Delivery Challans, Credit & Debit Notes. Tabs: Invoices, Outstanding, Customer Ledger, Gold Settlements, Customer Settlements.
- **Rate / credits / bell:** no separate missing-rate banner; top chip NOT SET; "Credit" only in Credit & Debit Notes; bell still present.

### Customers
- **Default landing:** People Directory.
- **Gold-vs-cash:** no Gold bal | Cash bal header on this landing; Who owes is a separate sub-nav for outstanding.
- **Primary CTAs:** Add Party / Grahak, Add Firm, Add Karigar / Worker, Add Employee, Add Vendor. Sub-nav: Customers, Suppliers, Who owes. Directory mixes Party, Firms, Karigar, Employees, Vendors, KYC.
- **Rate / credits / bell:** chip NOT SET; no credits wording; bell present.

### Stock
- **Default landing:** **Gold** (not Ready Stock). Copy: "Firm gold first - Fine g @995 by custody. Ready jewellery is on the Ready tab."
- **Gold-vs-cash:** gold-only on this tab; headers FINE G @995, SHOWROOM, VAULT, KARIGAR.
- **Primary CTAs / sections:** Gold, Ready F3, Raw lots, Tag piece, Scan tag, Transfers, Branch trays, Stones, Hallmark, Physical audit. Internal tabs: Gold / Ready / Raw / WIP / Karigar / Branch / Transfers / Items (Gold selected). Actions: Gold vault, Give metal, Raw lots, WIP/jobs, Ready pieces.
- **Rate / credits / bell:** chip NOT SET; no credits; bell present.

### Make
- **Default landing:** Manufacturing Books.
- **Gold-vs-cash:** cards include Jeweller Gold With Us, Gold Owed To Us, Cash Outstanding Rs, Open Orders, Open Job Cards.
- **Primary CTAs:** Receive Finished Product. Empty: No jeweller books yet. Sub-nav: Workshop Cockpit, Karigar Gold Book, Production Job Cards, Outside Work, Polishing & Processes, Meena, Dhadi Groups, Melt & Assay, Artisan Settlements. Literal **Give metal** / **Get back** not the primary landing labels (Give metal exists on Home shortcuts).
- **Rate / credits / bell:** chip NOT SET; no credits on Make; bell present.

### Money
- **Default landing:** Our Gold Stock (vault / gold balance sheet first).
- **Gold-vs-cash:** Gold Balance Sheet - Balanced; separate Total Outstanding Cash card; tabs Balance Sheet, Material Vault, Opening Vault, Gold Movements, Company Cash Ledger.
- **Primary CTAs:** Export CSV/XLSX, Print Ledger, Tally Export. Sub-nav includes Gold vault, Cash Book, Payment & Receipt Vouchers, Bank Reconciliation, Financial Statements, etc.
- **Rate / credits / bell:** chip NOT SET; no credits on Money; no mojibake/RPC strings seen; bell present.

### Reports
- **Default landing:** Accounting & Statutory Report Center (technical / suite hub).
- **Gold-vs-cash:** both present in catalogue (Gold Position/Outstanding, Fine Rojmel, Company Cash Book, Cash Flow, etc.). Fineness Standard 995 / 99.50%.
- **Primary CTAs:** report search, category selector, traditional-name search, Save Suite Snapshot. Copy style TRANSACTION > LEDGER > SUBLEDGER > REPORT (not question-first for operators).
- **Rate / credits / bell:** chip NOT SET; no credits; bell present.

### More / Settings
- **More:** opened Settings-style destinations (no separate flyout observed in this walk): Firm Profile & Branch, Automation Engine, Live Bullion Rates, Customization & Print, Hardware & Devices, WhatsApp & Email, Security & Audit, System Diagnostics, Attendance.
- **Settings:** tabs General, Business & Branches, Users & Roles, Security, Notifications, Integrations, Billing & Usage, Customization, Advanced/Developer.
- **Owner access:** Owner could open Users & Roles (Onboard Showroom Staff, directory, invites) and Business & Branches - **no Access Restricted** banner. Some ACL matrix / lock-delete controls disabled.
- **Credits wording (Billing & Usage):** **Credits left 1000.0**, AI Usage, WhatsApp, Monthly Plan Grant, **Buy credits**. One Advanced/Developer-adjacent label referenced MCP Server / JSON-RPC tools / diagnostics (admin-facing).

## vs locked AVS-4 (Home/Sell/Customers/Stock/Make/Money/Reports/More; Stock opens on Gold first)

| AVS-4 target | Live observe (777) |
|--------------|--------------------|
| Top nav words Home/Sell/Customers/Stock/Make/Money/Reports/More | **Match** |
| Stock default = Gold (not Ready Stock) | **Match** - Gold selected; Ready on separate tab |
| Rate chip to Set today's gold rate | Chip present but **NOT SET**; no one-tap "Set today's gold rate" CTA observed on chip/Home banner |
| Home: Gold today then Cash + shortcuts Sell / Old gold / Give metal / Who owes / Day done | Partial: Who owes / Give metal / Day done exist; **no Gold today / Cash today blocks**; card grid still primary |
| Sell: one gold primary; scan-first; missing-rate banner | Gold-first billing yes; **two** strong CTAs (Settlement + Invoice); POS F2 present; no dedicated missing-rate banner |
| Customers = grahak; Gold|Cash header | People Directory still mixes Party/Karigar/Employee/Vendor; no bal header on landing |
| Make: Jobs; Give metal / Get back | Manufacturing Books / Workshop Cockpit / Receive Finished Product; Dhadi / Meena still in sub-nav |
| Money: Cash | Gold @995; Who owes / Receipts first | Lands on **Our Gold Stock** / vault; cash secondary |
| Reports: question-first hub | Accounting & Statutory suite hub (jargon-first) |
| Credits: Credits left / Buy credits | **Match** inside Settings Billing & Usage; not a Home/chrome chip |
| Attention bell + Needs attention | Bell badge **1** present; Home has Gold Rate Not Set card |
| Icon+word / Owner Team | Owner reached Users & Roles without Access Restricted |

## Must improve (ranked P0/P1/P2)

Aligned to `01-IMPROVEMENTS.md` from what live actually shows (observe to improve list; not a bug hunt):

### P0
- **P0-1 / ops-hostinger-pull** - Keep Hostinger pull awareness: this walk is LIVE; tip may differ until pull.
- **P0-2 / ux-nav-shell** - Nav **words already match** AVS-4 on live. Remaining shell work is density/icon+word polish and reducing jargon *inside* modules, not renaming top tabs.
- **P0-3 / ux-stock-gold-first** - **Already true on live** (Gold default). Keep regression-watched after future deploys.
- **P0-4 / ux-rate-cta** - Rate chip still **GOLD RATE Rs. NOT SET** with no clear one-tap **Set today's gold rate** from chip/Home.
- **P0-5 / ux-home** - Home still Daily operations **card grid**; missing Gold today then Cash today blocks and the locked five-shortcut strip as primary.

### P1
- **P1-1 / ux-credits-copy** - Settings already uses Credits left / Buy credits; add chrome **Credits left** chip so operators need not dig into Billing & Usage.
- **P1-2 / ux-attention** - Bell shows **1**; ensure Needs attention list uses plain titles + one fix (rate first).
- **P1-7 / ux-settings-owner** - Owner Settings access looked open this pass; keep VERIFY after tip/LIVE sync.
- Sell path: move toward **one** gold primary + scan/search-first (AVS-4 Sell sheet) - still two strong CTAs.
- Customers: land on grahak with Gold bal | Cash bal; park Karigar under Make.
- Make: promote Give metal / Get back / Jobs over Workshop Cockpit / Receive Finished Product / Dhadi as primary verbs.
- Money: operator landing Cash | Gold @995 with Who owes / Receipts before vault ledger exports.
- Reports: question-first operator hub over TRANSACTION>LEDGER suite chrome.

### P2
- **P2-1 / ux-plain-verbs** - Replace remaining admin jargon (Accounting & Statutory, MCP/JSON-RPC labels on firm Settings Advanced, Dhadi as primary nav word).
- **P2-5 / qa-live-verify** - Re-VERIFY branding/mojibake after next Hostinger pull (none seen this pass on walked screens).

## LIVE vs tip notes

- Walked **LIVE** only (`erp.arivahly.in`, Ready, v1.1.1). Local tip at `C:\final erp 29.08\new and final` not compared screen-by-screen this pass.
- Per project scope: **LIVE is not tip until Hostinger pull of main** (not shop). Treat Stock-opens-on-Gold and AVS-4 nav words as live facts already; rate CTA + Home gold/cash blocks still open on live.
- Shop `maatarajewellers.shop` not touched.

## Status: Done