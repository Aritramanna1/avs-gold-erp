# Security

The web application uses Supabase Auth sessions, organization-aware access controls, PostgreSQL RLS, CSP, and browser-safe external-link handling.

## Secrets and local protection

- Sessions and authorization are managed by Supabase Auth and PostgreSQL RLS.
- WasenderAPI credentials remain in the main process, require OS-backed encryption, and are never readable through the preload bridge. The outbound proxy restricts HTTPS hosts/methods, request sizes, response sizes, and caller headers.
- Business-generated files use Supabase Storage where required; personal identity documents are not stored.
- The Hybrid service-role key is setup-only and discarded. Project URL and anon key are runtime configuration.
- The licensing client knows only the Arivahly Licensing API and an Ed25519 public key. It never knows Central Licensing Database credentials.

The first local account is the permanent Super Owner. Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations; legacy hashes upgrade after successful sign-in. Sessions have absolute expiry and device binding. Repeated failures trigger a timed account lockout.

## Remaining release risks

- The Windows installer remains unsigned until an Arivahly code-signing certificate is configured.
- The current Hybrid master migration grants the project anon role broad single-tenant table access because runtime sync has no dedicated authenticated cloud identity. Treat the anon key as customer-sensitive and do not approve Hybrid for production until this is replaced with an authenticated sync principal and restrictive RLS.
- A service-role key cannot execute arbitrary PostgreSQL DDL through the Supabase Data API. Fresh-project automatic master-schema installation needs a separate authenticated provisioning/SQL mechanism; the current safe workflow is owner-applied master SQL followed by ERP validation.
- No independent penetration test or live clean-project Hybrid acceptance test has been completed.

Never place customer PII, access tokens, service-role keys, passwords, licensing private keys, or Central Licensing Database credentials in source, documentation, logs, or support messages.
