# MVP-NAV leftover (after MVP-STOCK)

Shipped in `feat/mvp-stock-gold-first`: **Stock → Gold default** only (AVS-32 / AVS-4).

## Not in this PR (too risky as one mega rewrite)

Primary firm chrome is still **not** locked to:

`Home · Sell · Customers · Stock · Make · Money · Reports · More`

Current surfaces still using Operations / Accounts / Settings mega IA:

- `src/components/layout/WorkspaceNavRail.tsx` — Home · Operations · Accounts · Settings
- `src/lib/navigation-groups.ts` — Offline-style Retail / Manufacturing / Treasury folders
- `src/components/layout/Sidebar.tsx` / `app-shell.tsx` — dense module chrome

## Safe follow-up (AVS-57 / MVP-NAV)

1. Relabel / reorder **primary** firm rail to the locked 7+More verbs without inventing routes.
2. Keep Admin / Treasury / Customization under **More**.
3. Do not collapse gold+cash; do not touch `CONTAMINATED_SHOP_NAMES` here.

Gate: prefer after RATE-01 live VERIFY (#25) per AVS-4 / AVS-32.
