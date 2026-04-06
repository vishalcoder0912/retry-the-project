# InsightFlow Workspace

Full-stack workspace with a Vite/React frontend and a local Node analytics API.

## Structure

```text
apps/
  backend/
    data/      # SQLite database files
    src/       # HTTP API, analytics logic, persistence layer
  frontend/
    public/    # Static assets
    src/       # App shell, features, shared UI, tests
scripts/       # Root development runners
```

## Start

1. Install dependencies at the workspace root:
   `npm install`
2. Start frontend and backend together:
   `npm start`

URLs:

- Frontend: `http://127.0.0.1:8080`
- API: `http://127.0.0.1:3001`

## Workspace Commands

- `npm run start:frontend`: frontend only
- `npm run start:backend`: backend only with watch mode
- `npm run build`: production frontend build
- `npm run test`: frontend Vitest suite
- `npm run lint`: frontend ESLint
