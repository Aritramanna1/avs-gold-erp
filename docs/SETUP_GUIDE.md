# Setup Guide

> Current production setup is Supabase-online only. Older Offline/Hybrid setup
> modes are retired historical references and must not be offered in production.

1. Sign in through Supabase Auth with an invited or platform-provisioned account.
2. Verify the first platform/tenant owner role and firm assignment in Supabase-backed user/role records.
3. Configure firm identity, branch, document numbering, gold/purity defaults, fiscal/GST behavior, and backup policy in Settings.
4. Configure printers/scanner only if present; run a non-financial sample preview.
5. Configure WhatsApp only if online messaging is required.
6. Create restricted users/roles and verify branch scope through RLS-backed access.
7. Record opening gold exclusively through approved Gold Vault workflows.
8. Verify Supabase backup/disaster-recovery readiness before entering live workshop data.
