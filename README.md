# BD Price Scout

Private Next.js app for comparing product prices across Bangladesh online stores. Deployed on Vercel; no database.

**Status:** Phase 4 (first store adapter). Supported store: **Othoba**. It covers grocery and household categories only; see `docs/stores/othoba.md`.

## Local development (Docker only)

Nothing needs to be installed on the host except Docker.

```bash
docker compose up --build                      # http://localhost:3000
docker compose run --rm app npm run check      # lint + typecheck + tests + build
docker compose run --rm app npm test           # tests only
```

After `package.json` changes, rebuild the dependency volume: `docker compose down -v && docker compose up --build`.

Optional: copy `.env.example` to `.env.local` (git-ignored). Compose loads it if it exists.

## Scripts

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `start` | Next.js |
| `lint` | ESLint |
| `typecheck` | `next typegen` + `tsc --noEmit` |
| `test` | Vitest |
| `check` | All of the above + build |

## Architecture

```
UI (src/components, client) → POST /api/search (Node runtime)
  → orchestrator (src/server/search) → store adapters (src/server/stores)
  → [normalize → match → compare: later phases] → JSON response
```

- Everything under `src/server/` is server-only (`import "server-only"`).
- Stores run in parallel with a per-store timeout and an overall budget; one failing store never fails the search. Each store reports `ok | empty | timeout | blocked | error`.
- Shared types live in `src/lib/types.ts`.

## CI/CD

- `.github/workflows/ci.yml`: lint, typecheck, tests, build, plus a Docker build and in-container test run.
- `.github/workflows/lockfile.yml`: manual workflow that regenerates and commits `package-lock.json`.
- Vercel deploys from `main` via its Git integration. No environment variables are required yet (see `.env.example`).
