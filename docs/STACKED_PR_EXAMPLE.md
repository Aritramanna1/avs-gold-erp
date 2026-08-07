# Safe Non-Production Example Stack

This example demonstrates the workflow without changing ERP business behavior.

## Stack

1. PR TBD - Governance foundation
   - Branch: `docs/example-stack-foundation`
   - Base: `develop`
   - Scope: add a README-only governance note.

2. PR TBD - Governance checklist
   - Branch: `docs/example-stack-checklist`
   - Base: `docs/example-stack-foundation`
   - Scope: add checklist examples that depend on the foundation wording.

3. PR TBD - Governance screenshots
   - Branch: `docs/example-stack-screenshots`
   - Base: `docs/example-stack-checklist`
   - Scope: add optional screenshot placeholders for documentation-only PRs.

## Commands

```sh
git fetch origin
git switch develop
git pull --ff-only

git switch -c docs/example-stack-foundation
echo "# Example foundation note" > docs/example-stack-foundation.md
git add docs/example-stack-foundation.md
git commit -m "docs: add example stack foundation"
git push -u origin docs/example-stack-foundation

git switch -c docs/example-stack-checklist
echo "# Example checklist note" > docs/example-stack-checklist.md
git add docs/example-stack-checklist.md
git commit -m "docs: add example stack checklist"
git push -u origin docs/example-stack-checklist

git switch -c docs/example-stack-screenshots
echo "# Example screenshot note" > docs/example-stack-screenshots.md
git add docs/example-stack-screenshots.md
git commit -m "docs: add example stack screenshot placeholders"
git push -u origin docs/example-stack-screenshots
```

Open PRs in this order:

1. `docs/example-stack-foundation` into `develop`.
2. `docs/example-stack-checklist` into `docs/example-stack-foundation`.
3. `docs/example-stack-screenshots` into `docs/example-stack-checklist`.

Merge PR 1 first, then retarget PR 2 to `develop`, then retarget PR 3 after PR 2 merges.

## Why This Is Safe

- It changes only documentation.
- It does not touch ERP source code.
- It does not touch database migrations.
- It does not alter production infrastructure.
- It can be abandoned by closing all three PRs.
