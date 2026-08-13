# Notifications

Notifications is the operational attention center at `/notifications`. The header bell shows the unread count and opens the center.

## Sources

The center derives actionable notifications from existing sources of truth; it does not create a parallel business ledger:

- missing current gold rate;
- license state requiring attention;
- Supabase connectivity, retry, and operational delivery failures;
- pending or permanently failed communication-queue entries;
- pending approval-workflow requests.

Opening an item marks it read and navigates to the module that owns the underlying state. Platform notification read state is stored in Supabase where available; computed operational alerts may use browser UI metadata only for dismiss/read presentation. Notifications never mutate gold, communication, approval, or business records.

## Supabase-online operation

Ornexa production uses the Supabase-online architecture. The notification center shows Supabase-backed approvals, support events, communication delivery status, and operational attention items where available.

The center degrades safely when Supabase or a configured communication provider cannot be reached, with clear retry/support paths instead of silently creating local business records.
