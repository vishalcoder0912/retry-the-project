# Backend Structure

Path: `apps/backend`

## Key Folders

```text
data/                         Local SQLite files
src/
  database/                   Dataset persistence and chat history storage
  services/                   Analytics and response generation
  server.js                   HTTP API entrypoint
```

## Placement Rules

- Keep request handling and route branching in `src/server.js`.
- Put SQLite access and persistence logic in `src/database`.
- Put analytics and response-building logic in `src/services`.
