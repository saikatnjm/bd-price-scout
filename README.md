# BD Price Scout

A private Next.js app that searches Bangladesh online stores for a product and shows the same product's price, availability and link at each store. It runs on Vercel and needs no database.

Accuracy comes first: products are only grouped together when the evidence says they are the same product and the same variant (size, pack, flavour and so on). A missing comparison is better than a wrong one.

**Status:** MVP. Production: https://bd-price-scout.vercel.app

## Stores

| Store | Status | Notes |
|---|---|---|
| **Othoba** (othoba.com) | Supported | Grocery and household. Searched through 22 mapped category pages (first 2 pages each); product data comes from each product page's JSON-LD. See [docs/stores/othoba.md](docs/stores/othoba.md). |
| Shwapno | Not supported | Its terms forbid automated access and scraping. [docs/stores/shwapno.md](docs/stores/shwapno.md) |
| Daraz | Not supported | Its terms forbid collecting listings and prices; `robots.txt` disallows the catalogue. [docs/stores/daraz.md](docs/stores/daraz.md) |
| Meena Bazar | Not supported | Product data is only available through a private API. |
| Star Tech | Researched, not built | Electronics; usable via product pages and sitemap. [docs/stores/startech.md](docs/stores/startech.md) |

Store restrictions are respected: no CAPTCHA, anti-bot, login or `robots.txt` bypass, and no private APIs.

With one supported store, results are listed but **not compared across stores**, and nothing is labelled "lowest price". That label only appears when at least two stores have the same confirmed product in stock.

## Local development (Docker only)

The host needs only **Docker, Docker Compose and Git**. Node.js, npm and all dependencies live in the container.

```bash
git clone https://github.com/saikatnjm/bd-price-scout.git
cd bd-price-scout
docker compose up --build        # first run; afterwards: docker compose up
```

Open http://localhost:3000 (bound to `127.0.0.1` only). Source changes hot-reload; no rebuild needed.

| Task | Command |
|---|---|
| Start (detached) | `docker compose up -d` |
| Logs | `docker compose logs -f app` |
| Stop | `docker compose down` |
| Tests | `docker compose exec app npm test` |
| Lint | `docker compose exec app npm run lint` |
| Typecheck | `docker compose exec app npm run typecheck` |
| Production build | `docker compose exec app npm run build` |
| All of the above | `docker compose run --rm app npm run check` |

Use `exec` while the app is running, `run --rm` when it is not.

After `package.json` changes, rebuild the dependency volume: `docker compose down -v && docker compose up --build`.

**Troubleshooting:** if the container exits with `Could not read package.json`, Docker cannot see the project folder (common with Docker Desktop and projects on an external or `/run/media` drive). Share that folder in Docker Desktop → Settings → Resources → File sharing, or clone the repo into your home folder. Check with `docker run --rm -v "$PWD":/x alpine ls /x`.

## Environment variables

None are required. Both are optional, server-only, and documented in [.env.example](.env.example):

| Variable | Default | Range | Purpose |
|---|---|---|---|
| `STORE_TIMEOUT_MS` | 8000 | 1000–20000 | Time limit per store |
| `SEARCH_BUDGET_MS` | 15000 | 2000–25000 | Time limit for the whole search |

For local overrides, copy `.env.example` to `.env.local` (git-ignored); Compose loads it if present. Never commit real secrets.

## Architecture

```
UI (src/components, client)
 → POST /api/search            src/app/api/search/route.ts  (Node runtime, input validation)
 → Search orchestrator         src/server/search/orchestrator.ts  (stores in parallel, timeouts)
 → Store adapter               src/server/stores/<store>/  (search + extraction)
 → Normalization               src/server/normalize/  (price, availability, pack size, variant, brand)
 → Matching                    src/server/match/  (conservative same-product decision)
 → Comparison                  src/server/compare/  (groups; lowest price only across 2+ stores)
 → JSON response → UI          src/components/SearchResults.tsx
```

- Everything under `src/server/` is server-only (`import "server-only"`). Shared types: `src/lib/types.ts`.
- One failing or slow store never fails the search: each store reports `ok`, `empty`, `timeout`, `blocked` or `error`, and the UI shows partial results.
- All store requests go through `src/server/http/fetch-html.ts`: https only, the store's own hosts and default port only, redirects re-checked, 1.5 MB response cap, per-request timeout.
- Matching: any conflict (size, pack count, bundle, variant, model, generation, used/new) means *no match*. A match needs the same listing, the same GTIN, brand + model, or full agreement on all known attributes; anything else stays *uncertain* and is not grouped.

### Adding a store (only one that permits it)

1. Research first: terms of use, `robots.txt`, whether pages are server-rendered, structured data. Write `docs/stores/<store>.md`. Stop if the terms or `robots.txt` forbid it.
2. Create `src/server/stores/<store>/` with an adapter implementing `StoreAdapter` (`src/server/stores/types.ts`): `search(query, ctx)` returns `StoreCandidate`s, fetching only via `fetchHtml` with the store's hosts.
3. Add saved page fixtures under `tests/fixtures/<store>/` and adapter tests that run without network.
4. Register the adapter in `src/server/stores/registry.ts`; add its image hosts to the CSP in `next.config.ts`.
5. Normalization, matching and comparison need no changes.

## Testing

- Unit and adapter tests (Vitest, saved fixtures, no network): `npm test`.
- `othoba.live.test.ts` hits the real store and is skipped unless `LIVE_STORE_TESTS=1`.

### CI workflows (`.github/workflows/`)

| Workflow | When | What |
|---|---|---|
| `ci.yml` | Every push to `main`/`dev`, PRs | Dependency audit (fails on high/critical runtime advisories), lint, typecheck, tests, build; plus Docker build, in-container checks and a smoke test |
| `qa.yml` | Manual, or push to `qa/**` | Clean Docker rebuild, in-container checks, then Playwright end-to-end with real Othoba searches (desktop/tablet/mobile, error states, images, product-link spot checks, production server with CSP). Results go to the `qa-results` branch |
| `live.yml` | Manual | Live Othoba adapter check |
| `smoke.yml` | Manual | HTTP smoke test of a deployed URL |
| `lockfile.yml` | Manual | Regenerates `package-lock.json` |

## Deployment (Vercel)

- Vercel's Git integration deploys `main` to production; other branches get preview deployments.
- Framework preset: Next.js. No build settings or environment variables are needed.
- `/api/search` has `maxDuration = 30` s; the search itself is capped by `SEARCH_BUDGET_MS`.
- **Verify a deployment:** run the `smoke.yml` workflow with the URL, or open the site and search for "rice" (results in a few seconds).
- **Troubleshooting:** a store shown as *Blocked* means it refused the request (HTTP 403/429 or a challenge); it is logged as a warning in Vercel's function logs. *Timed out* means it exceeded `STORE_TIMEOUT_MS`.

## Security

- No user-supplied URLs are fetched; the server only requests fixed store hosts (no SSRF path).
- Request body ≤ 2 KB, query 2–120 characters, product titles over 300 characters rejected before parsing.
- Store data is treated as untrusted: React escapes all text, links and images must be https on allowed hosts, and links open with `noopener noreferrer`.
- Headers: CSP (production), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; HSTS from Vercel.
- No secrets exist; any future ones go in environment variables, never in client code.

## Known limitations

- One supported store, so no cross-store price comparison yet.
- Othoba coverage is partial: 22 mapped categories and their first 2 pages. Products outside them (or Bangla queries) return no results.
- Some Othoba JPEG images are hotlink-protected and show a placeholder.
- No login or rate limiting: anyone with the URL can search (each search makes at most about 9 Othoba requests).
- Prices are store product prices; delivery fees and coupons are not included.
- Dev-only `npm audit` advisories in the ESLint toolchain (micromatch via `eslint-config-next`); runtime dependencies have none.
