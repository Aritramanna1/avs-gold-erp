# Portal routing verification (Wave 5)

## Registered portals (actual route registry)

| Role / workspace | Login path | Home after auth | Status |
|------------------|------------|-----------------|--------|
| Customer | `/customer-login` → unified `/login` | `/customer-portal` | Wired via `workspaceHomeRoute` + AuthGate |
| Karigar / Worker | `/karigar-login` → `/login` | `/karigar-portal` | Wired |
| Supplier | `/supplier-login` → `/login` | `/supplier-portal` | Wired |
| Platform Owner | `/login` | `/platform` | Wired via `get_authorization_context` + `set_platform_workspace` |
| ERP / MTG staff | `/login` | `/app` or `/mtg` | Wired by entitlements |

## Carrier portal

**Not present** in the TanStack route registry. Party type “carrier” may exist for logistics metadata, but there is **no** Carrier Portal authentication shell or routes.

Do **not** invent a Carrier portal in this wave. If required later: add routes + RLS/RPC + entitlement in a dedicated PR.

## Security principle

Frontend hide ≠ security. Portal isolation remains RLS + SECURITY DEFINER RPCs. Cross-tenant Firm A ≠ Firm B must continue to fail at the API layer.
