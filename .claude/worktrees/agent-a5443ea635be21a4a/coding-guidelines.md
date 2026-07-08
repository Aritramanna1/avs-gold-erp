# MTJ ERP — Coding Guidelines

This document details the code architecture, structural conventions, quality standards, and verification requirements for developers working on the MTJ ERP platform.

---

## 1. Coding Conventions & Best Practices

- **TypeScript Everywhere**: Enforce strict compilation configurations. `any` types are forbidden unless interacting with untyped third-party packages (which should be wrapped immediately).
- **Precise Wealth Arithmetic**: Never use floating-point types to represent monetary assets or gold weights.
  - ❌ _Bad_: `const total = item.weight * item.rate; // 1.2000000000004 grams`
  - _Good_: `const totalPaise = Math.round((item.netMg * item.ratePerGramPaise) / 1000);`
- **Declarative Code Patterns**: Keep React components clear and predictable. Use functional components with hooks, avoiding heavy nested state functions.

## 2. File Naming Rules

- **Components**: PascalCase (e.g., `/src/components/CounterBillingWizard.tsx`).
- **Routes**: File-system-based routing convention utilizing lowercase dots/hyphens (e.g., `/src/routes/billing.new.tsx`).
- **State Stores & Libraries**: lowercase-kebab-case (e.g., `/src/lib/billing-store.ts`).
- **Types**: Singular `types.ts` at `/src/types.ts` containing the shared models.

## 3. Component Structure Guidelines

To prevent long components from exceeding token limits and becoming unmaintainable, follow this structure:

1. **Imports**: Group imports into Standard React, Domain Stores, Shared UI, and Icons.
2. **Types**: Component-specific interfaces/types should be clearly declared at the top of the file.
3. **Sub-components**: Extract complex sub-elements (like specific table rows or input fields) into separate files rather than nesting them in the main component function.
4. **Main Component Hook Definitions**: Define hooks, refs, and contexts first.
5. **Event Handlers**: Keep logical handlers pure. Delegate heavy calculations to domain stores or helper functions.
6. **Layout Return**: Keep JSX clean, utilizing atomic styling with Tailwind CSS utility classes.

## 4. Service & Store Architecture

- **State Stores**: Zustand is used as our primary state engine. Keep stores highly focused. A store should represent a single domain (e.g., Billing, Stock, Workshop).
- **Decoupled Math**: Never embed heavy pricing calculations directly in components. Keep them in pure helper functions within store files to facilitate easy unit testing.

## 5. Robust Error Handling

- **No Swallowed Errors**: Always catch asynchronous database statements and display user-facing alert bars.
- **Failback States**: When network API calls fail, the client must safely operate on local offline caches, storing unsynced rows in a local queue with an `is_dirty` or `pending_sync` flag.

## 6. Database-First Philosophy

- **Constraints Enforced at Schema Level**: When implementing new database tables, define strict non-null, unique, and check constraints first. The database represents our ultimate shield against data corruption.
- **Type Harmonization**: Client-side TypeScript interfaces must exactly mirror server-side table types.

## 7. Performance Expectations

- **Fast Hydration**: Main dashboard loading times must be under `1.5 seconds`.
- **Zero Input Lag**: Search queries on catalogs or stock lists must complete within `< 50ms` using pre-calculated state maps.
- **Optimized Re-renders**: Avoid updating global context state on fast input fields. Instead, handle input focus state locally and sync to global stores only on field blur or submission.

## 8. Verification Checklist

Before submitting code for deployment:

- [ ] Run `npx eslint` and ensure zero warnings or errors.
- [ ] Build the applet using `npm run build` to verify proper TypeScript compilation.
- [ ] Test the application across both Light and Dark themes to verify proper color contrast.
- [ ] Confirm layout spacing and interactive element sizes are mobile and touch responsive.
