# Version 1 Testing Build

Build identity: AVS Gold ERP `1.0.0-testing.1` by Arivahly Venture Sphere.

## Windows installer

- File: `release-build/AVS-Gold-ERP-V1-Testing-Setup.exe`
- Size: `130,388,416` bytes
- SHA-256: `EF44AF156F0D9BF78EB75C3C6E8184070CEC72A6056CB12C1FB9C8DFFA403D16`
- Authenticode: **Not signed**

Distribute only through a trusted Arivahly channel and verify the SHA-256. Windows may show Unknown Publisher until a code-signing certificate is configured.

## Verification performed

- `npx tsc --noEmit`: passed.
- Electron TypeScript build: passed.
- Focused ESLint for release-touched source: passed.
- Full `eslint .`: did not complete within three minutes because the repository includes large auxiliary tool/vendor trees; this is an unresolved verification gap, not a pass.
- Renderer production build: passed with chunk-size/ineffective-dynamic-import warnings.
- NSIS packaging: passed.
- Bundle checks found no Gold Payment audit UI, remote Google Fonts, or development upload emulator.
- Master Hybrid SQL static check: 60 tables, 34 indexes, 31 policies, zero Supabase Storage references.
- `npm audit --omit=dev`: one high-severity direct dependency finding in `xlsx` (prototype pollution/ReDoS); no npm fix is available for the current package line.
- Playwright was not run, as required.

## Test-release limitations

This artifact is for the owner's internal two-day test only. It is not approved for customer production. Do not treat Hybrid as accepted until its authenticated sync/RLS design and a clean live-project test are complete. Licensing requires a real Arivahly endpoint and Ed25519 public key in the build; the desktop rejects unsigned responses.

Electron was launched from the final build on 2026-07-18 and left open for manual testing (root PID at handoff: `39068`).
