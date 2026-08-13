# Startup Performance

The application uses a staged Supabase-online startup path.

1. Supabase authentication, brand/theme, and shell settings load first.
2. Operational stores hydrate after the shell becomes usable.
3. Security monitoring starts after the first paint.
4. Communication, notifications, and bullion-rate services start after six seconds during browser idle time.
5. Scheduled reports, reminders, reconciliation, recovery drills, and statements start after twelve seconds during idle time.

Global command, session-lock, and print-preview UI are separate lazy chunks. The notification aggregator is deferred, and the obsolete development test harness is not attached to the renderer.

The retired local SQLite/Hybrid boot path is not part of production startup. Do not add local database schema initialization, local outboxes, or browser-local business backup work to improve perceived launch speed. Use route-level lazy loading, skeleton states, Supabase query tuning, and background hydration instead.

Supabase data loading has one owner (`data-loader`). The former root-level duplicate branches/workshops fetch is not part of application startup.
