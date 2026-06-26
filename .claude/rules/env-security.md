---
paths:
  - "**/.env*"
---

# Environment File Security

- **Never commit real secrets.** `.env.example` (repo root) is the only committed env
  template — placeholders only, no real values.
- `.env`, `.env.local`, and `.env.*.local` are gitignored (see `.gitignore`). Real keys
  live there, never in a tracked file.
- **Adding a new env var:** add it to `.env.example` with an empty value + a short comment,
  and add it to the README env table if it's required to run the app.
- **Apps read their own local env:** web → `apps/web/.env.local`; MCP → `apps/mcp/.env`
  (template `apps/mcp/.env.example`). Copy `.env.example` into the app's local file and fill
  in values.
- Access vars via `process.env.X` (Node / Next.js). Never hardcode secrets in source.
- A **gitleaks pre-commit hook** scans staged changes for leaked secrets. If it blocks a
  commit, a real key landed in a tracked file — move it to a local env file, don't bypass.
