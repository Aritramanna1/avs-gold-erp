# Ornexa Security Model

## Baseline

Supabase Auth, RLS, RBAC, tenant isolation, branch isolation, storage isolation, secure tokens, signed links, audit, rate limiting, HTTPS, secure headers, CORS, secrets management, session security, input validation, XSS protection, safe uploads, and safe exports.

## Portal Authorization Invariant

> **A portal identity belongs to one authorized tenant context and one or more explicitly linked Party relationships. No portal request may escape that authorization boundary.**

External portals (Customer, Karigar, Supplier) resolve scope exclusively through `portal_identities` and `portal_party_links`. Communication sends validate recipient party and referenced document via `assert_communication_scope()`.

## Prohibited

Do not rely on localStorage/sessionStorage/frontend flags/hidden routes as authorization. Do not expose service-role keys, database passwords, private signing keys, or privileged API secrets to the client.

## Validation Areas

Authentication, authorization, RLS/IDOR/BOLA, public routes, files/storage, license manipulation, client exposure, input security, business logic, and hardening.
