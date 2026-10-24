# Story 1.4: Create the `backend/` NestJS application

Status: Done

## Context

Epic 1 turns this repo into a pnpm workspace shaped `frontend/` + `backend/`
(+ `packages/shared`, deferred to Epic 4). Story 1.3 (done) converted the workspace to
pnpm with `frontend` as its only real member - `pnpm-workspace.yaml` deliberately did not
list `backend` because the directory did not exist yet, and 1.3's Dev Notes recorded that
a non-existent literal workspace entry does not error, so no special handling is needed
when this story adds it.

**This story creates the backend service itself: it boots, serves a health endpoint, and
reads config from `defaults.env`/`override.env` through an injectable provider. No
domain modules, no database connection, no Swagger, no auth, no logging framework, no
compose/nginx wiring.** Those all belong to later stories, per the PRD's cross-cutting
concerns table ("Injectable configuration | 1.4 | The backend cannot boot or reach MySQL
without it") and architecture's Migration section ("The backend's injectable config
provider (story 1.4) is the one piece of cross-cutting infrastructure that must exist
before anything else, because nothing boots without it... nginx gets its `/backend/`
block in 1.5"). The PRD bullet, the architecture doc, and HANDOFF.md's framing of this
story all agree on this scope - there is no discrepancy to reconcile.

The rest of Epic 1 runs 1.2 → 1.2a → 1.3 → **1.4 (this story)** → 1.5 (compose/nginx
wiring for `nest-api`) → 1.6 (type/lint baseline).

### Ground rules and architecture decisions that bind this story

- **GR-1 - Additive only.** Nothing under `frontend/src/app/api/` or `frontend/src/server/`
  is touched - this story only adds new files under `backend/` plus edits to
  `pnpm-workspace.yaml` and `.gitignore`.
- **GR-3 - Nothing is committed.** All changes stay in the working tree.
- **GR-4 - Human sign-off between chunks.** Drafted as `Status: Draft`; does not move to
  `Ready` until the owner reviews it. Story 1.5 does not start before this story's sign-off
  gate (section F) closes.
- **D1 (architecture)** - Nest's global prefix is `/backend/api`, so every path after the
  prefix matches the old Next.js route character-for-character. Set this now (see AC B) so
  every later story inherits it rather than retrofitting it.
- **D26c (architecture)** - production images use unflagged `pnpm deploy --filter <pkg>
  --prod <dir>`, enabled by `injectWorkspacePackages: true` already present in
  `pnpm-workspace.yaml`'s `settings:` (written by story 1.3, before the first install, so
  there is no `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` risk from adding a new workspace member
  now). Architecture's own worked example names this exact package:
  `pnpm deploy --filter @portfolio/backend --prod /app/deploy`.
- **NFR-1 (PRD)** - collaborators arrive via Nest DI, nothing ambient. The config provider
  built in this story is the template every later injectable in this initiative follows.
- **NFR-2 (PRD)** - `backend/` is eventually type-checked and linted with build-failing
  behavior, but turning that enforcement *on* is story 1.6's job, not this one. This story
  only needs the scaffold's `tsconfig.json`/lint config to exist and be reasonable.
- **NFR-3 (PRD)** - `docker compose up` must still work at the end of this story. Since
  `backend` is not added to `docker-compose.yml` until 1.5, this means the *existing*
  8-service stack (unchanged) must still come up cleanly despite `pnpm-lock.yaml` being
  regenerated to include the new `backend` workspace member.

## Acceptance Criteria

### A. Workspace registration

- [x] **`pnpm-workspace.yaml`'s `packages:` list gains a `backend` entry**, alongside the
      existing `frontend` and `packages/*`:
      ```yaml
      packages:
        - frontend
        - backend
        - packages/*
      ```
      (Leave the `allowBuilds:` and `injectWorkspacePackages: true` lines from 1.3
      untouched.)
- [x] **`backend/package.json` is created**, `"name": "@portfolio/backend"`, `"private":
      true`, `"engines": { "node": ">=24 <25" }` (identical value to
      `frontend/package.json`'s, added in story 1.2a), and Nest CLI's conventional scripts:
      `build` (`nest build`), `start` (`nest start`), `start:dev` (`nest start --watch`),
      `start:prod` (`node dist/main.js`). Dependencies: Nest 11.x (architecture's own
      verified spike pin is `@nestjs/core@11.2.1` - that major, whatever latest 11.x patch
      pnpm resolves is fine; do not take a Nest 12 major even if one has since released,
      since this initiative's design was verified against 11) - `@nestjs/core`,
      `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config` (latest 4.x, compatible
      with Nest 11), plus `reflect-metadata` and `rxjs` as required peers. Dev dependencies:
      `@nestjs/cli`, `typescript`, `ts-node`, `tsconfig-paths`, `@types/node`,
      `@types/express`.
- [x] **`backend/tsconfig.json` extends the root `tsconfig.base.json`** (architecture:
      "the base exists to stop `strict` drifting, not to unify things that are not alike")
      and sets the backend-specific compiler options architecture's Structure section
      names: `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `module:
      commonjs`, `target: ES2022`, real emit (`outDir: dist`, no `noEmit`).
- [x] **`backend/nest-cli.json` is created** with Nest CLI's conventional defaults
      (`sourceRoot: "src"`).
- [x] **A minimal `backend/eslint.config.mjs` exists**, matching Nest CLI's default
      flat-config output for a new project. It does not need to pass with zero warnings
      and is not wired into any build-failing check yet - that enforcement is story 1.6's
      entire job, not this one's.
- [x] **`.gitignore` gains a `dist/` entry** (or `/backend/dist` if scoped narrowly - either
      is acceptable). The existing `build` line does not cover Nest's default `dist/`
      output directory, and without this, `pnpm --filter @portfolio/backend build`'s output
      would show up as untracked/stageable files.
- [x] **`pnpm install` is re-run from the repo root** after the above changes, regenerating
      `pnpm-lock.yaml` to include `backend` as a resolved workspace member. Confirm
      `pnpm --filter @portfolio/backend... list --depth -1` resolves the package (mirrors
      story 1.3's equivalent check for `@portfolio/frontend`).

### B. NestJS application boots and serves a health endpoint

- [x] **`backend/src/main.ts`** bootstraps a standard Nest application
      (`NestFactory.create(AppModule)`), sets the **global prefix to `backend/api`**
      (architecture D1 - every path after the prefix must match the old Next.js route
      exactly, so getting this string right now saves every later story from
      retrofitting it), and listens on `process.env.PORT ?? 3001` (3001 matches
      architecture's chosen internal port for `nest-api`, D27; this is not yet published
      through Docker Compose - that's 1.5).
- [x] **`backend/src/app.module.ts`** imports only the config module from section C below.
      No domain modules (transactions, summary, auth, etc.) exist yet - those start in
      Epic 2 (scaffold stubs) and Epic 5 (real implementations).
- [x] **A health endpoint is exposed at `GET /backend/api/health`**, returning HTTP 200
      with a small JSON body (e.g. `{ "status": "ok" }` - the exact shape is this story's
      own choice; nothing in the PRD or architecture pins it). Implementation can be a
      dedicated `backend/src/health/health.controller.ts` or Nest CLI's default
      `AppController` repurposed - either is fine, but do not reach into the database or
      Redis to answer it (neither is available yet; this is a liveness check, not a
      readiness check).
- [x] No top-level `await` exists anywhere in `backend/src` (architecture: `@mikro-orm/core`
      is ESM-only and loaded via Node's `require(esm)`, which cannot load a module
      containing a top-level `await` anywhere in the dependency graph - not relevant to
      this story's own code yet since MikroORM isn't installed until Epic 3, but the
      constraint applies from day one so no code written now needs revisiting then).
      Bootstrap stays inside an `async function bootstrap()`, which is Nest's default
      shape anyway.

### C. Injectable configuration provider

- [x] **`backend/src/config/app-config.module.ts` and `app-config.service.ts`** are
      created. Name them `AppConfigModule` / `AppConfigService` (not bare
      `ConfigModule`/`ConfigService`) to avoid confusion with `@nestjs/config`'s own
      exports of those same names, which `AppConfigModule` wraps internally.
      `AppConfigModule` is `@Global()` (or otherwise imported once into `AppModule` and
      exported for every future module to inject `AppConfigService` via constructor
      injection - this is the one piece of infrastructure every later domain service
      depends on, per NFR-1's "collaborators arrive via Nest DI").
- [x] **`AppConfigModule` wraps `@nestjs/config`'s `ConfigModule.forRoot(...)`**, reading
      from `process.env` only - **no `envFilePath`, no in-code file loading**.
      `AppConfigModule`/`AppConfigService` never open `defaults.env`/`override.env`
      themselves. `process.env` is populated by whatever started the process:
      `docker-compose.yml`'s `env_file: [defaults.env, override.env]` for Docker, and
      Node's own `--env-file-if-exists` flags (passed via `backend/package.json`'s
      `start`/`start:dev`/`start:prod` scripts) for host-side dev. Both list
      `defaults.env` before `override.env`, and both mechanisms are **last-listed-wins**,
      so the two stay in the same order everywhere - there is exactly one place config
      loading happens conceptually (whatever launched the process), not two with opposite
      precedence rules for the same pair of files.
      (An earlier draft of this AC had `AppConfigModule` load the files itself via
      `@nestjs/config`'s `envFilePath`, resolved relative to `__dirname`. That was
      abandoned: in the prod Docker image the deploy closure sits at `/app/dist/config`,
      so `__dirname`-relative resolution reaches `/`, where no env files exist - the
      in-code loading was already a silent no-op in Docker, with `env_file`/`docker run
      --env-file` doing the real work. And `envFilePath`'s first-listed-wins precedence
      is the opposite of Compose's `env_file` last-listed-wins, which meant listing the
      same two files in opposite orders in two places for one pair of files.)
- [x] **`override.env` must win over `defaults.env` when the same key appears in both** -
      matches `docker-compose.yml`'s `env_file: [defaults.env, override.env]` semantics
      (Compose applies files in order, later files override earlier ones) and Node's own
      `--env-file` flag, which is also last-listed-wins. `backend/package.json`'s scripts
      pass `--env-file-if-exists=../defaults.env --env-file-if-exists=../override.env` in
      that order (paths relative to `backend/`, the scripts' cwd under both `pnpm --filter
      @portfolio/backend <script>` and a plain `pnpm <script>` run from inside `backend/`).
      `-if-exists` matters because `override.env` is gitignored and may not exist on a
      fresh clone; `defaults.env` is tracked and always present.
      **Verified empirically, not just by reasoning**: temporarily set the same key
      (`PRICE_PROVIDER`) to two different values in `defaults.env` and `override.env`,
      booted via `pnpm --filter @portfolio/backend start:dev`, confirmed the resolved
      value was `override.env`'s, then reverted both files. Also verified Node's
      `--env-file-if-exists` degrades gracefully: with `override.env` temporarily moved
      aside, the app still booted (logging "not found. Continuing without it.") using only
      `defaults.env`. Record of both runs is in Dev Notes.
- [x] **`AppConfigService` exposes typed getters for the variables the backend needs soon**,
      reading them from the wrapped `@nestjs/config` `ConfigService` (not by having other
      code read `process.env` directly - PRD's explicit requirement: "via an injectable
      configuration provider... not via scattered `process.env` reads"). Minimum set for
      this story: `databaseUrl` (`DATABASE_URL`, needed by Epic 3's MikroORM setup),
      `metricsSecret` (`METRICS_SECRET`, needed by story 5.9's metrics guard), and
      `priceProvider` (`PRICE_PROVIDER`, needed by Epic 5's exchange-rate work). This list
      is deliberately not exhaustive - later stories add getters for whatever env vars they
      need (e.g. Epic 4's `SESSION_PRIVATE_KEY_JWK`/`SESSION_PUBLIC_KEY_JWK`, which don't
      exist in `defaults.env` yet) rather than this story trying to anticipate everything.
- [x] **The app throws a clear error at bootstrap if `DATABASE_URL` is missing or empty**
      (proves the provider actually drives startup correctness, without this story
      attempting an actual database connection - MikroORM isn't installed until Epic 3).
      A simple presence check in `AppConfigService`'s constructor or a `@nestjs/config`
      validation function is sufficient; do not add a full schema-validation library for
      this one field.

### D. `backend/Dockerfile` - filtered-install pattern, matching `frontend/Dockerfile`

Mirror the structure story 1.3 established for `frontend/Dockerfile` exactly, adapted to
`backend`. Base image, corepack/`PNPM_HOME` setup, and the manifest-then-install-then-source
layer ordering are identical in shape:

- [x] **`base` stage**: `FROM node:24-bookworm AS base`, `RUN corepack enable`, `ENV
      PNPM_HOME="/pnpm"` (same reasoning as `frontend/Dockerfile`: pnpm's real store
      location must match wherever the BuildKit cache mount points, or the mount is
      silently inert).
- [x] **`deps` stage**: copies `pnpm-lock.yaml pnpm-workspace.yaml package.json` to `/app/`
      and `backend/package.json` to `/app/backend/`, then
      `RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
      --filter @portfolio/backend...`. **Do not copy `frontend/package.json` or
      `packages/shared/package.json` into this image** - `@portfolio/backend` does not
      depend on either yet, so including them would be scope creep, not
      defensive-but-harmless completeness (the "copy every workspace manifest" warning in
      architecture's Deployment section applies to manifests of packages the *target*
      actually depends on, which today is none).
- [x] **`common-build` stage**: copies `node_modules` and `backend/node_modules` from
      `deps`, plus `backend/src`, `backend/tsconfig.json`, `backend/nest-cli.json`, and
      `tsconfig.base.json` (landing at `/app/tsconfig.base.json`, matching
      `frontend/Dockerfile`'s already-proven pattern for the same `extends` path to
      resolve).
- [x] **`dev` stage** (from `common-build`): `CMD ["pnpm", "--filter", "@portfolio/backend",
      "start:dev"]`.
- [x] **`builder` stage** (from `common-build`): `RUN pnpm --filter @portfolio/backend
      build`.
- [x] **Production stages use the `pnpm deploy` pattern (architecture D26c)**, not a manual
      `node_modules` copy - this is architecture's own worked example for this exact
      package:
      ```dockerfile
      FROM builder AS deploy
      RUN pnpm deploy --filter @portfolio/backend --prod /app/deploy

      FROM base AS prod
      WORKDIR /app
      ENV NODE_ENV=production
      COPY --from=deploy /app/deploy ./
      EXPOSE 3001
      ENV PORT=3001
      CMD ["node", "dist/main.js"]
      ```
      `pnpm deploy` only copies what's already on disk - it does not run builds - so the
      `builder` stage's `RUN pnpm --filter @portfolio/backend build` must run **before**
      the deploy step, which the `FROM builder AS deploy` lineage above already guarantees.
      `injectWorkspacePackages: true` (already in `pnpm-workspace.yaml` since story 1.3) is
      what makes the unflagged `pnpm deploy` invocation work at all - do not add
      `--legacy`.
- [x] **`grep -n npm backend/Dockerfile` shows no bare `npm ci`/`npm install`/`npm run`** -
      pnpm throughout, same standard as `frontend/Dockerfile`.

### E. Verification

- [x] **`pnpm --filter @portfolio/backend build` succeeds** from the repo root, host-side,
      outside Docker - a real `tsc` compile via `nest build`.
- [x] **`pnpm --filter @portfolio/backend start:dev` boots the app host-side** (outside
      Docker) and `curl localhost:3001/backend/api/health` (or whatever port `PORT`
      resolves to) returns HTTP 200 with the health body. This is what proves section C's
      `__dirname`-relative env-file path resolution works correctly under pnpm's
      package-directory-as-cwd invocation style, not just in theory.
- [x] **`docker build -f backend/Dockerfile --target dev` succeeds**, and a standalone
      `docker run` of the resulting image (passing `--env-file defaults.env --env-file
      override.env -p 3001:3001`, or equivalent) answers `GET /backend/api/health` with
      200. No compose service exists for this yet (1.5), so this is a direct `docker run`,
      not `docker compose up`.
- [x] **`docker build --target prod -f backend/Dockerfile` also succeeds**, and running
      that image the same way answers the health endpoint too - confirms the `pnpm deploy`
      production path (section D) actually produces a working `dist/main.js` and its
      runtime dependencies, not just that the build step exits 0.
- [x] **Regression: the existing `docker compose up` (unchanged `docker-compose.yml`,
      no `nest-api` service yet) still brings up the full 8-service stack cleanly**, despite
      `pnpm-lock.yaml` having been regenerated to include `backend` as a new workspace
      member. This is NFR-3's "must hold at the end of every story" applied to a story that
      doesn't itself touch Compose - the risk is the lockfile regen subtly affecting
      `frontend/Dockerfile`'s `--filter @portfolio/frontend...` install, not that Compose
      config changed. A quick `/` and `/login` spot-check through the existing local HTTPS
      flow is sufficient here; this story does not need to repeat 1.3's full spot-check
      list.

### F. Nothing else changed, and sign-off

- [x] `git status` shows changes limited to: new `backend/` directory (package.json,
      tsconfig.json, nest-cli.json, eslint.config.mjs, Dockerfile, `src/`), edited
      `pnpm-workspace.yaml` (the `backend` entry), edited `.gitignore` (the `dist/` line),
      regenerated `pnpm-lock.yaml`. `docker-compose.yml` and `nginx/` are **not** touched
      (that's 1.5). `frontend/` is **not** touched. Anything else is scope creep.
- [x] `frontend/src/`, `frontend/src/app/api/`, `frontend/src/server/` - unedited (GR-1).
- [x] Nothing is committed (GR-3).
- [x] Dev Notes record the section C empirical precedence-order test result, the exact
      dependency versions pnpm actually resolved, and the observed build/run output for
      both the `dev` and `prod` Docker targets.
- [x] Owner has reviewed and signed off. **Story 1.5 does not start before that** (GR-4).

## Technical Notes

### Current state this story builds from

`backend/` does not exist. `pnpm-workspace.yaml` (story 1.3) lists only `frontend` and
`packages/*`. `frontend/Dockerfile` (story 1.3) is the proven reference implementation of
the filtered-install pattern this story mirrors - read it directly rather than relying on
this story's restated summary if anything is ambiguous.

### Why the config provider's env-file paths cannot use `process.cwd()`

This is the one subtle correctness trap in this story, worth restating plainly: pnpm's
`--filter <pkg> run <script>` executes with **that package's directory as cwd**, not the
workspace root - unlike `frontend/Dockerfile`'s Next.js dev server, which itself doesn't
need to locate `defaults.env`/`override.env` at all (Next reads `process.env`, already
populated by Compose's `env_file`, and never opens those files itself). The backend does
need to open them directly for host-side (non-Docker) dev to work at all, so getting this
path resolution wrong fails silently on one invocation style (`nest start` from inside
`backend/`) while appearing to work on another (`docker run`, where Compose/`docker run
--env-file` already populates `process.env` and file-loading is redundant).

### What this story deliberately does not build

No MikroORM, no database connection (Epic 3). No Swagger (`@nestjs/swagger` - story 2.3).
No Winston logging (story 4.1). No injectable clock (story 4.2). No global error filter
(story 4.3). No auth, no session, no cookies (Epic 4). No domain modules - transactions,
summary, stats, product, exchange-rates, price-history, time-frame-pl, token-info, metrics
(Epic 2 scaffolds them, Epic 5 implements them). No Redis client (story 5.2). No
`packages/shared` (deferred to Epic 4, per story 1.1's inventory). No `docker-compose.yml`
or `nginx/` changes (story 1.5).

### Files this story touches

```
pnpm-workspace.yaml          EDITED: `backend` added to `packages:`
.gitignore                   EDITED: `dist/` entry added
pnpm-lock.yaml                REGENERATED via `pnpm install` (backend now a member)
backend/package.json          NEW - "@portfolio/backend"
backend/tsconfig.json         NEW - extends ../tsconfig.base.json
backend/nest-cli.json         NEW
backend/eslint.config.mjs     NEW - Nest CLI default, not yet enforced (1.6)
backend/Dockerfile             NEW - filtered-install + pnpm-deploy pattern
backend/src/main.ts            NEW - bootstrap, global prefix `backend/api`, port 3001
backend/src/app.module.ts      NEW - imports AppConfigModule only
backend/src/health/*           NEW - GET /backend/api/health
backend/src/config/*           NEW - AppConfigModule / AppConfigService
```

## Out of Scope

- **Story 1.5** - adding `backend` (as `nest-api`) to `docker-compose.yml`, the nginx
  `/backend/` location block, the bind mount for `backend/src`, and reaching the health
  endpoint through nginx/HTTPS. **Must also add `env_file: [./defaults.env,
  ./override.env]` to the `nest-api` service** - since `AppConfigModule` no longer reads
  env files itself (round 2 change, see AC C), that `env_file` list is now the *only*
  thing supplying `DATABASE_URL`/etc. to the container in Compose.
- **Story 1.6** - turning on build-failing type-check/lint enforcement for `backend/`, or
  recording error counts.
- **Epic 2** - Swagger, DTOs, domain-module stubs, the endpoint inventory.
- **Epic 3** - MikroORM, database entities, any real database connectivity.
- **Epic 4** - authentication, sessions, cookies, Winston structured logging, the
  injectable clock, the global error filter, `packages/shared`.
- **Epic 5** - any domain endpoint, the Redis provider, the Prometheus metrics endpoint
  (even though `AppConfigService` exposes `metricsSecret` now, in anticipation - nothing
  reads it yet).
- **Renaming or restructuring anything under `frontend/`.** GR-1; this story is
  backend-only besides the two workspace-level file edits in section A/F.

## Dev Notes

**Section C empirical precedence-order test (envFilePath, `override.env` vs
`defaults.env`).** Verified exactly as prescribed: temporarily set
`PRICE_PROVIDER=from_defaults` in `defaults.env` and `PRICE_PROVIDER=from_override` in
`override.env`, temporarily added the resolved value to the health response, ran
`pnpm --filter @portfolio/backend start:dev`, and `curl localhost:3001/backend/api/health`
returned `{"status":"ok","priceProvider":"from_override"}`. Confirms `override.env`
(listed first in `envFilePath`) wins, matching the story's stated `dotenv`
first-listed-wins semantics - opposite of Compose's `env_file` last-wins order. Both
files and `health.controller.ts` were reverted immediately after (verified via `diff`
against pre-change backups - no residual changes; `git status`/`git diff --stat` on
`defaults.env` and `override.env` show no changes). This same run also empirically
confirms the `__dirname`-relative env-file path resolution: the app was invoked via
`pnpm --filter @portfolio/backend start:dev`, which runs with `backend/` (not the repo
root) as cwd, and it still located and loaded both `override.env` and `defaults.env`
correctly from the repo root via `path.resolve(__dirname, '../../..', ...)`.

Also verified the DATABASE_URL-missing guard (AC C, last bullet): temporarily blanked
`DATABASE_URL=` in `defaults.env` and ran `node dist/main.js` directly - Nest's
`ExceptionHandler` logged `Error: DATABASE_URL is missing or empty - check
defaults.env/override.env` thrown from `AppConfigService`'s constructor, and the process
did not report a successful start. Reverted `defaults.env` immediately after (diff
confirmed clean).

**Exact dependency versions pnpm resolved** (`pnpm --filter @portfolio/backend list
--depth 0`): `@nestjs/common@11.2.1`, `@nestjs/config@4.0.4`, `@nestjs/core@11.2.1`,
`@nestjs/platform-express@11.2.1`, `reflect-metadata@0.2.2`, `rxjs@7.8.2` (dependencies);
`@nestjs/cli@11.0.24`, `@types/express@5.0.6`, `@types/node@24.13.3`, `ts-node@10.9.2`,
`tsconfig-paths@4.2.0`, `typescript@5.9.3` (devDependencies). `@nestjs/core@11.2.1`
matches architecture's own verified spike pin exactly.

**Host-side build/boot** (section E): `pnpm --filter @portfolio/backend build` (`nest
build`) succeeded with no output/errors, producing `backend/dist/{main.js,
app.module.js, config/*, health/*}`. `pnpm --filter @portfolio/backend start:dev`
booted cleanly (Nest logged `HealthController {/backend/api/health}` mapped, "Nest
application successfully started"); `curl -w "%{http_code}"
localhost:3001/backend/api/health` returned `{"status":"ok"}` / `200`.

**Docker `dev` target**: `docker build -f backend/Dockerfile --target dev` succeeded
(new image, ~5s for the filtered install layer, cached on rebuild). `docker run
--env-file defaults.env --env-file override.env -p 3001:3001 <image>` booted Nest inside
the container (`nest start --watch` via the `dev` stage `CMD`) and `curl
localhost:3001/backend/api/health` returned `200` with `{"status":"ok"}`.

**Docker `prod` target**: `docker build --target prod -f backend/Dockerfile` succeeded -
`builder` stage ran `nest build`, `deploy` stage ran `pnpm deploy --filter
@portfolio/backend --prod /app/deploy` (reported `Progress: resolved 109, ... added 109,
done`, confirming `injectWorkspacePackages: true` makes the unflagged `pnpm deploy`
invocation work with no `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`/lockfile-mismatch error).
Running that image the same way (`node dist/main.js` via the `prod` stage `CMD`) also
answered the health endpoint with `200` / `{"status":"ok"}`, confirming the `pnpm deploy`
output is a working, self-contained production closure.

**Regression check**: `docker compose up -d --build` (unchanged `docker-compose.yml`, no
`nest-api` service) brought up all 8 existing services cleanly (`portfolio-db`,
`next-app`, `redis`, `loki`, `alloy`, `prometheus`, `nginx`, `grafana` all `Up`) despite
`pnpm-lock.yaml` having been regenerated. `curl -k https://www.tubesock.xyz/` returned
`307` (unauthenticated redirect - pre-existing NextAuth middleware behavior, unrelated to
this story) and `/login` returned `200`. Brought the stack back down with `docker compose
down` after the check. Test images/containers (`portfolio-backend:dev`,
`portfolio-backend:prod`, and their test containers) were removed after verification;
they are not part of this story's committed scope (no compose service exists for
`backend` until 1.5).

**Deviations from the story as drafted**: none of substance. One structural choice made
within the story's stated flexibility: `AppModule`'s `controllers:` array registers
`HealthController` directly rather than via an intermediate `HealthModule`, since the AC
for `app.module.ts` says it "imports only the config module from section C" (i.e. only
`AppConfigModule` appears in `imports:`) and the health-endpoint AC explicitly allows
either a dedicated controller or the default `AppController` - registering the
controller directly on `AppModule` satisfies both literally without introducing an
unrequested `HealthModule`.

`backend/eslint.config.mjs` matches Nest CLI's default flat-config output with the
jest-specific `globals.jest` entry omitted, since this story does not set up Jest/testing
and the AC's dependency list (section A) does not include `eslint`,
`typescript-eslint`, `eslint-plugin-prettier`, or `globals` as devDependencies - the file
exists per the AC's letter ("minimal ... matching Nest CLI's default flat-config output
... not wired into any build-failing check yet") but is not currently runnable until a
later story (1.6) adds the lint tooling as dependencies.

#### Round 2 (Dev)

**Process note.** F1 and F2 below were applied to the working tree outside the normal
Dev/Reviewer loop before this round started. Both are re-verified here as if newly
implemented in this round (see the "Status: Fixed" lines appended to F1/F2 in Round 1
below) rather than taken on faith.

**F1 re-verification.** `pnpm --filter @portfolio/backend build` (after `rm -rf
backend/dist`) compiles clean under the base `strict` config with `databaseUrl` typed
`string`. Fail-fast guard re-checked two ways: `DATABASE_URL= node dist/main.js` on the
host exits 1 with `Error: DATABASE_URL is missing or empty...`; `docker run -e
DATABASE_URL= <prod image>` also exits 1 with the same error, logged before any
`listen()` call.

**F2 re-verification.** Rebuilt both Docker targets from scratch. `docker exec
<prod-container> id` returns `uid=1001(nestjs) gid=1001(nodejs)`; `docker top
<prod-container>` shows the actual running process (`node dist/main.js`) under `UID
1001`, not just that the image declares a `USER` - confirms PID 1 itself is
unprivileged, not merely that a later `RUN`/`USER` line exists. `docker exec ... ls -la
/app` shows the deploy closure owned by `nestjs:nodejs`.

**Env mechanism change (substantive round-2 work).** Removed `envFilePath` and the
`path` import from `backend/src/config/app-config.module.ts` - `ConfigModule.forRoot()`
now reads `process.env` only, no file access in application code. Reasoning is captured
in AC C above and as a comment on `AppConfigModule` itself.

Restored host-side dev by adding Node's native `--env-file-if-exists` flags to
`backend/package.json`'s `start`, `start:dev`, and `start:prod` scripts, pointing at
`../defaults.env` then `../override.env` (paths relative to `backend/`, the scripts'
cwd). `start`/`start:dev` go through `nest start`'s own `--exec "node
--env-file-if-exists=... --env-file-if-exists=..."` option, since Nest CLI's own
`--env-file` collect-flag hardcodes plain `--env-file=` (hard-fails on a missing file,
no `-if-exists` variant) and `NODE_OPTIONS` explicitly rejects both `--env-file` and
`--env-file-if-exists` (verified: `NODE_OPTIONS="--env-file-if-exists=..." node ...`
errors `not allowed in NODE_OPTIONS`) - the `--exec` wrapper is the one place a raw node
flag reaches the process Nest CLI actually spawns, confirmed by reading
`@nestjs/cli`'s `start.action.js`: `--exec`'s value and `processArgs` are joined into a
single shell command string.

**Verified on Node v24.13.0** (the version this repo runs): `node --env-file=a
--env-file=b` is last-listed-wins (confirmed with two temp files, `b`'s value won); `node
--env-file-if-exists=<missing>` logs `not found. Continuing without it.` and continues
rather than exiting.

**End-to-end verification, this round:**
- Host build: `pnpm --filter @portfolio/backend build` succeeds after `rm -rf
  backend/dist`.
- Host boot via the actual `pnpm --filter @portfolio/backend start:dev`/`start` scripts
  (not a manual `node` invocation): booted cleanly, `curl localhost:3001/backend/api/health`
  -> `200 {"status":"ok"}`.
- Precedence, re-verified under the new mechanism: temporarily set
  `PRICE_PROVIDER=from_defaults` in `defaults.env` and `PRICE_PROVIDER=from_override` in
  `override.env`, temporarily surfaced the value on the health response, booted via
  `start:dev` -> `{"status":"ok","priceProvider":"from_override"}`, confirming
  last-listed (`override.env`) wins. Both env files and the health controller reverted
  immediately after; `git diff`/`git status` on all three showed no residual changes.
- Graceful degradation: temporarily moved `override.env` aside and re-ran `start` -
  logged `../override.env not found. Continuing without it.`, still booted (DATABASE_URL
  came from `defaults.env` alone), health endpoint still 200. File moved back
  immediately after.
- Docker `dev` target: rebuilt from scratch, `docker run --env-file defaults.env
  --env-file override.env -p 3001:3001 <image>` -> health 200. Also ran once *without*
  `--env-file` flags: inside the container the `--env-file-if-exists` flags in the
  script (resolving to `/app/defaults.env`/`/app/override.env`, which don't exist in the
  image) logged "not found" and no-opped, proving config in Docker comes from `docker
  run --env-file`/Compose `env_file` alone, never from any file the image ships.
- Docker `prod` target: rebuilt from scratch, `docker run --env-file defaults.env
  --env-file override.env -p 3001:3001 <image>` -> health 200; `docker run -e
  DATABASE_URL= <image>` -> container exits 1 with the fail-fast error (see F1
  re-verification above).
- Regression: `docker compose up -d --build` (unchanged `docker-compose.yml`, no
  `nest-api` service) brought up all 8 existing services `Up`; `curl -k
  https://www.tubesock.xyz/` -> 307, `/login` -> 200, matching Round 1's baseline.
  `docker compose down` after. All test images/containers from this round removed
  (`portfolio-backend:dev`, `portfolio-backend:prod`, and their test containers).

**Deviations from this round's instructions:** none of substance. `start:prod` (plain
`node dist/main.js`, no Nest CLI involved) takes the flags directly rather than via the
`--exec` trick, since there's no CLI wrapper in the way for that script.

Per a direct mid-round instruction (not part of this story's file scope), also trimmed
comments touched in this round (`app-config.module.ts`, `app-config.service.ts`,
`Dockerfile`) to be brief and drop story/epic references, and recorded that rule in the
requester's own global agent-instructions file rather than a repo file.

#### Round 3 (Dev)

**F5 fix (blocking, the only code change this round).** `backend/src/config/app-config.module.ts:11-14`
now passes `ignoreEnvFile: true` to `ConfigModule.forRoot(...)`. Without it,
`@nestjs/config@4.0.4` defaults `envFilePath` to `resolve(process.cwd(), '.env')` and
silently loads whatever `.env` file happens to exist at the process's cwd - in this repo,
an untracked root `.env` containing real `DATABASE_URL`/`METRICS_SECRET`/`PRICE_PROVIDER`
values, which masked the AC C fail-fast guard entirely on any invocation with cwd at the
repo root. Verified the fix by reproducing the reviewer's exact reported command against
the fixed code: `env -u DATABASE_URL -u METRICS_SECRET -u PRICE_PROVIDER node
backend/dist/main.js` from the repo root (real root `.env` still present on disk,
untouched) now throws `DATABASE_URL is missing or empty`
from `AppConfigService`'s constructor and exits 1; `curl localhost:3001/backend/api/health`
gets `000` (connection refused) rather than `200`. Re-verified all three normal paths
still work after the fix, each rebuilt from scratch: host `pnpm --filter @portfolio/backend
start` -> `200 {"status":"ok"}`; `docker build -f backend/Dockerfile --target dev` +
`docker run --env-file defaults.env --env-file override.env -p 3001:3001` -> `200
{"status":"ok"}` (container logs confirm the in-image `--env-file-if-exists` flags no-op
with "not found. Continuing without it." - config came entirely from `docker run
--env-file`); `docker build --target prod` + same `docker run --env-file` invocation ->
`200 {"status":"ok"}`. All test images/containers removed after; `.env`, `defaults.env`,
`override.env` untouched throughout (`git status`/`git diff --stat` show no changes to
any of the three).

**Hygiene item 1 (heading collision with `/bmad:status`'s `^### Round` grep).** The Round
2 Dev Notes heading at line 435 was `### Round 2`, which collided with the Reviewer's own
`### Round 1`/`### Round 2` headings under Review Notes and would inflate
`/bmad:status`'s round count. Demoted it to `#### Round 2 (Dev)` (this section follows the
same `#### Round N (Dev)` convention). Checked the rest of the file for the same problem -
no other heading besides the two genuine Reviewer headings (`### Round 1`, `### Round 2`)
matches `^### Round`.

**Hygiene item 2.** Per instruction, left the Technical Notes section ("Why the config
provider's env-file paths cannot use `process.cwd()`", lines 294-304) untouched. F6
(advisory, still Open) correctly notes it still describes the abandoned in-code
file-loading design and is stale relative to AC C's rewrite and this round's `ignoreEnvFile`
fix - that section is SM-authored and the owner will decide on it separately, not
`bmad-dev`'s to rewrite.

**Deviations from this round's instructions:** none.

## Review Notes

### Round 1

Reviewed the full uncommitted diff for this story: new `backend/` (Dockerfile,
eslint.config.mjs, nest-cli.json, package.json, tsconfig.json, `src/main.ts`,
`src/app.module.ts`, `src/config/*`, `src/health/health.controller.ts`) plus modified
`.gitignore`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`.

**Independently re-verified (not taken from Dev Notes):**

- `pnpm --filter @portfolio/backend... list --depth -1` resolves
  `@portfolio/backend@0.0.1` (AC A).
- `pnpm --filter @portfolio/backend build` exits 0 after `rm -rf backend/dist`, emitting
  `dist/{main.js,app.module.js,config/*,health/*}` (AC E).
- `pnpm --filter @portfolio/backend start` boots; Nest maps `{/backend/api/health, GET}`;
  `curl localhost:3001/backend/api/health` -> `200 {"status":"ok"}`, and
  `localhost:3001/health` correctly 404s, confirming the global prefix is applied and
  matches D1/D27 and what 1.5's nginx `/backend/` block will need (AC B, AC E).
- **envFilePath precedence, verified two ways.** (1) Source: `@nestjs/config@4.0.4`'s
  `ConfigModule.loadEnvFile` is
  `config = Object.assign(dotenv.parse(readFileSync(envFilePath)), config)` per file in
  array order, so the already-accumulated (earlier-listed) value wins - first-listed-wins
  confirmed, opposite of Compose's `env_file`. (2) Real repo data, no file edits needed:
  booting the compiled `AppModule` with `DATABASE_URL`/`METRICS_SECRET`/`PRICE_PROVIDER`
  unset in the ambient environment resolved `metricsSecret` to override.env's real value
  rather than defaults.env's empty `METRICS_SECRET=` on line 19 - which only happens if
  `override.env` is listed first, as it is. The array order in
  `app-config.module.ts:11-14` is correct as written (AC C).
- **`__dirname` path resolution.** Host: `backend/dist/config` -> `../../..` -> repo root;
  the run above loaded both files while cwd was `backend/` under `pnpm --filter`, so the
  `process.cwd()` trap is genuinely avoided. Docker: in the prod image the deploy closure
  lands at `/app/dist/config`, so the same expression resolves to `/`, where no env files
  exist - `loadEnvFile`'s `fs.existsSync` guard makes that a silent no-op and config comes
  entirely from `--env-file`/`env_file`, which is exactly the behaviour AC C predicts. Not
  a defect; noting the depth difference explicitly since the AC's "exactly three
  directories below the repo root" reasoning holds only for the host layout.
- **Docker, both targets, rebuilt and run.** `--target dev` and `--target prod` both build
  (all layers CACHED against the current tree, i.e. Dev's builds match what is on disk
  now) and both answer `GET /backend/api/health` with `200 {"status":"ok"}` under
  `docker run --env-file defaults.env --env-file override.env -p 3001:3001`. `pnpm deploy`
  output at `/app` contains a working `dist/main.js` + `node_modules` (AC D, AC E).
- **Fail-fast guard.** `docker run ... -e DATABASE_URL= rev-be-prod` throws
  `DATABASE_URL is missing or empty` from `AppConfigService`'s constructor during
  `InstanceLoader` and the process **exits 1** - so a misconfigured container dies rather
  than serving (AC C, last bullet).
- **Lockfile regression risk.** `docker build -f frontend/Dockerfile --target deps` is
  fully CACHED against the regenerated `pnpm-lock.yaml`, i.e. the frontend's
  `--frozen-lockfile --filter @portfolio/frontend...` install does succeed with `backend`
  now an importer in the lockfile and `backend/package.json` absent from that image's
  context (NFR-3 / AC E).
- `grep -n npm backend/Dockerfile` shows only the word inside comments and `pnpm` - no
  bare `npm ci`/`install`/`run` (AC D). `app.module.ts` imports `AppConfigModule` only;
  registering `HealthController` directly on `AppModule` satisfies AC B literally and
  pulls in no extra scope. No top-level `await` in `backend/src`. No tracked file is newly
  ignored by the added `dist/` line.

All acceptance criteria in A-E hold as checked. No blocking findings.

- **F1** [advisory · typing] `backend/src/config/app-config.service.ts:14` - `databaseUrl`
  is typed `string | undefined` even though the constructor guard proves it is a non-empty
  string by the time any consumer can reach it.
  ```ts
  get databaseUrl(): string | undefined {
    return this.configService.get<string>('DATABASE_URL');
  }
  ```
  Under the base `strict`, Epic 3's MikroORM config will have to write `!` or re-check a
  value this class already guarantees. AC C calls this service "the template every later
  injectable in this initiative follows" (NFR-1), so the shape is worth getting right
  while there is exactly one consumer-less getter of each kind: `databaseUrl` can be
  `string` on the strength of its own guard, while `metricsSecret`/`priceProvider` are
  legitimately optional today and should stay `string | undefined`.
  - Status: Fixed - `backend/src/config/app-config.service.ts:1-8` now reads and
    validates `DATABASE_URL` once in the constructor and exposes it as `readonly
    databaseUrl: string`; `metricsSecret`/`priceProvider` (lines 20-26) stay
    `string | undefined` getters as F1 recommended. Re-verified in round 2: `pnpm
    --filter @portfolio/backend build` compiles clean under the base `strict`, and the
    constructor guard still throws and exits the process non-zero (both host `node
    dist/main.js` and `docker run` on the `prod` image with `DATABASE_URL=` unset/empty).

- **F2** [advisory · security] `backend/Dockerfile:48-54` - the `prod` stage runs as root,
  unlike `frontend/Dockerfile`'s prod stage, which creates `nodejs`/`nextjs` and ends with
  `USER nextjs`.
  ```dockerfile
  FROM base AS prod
  WORKDIR /app
  ENV NODE_ENV=production
  COPY --from=deploy /app/deploy ./
  ```
  This is **not** a story violation - AC D prescribes this stage verbatim, without a
  `USER`, and Dev implemented exactly what was written. Raising it for the owner because
  section D's own framing is "mirror `frontend/Dockerfile` exactly" and this is the one
  place it does not, and because the backend is the process that will hold the DB
  credentials (Epic 3) and the ES256 session signing key (Epic 4). Cheaper to add a
  `USER` now than after later stories bake assumptions into the deploy closure's file
  ownership. Owner's call whether to fold it in here or schedule it.

  (Related, same stage, same cause: `pnpm deploy` copies the whole package directory, so
  the prod image also ships `src/`, `tsconfig.json` and `nest-cli.json` alongside `dist/`.
  Harmless, and trimmable later with a `files` field if wanted.)
  - Status: Fixed - `backend/Dockerfile:48-62` now creates `nodejs`/`nestjs` (gid/uid
    1001, lines 54-55), copies the deploy closure with `--chown=nestjs:nodejs` (line 57),
    and sets `USER nestjs` (line 59) before `CMD`, mirroring `frontend/Dockerfile`'s prod
    stage. Re-verified in round 2: rebuilt the `prod` target from scratch, ran it, and
    confirmed via `docker exec ... id` (`uid=1001(nestjs) gid=1001(nodejs)`) and `docker
    top` (process row shows `UID 1001`) that PID 1 itself runs as uid 1001, not just that
    the image contains a `USER` instruction. `docker exec ... ls -la /app` shows the
    deploy closure owned by `nestjs:nodejs`. Health endpoint still answers 200. The
    related `src`/`tsconfig.json`/`nest-cli.json` observation is unchanged by this fix and
    remains as documented above; no action taken on it (out of this round's scope).

- **F3** [advisory · dependencies] `pnpm-lock.yaml` - the regeneration changed the
  frontend's resolved graph as a side effect, not only added the `backend` importer.
  Ten frontend entries were re-suffixed, e.g.
  `bcrypt: 5.1.1(supports-color@7.2.0)` -> `5.1.1(supports-color@8.1.1)`, the same shift
  through `@emotion/styled` for the four MUI packages, `axios`'s `debug`, `react-select`,
  `@typescript-eslint/eslint-plugin`, and `eslint-plugin-prettier` additionally gaining an
  `(@types/eslint@9.6.1)` peer context. Verified benign: **no frontend direct dependency's
  own resolved version changed** (62 entries before and after, all base versions
  identical) - only the peer-context labels, because `@nestjs/cli` pulled
  `supports-color@8.1.1` into the store. The frontend `deps` image layer builds clean
  against the new lockfile (above) and Dev's compose spot-check passed. Recorded only so
  the frontend lines in a 2326-line lockfile diff are not a surprise at sign-off; no
  action needed.
  - Status: Open

- **F4** [advisory · tooling] `backend/eslint.config.mjs:2-5` - the config imports
  `@eslint/js`, `eslint-plugin-prettier/recommended`, `globals` and `typescript-eslint`,
  none of which are in `backend/package.json`'s `devDependencies`, so the file cannot
  execute today. AC A explicitly permits this ("does not need to pass with zero warnings
  and is not wired into any build-failing check yet") and Dev Notes disclose it, so it is
  not a defect - recording the exact missing set so story 1.6 has it: those four plus
  `eslint` and `prettier` themselves. Nothing at the repo root runs eslint over
  `backend/`, so the unrunnable file affects nothing in the meantime.
  - Status: Open

**Verdict: Done.** No blocking findings; F1-F4 are advisory and do not gate the loop.
Ready for the owner's final read and commit (AC F's last checkbox). No repo files were
modified by this review - the two Docker images and the container used for verification
were removed, and `git status` is byte-identical to what Dev left.

### Round 2

Delta review only, per this round's scope: `app-config.service.ts` (F1's fix), the
`Dockerfile` prod stage (F2's fix), the env-mechanism change
(`app-config.module.ts` + `backend/package.json` scripts), and story-file coherence.
Round 1's full checklist was not re-run.

**Adjudication of Round 1's findings**

- **F1 - Resolved.** `backend/src/config/app-config.service.ts:8-18` validates
  `DATABASE_URL` once in the constructor and exposes `readonly databaseUrl: string`;
  `metricsSecret`/`priceProvider` stay `string | undefined` getters. The guard still
  fires before anything can serve: it runs during `InstanceLoader`, i.e. before
  `listen()`, and re-confirmed independently that with no config reachable the process
  exits 1 rather than starting. As a template for later injectables the shape is sound -
  required config is a field proven by the constructor, optional config stays an
  explicitly-optional getter, and nothing reads `process.env` directly.
- **F2 - Resolved.** `backend/Dockerfile:54-59` creates `nodejs` (gid 1001) and `nestjs`
  (uid 1001, `--ingroup nodejs`) *before* the copy, copies the deploy closure with
  `--chown=nestjs:nodejs` (line 57), and sets `USER nestjs` (line 59) ahead of `CMD`.
  Ordering is correct - the user exists at `--chown` time - and it matches
  `frontend/Dockerfile:59-79`'s equivalent stage; the backend's `adduser` is in fact
  slightly stricter than the frontend's (`--ingroup nodejs`, which the frontend omits).
  No divergence worth flagging.
- **F3, F4 - unchanged, still advisory.** Nothing in this round's diff touches them.

**Independently verified this round (not taken from Dev Notes)**

- Node v24.13.0: `--env-file=a --env-file=b` is last-listed-wins (`b` won);
  `--env-file-if-exists=<missing>` logs `not found. Continuing without it.` and continues.
- The flags reach the process under the Nest CLI path: `@nestjs/cli@11.0.24`'s
  `start.action.js:141-148` spawns with `shell: options.shell`, and `start.command.js:29`
  defaults `--shell` to `true`, so `[binaryToRun, ...processArgs].join(' ')` puts the
  whole `--exec` string on the command line. Confirmed empirically:
  `env -u DATABASE_URL pnpm --filter @portfolio/backend start` booted and answered
  `200 {"status":"ok"}` - with `DATABASE_URL` unset ambiently and no `.env` in `backend/`,
  the only possible source was the `--env-file-if-exists` pair, so the flags demonstrably
  arrived. `--watch` takes the identical code path (same `binaryToRun`, same hook), and
  `start:prod` passes them to `node` directly with no wrapper.
- Order is right: from `backend/`, `node --env-file-if-exists=../defaults.env
  --env-file-if-exists=../override.env` resolves `METRICS_SECRET` to `override.env`'s
  non-empty value rather than `defaults.env:19`'s empty one - last-listed wins, matching
  Compose's `env_file` order. No repo file was edited to test this.
- Story-file coherence (item 4): the Out of Scope entry for 1.5 names
  `env_file: [./defaults.env, ./override.env]` in exactly the form
  `docker-compose.yml:25-27, 56-58, 138-140` already use for other services, and states
  plainly that it is now the only supplier of container config. Accurate and sufficient
  for 1.5 to pick up. AC C's rewrite matches the implemented mechanism.

- **F5** [blocking · correctness] `backend/src/config/app-config.module.ts:11-13` -
  `ConfigModule.forRoot()` without `ignoreEnvFile: true` still performs in-code file
  loading: it silently reads `<cwd>/.env`, which AC C forbids and the module's own comment
  denies.
  ```ts
  ConfigModule.forRoot({
    isGlobal: false,
  }),
  ```
  `@nestjs/config@4.0.4`'s `config.module.js:74-80` defaults `envFilePath` to
  `resolve(process.cwd(), '.env')` whenever `ignoreEnvFile` is not `true`, and
  `loadEnvFile` (line 185) reads it if it exists. This repo has an untracked `.env` at the
  root containing `DATABASE_URL`, `PRICE_PROVIDER` and `METRICS_SECRET` - the exact keys
  `AppConfigService` reads. Concrete failure, reproduced: `env -u DATABASE_URL node
  backend/dist/main.js` from the repo root, with no `--env-file` flags and no Compose,
  booted and answered `GET /backend/api/health` with `200` - it should have died on the
  AC C fail-fast guard, but `ConfigModule` supplied `DATABASE_URL` from root `.env` on its
  own. (Also confirmed the inverse: with `process.cwd()` pointed at a directory holding a
  `.env` that defines `DATABASE_URL`, `AppConfigService` constructs successfully with
  `DATABASE_URL` unset in the environment; point it at an empty directory and the guard
  throws.) This is a third, undocumented config source with its own precedence rule -
  `assignVariablesToProcess` (line 200) fills only keys absent from `process.env`, so it
  is a silent lowest-priority fallback - in a story whose stated goal is "exactly one
  place config loading happens conceptually". It is inert on today's three exercised paths
  (host scripts and the `dev` image run with cwd `backend/`/`/app/backend`; the prod
  closure at `/app` ships no `.env`), which is why Round 1's and this round's runtime
  checks all passed - but 1.5 adds bind mounts and a compose `working_dir`, and this is
  the template every later injectable copies. Fix: add `ignoreEnvFile: true` to
  `ConfigModule.forRoot(...)`; the module comment at lines 5-7 then becomes true as
  written.
  - Status: Fixed - `backend/src/config/app-config.module.ts:11-14` now passes
    `ignoreEnvFile: true` alongside `isGlobal: false`, and the header comment (lines 5-9)
    is rewritten to explain why the flag is needed (stops `@nestjs/config`'s own default
    `process.cwd()`-relative `.env` lookup). Re-verified by reproducing the exact failure
    first: with `.env`/etc unset from the shell but the real untracked root `.env` present
    (containing `DATABASE_URL`, `METRICS_SECRET`, `PRICE_PROVIDER`), `env -u DATABASE_URL
    -u METRICS_SECRET -u PRICE_PROVIDER node backend/dist/main.js` from the repo root now
    throws the constructor's fail-fast guard and exits 1 (curl to
    `localhost:3001/backend/api/health` gets connection refused, `000`), where before the
    fix it served `200`. Then confirmed the fix does not disturb the three normal paths,
    rebuilt from scratch: `pnpm --filter @portfolio/backend start` (host, via the
    `--env-file-if-exists` flags) -> `200 {"status":"ok"}`; `docker build --target dev` +
    `docker run --env-file defaults.env --env-file override.env -p 3001:3001` -> `200
    {"status":"ok"}` (container logs show `../defaults.env not found. Continuing without
    it.` etc., confirming config came from `--env-file`, not any in-image `.env`);
    `docker build --target prod` + the same `docker run --env-file` invocation -> `200
    {"status":"ok"}`. Test images/containers removed after.

- **F6** [advisory · docs] `docs/bmad/nestjs-migration/stories/1-4-backend-scaffold.md:294-304` -
  the Technical Notes section "Why the config provider's env-file paths cannot use
  `process.cwd()`" still describes the abandoned in-code file-loading design and
  contradicts AC C as rewritten: "The backend does need to open them directly for
  host-side (non-Docker) dev to work at all". It no longer does - the launcher's
  `--env-file-if-exists` flags do. Round 1's Dev Notes paragraph on `envFilePath` is a
  historical record and is fine as-is, but this section reads as current guidance for
  later stories. Not `bmad-dev`'s to rewrite (Technical Notes are the SM's); flagging for
  the owner to trim or annotate before commit.
  - Status: Open

**Verdict: In Progress.** One blocking finding (F5) for `bmad-dev`. F1 and F2 are
Resolved; F3, F4, F6 are advisory and do not gate the loop. No repo files were modified
by this review - `git status` is byte-identical to what Dev left, `defaults.env`,
`override.env` and `.env` are untouched, and the two processes started for verification
were killed.

### Round 3

Closeout review, scope limited to Round 2's F5 fix (`ignoreEnvFile: true` in
`backend/src/config/app-config.module.ts:15` plus the rewritten header comment at lines
5-9). Nothing cleared in Rounds 1-2 was re-reviewed.

- **F5 - Resolved.** Verified against `@nestjs/config@4.0.4`'s source, not the docs. In
  `config.module.js:78-80`, `ignoreEnvFile: true` short-circuits `loadEnvFile` entirely,
  so the `resolve(process.cwd(), '.env')` default computed at lines 74-76 is never read.
  Traced every other value source in this exact configuration and confirmed all of them
  are inert: `internalConfig` starts `{}` (`config-host.module.js:24-25`,
  `useFactory: () => ({})`) and no `load` factories are passed, so
  `getFromInternalConfig` never answers; no `validate`/`validationSchema` is passed, so
  `VALIDATED_ENV_PROPNAME` is never populated and `getFromValidatedEnv` never answers;
  `expandVariables` is off and applies only inside `loadEnvFile` anyway;
  `assignVariablesToProcess(config)` at line 102 receives `{...process.env}` and its
  `filter(key => !(key in process.env))` makes it a no-op, so nothing is injected into
  `process.env` at boot. `ConfigService.get()` therefore resolves solely from
  `process.env` at call time (`config.service.js:180`), with caching off and
  `skipProcessEnv` false. `ignoreEnvFile: true` is the complete fix.
- **No side effects on later epics.** `ignoreEnvFile` only blanks the file-sourced base
  config; it does not change `ConfigService.get()` semantics, does not disable
  `process.env` lookup, and leaves `validationSchema`/`load`/`expandVariables` fully
  available to later stories (a future `validationSchema` would validate `{...process.env}`,
  which is the intended input). `ConfigModule.envVariablesLoaded` resolves the same way
  either path (`config.module.js:136` runs unconditionally).
- **Header comment is accurate as written.** "Reads process.env only, never a file" and
  the `process.cwd()`-relative explanation both match `config.module.js:74-80` exactly.

One residual detail, verified and recorded rather than raised as a finding, since it is
unreachable in this diff: `config.module.js:120` calls `configService.setEnvFilePaths(envFilePaths)`
*unconditionally*, so `ConfigService` retains `[<cwd>/.env]` even with `ignoreEnvFile: true`.
That array is read by exactly one method, `updateInterpolatedEnv` (`config.service.js:197-210`),
which is reachable only from `ConfigService.set(...)`. Nothing in `backend/src` calls `set()`
(grepped), and `AppConfigService` never will. Worth knowing if a later story ever mutates
config at runtime; not this story's problem.

- **F6** [advisory · docs] - carried forward unchanged, **Status: Open** by the owner's
  decision. Technical Notes lines 294-304 still describe the abandoned in-code
  file-loading design. Left untouched this round.
- **F3, F4** - unchanged, still advisory, still Open.

**Verdict: Done.** No blocking finding remains open (F1, F2, F5 all Resolved). F3, F4,
F6 are advisory and do not gate the loop; they are for the owner's final read. No repo
files were modified by this review and no process was started - source inspection only.
