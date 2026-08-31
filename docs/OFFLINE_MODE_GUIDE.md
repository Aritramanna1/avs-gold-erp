# Retired Offline Mode Guide

> Superseded production guidance: Ornexa / AVS production is Supabase-online only.
> Do not use this document to build, configure, sell, deploy, or justify an
> Offline/local-auth/local-database runtime. It remains only as a historical
> design record for business-rule recovery. The current authoritative
> architecture is `docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md`,
> `docs/ARCHITECTURE.md`, and `docs/DATABASE.md`.

The design below is retired. Offline is no longer the recommended first-install
mode, and local SQLite, local encrypted files, and local authentication are not
approved production authority.

The old Offline design allowed business work to continue locally, queued WhatsApp messages, and avoided cloud-specific errors. That behavior is not the current production architecture.

Historical backups remain the operator's responsibility. Preserve them when recovering old pilot evidence, but do not create new production workflows that depend on a local ERP database or Hybrid activation.
