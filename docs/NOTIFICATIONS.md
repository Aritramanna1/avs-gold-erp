# Notifications

Notifications is the operational attention center at `/notifications`. The header bell shows the unread count and opens the center.

## Sources

The center derives actionable notifications from existing sources of truth; it does not create a parallel business ledger:

- missing current gold rate;
- license state requiring attention;
- SQLite outbox changes and unresolved synchronization conflicts;
- pending or permanently failed communication-queue entries;
- pending approval-workflow requests.

Opening an item marks it read and navigates to the module that owns the underlying state. Read state is local UI metadata only. Notifications never mutate gold, communication, approval, or synchronization records.

## Deployment modes

- **Offline:** local configuration, queue, and cached operational conditions remain visible.
- **Hybrid:** local conditions plus cloud synchronization status are shown.
- **Online:** cloud-backed approvals and operational status are shown where available.

The center degrades safely when a remote service cannot be reached.
