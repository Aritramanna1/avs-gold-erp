# Contributing to AVS Gold ERP

We welcome contributions to AVS Gold ERP! To maintain a clean and reliable codebase, please adhere to the following contribution workflow.

## Development Standards
- **Clean Architecture**: Follow the established offline-first database repositories and store patterns.
- **Strict Linting & Formatting**: Ensure code adheres to ESLint rules and Prettier formats:
  ```bash
  npm run lint
  npm run format
  ```
- **Type Safety**: Maintain TypeScript type coverage. Run `tsc` to verify compilation.

## Pull Request Workflow
1. **Branch Naming**: Use descriptive branch names:
   - `feature/your-feature-name`
   - `fix/bug-description`
2. **Commit History**: Do not force-push or amend commits that have already been pushed to public staging branches. Keeping clean history ensures seamless synchronization with project editors.
3. **Verify Tests**: All automated tests must pass before opening a Pull Request:
   ```bash
   npx playwright test
   ```
4. **Submitting Changes**: Open a PR with clear details explaining what the change accomplishes and how to test it.
