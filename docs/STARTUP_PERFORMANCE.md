# Startup Performance

The application uses a staged startup path in Offline, Hybrid, and Online modes.

1. Authentication, deployment mode, brand/theme, and shell settings load first.
2. Operational stores hydrate after the shell becomes usable.
3. Security monitoring starts after the first paint.
4. communication, sync-outbox, and bullion-rate services start after six seconds during browser idle time.
5. scheduled reports, reminders, reconciliation, recovery drills, and statements start after twelve seconds during idle time.

Global command, session-lock, and print-preview UI are separate lazy chunks. The notification aggregator is deferred, and the obsolete development test harness is not attached to the renderer.

SQLite initializes its schema only for a new database or a schema upgrade. A normal launch no longer re-runs the complete table/index definition or exports, encrypts, hashes, and rewrites an unchanged database. Schema version 3 records this optimized baseline.

Cloud data loading has one owner (`data-loader`). The former root-level duplicate branches/workshops fetch is not part of application startup.
