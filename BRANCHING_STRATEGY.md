# Branching Strategy

## Current Stable Baseline

The current approved AVS ERP baseline is the release tagged from the verified
feature-train state restored on 2026-08-08.

`main` is the protected product branch. It represents the current approved ERP
release and is not an active development branch.

Legacy `master` may exist for compatibility with older tools, but new release
governance uses `main`.

## Branch Roles

- `main`: current approved production version only.
- `develop`: integration branch for the next ERP version.
- `staging`: release-candidate or preview branch.
- `release/<version>`: frozen release candidate branch.
- `feature/<task>`: isolated feature work.
- `fix/<issue>`: isolated bug fix work.
- `perf/<area>`: performance work.
- `security/<area>`: security hardening work.
- `backup/<description>`: recovery branch created before risky operations.

## Development Flow

```text
main
  -> develop
       -> feature/*, fix/*, perf/*, security/*
  -> release/<version>
  -> staging
  -> main, after Product Owner approval
```

Normal work must not happen directly on `main`.

## Multi-Agent Rule

Each AI agent or human contributor works on a separate task branch. No agent is
the release manager unless the Product Owner explicitly says so for that
release.

## GitHub Free Limitation

This repository is private on GitHub Free. Native branch protection and rulesets
are unavailable unless the repository is made public or the account is upgraded.
The repository therefore uses documented policy, PR templates, CODEOWNERS, and
GitHub Actions checks as lightweight guardrails.
