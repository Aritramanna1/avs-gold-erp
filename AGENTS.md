<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Shop baseline lock (Owner 2026-08-28)

**Only** the build on `https://maatarajewellers.shop` (`index-CVsE73i6.js`).

- Source tree = frozen backup at `8dc1c43` (matches `AVS_PRODUCTION_BASELINE_CVsE73i6_IMMUTABLE_BACKUP/source`).
- **`npm run preview`** / **`npm run preview:shop`** — exact shop UI (`production-dist-shop/`, `index-CVsE73i6.js`).
- **`npm run dev`** — source editing only; **not** the shop bundle. Do not use for “what does shop look like”.
- **`npm run build`** — produces a *new* hash (not `index-CVsE73i6.js`); do not treat as shop truth.
- Wrong `dist/` rebuilds must be deleted; only `production-dist-shop/` is the frozen shop artifact.
- Never deploy over `maatarajewellers.shop`.
- **Aurum deploy is owner-only.** When approved, ERP → `erp.aurum.arivahly.in`; marketing → `aurum.arivahly.in`; portal → `aurumportal.arivahly.in`. Agents must not run `upload-dist-multi.mjs` unless the owner explicitly requests deploy in that session.

## Release Safety Rule

Never reset, overwrite, force-push, rollback, or replace `main` merely to
resolve development problems.

`main` is the current approved AVS ERP release. All development happens through
branches and Pull Requests. Only explicit Product Owner release approval allows
a new version to enter `main`.

Before any materially risky Git operation, record the current commit SHA,
verify the branch, verify the remote, inspect the working tree, and create a
recovery branch or tag where appropriate. If there is uncertainty, stop and ask.

## Ornexa / AVS Product Memory Rule

Before modifying Ornexa / AVS Jewellery Manufacturing ERP, read
`/docs/MASTER/ORNEXA_PRODUCT_CONSTITUTION.md` and the relevant master
specifications in `/docs/MASTER`.

Do not make architectural or business-rule assumptions from the current UI
alone. Do not silently change established business behavior. Whenever an
approved architectural, product, workflow, calculation, security, schema, or
configuration decision changes, update the corresponding master document in
the same PR.
