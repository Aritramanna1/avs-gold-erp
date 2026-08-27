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

## Release Safety Rule

Never reset, overwrite, force-push, rollback, or replace `main` merely to
resolve development problems.

`main` is the current approved AVS ERP release. All development happens through
branches and Pull Requests. Only explicit Product Owner release approval allows
a new version to enter `main`.

**Production foundation (locked):** Live Hostinger LKG is **`index-CVsE73i6.js`**
(git **`8dc1c43`**). Default site is **`https://maatarajewellers.shop`**. Do not
migrate domain/hosting and do not redeploy over CVsE73i6 without Owner approve.
Additive work continues on `main`; second production rollbacks require explicit
Owner order and the recovery zip.

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
