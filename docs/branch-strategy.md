# Branch Strategy

## Main Branches
- **`main`** — Production. Protected, requires CI + review.
- **`develop`** — Staging. Integration branch for features.

## Supporting Branches

| Prefix | Purpose | Branch from | Merge into |
|--------|---------|-------------|------------|
| `feat/description` | New features | `develop` | `develop` |
| `fix/description` | Bug fixes | `develop` | `develop` |
| `hotfix/description` | Urgent production fixes | `main` | `main` & `develop` |

Naming uses kebab-case (e.g. `feat/add-login`, `fix/null-pointer`).

## Release Process

```
develop
  │  (merge feat/fix branches)
  ▼
release candidate
  │  (QA, regression)
  ▼
main  ← tag with version (e.g. v1.2.3)
  │
  ▼
deploy to production
```

After a release, merge `main` back into `develop` to keep them in sync.
