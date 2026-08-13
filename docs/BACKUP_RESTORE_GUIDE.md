# Backup & Restore Guide

Use Settings -> Backup & Recovery. Create a Supabase-controlled backup before upgrades, imports, bulk changes, and at the end of each working day. Keep at least one protected copy away from the workstation/account and document who created it.

Before restore: stop posting, record the current time, create an additional backup if the database is reachable, confirm the selected recovery point belongs to this project/firm, and capture the reason for restore. Restore only through authorized Supabase recovery procedures.

After restore, verify firm identity, users, branch access, latest documents, Gold Vault totals, attachment availability, audit logs, and representative customer/karigar/account ledgers.

Do not edit database dumps manually, copy browser profile folders, restore IndexedDB/localStorage, or use retired browser-local pilot exports as production backups. Supabase database, storage, auth, and edge/runtime configuration each need explicit recovery evidence.
