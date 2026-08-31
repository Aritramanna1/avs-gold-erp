# AVS Gold ERP / Ornexa

This repository is the Supabase-online jewellery manufacturing ERP for AVS/Ornexa. The production architecture is authoritative and single-source: Supabase Auth, PostgreSQL, RLS, RPCs, Storage, cloud workflows, and browser session state only. No production path is permitted to rely on local SQLite, local-first sync, IndexedDB primary persistence, local auth, or hybrid-as-authoritative runtime logic.

Current distributable identity: **AVS Gold ERP / Ornexa** by [Arivahly Venture Sphere](https://arivahly.in/). This is a controlled jewellery-manufacturing workshop ERP, not a retail POS.

## Development

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run dev
```

Production checks and builds:

```sh
npm run lint
npx tsc --noEmit
npm run build
```

## Documentation

Use the canonical documentation set under [docs](docs/) and the master specification set under [docs/MASTER](docs/MASTER/). Historical root-level notes and retired Offline/Hybrid guides are preserved only as contextual references and must not be used as production instructions.

- [docs/README.md](docs/README.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DATABASE_AND_SUPABASE_MASTER.md](docs/DATABASE_AND_SUPABASE_MASTER.md)
- [docs/ORNEXA_PRODUCT_CONSTITUTION.md](docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md)
- [docs/MASTER/FINAL_ERP_COMPLETION_GOAL.md](docs/MASTER/FINAL_ERP_COMPLETION_GOAL.md)

## Runtime and data rules

- Authentication: Supabase Auth
- Authorization: Supabase RLS/RBAC and approved RPC checks
- Tenant data and ledger history: Supabase PostgreSQL
- Files and attachments: Supabase Storage and signed URLs
- Browser state: session memory, UI preference, draft state, and transient client caches only

There is no production Offline or Hybrid database mode. Legacy local/offline architecture is retired and intentionally removed from the current operator path.

## Repository safety

This repository is connected to controlled project history. Do not rewrite published history with force pushes, rebases, amended pushed commits, or squashed pushed commits.
