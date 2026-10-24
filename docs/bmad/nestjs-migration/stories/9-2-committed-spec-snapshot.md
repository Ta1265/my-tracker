# Story 9.2: Committed spec snapshot

Status: Done

## Context

Builds the first of the two generated artifacts (FR-21, NFR-6): a committed OpenAPI JSON
snapshot at `backend/openapi.json`, produced with no database, no Redis, no network, and
no running backend. Depends on stories 9.1, 9.1a, and 9.1b landing first - generating from
DTOs still carrying the `'24h'` example bug or the missing `ProductTransactionResponseDto`
fields would commit a wrong first snapshot. Story 9.3 then generates frontend types from
this file; story 9.4a wires the staleness check.

## Acceptance Criteria

### A. Shared DocumentBuilder config (D36)

- [x] Create `backend/src/openapi/document.ts` (or `index.ts`) exporting the
  `DocumentBuilder` configuration and `GLOBAL_PREFIX = 'backend/api'` as named exports -
  today this is built inline in `backend/src/main.ts:24-46`. Move that exact
  `DocumentBuilder` chain (title, description, version, cookie auth, bearer auth, all ten
  tags) into the new module unchanged.
- [x] `backend/src/main.ts` imports the config from `backend/src/openapi/` and calls
  `app.setGlobalPrefix(GLOBAL_PREFIX)` instead of the current inline string literal
  `'backend/api'` (`main.ts:12`), and passes the same imported `DocumentBuilder` chain
  into `SwaggerModule.createDocument`. No behavior change - `GET /backend/docs` and
  `GET /backend/docs-json` must serve identical content to before.

### B. The generator script

- [x] Create `scripts/generate-api-contract.mjs` at the repo root (not under `backend/`
  or `frontend/` - the pipeline crosses both packages, so it's owned by the workspace
  root per architecture "Scripts, and where they live").
- [x] `--only=spec` half: boots `NestFactory.create(AppModule, { preview: true })`
  against the **compiled** `backend/dist` (not `src` - no TypeScript loader, no
  `ts-node`/`tsx`; D35's reason is `src/auth/current-user.decorator.ts:7`'s
  `express-request.d.ts` global augmentation, which `ts-node` does not load), calls
  `setGlobalPrefix(GLOBAL_PREFIX)` from the shared module before `createDocument`, and
  writes `JSON.stringify(document, null, 2)` plus a trailing newline to
  `backend/openapi.json` (D37 - pretty-printed, not minified, because the file's whole
  job is to be diffed).
- [x] Preview mode instantiates no providers, so this must succeed with **no environment
  variables set at all** and with `DATABASE_URL` pointed at an unreachable address -
  verify both explicitly (see Verification below). `SWAGGER_ENABLED` must not be read by
  the script at any point (NFR-6's own warning: the flag gates `main.ts`'s document
  construction, and the generator doesn't go through `main.ts`).
- [x] `--check` flag: instead of writing, generate into memory and byte-compare against
  the file already on disk; exit non-zero (with a message naming the file and the command
  to fix it, e.g. `backend/openapi.json is stale - run pnpm spec:generate and commit the
  result`) if they differ. **No `git diff`/`git status` call anywhere in the script** -
  this must work identically whether or not `.git` is present, because it will run inside
  a Docker build context that excludes `.git` (root `.dockerignore`) in story 9.4a.

### C. Root scripts and devDependency

- [x] Root `package.json` gains a `"devDependencies"` entry for `openapi-typescript`
  (pin the version actually installed at commit time; architecture's spike verified
  `openapi-typescript@7.13.0`) and three scripts:
  - `"spec:generate": "node scripts/generate-api-contract.mjs"`
  - `"spec:check": "node scripts/generate-api-contract.mjs --check"`
  - `"spec:watch": "node --watch-path=backend/src scripts/generate-api-contract.mjs"`
  All three invoke the one script file; there is no second code path (this story's
  `--only=types` half doesn't exist yet, so `spec:generate`/`spec:watch` run both
  `--only=spec` and `--only=types` by default even though `--only=types` has nothing to
  read yet at the end of this story - see Out of Scope).

### D. Verification, no database

- [x] Run `pnpm --filter @portfolio/backend build` then `pnpm spec:generate` from the
  repo root with `DATABASE_URL` unset and every other env var absent. Confirm
  `backend/openapi.json` is written and contains a `paths` object with all 22 paths
  (19 route handlers plus 3 already-scaffolded auth endpoints - count matches the running
  `/backend/docs-json`) and 20 `components.schemas` entries (nineteen DTOs from Epic 2 plus
  the new `TimeFrame` schema from story 9.1b). Record the exact counts in Dev Notes.
- [x] Run `pnpm spec:generate` twice in a row with no source change between runs and diff
  the two outputs - confirm byte-identical (D35's own verification found this holds;
  this story re-confirms it on the current tree, since it's the precondition the FR-21
  diff in story 9.4a depends on). Record the file size in Dev Notes.
- [x] Start the real stack (`docker compose up -d --build`) and compare
  `backend/openapi.json` against a live `curl` of `GET /backend/docs-json` through nginx -
  same path list, same schema names.

## Technical Notes

- `backend/src/main.ts`'s current inline `DocumentBuilder` block is at lines 24-46 (ten
  `.addTag()` calls, `addCookieAuth`, `addBearerAuth`). Moving it verbatim into
  `backend/src/openapi/` is a refactor, not a rewrite - no tag, description, or auth
  scheme changes.
- Preview mode: `NestFactory.create(AppModule, { preview: true })` registers every module
  and controller but instantiates no providers - confirmed empirically (D35) to succeed
  with `DATABASE_URL` pointed at a dead port and with no env vars at all, because preview
  mode never constructs `AppConfigService`, whose constructor is where env validation
  happens (`backend/src/config/app-config.service.ts`).
- A full `nest build` on this backend measures ~1.9s warm; preview-mode generation adds
  about another second (architecture, "A full `nest build`..."). Worth knowing before
  writing a watch loop in a later story (9.4a does not need one; watch mode already exists
  per this story's `spec:watch` script).

## Out of Scope

- `--only=types` and anything that reads `backend/openapi.json` to produce
  `frontend/types/api.d.ts` - story 9.3. This story's `--only` flag parsing may be
  stubbed to accept `--only=spec` and no-op on `--only=types` (or simply not parse
  `--only` at all yet, if that's simpler) as long as story 9.3 lands the real
  implementation without changing this story's `--only=spec` behavior.
- Wiring the staleness check into either Dockerfile - story 9.4a.
- Any DTO or controller edit - that was stories 9.1a/9.1b; this story only reads what they
  shipped.

## Dev Notes

- The generator anchors module resolution with `createRequire(backend/dist/main.js)`
  rather than importing `@nestjs/core`/`@nestjs/swagger` directly from the script's own
  location: the root workspace has no hoisted `node_modules` (confirmed empty), so a
  plain `import` from `scripts/` would not resolve those packages. Anchoring at
  `backend/dist/main.js` makes both the npm-package requires and the relative
  `./app.module` / `./openapi/document` requires resolve exactly as the compiled backend
  output already expects.
- `--only=types` is implemented as a real branch of `--only` parsing (not a stub that
  ignores the flag) but its body is an intentional no-op until story 9.3.
- Generated snapshot: 22 `paths`, 20 `components.schemas` entries (includes `TimeFrame`
  from story 9.1b), file size 47,664 bytes, trailing newline present.
- Two consecutive `pnpm spec:generate` runs with no source change produced byte-identical
  output (diff empty, both 47,664 bytes) - re-confirms D35 on the current tree.
- `pnpm spec:generate` succeeded with no environment variables set at all, and separately
  with `DATABASE_URL=mysql://user:pass@10.255.255.1:3306/nonexistent` (an unreachable
  address) - both produced the identical 47,664-byte document, confirming preview mode
  never constructs `AppConfigService`.
- Live-stack comparison: `docker compose up -d --build` then
  `curl -sk -H "Host: tubesock.xyz" https://localhost/backend/docs-json` (nginx only
  terminates the configured `server_name`, so the Host header is required) produced a
  document with the same 22 paths and same 20 schema names as the committed
  `backend/openapi.json`, verified with a scripted set comparison rather than eyeballing.
- Pre-existing `@typescript-eslint/no-floating-promises` warning on the `bootstrap()` call
  at the bottom of `main.ts` is unchanged by this story (confirmed by running lint against
  the pre-story tree via `git stash`); it just moved from line 53 to line 31 as the file
  shrank.

### Changed Files

+ backend/src/openapi/document.ts       shared DocumentBuilder config and GLOBAL_PREFIX, moved verbatim out of main.ts
~ backend/src/main.ts                   imports the shared config/prefix instead of building DocumentBuilder inline
+ scripts/generate-api-contract.mjs     root generator script: --only=spec/types split, --check byte-compare, no git usage
~ package.json                          adds openapi-typescript devDependency and spec:generate/spec:check/spec:watch scripts
~ pnpm-lock.yaml                        lockfile update for the new root devDependency
+ backend/openapi.json                  committed OpenAPI snapshot generated from the compiled backend in preview mode

### Verification

- `pnpm --filter @portfolio/backend build` - succeeded (`nest build`).
- `pnpm spec:generate` from repo root with no env vars set at all - wrote
  `backend/openapi.json` (22 paths, 20 schemas, 47,664 bytes).
- `DATABASE_URL="mysql://user:pass@10.255.255.1:3306/nonexistent" pnpm spec:generate` -
  succeeded, wrote an identical 47,664-byte document.
- Ran `pnpm spec:generate` twice back to back with no source change; `diff` between the
  two outputs was empty (byte-identical), both 47,664 bytes.
- `pnpm spec:check` with the committed file unchanged - exited 0, printed
  "backend/openapi.json is up to date".
- `pnpm spec:check` after overwriting `backend/openapi.json` with `{}` - exited 1,
  printed "backend/openapi.json is stale - run `pnpm spec:generate` and commit the
  result"; then restored the file with `pnpm spec:generate`.
- `pnpm --filter @portfolio/backend typecheck` - passed with no output.
- `pnpm --filter @portfolio/backend lint` - one pre-existing `no-floating-promises`
  warning on `bootstrap()`, present before this story's changes too (verified via
  `git stash`); no new errors or warnings.
- `docker compose up -d --build` then
  `curl -sk -H "Host: tubesock.xyz" https://localhost/backend/docs-json` compared against
  `backend/openapi.json`: identical sorted path lists (22) and identical sorted schema
  name lists (20). `docker compose down` afterward.
