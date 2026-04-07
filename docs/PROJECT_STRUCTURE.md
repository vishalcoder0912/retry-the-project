# Project Structure

This repository is organized as a small workspace rather than a single mixed application root.

## Root

```text
apps/      Product applications
docs/      Project documentation
scripts/   Workspace-level scripts
```

Root files:

- `package.json`: workspace scripts and package boundaries
- `package-lock.json`: canonical lockfile
- `README.md`: quickstart and high-level layout

## Frontend

Path: `apps/frontend`

```text
public/                Static assets
src/
  app/                 Bootstrap, providers, routing
  features/            Feature-specific UI and state
  shared/
    components/        Shared UI primitives and navigation
    hooks/             Shared React hooks
    layout/            App shell layout
    lib/               Shared utilities
  test/                Vitest setup and tests
```

Guideline:

- Put reusable, non-feature-specific code in `src/shared`.
- Put product behavior in `src/features`.
- Keep entrypoints and routing in `src/app`.

## Backend

Path: `apps/backend`

```text
data/                  SQLite runtime data
src/
  database/            Persistence layer
  services/            Analytics and response generation
  server.js            HTTP entrypoint
```

Guideline:

- Keep HTTP orchestration in `server.js`.
- Keep storage concerns in `database/`.
- Keep business logic in `services/`.

## Workspace Notes

- The frontend and backend are started together from `scripts/start.js`.
- Runtime artifacts such as `dist/` and SQLite data should stay out of git.
- New top-level folders should only be added when they serve the whole workspace.
