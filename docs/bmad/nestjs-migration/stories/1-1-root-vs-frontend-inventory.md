# Story 1.1: Root-vs-`frontend/` file inventory

Status: Done

## Context

Epic 1 turns this repo into a pnpm workspace shaped `frontend/` + `backend/` (+
`packages/shared`). Story 1.2 executes that move as a path-only change. This story is the
plan 1.2 executes against: a written, file-by-file inventory of everything currently at
the repo root, each entry classified as **moves into `frontend/`**, **stays at root**, or
**is duplicated/split**, with a one-line reason.

The rest of Epic 1 runs 1.2 → **1.2a** (bump the frontend runtime to Node 24) → 1.3 (npm →
pnpm) → 1.4 (backend scaffold) → 1.5 (compose/nginx wiring) → 1.6 (type/lint baseline).
1.2a sits between the move and the pnpm conversion deliberately: 1.3's pinned pnpm major
will not run on Node 18. This story precedes all of them and decides none of them.

**No files move in this story.** The only deliverable is a document. The owner signs off
on the inventory before 1.2 starts (GR-4). This exists as its own story because the move
in 1.2 is large, mechanical, and hard to review after the fact - the cheap place to catch
"that should have stayed at root" is a table, not a diff.

### Ground rules that bind this story (and every story in this initiative)

- **GR-1 - Additive only.** Nothing under `src/app/api/` or `src/server/` is deleted,
  gutted, or rewritten. The Epic 1 relocation of `src/` into `frontend/src/` is the one
  permitted move, and it is a path change only. Removal work is Epic 8 and is out of
  scope until separately approved. **Consequence for this story: an entry may be marked
  "unused / suspected dead" but must still be given a destination.** The inventory
  proposes exactly one deletion in the entire tree - `package-lock.json`, for the reason
  set out below - and nothing else.
- **GR-2 - Scaffold-first with a hard Swagger sign-off gate at 2.9.** Not this story's
  concern, but no Epic 3+ work may be pulled forward into Epic 1.
- **GR-3 - Nothing is committed until the initiative is complete.** Work accumulates on
  the branch. "Commit" is not part of any story's definition of done.
- **GR-4 - Human sign-off between chunks.** This story ends at a sign-off gate.

## Acceptance Criteria

### Coverage and classification

- [x] A single inventory document exists at
      `docs/bmad/nestjs-migration/inventory-root-vs-frontend.md`.
- [x] Every entry currently at the repo root is listed, each with exactly one
      classification - `frontend/`, root, or duplicated/split - and a one-line reason.
      Verified by listing the working tree root (including dotfiles, excluding
      `node_modules/`, `.git/`, `.next/`) and checking every entry appears in the table.
- [x] The table covers at minimum every item the PRD names: `src/`, `public/`, `types/`,
      `types.d.ts`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`,
      `tsconfig.json`, `package.json`, `package-lock.json`, `.eslintrc.cjs`,
      `prettier.config.mjs`, `Dockerfile`, `nginx/Dockerfile`, `docker-compose.yml`,
      `defaults.env`, `override.env`, `setup_local_https.sh`, `nginx/`, `monitoring/`,
      `docs/`, `.claude/`, `.gitignore`, and the `"prisma": { "schema": ... }` pointer at
      `package.json:79-81`.
- [x] It also covers the root entries the PRD list does not name, each with the same
      treatment: `.env`, `.secrets`, `.eslintignore`, `.prettierignore`, `.dockerignore`,
      `next-env.d.ts`, `README.md`, `OBSERVABILITY.md`, `statsQuery.sql`,
      `com.tubesock.loopbackalias.plist`, `Dockerfile.dev`.
- [x] It covers the entries that do not exist yet but that the restructure creates at
      root, each with a one-line statement of what it is for: `pnpm-workspace.yaml`,
      `pnpm-lock.yaml`, `tsconfig.base.json`, the new private root `package.json`,
      `.nvmrc`, and `.npmrc` (see the pnpm criteria below).
- [x] **`src/middleware.ts` is called out explicitly as its own row**, not left implicit
      inside "`src/` moves wholesale". It moves to `frontend/src/middleware.ts` with the
      rest of `src/`, and the row records *why* it is singled out: per architecture
      finding F1 it is an unlisted server-side session consumer and an Epic 7 cutover
      blocker (see Technical Notes).
- [x] **`Dockerfile.dev` is recorded as suspected-unused and flagged, not deleted.**
      `docker-compose.yml:46-49` builds `Dockerfile` with `target: ${TARGET:-dev}`, so
      `Dockerfile.dev` has no referencing caller found. Under GR-1 removal is an Epic 8
      item; the row must give it a destination anyway and note the suspicion, so 1.2 does
      not silently relocate it as if it were live.
- [x] Repo-wide concerns are recorded as staying at root: `nginx/`, `monitoring/`,
      `docs/`, `.claude/`, `docker-compose.yml`, `defaults.env`, `override.env`,
      `setup_local_https.sh`.
- [x] For every entry classified **duplicated/split**, the document states what each copy
      contains and which package owns which half. At minimum this must resolve:
      `package.json`, `tsconfig.json`, and the lint/prettier config set.
- [x] The document records the **consequential edits** each move forces, so 1.2 has a
      checklist rather than a discovery exercise. At minimum: the `@/*` path alias in
      `tsconfig.json:16-18`, the `"prisma": { "schema": "src/server/db/schema.prisma" }`
      pointer at `package.json:79-81`, the Docker build context and every `COPY` path in
      `Dockerfile:9-27`, `.dockerignore`, the bind mounts at `docker-compose.yml:59-61`
      (`./src:/app/src`, `./public:/app/public`), and the `.gitignore` fix below.

### Package-manager entries (the pnpm side of the restructure)

These are inventory facts, not 1.3 design work. They are here because each one is a
root-vs-`frontend/` placement decision, and getting them wrong is discovered painfully
during the move rather than cheaply during review.

- [x] **`pnpm-workspace.yaml` is recorded as root-only**, listing `frontend`, `backend`,
      and `packages/*`. There is no per-package copy. The entry must also record that the
      file has to contain **`injectWorkspacePackages: true` from the moment it is created,
      before the first `pnpm install`** (D26c). This is an ordering constraint, not a
      config detail: adding the setting to a workspace whose lockfile predates it fires
      `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` and costs a lockfile regeneration, whereas a
      lockfile born with it in `settings:` is correct from the first install onward. It is
      what lets the production stages run plain `pnpm deploy`; **`--legacy` is not used
      anywhere** - that approach was tested and dropped.
- [x] **`pnpm-lock.yaml` is recorded as root-only**, and the document says explicitly that
      **the frontend does not get its own lockfile**. This is worth a sentence rather than
      a table cell: a single lockfile across the workspace means one resolution pass and
      one source of truth for every version, which is most of the reason to adopt pnpm at
      all. A per-package lockfile is the intuitive expectation and it is wrong here.
- [x] **`package.json` is classified as a split**, with both halves described: today's
      root `package.json` moves into `frontend/` essentially intact (keeping its
      dependencies, its Next scripts, and the `"prisma": { "schema": ... }` pointer with
      the path rewritten), and a **new private root `package.json`** is created holding
      only workspace-wide scripts and the prettier config reference. The root one is not
      the old one edited down; it is new, and the old one is the frontend's.
- [x] **`package-lock.json` has its own conspicuous entry with the destination "deleted",
      and the reasoning written out in full.** It is committed today at ~886KB. npm and
      pnpm cannot coexist - a stale `package-lock.json` alongside `pnpm-lock.yaml` is two
      contradictory sources of truth, and there is no additive way to adopt pnpm. The
      entry must state plainly that **this does not violate GR-1**: GR-1 governs
      `src/app/api/` and `src/server/`, the code whose behavior is being preserved, not
      the build tooling being deliberately replaced by story 1.3. This is the only
      deletion the inventory proposes anywhere, so it must be findable at a glance rather
      than buried in a table row - a reviewer who misses the reasoning will read it as a
      GR-1 breach.
- [x] **The `node_modules` removal-and-reinstall is recorded as owned by story 1.3**, and
      the row says so unambiguously rather than naming a range of stories. The existing
      tree must be physically removed and reinstalled *with pnpm* at the point of the
      pnpm conversion: npm's flat hoisted layout and pnpm's symlinked content-addressed
      store are incompatible, and a stale tree produces half-broken resolution that looks
      like a code problem. The row must also distinguish this from the **separate clean
      reinstall in 1.2a**, which is still an npm install and exists for a different reason
      (re-resolving and rebuilding against the Node 24 runtime after the major bump).
      Two reinstalls, two stories, two reasons - 1.2a re-installs on the new runtime, 1.3
      replaces the package manager. `node_modules` is gitignored, so neither is a repo
      change - which is precisely why they need to be written down somewhere, or they will
      not be.
- [x] **The `.gitignore` defect is recorded as a consequential edit.** `.gitignore:4` is
      `/node_modules` - the leading slash anchors it to the repo root, so it will not
      match `frontend/node_modules`, `backend/node_modules`, or
      `packages/shared/node_modules`. Left unfixed, the first `pnpm install` stages
      several thousand files. The inventory states the needed change; 1.2 makes it.
- [x] **`packageManager` placement is resolved**: the document states that it is pinned in
      the **root** `package.json` for corepack, so the pnpm version is reproducible and
      does not depend on what happens to be installed on the host. The pinned version is
      **pnpm 11.22.0** (D26a). There is no such field today.
- [x] **`.nvmrc` is resolved as a single root file containing `24`**, covering the whole
      workspace. There is no per-package `.nvmrc` and no backend/frontend divergence: per
      D26e the frontend moves to Node 24 in Epic 1 alongside the backend. The inventory
      notes that the root file sits alongside an `engines` field of `">=24 <25"` on **both**
      package manifests (`frontend/package.json` and `backend/package.json`), so a
      host-side `pnpm install` in either package matches the containers.
- [x] **`.npmrc` is raised as an open question rather than guessed at.** There is none
      today. pnpm's strict symlinked layout sometimes needs settings - `node-linker`,
      `shamefully-hoist`, or targeted `public-hoist-pattern` entries - for tools that
      assume flat hoisting, and Next and Nest are both candidates. The inventory records
      the question and the decision rule (add nothing up front; add the narrowest possible
      setting only if an actual resolution failure appears, and record which tool forced
      it). The rule is unchanged but it is **not a guess**: per architect decision D26c,
      real `pnpm install` runs plus a full `node:24-bookworm` Docker build were performed
      on a miniature workspace of this exact shape (`frontend`, `backend`,
      `packages/shared` with a build step, one root lockfile) on the pinned pnpm 11.22.0,
      and **no `.npmrc` was needed** - the empty-by-default position has evidence behind
      it. The inventory should cite that rather than framing it as an open bet.
      **1.3 confirms it against this repo's actual dependency set; this story must not
      invent a preemptive config.**
### Scope and sign-off

- [x] The document states the intended destination for `packages/shared` and whether it is
      created (empty) in Epic 1 or deferred to Epic 4, so 1.2 knows whether to make the
      directory.
- [x] The document states, in one line each, what the inventory does **not** decide: the
      frontend Node 24 bump (1.2a), pnpm conversion (1.3), backend scaffolding (1.4),
      compose/nginx wiring for `nest-api` (1.5).
- [x] No file outside `docs/bmad/nestjs-migration/` is created, moved, modified, or
      deleted by this story. Verified by `git status` showing only the new inventory
      document and this story file.
- [x] Owner has reviewed and signed off on the inventory. 1.2 does not start before that.
      *(GR-4 gate closed by the owner - see "Owner sign-off" below. Story 1.2 is
      unblocked.)*

## Technical Notes

### Target shape (from `architecture.md`, "Workspace layout")

The inventory should land on this shape. It is the target, not a substitute for the
file-by-file table - the architecture doc explicitly does not pre-empt this story.

```
/                          repo root - workspace-wide concerns only
  pnpm-workspace.yaml      packages: frontend, backend, packages/*
                           + injectWorkspacePackages: true, from creation
  pnpm-lock.yaml           single lockfile for the whole workspace
  package.json             private; workspace scripts + prettier + packageManager
                           (pnpm@11.22.0)
  .nvmrc                   24   - one runtime for the whole workspace
  tsconfig.base.json       deliberately thin
  prettier.config.mjs      shared - the one config both sides agree on
  docker-compose.yml
  defaults.env / override.env
  nginx/  monitoring/  docs/  .claude/
  setup_local_https.sh

  frontend/                today's tree, moved in 1.2, contents unchanged
    src/  public/  types/
    next.config.js  tailwind.config.ts  postcss.config.js
    tsconfig.json  .eslintrc.cjs  Dockerfile
    package.json           keeps the "prisma": { "schema": ... } pointer
                           engines: >=24 <25

  backend/                 new NestJS 11 service (story 1.4)
    src/  tsconfig.json  eslint.config.mjs  Dockerfile  package.json
                           engines: >=24 <25

  packages/shared/         session claim contract + verify helper, nothing else
```

Note what is *absent* from that root listing: no `package-lock.json`, and no `node_modules`
carried over from npm.

### Architecture decisions the inventory must respect

- **D24 - root `tsconfig.base.json`, per-package lint, no config packages.** The base
  carries only `strict`, `esModuleInterop`, `skipLibCheck` and is extended by relative
  path. It is thin on purpose: the two compilers genuinely differ (frontend `noEmit`,
  `jsx: preserve`, `moduleResolution: bundler`, `target: es5`; backend
  `experimentalDecorators`, `emitDecoratorMetadata`, `module: commonjs`, `target: ES2022`,
  real emit). The base exists to stop `strict` drifting, not to unify unlike things.
  So `tsconfig.json` is a **split**: the frontend keeps its own, and a new thin
  `tsconfig.base.json` appears at root.
- **Lint is per-package with no shared base.** The frontend keeps `eslint-config-next`
  and its existing `.eslintrc.cjs` (moves into `frontend/`); the backend gets its own
  `@typescript-eslint` flat config in 1.4/1.6. Prettier is the one config both sides
  agree on and `prettier.config.mjs` stays at root.
- **Prisma stays in `frontend/`.** Prisma remains the sole DDL owner for the whole
  initiative and lives on in the frontend package, so `frontend/package.json` keeps the
  `"prisma": { "schema": ... }` pointer with the path rewritten. MikroORM never generates
  DDL, and `@mikro-orm/migrations` is never installed (D14). Nothing under
  `src/server/db/migrations/` is touched (FR-13).
- **Docker build context becomes the repo root for both images**, because pnpm workspace
  dependency resolution requires it. Layer caching comes from copying `pnpm-lock.yaml`
  and both package manifests before any source. The Dockerfile itself moves into
  `frontend/`; the *context* stays root. Note this in the row for `Dockerfile` so 1.2/1.3
  do not treat "move the file" and "change the context" as the same edit.
- **One Node runtime across the whole workspace (D26, D26e).** Both packages are on
  **`node:24-bookworm`**. Node 24 "Krypton" is Active LTS, and LTS status rather than the
  dependency floor drives the choice (the floor is lower: `@mikro-orm/core@7.1.11`
  declares `engines.node >= 22.17.0`, `@nestjs/core@11.2.1` declares `>= 20`). Node 22 was
  evaluated and rejected as Maintenance LTS - security fixes only, a shorter-lived answer
  that would need redoing sooner. Node 20 is a non-starter: EOL since 2026-04-30 and below
  pnpm 11's `>= 22.13` floor.
- **The frontend moves to Node 24 too, in Epic 1 (D26e).** This reverses the earlier
  position that the frontend stayed on Node 18 for the duration. The presumed blocker was
  Next 14.0.1; a spike established empirically that 14.0.1 builds, boots, and serves on
  Node 24.13.0, that **Edge middleware executes ES256 WebCrypto successfully**, and that
  `bcrypt@5.1.1` is fine because it is N-API and therefore ABI-stable across Node majors.
  No Next upgrade is in scope. For this inventory the consequence is narrow and concrete:
  **there is no backend/frontend runtime divergence to record**, so `.nvmrc` is a single
  root file and `engines` is `">=24 <25"` on both manifests.
- **The runtime is pinned in code, not only in prose.** The root `.nvmrc` plus the two
  `engines` fields mean host-side development matches the containers. Without them the
  base image in a Dockerfile is the only record of the intended runtime, and a host-side
  `pnpm install` silently runs on whatever the developer happens to have.
- The architecture also records a scheduled bump to **`node:26-bookworm` shortly after
  2026-10-20**, when 24 enters maintenance and 26 becomes Active LTS. That is a calendar
  item, not this initiative's work.
- **npm → pnpm is story 1.3, not this one.** The inventory records the placement facts
  (root-only workspace file and lockfile, the `package.json` split, the
  `package-lock.json` deletion, where `packageManager` is pinned, the `.gitignore` fix,
  the `node_modules` reinstall) because those are all root-vs-`frontend/` questions. It
  does not perform or design the conversion itself.

### Architecture finding F1 - `src/middleware.ts` (must appear in the inventory)

The brief and PRD FR-8 both state that `src/app/page.tsx` and `src/app/login/page.tsx`
are the only non-API server-side session consumers. **That is wrong.**
`src/middleware.ts` wraps `withAuth` from `next-auth/middleware` and gates `/stats`,
`/stats/:path*`, and `/product/:path*` on the NextAuth cookie. After the Epic 7.1 auth
flip, a browser holding only a Nest-issued session would be redirected away from `/stats`
by middleware that still only understands NextAuth - a cutover blocker, not a polish item.

It matters here only for one reason: it is a file that must be consciously accounted for
rather than swept along inside "`src/` moves wholesale", so that the Epic 6.2 seam work
has a written record that it exists. It moves with `src/`; nothing about it changes in
Epic 1.

Context worth carrying, since it is easy to reach for the wrong fix later: this repo is on
**Next.js 14.0.1**, where middleware runs exclusively on the Edge runtime. The
`runtime: 'nodejs'` opt-out did not arrive until Next 15.2 and is experimental there.
"Edge" is a Next.js *runtime*, not a hosting location - running on EC2 behind nginx does
not make middleware run in Node.

The other two architecture findings, **F2** (the two `formatUSD` copies are behaviorally
different and both must ship) and **F3** (`http_requests_total` and
`http_request_duration_ms` are registered but never incremented), belong to stories 5.7
and 5.9 and have no bearing on this inventory. They are named here only so it is clear
they were considered and deliberately excluded.

### Observed root contents (as of drafting - re-verify, do not trust this list)

Files: `docker-compose.yml`, `Dockerfile`, `Dockerfile.dev`, `.dockerignore`,
`tailwind.config.ts`, `postcss.config.js`, `next.config.js`, `next-env.d.ts`,
`tsconfig.json`, `package.json`, `package-lock.json`, `types.d.ts`, `.eslintrc.cjs`,
`.eslintignore`, `prettier.config.mjs`, `.prettierignore`, `.gitignore`, `defaults.env`,
`override.env`, `.env`, `.secrets`, `setup_local_https.sh`, `README.md`,
`OBSERVABILITY.md`, `statsQuery.sql`, `com.tubesock.loopbackalias.plist`.

Directories: `src/`, `public/`, `types/`, `nginx/`, `monitoring/`, `docs/`, `.claude/`.

**Confirmed working-tree state relevant to the pnpm entries:** `package-lock.json` is
committed and is ~886KB; `node_modules/` exists and is gitignored; there is **no**
`.npmrc`; there is **no** `.nvmrc` anywhere in the tree; and `package.json` has **no**
`packageManager` field. So `.npmrc`, `.nvmrc`, and `packageManager` are all net-new
decisions rather than relocations of something existing - and in `.nvmrc`'s case the
outcome is one new root file, not one per package.

Two further notes on that list. **There is no `docker/` directory at the repo root**, despite PRD
success criterion 1 naming one among the repo-wide concerns - the inventory should record
that it does not exist rather than leave a reader hunting for it. And `.env`, `.secrets`,
`override.env`, and `nginx/certs`, `nginx/letsencrypt`, `nginx/dhparam.pem` are
gitignored (`.gitignore:37-55`); they are present in the working tree, they matter to a
working `docker compose up`, and they must appear in the inventory even though git does
not track them.

### Facts that constrain specific rows

- `docker-compose.yml:46-49` - `next-app` builds `context: .` with `dockerfile:
  Dockerfile` and `target: ${TARGET:-dev}`. This is why `Dockerfile.dev` appears unused.
- `docker-compose.yml:59-61` - bind mounts `./src:/app/src` and `./public:/app/public`.
  Both paths change in 1.2. Architecture warns the dev mount must stay narrow: mounting
  anything containing `node_modules` is fatal under pnpm's symlinked store.
- `docker-compose.yml:154-155` - the nginx service builds `context: ./nginx`, so
  `nginx/Dockerfile` is unaffected by the move.
- Every service reads `./defaults.env` and `./override.env` by root-relative path -
  another reason those two stay at root.
- `Dockerfile:9-27` - `COPY`s `package.json`, `package-lock.json`, `src`, `public`,
  `next.config.js`, `tsconfig.json`, `next-env.d.ts`, `tailwind.config.ts`,
  `postcss.config.js`, `types.d.ts`, and `types`. Every one of these paths changes when
  the build context becomes the repo root.
- `tsconfig.json:16-18` - `"@/*": ["./src/*"]`. Resolves relative to the tsconfig, so it
  survives the move unchanged *if* the frontend tsconfig moves alongside `src/`; state
  this explicitly rather than leaving 1.2 to guess.
- `tsconfig.json:25-36` - `include` names `next-env.d.ts`, `.eslintrc.cjs`,
  `prettier.config.mjs`, and `tailwind.config.ts` by relative path. `prettier.config.mjs`
  staying at root while the tsconfig moves is a real interaction; the inventory should
  say how it is resolved (drop it from `include`, or point at `../`).
- `package.json:79-81` - `"prisma": { "schema": "src/server/db/schema.prisma" }`.
- `next.config.js:6-16` - `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`
  are both `true`. Per NFR-2 they **stay on for this initiative**; story 1.6 records the
  real error counts and the deferral rationale, and 8.5 carries the fix for these two
  flags only. Note 8.5 no longer carries the frontend Node bump - that moved into Epic 1
  as its own story (1.2a) per D26e. The inventory
  moves this file unchanged and does not touch those flags.
- `.dockerignore` currently ignores `Dockerfile`, `db-dumps`, `.private`,
  `.dockerignore`, `node_modules`, `npm-debug.log`, `README.md`, `.next`, `.git`. With a
  root build context its patterns need re-examination; flag that, do not solve it here.
- `.gitignore:4` is `/node_modules`, anchored to the repo root. `.gitignore:52` is
  `/override.env`, also anchored, and correctly so. The former is the defect; the latter
  is fine and should not be "fixed" along with it.
- `Dockerfile:9-11` runs `npm ci` from `package.json` + `package-lock.json`. That is the
  concrete reason `package-lock.json` cannot simply be left lying around: it is load-
  bearing until 1.3 replaces the install step, and stale afterwards.

## Out of Scope

- **Moving anything.** Not one file changes location, name, or content in this story. If
  the working tree differs from `git status` beyond the two docs, the story failed.
- Story 1.2 - executing the move and making the forced path edits.
- Story 1.2a - bumping the frontend runtime to Node 24: editing `frontend/Dockerfile` to
  `node:24-bookworm`, writing the root `.nvmrc`, and setting `engines` on either manifest.
  This story only *inventories* those files - it records that `.nvmrc` is one root file
  containing `24` and where `engines` lands, and bumps nothing.
- Story 1.3 - actually performing the npm → pnpm conversion: writing
  `pnpm-workspace.yaml`, generating `pnpm-lock.yaml`, deleting `package-lock.json`,
  reinstalling `node_modules`, and reworking the Docker install steps. The inventory
  records *where each of those artifacts lives and why*; it does not execute any of it.
- Deciding the contents of `.npmrc`. The inventory records the question, the rule for
  answering it, and the D26c evidence that no `.npmrc` was needed on a miniature workspace
  of this shape; 1.3 confirms it from observed resolution behavior against the real
  dependency set. Do not write a speculative `.npmrc` into the inventory.
- Story 1.4 - creating `backend/`, the NestJS app, or the injectable config provider. The
  inventory names `backend/` as a destination directory and stops there.
- Story 1.5 - adding `nest-api` to `docker-compose.yml` or the `/backend/` location block
  in `nginx/nginx.conf`.
- Story 1.6 - running the type-checker or linter, or recording error counts.
- Populating `packages/shared`. The inventory says where it goes and when it is created;
  its contents are Epic 4's business.
- Deleting `Dockerfile.dev`, `src/app/api/_nextApiCompat.ts`, or anything else that looks
  dead. All of it is Epic 8, which requires separate approval (GR-1).
- Any change to `src/app/api/`, `src/server/`, or `src/server/db/migrations/`.

## Dev Notes

### Files touched

- **Created:** `docs/bmad/nestjs-migration/inventory-root-vs-frontend.md` - the only
  deliverable.
- **Modified:** this story file (status + AC checkboxes + these notes).

Nothing else. `git status` shows only the pre-existing untracked `docs/` and `.claude/`
trees; no file was moved, renamed, edited, or deleted anywhere else in the repo. GR-3
respected - nothing staged, nothing committed, no branch created (work sits on
`app-router-migration`).

### How it was verified

The inventory was built from the working tree, not from the story's "Observed root
contents" list. Every entry from `ls -A` at the root (excluding `node_modules/`, `.git/`,
`.next/`) was mechanically checked back against the document, and every line-number
citation the story makes was opened and confirmed: `docker-compose.yml:46-49`, `:59-61`,
`:154-155`; `Dockerfile:9-27`; `tsconfig.json:16-18`, `:25-36`; `package.json:79-81`;
`next.config.js:6-16`; `.gitignore:4` and `:52`. All correct. Confirmed absent as the
story states: `.nvmrc`, `.npmrc`, a `packageManager` field, and a root `docker/`
directory. `package-lock.json` measures 866 KiB rather than the story's "~886KB" - same
artifact, recorded as observed.

### Deviations and findings beyond the story

Five root entries exist that the story's observed list does not name, plus one extra
instance of a defect class it does name. All are written up in section 7 of the
inventory.

- **`.github/` - the material one.** Tracked, holds `workflows/deployment.yml` and
  `workflows/nginx_setup.yml`. `deployment.yml` builds with `context: .` and no explicit
  `dockerfile` input, so it builds the root `Dockerfile` by default and breaks the moment
  1.2 relocates that file. Added to the consequential-edits checklist as **C7** (add
  `file: frontend/Dockerfile`, keep `context: .`). Without this it would have surfaced as
  a red CI run after merge rather than during the move. `nginx_setup.yml` copies `./nginx`
  and needs no change.
- **`.gitignore:13` `/.next/` carries the same root-anchoring defect as `/node_modules`,**
  and so do `/.pnp` (5), `/coverage` (10), `/out/` (14), `/build` (17). The story named
  only line 4. Unfixed, `frontend/.next/` becomes tracked after the move. Added as
  **C9a**, with an explicit note not to touch the entries that are anchored *correctly*
  (`/override.env`, `/docker-compose.override.yml`, the three `/nginx/...` cert paths).
- **`app/`** - a stray untracked directory containing only a `.DS_Store`. It is not the
  Next app directory (that is `src/app/`) and has no consumers. Left in place per GR-1 and
  flagged for Epic 8, but it looks like an accident and is worth a glance at sign-off.
- **`db-dumps/`, `.private/`, `.DS_Store`** - all gitignored local data/noise, all
  classified stays-at-root, no action.

### Judgment calls the owner should look at

Written up in full in section 10 of the inventory; summarised here.

1. **`statsQuery.sql` → root, not `frontend/`.** Unreferenced by any build, script, or
   runtime path; it is reference material for the stats query Epic 5 reimplements in the
   *backend*, so filing it under `frontend/` would attach it to the side losing that
   logic. Reversible at zero cost.
2. **`README.md` → root.** Its content is actually Prisma-migration notes (frontend
   domain), but leaving the repo without a top-level README is worse, and rewriting it is
   out of scope.
3. **`prettier.config.mjs` dropped from the frontend tsconfig `include` (C3)** rather than
   re-pointed at `../prettier.config.mjs`. The story flagged this interaction and asked for
   a resolution; dropping keeps the frontend program inside `frontend/`, whereas
   re-pointing pulls a root file into it for no type-checking benefit.
4. **`packages/shared` deferred to Epic 4, not created empty in Epic 1.** Architecture
   leaves this open. Deferred because git cannot track an empty directory, so "creating" it
   in 1.2 would not be a repo change at all, and a `packages/*` glob matching zero packages
   is valid for pnpm. Section 8 flags that the Dockerfiles written in 1.3 will need a
   `COPY packages/shared/package.json` line added when Epic 4 creates the package - the
   architecture records that omitting a workspace manifest fails *silently*.

### Owner sign-off (GR-4 gate - closed)

The owner reviewed the inventory and signed off. The sign-off explicitly covered the four
judgment calls in section 10 of the inventory, **all accepted as proposed**:

1. **`statsQuery.sql` stays at root**, not `frontend/` - it is reference material for a
   query Epic 5 reimplements in the *backend*, so filing it under `frontend/` would attach
   it to the side losing that logic.
2. **`README.md` stays at root.**
3. **`prettier.config.mjs` is dropped from the frontend tsconfig `include` (C3)** rather
   than re-pointed at `../prettier.config.mjs`.
4. **`packages/shared` is deferred to Epic 4**, not created empty in Epic 1.

No changes to the inventory were requested. Story 1.2 may proceed against
`docs/bmad/nestjs-migration/inventory-root-vs-frontend.md` as written.

### Notes for story 1.2

Two things in the checklist are deliberately "no change needed" rather than edits, and
both are stated that way so 1.2 does not invent work: the `@/*` alias (**C1**) survives
untouched because the tsconfig and `src/` move together, and the Prisma schema pointer
(**C2**) survives untouched for the same reason - though C2 asks 1.2 to *verify* it by
running `npx prisma generate` from `frontend/` rather than assume it. Also confirmed:
`setup_local_https.sh` needs no edit at all (every path it touches - `./nginx/...` and
`./com.tubesock.loopbackalias.plist` at line 101 - stays at root), and `nginx/Dockerfile`
is untouched because `docker-compose.yml:154-155` builds `context: ./nginx`.

Nothing in the story's "Out of Scope" list was pulled in. No `.npmrc` was invented - the
inventory records the question, the decision rule, and the D26c evidence, per the story's
explicit instruction.
