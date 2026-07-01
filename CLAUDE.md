# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Next.js dev server on port 20127 (not 20128 — README uses 20128)
npm run build         # Production build
npm run start         # Start production server

# Tests (vitest, from tests/ directory)
cd tests && npx vitest run                        # Run all
cd tests && npx vitest run unit/embeddingsCore    # Single file
cd tests && npx vitest run --reporter=verbose     # Verbose output
```

Tests live in `tests/` with their own `package.json`. vitest is expected at `/tmp/node_modules` (workspace hoisting workaround). The vitest config maps `open-sse/` → `../open-sse/` and `@/` → `../src/`.

## Architecture

9Router is a local AI routing gateway: Next.js dashboard + provider-agnostic SSE engine. One OpenAI-compatible endpoint (`/v1/*`) → routes to 40+ upstream providers with format translation, fallback, token refresh, and usage tracking.

### Two-source layout

| Directory | Role |
|-----------|------|
| `src/` | Next.js app (dashboard UI, management APIs, compatibility API routes) |
| `open-sse/` | Provider engine (translators, executors, handlers — no Next.js dependency) |

`src/lib/localDb.js` is a **shim** that re-exports from `src/lib/db/index.js`. All DB access goes through this barrel. Never import from `src/lib/db/repos/*` directly outside the barrel.

### Request flow (chat)

```
Client → /v1/chat/completions
  → src/app/api/v1/chat/completions/route.js (CORS, init translators)
  → src/sse/handlers/chat.js (body parse, API key, combo? model resolution)
  → src/sse/services/model.js (parse provider/model prefix, resolve custom nodes)
  → src/sse/services/auth.js — getProviderCredentials()
      (filter locked/excluded, apply strategy: fill-first | round-robin)
  → open-sse/handlers/chatCore.js
      → detectFormat → getTargetFormat → translateRequest
      → getExecutor(provider) → execute() → translateResponse → SSE out
```

### Key subsystems

- **Translator** (`open-sse/translator/`): pivots through OpenAI as intermediate format. Direct routes (e.g. `claude:kiro`) skip the lossy double-hop. Translators self-register via `register(from, to, reqFn, resFn)` as side-effect of import — new files must be imported in `translator/index.js`.

- **Executors** (`open-sse/executors/`): per-provider upstream call. `getExecutor(provider)` returns a specialized executor for non-standard providers (OAuth, protobuf, custom auth), or a cached `DefaultExecutor` for OpenAI-compatible APIs.

- **Account fallback** (`src/sse/services/auth.js`): `getProviderCredentials` filters connections by active + not excluded + not model-locked. On error, `markAccountUnavailable` locks `modelLock_<model>` with exponential backoff. On success, `clearAccountError` clears the lock. Error classification in `open-sse/config/errorConfig.js` — text rules first, then status rules.

- **DB** (`src/lib/db/`): SQLite via driver chain: `better-sqlite3` → `bun:sqlite` → `node:sqlite` → `sql.js` (auto-fallback). `src/lib/db/schema.js` is declarative — `syncSchemaFromTables()` auto-adds missing tables/columns. Destructive changes go through numbered migration files in `migrations/`.

- **RTK token saver** (`open-sse/rtk/`): mutates request body in-place, fail-open (errors return null, leave body untouched).

### Settings

Single-row JSON blob in SQLite `settings` table. Read via `getSettings()`, updated via `updateSettings()`. Defaults defined in `src/lib/db/repos/settingsRepo.js`.

### Conventions

- **Never hardcode** values, models, block/role strings — use `open-sse/config/` constants.
- **Provider registry** entries in `open-sse/providers/registry/{id}.js` copy from `REGISTRY_TEMPLATE.js`. `registry/index.js` is auto-generated — don't hand-edit.
- **Tunnel/Tailscale** are optional add-ons, default off, zero npm deps. They live in `src/lib/tunnel/` and don't touch core routing.
- **No pagination** in most list endpoints (providers, combos, nodes, usage/history). Only `requestDetailsRepo` has proper SQL `LIMIT/OFFSET`. There's a shared `Pagination` component at `src/shared/components/Pagination.js` (not in barrel export).
- **Port mismatch**: `package.json` dev script binds 20127, but README and docs reference 20128. Check env `PORT` or settings override.