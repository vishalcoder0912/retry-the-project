# Retry The Project

`retry-the-project` is a full-stack workspace for the InsightFlow app: a Vite/React frontend plus a local Node analytics API backed by SQLite.

## Workspace Layout

```text
apps/
  backend/
    data/        # Local SQLite files, ignored from git
    src/
      database/  # Persistence and dataset storage
      services/  # Analytics and chat response logic
      server.js  # HTTP server entrypoint
  frontend/
    public/      # Static assets
    src/
      app/       # App bootstrap, providers, routing
      features/  # Feature modules
      shared/    # Reusable UI, hooks, layout, utilities
      test/      # Frontend tests
docs/            # Project structure and workspace notes
scripts/         # Root dev scripts
```

Detailed folder notes live in [docs/PROJECT_STRUCTURE.md](/C:/Users/VISHAL/Desktop/20-12-2025/All_full_stack_preparation/expo/retry-the-project/docs/PROJECT_STRUCTURE.md).

## Conventions

- Use `npm` at the workspace root. The repo is standardized on `package-lock.json`.
- Keep generated build output inside app folders, not at the repo root.
- Treat `apps/backend/data/` as local runtime state, not source code.

## Start

1. Install dependencies:
   `npm install`
2. Start both apps:
   `npm start`

URLs:

- Frontend: `http://127.0.0.1:8080`
- API: `http://127.0.0.1:3001`

## Commands

- `npm run start:frontend`: start the frontend only
- `npm run start:backend`: start the backend only
- `npm run build`: build the frontend
- `npm run test`: run the frontend tests
- `npm run lint`: lint the frontend
