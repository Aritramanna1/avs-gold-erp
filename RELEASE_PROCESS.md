# Release Process

## Release Model

While Version N is live:

- `main` equals Version N.
- `develop` receives work for Version N+1.
- feature branches merge into `develop` through Pull Requests.

## Creating a Release Candidate

1. Confirm `develop` is ready for release freeze.
2. Create `release/<version>` from `develop`.
3. Only release-blocking fixes may enter `release/<version>`.
4. Deploy the release candidate to staging.
5. Run build, typecheck, and required smoke tests.
6. Record test evidence in the release PR.

## Approving a Release

Only the Product Owner may approve replacing the current `main` version.

After approval:

1. Open a PR from `release/<version>` into `main`.
2. Include the Product Owner approval note in the PR.
3. Merge without rewriting history.
4. Tag the release, for example `v1.1.0`.
5. Deploy production from `main` only.
6. Merge any release fixes back into `develop`.

## Deployment Mapping

- Development site: `develop`
- Staging or preview site: `staging` or `release/<version>`
- Production live site: `main` only

Feature branches, experimental branches, and agent branches must never
automatically deploy to production.

## Tagging

Every approved production release gets an immutable tag.

Do not delete, move, or overwrite release tags.
