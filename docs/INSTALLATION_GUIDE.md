# Installation Guide

> Superseded production guidance: this older Version 1 installer guide described
> Offline/Hybrid testing behavior. Ornexa / AVS production is now
> Supabase-online only. Do not ask users to choose Offline or Hybrid during
> production setup. Use `docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md`,
> `docs/ARCHITECTURE.md`, and `docs/DATABASE.md` for current architecture.

Version 1 Testing Build supports Windows 10/11 x64. Obtain the installer and its SHA-256 from the release owner. Verify the hash, close older AVS Gold ERP instances, run the installer, and choose a per-user install folder. The current unsigned installer may show Windows Unknown Publisher; distribute only through a trusted Arivahly channel.

On first launch use the Supabase-online onboarding path. Keep the Windows user profile and application-data folder protected for runtime preferences, downloaded artifacts, and browser/session state, but do not create a local authoritative ERP database. Do not copy an active data profile between machines; use the approved Supabase backup, export, and recovery controls.

Uninstallation may remove application binaries but must not be treated as a backup. Export a verified backup first.
