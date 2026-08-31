# Installation Guide

This guide documents the current Supabase-online installation path for AVS Gold ERP / Ornexa. Offline, local-first, hybrid, and local SQLite deployment modes are retired and must not be used as production setup instructions.

## Prerequisites

- Node.js 20+
- npm 10+
- Access to the approved Supabase project for the tenant
- Valid organization/tenant authentication and authorization in Supabase Auth

## Development setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Configure the environment variables for the approved Supabase project in the local `.env` file or the deployment environment:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-or-approved-key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
```

4. Start the application:

```bash
npm run dev -- --host 0.0.0.0
```

5. Validate with the required build gates:

```bash
npx tsc --noEmit
npm run build
```

## Production deployment

Production deployment must use the approved Supabase-backed tenant configuration and frontend runtime. No local database initialization, detached SQLite state, or hybrid sync boot path is permitted for authority-critical ERP operations.

Use the canonical guides in [docs/README.md](docs/README.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current operator workflow.
