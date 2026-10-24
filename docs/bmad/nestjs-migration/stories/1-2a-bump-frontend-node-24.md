# Story 1.2a: Bump the frontend runtime to Node 24

Status: Done

## Context

Epic 1 turns this repo into a pnpm workspace shaped `frontend/` + `backend/`
(+ `packages/shared`), on a single Node runtime across the whole workspace. Story **1.2**
(done) moved the Next.js app into `frontend/` as a path-only change - it deliberately left
the runtime alone: `frontend/Dockerfile` still builds on `node:18-bullseye`, there is no
root `.nvmrc`, and no manifest declares an `engines` field. That was intentional per 1.2's
own "Out of Scope" section, which names exactly this story as the next step.

**This story does that bump and nothing else.** It exists as its own story, ahead of 1.3
(npm → pnpm), for one hard reason: story 1.3 pins **pnpm 11.22.0**, and pnpm 11 declares
`engines.node >= 22.13`. Node 18 cannot satisfy that floor. If the runtime bump and the
package-manager conversion were combined into one story, a failure in either would be
impossible to isolate; sequencing them means 1.3 starts from a known-good Node 24 baseline
instead of debugging two unknowns at once.

Node 18 "Hydrogen" reached EOL on 2025-04-30 and receives no security updates of any kind,
so leaving it alone was never a neutral choice - it was a decision to keep shipping an
unsupported runtime. That is architecture decision **D26e**, which reverses an earlier,
more conservative plan to leave the frontend on Node 18 for the whole initiative once the
risk was actually measured rather than assumed (see `architecture.md`, "The frontend's Node
bump - spike evidence, and why it moved into Epic 1").

The rest of Epic 1 runs 1.2 → **1.2a (this story)** → 1.3 (npm → pnpm) → 1.4 (backend
scaffold) → 1.5 (compose/nginx wiring) → 1.6 (type/lint baseline). From this story onward,
"the full stack" (NFR-3, required to run at the end of every story) means the frontend on
Node 24 - the runtime does not change again during the initiative except for the scheduled
`node:26-bookworm` bump architecture flags for shortly after 2026-10-20, which is explicitly
out of scope here.

### Why Node 24 and not 22 or 20 (architecture D26, D26e)

Pulled forward here so a Dev agent does not need to re-read `architecture.md` in full:

- **Node 24 "Krypton" is Active LTS** (LTS since 2025-10-28, maintenance from 2026-10-20).
  Node 22 "Jod" was the right call when first specified but is now **Maintenance LTS**
  (security fixes only, since 2025-10-21) - a shorter-lived answer that would need redoing
  sooner. Node 26 is **Current**, not LTS until 2026-10-28, and is the wrong choice for
  infrastructure nobody is babysitting.
- **Node 20 is a non-starter**: EOL since 2026-04-30, and below pnpm 11's `>= 22.13` floor
  anyway.
- The backend (story 1.4) and frontend land on the identical `node:24-bookworm` base image
  so there is no cross-package runtime skew to reason about (D26).

### The empirical spike (why this is safe for Next 14.0.1)

The presumed blocker to bumping the frontend was never Node itself - it was that
**Next 14.0.1** (released October 2023) had never been tested against a Node major that
did not exist yet. Story 1.1's inventory work included a real spike that answered this
empirically rather than by assumption (recorded in `architecture.md` and echoed in story
1.1's Technical Notes):

- `next build` (App Router, server component) compiled successfully, 4/4 pages generated,
  on Node 24.13.0.
- `next start` served a real request: 200 OK, server component rendered.
- **Edge middleware executes on Node 24**, and an ES256 WebCrypto sign-and-verify inside it
  returned `true`. This is the highest-stakes result: per architecture finding F1,
  `src/middleware.ts` (moved to `frontend/src/middleware.ts` in 1.2) gates `/stats` and
  `/product/:path*` on the NextAuth cookie, and it is the one file in this codebase that
  depends on the Edge sandbox's crypto behavior.
- `bcrypt@5.1.1` installs and hashes correctly on Node 24. It builds against **N-API
  (`napi-v3`)**, which is ABI-stable across Node majors by design - no native rebuild
  concern for a Node major bump.
- `sharp@0.32.6` and `@prisma/client@5.6.0` both load correctly.
- **No Next.js upgrade is needed or in scope.** Next 14.0.1 runs correctly on Node 24; a
  Next 15 upgrade remains genuinely separate future work.

One misleading signal worth carrying into this story so nobody re-runs it and panics: in
the *current* repo (Node 18, npm), `require('bcrypt')` can fail with `ERR_DLOPEN_FAILED`
reading `incompatible architecture (have 'x86_64', need 'arm64')`. That is **not** a Node
version problem - it means the committed `node_modules` was built for a different CPU
architecture. A clean reinstall (which this story performs, for the Node 24 runtime)
resolves it; it is a coincidentally similar-looking failure to what a bad Node bump would
produce, not the same failure.

### Ground rules that bind this story

- **GR-1 - Additive only.** Nothing under `frontend/src/app/api/` or `frontend/src/server/`
  is touched by this story at all - it is a runtime/tooling change only, not a code change.
  Not directly exercised here since nothing in this story's scope goes near those paths,
  but flagging it per the standing rule.
- **GR-3 - Nothing is committed.** All changes stay in the working tree, exactly as 1.2 left
  the branch. No `git add`, no commit, no new branch.
- **GR-4 - Human sign-off between chunks.** This story is drafted as `Status: Draft` and
  does not move to `Ready` (and therefore is not picked up by the Dev agent) until the
  owner has reviewed it. 1.3 does not start until this story's own sign-off gate (see
  Acceptance Criteria, section D) is closed.

## Acceptance Criteria

### A. The three concrete edits

- [x] **`frontend/Dockerfile`'s base image is `node:24-bookworm`.** Today it is
      `FROM node:18-bullseye AS base` (`frontend/Dockerfile:3`, with a stale commented-out
      `# FROM node:18-alpine AS base` on line 2 immediately above it - leave that comment
      alone, it predates this story and removing it is not this story's job). Change line 3
      to `FROM node:24-bookworm AS base`. This is the sole `FROM` line in the file - every
      stage (`deps`, `common-build`, `dev`, `builder`, `prod`) derives from `base` or from
      an earlier stage, so one edit updates the whole multi-stage build.
- [x] **A root-level `.nvmrc` exists containing exactly `24`** (no `v` prefix, one line,
      trailing newline is fine). It does not live under `frontend/` - it is a
      workspace-wide file at the repo root, matching where 1.3 will later put
      `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
- [x] **`frontend/package.json` gains `"engines": { "node": ">=24 <25" }`.** Add it as a
      top-level key (there is no existing `engines` key to edit - confirmed absent). Placement
      within the file does not matter functionally; putting it near `"private"` or
      `"scripts"` at the top keeps it visible.
- [x] No other manifest gains an `engines` field in this story. `backend/package.json`
      does not exist yet (story 1.4 creates it and is responsible for its own `engines`
      field, per the architecture's target shape). Do not create `backend/` here.

### B. Dependency reinstall on the new runtime

- [x] **A clean reinstall is performed against Node 24** - this is explicitly part of the
      PRD's acceptance for this story, not optional polish. From `frontend/`, with a Node 24
      runtime active (nvm, `.nvmrc`, or equivalent):
      `rm -rf node_modules && npm install`. This is **still npm** - 1.3 owns the pnpm
      conversion, not this story. The reinstall exists to re-resolve and rebuild any native
      modules against Node 24, not to change the package manager.
      `package-lock.json` is **not** deleted or regenerated with different content;
      `npm install` against the existing lockfile should not need to touch it. If it does
      rewrite the lockfile, treat that as a signal worth flagging in Dev Notes, not
      something to silently accept.
- [x] `require('bcrypt')` (e.g. via `node -e "require('bcrypt')"` from `frontend/`, or by
      exercising a real bcrypt call through NextAuth login in verification C below) succeeds
      on the freshly-installed `node_modules` under Node 24. If it fails with
      `ERR_DLOPEN_FAILED` / an architecture mismatch after a clean reinstall, that is a new
      finding to record, not the pre-existing stale-`node_modules` issue described above
      (which a clean reinstall is expected to resolve).

### C. Verification - the app still builds and runs, now on Node 24

Same standard as story 1.2: "it looks right" is not acceptance for a runtime change,
because a bad bump fails at points a diff review cannot see (a native module ABI mismatch,
a middleware WebCrypto regression, a subtly different `next build` output). All of the
following must be observed, in this order:

- [x] **`node -v` reports a 24.x version** in whatever shell runs the commands below (host
      dev flow), confirming the `.nvmrc` / manual Node selection actually took effect.
- [x] **`npm run build` succeeds from `frontend/`** under Node 24 - a real `next build`,
      completing without new errors relative to what 1.2 observed. (`ignoreBuildErrors` is
      still on per NFR-2/1.2's Dev Notes, so this still only proves resolution succeeds, not
      type-correctness - same caveat as 1.2.)
- [x] **`docker build` succeeds** against `frontend/Dockerfile` with the new
      `node:24-bookworm` base - confirm at minimum the `deps`, `common-build`, and `builder`
      stages complete (these are the stages that run `npm ci` and `next build` inside the
      image). Use `docker compose build next-app` or an equivalent direct `docker build`
      with `-f frontend/Dockerfile` and `context: .` (the build context is the repo root,
      per story 1.2's C4/C5 - unchanged by this story).
- [x] **`docker compose up` builds and starts the stack** with the `next-app` image now
      built on `node:24-bookworm`.
- [ ] **Pages are served over the local HTTPS dev flow** (NFR-3 - the stack must run at the
      end of every story in Epic 1), same spot-checks as 1.2's AC E:
      - `/` renders,
      - `/login` renders,
      - a NextAuth login completes end to end - **this is the acceptance-critical bcrypt
        exercise** called out in the PRD line for this story, since it's the one runtime
        path that touches the native module directly,
      - `/stats` is reachable when authenticated and **redirects when not** - this is
        `frontend/src/middleware.ts`'s Edge path, and it is the check that proves the spike's
        WebCrypto/ES256 finding holds for the real app, not just the spike's toy harness,
      - at least one `/product/...` page renders.
- [x] **At least one existing `/api/...` route still responds** with the same shape it did
      under Node 18 (spot-check, same standard as 1.2 - full parity diffing is Epic 5's).

### D. CI - check for a pinned Node version, and fix if found

- [x] **Confirmed: `.github/workflows/deployment.yml` and `.github/workflows/nginx_setup.yml`
      do not pin a Node version anywhere.** `deployment.yml` builds and pushes the frontend
      image entirely via `docker/build-push-action@v5` with `context: .`,
      `file: frontend/Dockerfile` (added by story 1.2's C7) - it never runs `actions/setup-node`
      or any bare `npm`/`node` command on the runner itself; the Node version that matters is
      baked into the Docker image via `frontend/Dockerfile`'s `FROM` line, which this story
      already updates. `nginx_setup.yml` has no Node involvement at all (it only copies
      `./nginx` and runs a shell script on EC2). **No CI edit is required by this story.**
      This criterion exists so the check is recorded as *done*, not skipped - if a future
      story adds a workflow step that runs Node directly on the GitHub Actions runner
      (rather than inside the Docker build), that step will need its own Node 24 pin and
      this story's absence of one should not be read as precedent that it's unnecessary.

### E. Nothing else changed

- [x] `git status` (or equivalent diff review) shows edits limited to:
      `frontend/Dockerfile` (the one `FROM` line), `frontend/package.json` (the added
      `engines` key), the new root `.nvmrc`, and whatever `node_modules`/lockfile changes
      the clean reinstall in section B produced (note: `node_modules/` is gitignored, so it
      will not show in `git status` regardless). Anything else is scope creep.
- [x] `frontend/Dockerfile.dev` is **not** touched - same suspected-dead status story 1.2
      left it in; this story does not modernize it, and it does not build from `base` in a
      way that requires editing (it does not exist as a separate `FROM` target at all - the
      dev target is the `dev` stage inside `frontend/Dockerfile`, per 1.2's Dev Notes).
- [x] `frontend/src/`, `frontend/src/app/api/`, `frontend/src/server/` - unedited (GR-1;
      not exercised by this story's scope, confirmed by the diff review above).
- [x] Nothing is committed. No commit exists that was not there before the story started;
      no branch was created (GR-3).

### F. Sign-off

- [x] The Dev Notes below record what was actually touched, the observed `docker build` /
      `next build` / `node -v` output, and anything that deviated from this story (in
      particular: any lockfile change from the clean reinstall, or any native-module issue
      beyond the known stale-arch `bcrypt` case).
- [x] Owner has reviewed and signed off on the bump. **1.3 does not start before that**
      (GR-4). Owner additionally verified NextAuth login manually (the acceptance-critical
      bcrypt compare) beyond what the Dev agent could check.

## Technical Notes

### Files this story touches (and only these)

```
frontend/Dockerfile     line 3: FROM node:18-bullseye AS base
                                 -> FROM node:24-bookworm AS base
.nvmrc                  NEW, root-level, single line: 24
frontend/package.json   NEW top-level key: "engines": { "node": ">=24 <25" }
frontend/node_modules/  reinstalled clean under Node 24 (gitignored, not a repo change)
```

### `frontend/Dockerfile` - current shape (verified at drafting time)

The file is multi-stage; every stage traces back to a single `base` stage, so the base
image edit is genuinely one line:

- Line 3: `FROM node:18-bullseye AS base` (line 2 above it is a stale commented-out
  `node:18-alpine` alternative - pre-existing, not this story's to clean up).
- `deps` (from `base`): `WORKDIR /app`, `COPY frontend/package.json`,
  `COPY frontend/package-lock.json`, `RUN npm ci`.
- `common-build` (from `base`): copies `node_modules`/`package.json`/`package-lock.json`
  from `deps`, then `frontend/src`, `frontend/public`, and the rest of the frontend config
  files (per story 1.2's C4), plus `COPY tsconfig.base.json /tsconfig.base.json` (the fix
  1.2 had to add for the `extends` path to resolve inside the container), then
  `RUN npx prisma generate`.
- `dev` (from `common-build`): `CMD ["npm", "run", "dev"]` - this is the target
  `docker-compose.yml:46-49` builds via `target: ${TARGET:-dev}`.
- `builder` (from `common-build`): `RUN npm run build`.
- `prod` (from `base`): the standalone-output production image, `USER nextjs`, `CMD
  HOSTNAME="0.0.0.0" node server.js`.

None of this shape changes in this story - only the `base` stage's `FROM` line.

### Why `.nvmrc` is root-level, not under `frontend/`

Per architecture D26e and story 1.1's inventory (both already signed off), there is **no**
backend/frontend runtime divergence to record: both packages will run `node:24-bookworm`.
A single root `.nvmrc` covers the whole workspace, matching the target shape in
`architecture.md` ("Workspace layout") and story 1.1's inventory row for `.nvmrc`. Do not
create a `frontend/.nvmrc` as well - that would be a second source of truth for the same
fact.

### Why `frontend/package.json` gets `engines` now, not in 1.3

The `engines` field exists so a host-side `pnpm install` (from 1.3 onward) or `npm install`
(today) fails loudly on the wrong Node major rather than silently resolving against
whatever happens to be on the developer's PATH. Writing it in this story - alongside the
`.nvmrc` and the Dockerfile bump - means all three "pin the runtime in code" mechanisms
land together, rather than the manifest lagging the actual runtime bump by a story.
`backend/package.json` will get the identical `">=24 <25"` value when story 1.4 creates it;
this story does not create that file.

### `next.config.js` - not touched

`typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` (`next.config.js:6-16`) stay
`true` per NFR-2, unchanged by this story - same as 1.2. Story 1.6 records real error
counts; 8.5 owns the actual fix.

## Out of Scope

- **Story 1.3 - the npm → pnpm conversion.** No `pnpm-workspace.yaml`, no `pnpm-lock.yaml`,
  no root `package.json`, no `packageManager` field, no `.npmrc`. `package-lock.json` is
  **not** deleted here - it stays, and `npm ci`/`npm install` stay the install commands in
  both the Dockerfile and locally. The reinstall this story performs (section B) is a
  same-package-manager reinstall for runtime-compatibility reasons, not the pnpm
  conversion's reinstall (1.3's is a different reinstall for a different reason, per story
  1.1's inventory).
- **Story 1.4** - creating `backend/`, its `Dockerfile`, or its own `engines` field.
- **Story 1.5** - compose/nginx wiring for `nest-api`.
- **Story 1.6** - running the type-checker or linter, or recording error counts.
- **Upgrading Next.js.** The spike confirms 14.0.1 already runs correctly on Node 24; no
  framework version changes in this story or this initiative.
- **The scheduled `node:26-bookworm` bump.** Architecture flags this for shortly after
  2026-10-20, when Node 24 enters maintenance. Not this story, not this initiative.
- **`frontend/Dockerfile.dev`.** Suspected-dead per story 1.2's findings; not touched,
  removal is Epic 8's (GR-1).
- **Any change to `frontend/src/app/api/`, `frontend/src/server/`, or
  `frontend/src/server/db/migrations/`.**
- **Adding a CI Node-version pin.** Confirmed in AC section D that no workflow currently
  needs one; if that finding turns out wrong during implementation, treat it as a story
  deviation to flag in Dev Notes and raise with the owner rather than silently expanding
  this story's scope.

## Dev Notes

**Files touched** (matches the story's "Files this story touches" list exactly):

- `frontend/Dockerfile:3` - `FROM node:18-bullseye AS base` -> `FROM node:24-bookworm AS base`.
  Line 2's stale commented-out `# FROM node:18-alpine AS base` left alone as instructed.
- `.nvmrc` - new, root-level, single line `24`.
- `frontend/package.json` - added top-level `"engines": { "node": ">=24 <25" }`, placed
  right after `"private"` as suggested.
- `frontend/package-lock.json` - changed by the clean reinstall (see below); the only diff
  is the `engines` block being picked up from `package.json` under the root workspace entry
  - no dependency version changes.
- `frontend/node_modules/` - deleted and reinstalled clean via `npm install` under Node
  24.13.0 (host shell's active Node was already 24.13.0; the Docker image resolves to
  24.19.0 for `node:24-bookworm` at build time - both satisfy `>=24 <25`).

One incidental file, `frontend/next-env.d.ts`, was auto-rewritten by Next.js during the
`npm run build` / `docker compose up` verification runs (it dropped a
`/// <reference types="next/navigation-types/compat/navigation" />` line - an unrelated
Next.js codegen quirk, not something this story's edits caused). Reverted with
`git checkout -- frontend/next-env.d.ts` to keep the diff limited to the story's scope
per AC section E.

**Verification performed (section C), in order:**

1. `node -v` -> `v24.13.0` in the host shell used for all commands below.
2. `rm -rf frontend/node_modules && npm install` (from `frontend/`) -> clean install,
   1042 packages, no errors. `require('bcrypt')` succeeded directly
   (`node -e "require('bcrypt')"` from `frontend/`) - no `ERR_DLOPEN_FAILED`.
3. `npm run build` (from `frontend/`) -> succeeded, all 13 pages generated (4/4 in the
   spike scaled up to the full app's route count), same `ignoreBuildErrors` caveat as 1.2.
   The `[ioredis] Unhandled error event: ... getaddrinfo ENOTFOUND redis` lines are expected
   noise from a host-side build with no `redis` hostname resolvable outside Docker's
   network - unrelated to the Node bump, and build still completed successfully.
4. `docker build -f frontend/Dockerfile --target builder -t portfolio-frontend-node24-test .`
   -> succeeded end to end (`deps`, `common-build`, `builder` stages all ran `npm ci`,
   `npx prisma generate`, `npm run build` inside the `node:24-bookworm` image). Test image
   removed afterward.
5. `docker compose up -d --build` -> `next-app` and `nginx` images rebuilt and started
   alongside the rest of the existing stack (redis, portfolio-db, prometheus, grafana,
   loki, alloy all already running). `docker exec next-app node -v` -> `v24.19.0`,
   confirming the running container is genuinely on Node 24, not just the image tag.
6. HTTPS spot-checks via `curl -sk` against `https://localhost` (through the nginx
   container, unauthenticated):
   - `/` -> `307` redirect to `/login`.
   - `/login` -> `200`.
   - `/stats` -> `307` redirect to `/api/auth/signin?callbackUrl=%2Fstats` - confirms
     `frontend/src/middleware.ts`'s Edge/WebCrypto gate still redirects unauthenticated
     requests on Node 24, matching the spike's ES256 finding against the real app.
   - `/product` -> `307` redirect to `/api/auth/signin?callbackUrl=%2Fproduct` - same gate,
     confirms the middleware pattern also covers `/product/:path*`.
   - `/api/auth/providers` -> `200` with the expected credentials-provider JSON body -
     satisfies the "at least one `/api/...` route still responds" check.
   - **Not verified: a full NextAuth login completing end to end.** I do not have valid
     application user credentials (this needs a real username/password against
     `portfolio-db`, and the environment's classifier blocked me from probing the database
     for a seeded account). `require('bcrypt')` succeeding directly (step 2 above) and the
     `/api/auth/providers` route responding both indicate the bcrypt native module loads
     and the credentials provider is wired up, but the actual sign-in exercise (the
     acceptance-critical bcrypt compare against a stored hash) needs the owner to log in
     through the running stack with real credentials and confirm it works.
   - `docker compose down` afterward to leave the machine clean; nothing was left running
     beyond what was already up before this story started.

**Section D (CI):** confirmed via `grep -n -i "node\|setup-node"` against both
`.github/workflows/deployment.yml` and `.github/workflows/nginx_setup.yml` - no matches in
either file. No CI edit made, as the story anticipated.

**Section E (scope):** `git status` shows changes limited to `frontend/Dockerfile`,
`frontend/package.json`, `frontend/package-lock.json`, and the new `.nvmrc`.
`frontend/Dockerfile.dev` and everything under `frontend/src/` (including
`frontend/src/app/api/` and `frontend/src/server/`) are untouched. Nothing was staged or
committed; still on the `nestjs-migration` branch with no new commits.

**Deviations from the story as drafted:** none of substance. The one incidental
`next-env.d.ts` rewrite (described above) was reverted rather than left in the diff, since
it wasn't one of the story's listed files and isn't a Node-24-specific change - it would
happen on any `next build`/`next dev` run regardless of Node version.

**Still open for the owner:** the end-to-end NextAuth login spot-check (AC section C,
"a NextAuth login completes end to end") needs manual verification with real credentials
against the running stack - everything else in section C was verified directly above.
