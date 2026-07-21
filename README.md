# ERP Gold

Offline-first jewellery manufacturing ERP for Electron, React, TypeScript, SQLite, and optional Supabase hybrid/SaaS operation.

Current distributable identity: **AVS Gold ERP Version 1.1.0 Production Release** (`1.1.0`) by [Arivahly Venture Sphere](https://arivahly.in/). This is a controlled jewellery-manufacturing workshop build, not a retail POS.

## Development

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run dev
```

Run the Electron development application with:

```sh
npm run electron:dev
```

Production checks and builds:

```sh
npm run lint
npx tsc --noEmit
npm run build
npm run build:electron
```

## Documentation

To help you get started, we have compiled the following guides:
- [Installation Guide](INSTALLATION.md)
- [User Guide](USER_GUIDE.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Support Channels](SUPPORT.md)
- [Release Notes](RELEASE_NOTES.md)
- [Changelog](CHANGELOG.md)

Start with the canonical [documentation index](docs/README.md). Installation, setup, Offline/Hybrid operation, administration, user workflows, backup/restore, troubleshooting, security, licensing, and release notes are linked there. Developers should also read [CLAUDE.md](CLAUDE.md).

## Configuration

Settings is the single configuration hub. Brand identity, print branding, support and reseller details, WhatsApp providers, WasenderAPI sessions, automation, templates, output behavior, authentication, licensing, and operational defaults are configured there. WasenderAPI secrets are stored through Electron's encrypted credential storage rather than application settings.

Licensing is isolated from customer data: the replaceable client provider calls only the embedded Arivahly Licensing API, validates a signed device entitlement, and never receives Central Licensing Database credentials. A production build must provide the licensing endpoint and Ed25519 public key described in [the Licensing Guide](docs/LICENSING.md).

## Repository safety

This repository is connected to Lovable. Do not rewrite published history with force pushes, rebases, amended pushed commits, or squashed pushed commits.

