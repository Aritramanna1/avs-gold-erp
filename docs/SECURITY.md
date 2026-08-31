# Security

The web app uses Supabase Auth, Supabase PostgreSQL, RLS, Storage, and approved Supabase-compatible services as the production authority. Browser/session state is never an authorization source.

## Secrets And Platform Protection

- Roles, firm/branch membership, entitlements, and sensitive access decisions must be enforced through Supabase/RLS or server-side RPCs.
- WasenderAPI and other provider credentials must be stored only in approved secret/configuration services and never exposed to the browser.
- Do not ship service-role keys, SQL connection strings, private signing keys, or privileged API secrets in frontend bundles, docs, logs, support tickets, or screenshots.
- The licensing client knows only the Arivahly Licensing API and an Ed25519 public key. It never knows Central Licensing Database credentials.

The first owner/platform account must be represented in Supabase Auth plus the approved user profile/role model. Do not restore obsolete local-auth bypasses. Sessions should expire according to the approved browser-session policy and sensitive actions should re-check the current Supabase user where appropriate.

## Remaining Release Risks

- The Windows installer remains unsigned until an Arivahly code-signing certificate is configured.
- Fresh-project provisioning, migrations, RLS policy changes, storage policy changes, and privileged RPC changes require authenticated Supabase migration/provisioning workflows, not frontend Data API shortcuts.
- Independent penetration testing, authenticated workflow testing, and advisor cleanup remain required before production-ready status.

Never place customer PII, access tokens, service-role keys, passwords, licensing private keys, or Central Licensing Database credentials in source, documentation, logs, or support messages.
