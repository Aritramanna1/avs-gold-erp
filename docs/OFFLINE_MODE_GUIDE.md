# Offline Mode Guide

Offline is the recommended first-install mode. It uses local SQLite, local encrypted files, and local authentication. It does not require Supabase, cloud storage, or internet access.

All business work remains available locally. WhatsApp is the only intentionally online feature: messages queue locally when delivery cannot run and retry when connectivity returns. Cloud-specific errors must not be shown in Offline mode.

Backups are the operator's responsibility. Create them regularly, store a second copy on protected removable media, and test restoration. To enable Hybrid later, back up first and use Settings → Enable Cloud Sync; never delete the local database.
