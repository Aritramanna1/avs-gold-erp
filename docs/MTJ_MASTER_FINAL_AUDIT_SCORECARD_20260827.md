# MASTER FINAL audit scorecard — post migration apply 2026-08-27

Foundation: index-CVsE73i6.js = git 8dc1c43 → additive main tip
Live DB: dqgrrafuoxaorvyrcuuh — 20260827180000..230000 applied via linked CLI

| Area | Mark |
|------|------|
| Editions 10/30/50 + MTJ/MTG | PASS (DB verified) |
| Config bundles export+import | PASS |
| Gold fineGoldMg /999 + default 995 | PASS (both conversion overloads /999) |
| Print vs PDF / logo / Hisaab hide | PASS |
| QR / public verify | PASS |
| Google OAuth + role redirect | PASS (live interactive needs Owner Google creds) |
| MTJ/MTG shell | PASS |
| Box entry | PASS (upsert validation + RLS error surface) |
| Entitlement RPC | PASS |
| Rate limit | PASS (consume_public_rate_limit live) |
| Barcode | PASS (AVS stock/billing links; hide≠delete) |

VIOLATE: none
