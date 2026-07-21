# Workflow Rules

Business invariants every module must respect. Violating these corrupts the gold books.

## 1. Gold Vault is the single source of truth

Every module that consumes or returns gold must ultimately reconcile with the Gold Vault (`ledger-store.ts` bucket model: `vault | karigar | finished | customer | jeweller | scrap`). No module keeps an independent mutable gold balance.

- Balances are **derived** from movements, never stored and edited.
- A ledger entry's per-bucket `deltas` must sum to its `netFineMg` (enforced in `useLedger.append`; it throws otherwise).
- Internal transfers (issue/return) are net-zero across buckets. Purchases/opening add; sales/deliveries reduce.
- Worker custody, material stock, and party gold balances are all compiled from their movement logs — not cached.

## 2. Money and weight are integers

Gold = milligrams, purity = per-mille, money = paise. Fine = `round(grossMg × purity ÷ 1000)`. No floats in accounting. Convert only for display.

## 3. Documents are consolidated, not per-transaction

Worker material handovers roll up into **one Daily Material Slip per worker per day** (`MTS-YYYYMMDD-NNN`), not a receipt per transaction. Every transaction carries its slip number so any ledger row traces back to the printed slip.

## 4. One generator per document

A document is defined once (Print Engine template + data-mapper builder). Print, preview, PDF download, and WhatsApp send all consume that one definition. Never duplicate document generation.

## 5. Offline-first writes

Write local + outbox first (`createRepository`), let `sync-engine` push to Supabase. Never block a workflow on the network; never write directly to Supabase bypassing the outbox.

## 6. Financial period locks

Postings dated in a month-end-closed period are rejected (`assertPeriodOpen`). Respect the lock; do not write around it.

## 7. Communication

Outbound WhatsApp routes through the configured provider (WasenderAPI when configured, deep-link fallback otherwise) via `send-whatsapp-text.ts` / `send-whatsapp-document.ts`. Never hard-code `wa.me` links in a screen. Document sends attach the Print Engine PDF.

## 8. Audit

Ledger and vault postings are audited best-effort (`security/audit-log.ts`) — a logging failure never blocks the posting.
