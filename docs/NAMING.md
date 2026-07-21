# Naming Conventions

## Files

- Routes: file-based TanStack Router names — `workshop.gold-book.tsx`, `orders.$id.tsx`, `billing.credit-note-print.$id.tsx`. Dynamic segments use `$param`.
- Services/stores: kebab-case — `worker-gold-book-store.ts`, `daily-material-slip.ts`, `ledger-store.ts`.
- Components: kebab-case files, PascalCase exports — `whatsapp-doc-menu.tsx` exports `WhatsAppDocMenu`.
- Self-checks: `<name>.selfcheck.ts` (assert-based, runnable via `npx tsx`).

## Symbols

- Zustand stores: `useX` hook + `XState` interface — `useLedger`, `useWorkerGoldBook`.
- Pure compilers/aggregators: `compileX` / `buildX` / `computeX` — `compileWorkerBook`, `buildJobCardData`, `computeBalances`.
- Types/interfaces: PascalCase — `LedgerEntry`, `DailyMaterialSlip`, `MaterialStockItem`.
- Enums as string unions, not TS `enum` — `MovementType`, `PrintDocType`.

## Units in identifiers

Weights end in `Mg` (`fineMg`, `grossMg`, `netMg`, `deltaMg`); money ends in `Paise`; per-mille purity is `purity`. Display-formatted strings end in `Label`/`Text` (`custodyBalanceLabel`). Never store a grams/rupees float in a `*Mg`/`*Paise` field.

## Domain vocabulary

| Term | Meaning |
|---|---|
| Karigar / Worker | Bench worker holding gold in custody |
| Jeweller | Wholesale client placing manufacturing orders |
| Gold Held / Vault | Raw gold owned by the firm (source of truth) |
| Custody balance | Gold currently physically with a worker |
| Fine / fine gold | Pure-gold equivalent = gross × purity ÷ 1000 |
| Touch | Purity in per-mille |
| Slip | Consolidated daily material document (`MTS-…`) |
| Jama / Naam | Credit / debit in party ledgers |

## Document numbers

`<PREFIX>-<YYYYMMDD>-<NNN>` via `nextDocumentNumber`. Prefixes: `WGB-G`/`WGB-R` (worker gold book give/return), `JC` (job card), `MTS` (material transaction slip). Keep prefixes short and stable.
