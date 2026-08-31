# Contributing to AVS Gold ERP / Ornexa

We welcome contributions to the Supabase-online Ornexa ERP. To maintain a clean and reliable codebase, contributors must follow the current production architecture and canonical rules in the docs set.

## Development standards

- **Clean architecture**: Follow the approved Supabase-backed repositories, services, and store patterns. Do not reintroduce local-first, local SQLite, IndexedDB-authoritative, or hybrid database patterns.
- **Strict linting and formatting**: Ensure code adheres to ESLint rules and Prettier formatting:
  ```bash
  npm run lint
  npm run format
  ```
- **Type safety**: Maintain TypeScript type coverage and verify compilation with `npx tsc --noEmit`.

## Pull request workflow

1. **Branch naming**: Use descriptive branch names:
   - `feature/your-feature-name`
   - `fix/bug-description`
2. **Commit history**: Do not force-push or amend commits that have already been pushed to shared branches.
3. **Verification**: Validate the required build gates before opening a PR:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
4. **Submitting changes**: Open a PR with clear details explaining what the change accomplishes and how it was validated.
