# Root-vs-`frontend/` inventory

Deliverable of story 1.1. This is the plan story **1.2** executes against.

**Nothing moves in this document.** It classifies every entry currently at the repo root
as one of:

- **→ `frontend/`** - relocates into the new `frontend/` package, contents unchanged
  except where the new path forces an edit.
- **root** - stays exactly where it is, because it is a workspace-wide (repo-level)
  concern.
- **split** - one root artifact becomes two, one per side, with each half described.
- **deleted** - exactly one entry (`package-lock.json`); see
  [The one deletion](#1-the-one-deletion-package-lockjson).

Verified against the working tree on the `app-router-migration` branch. Where this
document disagrees with story 1.1's "Observed root contents" list, the working tree wins
and the difference is called out in
[Entries story 1.1 did not anticipate](#7-entries-story-11-did-not-anticipate).

---

## 1. The one deletion: `package-lock.json`

This is the only deletion the entire inventory proposes, anywhere in the tree. It is
placed first, before the tables, so that a reviewer cannot miss the reasoning and read it
as a GR-1 breach.

| Entry | Classification | Owning story |
| --- | --- | --- |
| `package-lock.json` | **deleted** | 1.3 (npm → pnpm) |

**Observed state:** committed and tracked, 866 KiB on disk.

**Why it cannot simply be left in place.** npm and pnpm cannot coexist. A stale
`package-lock.json` sitting next to `pnpm-lock.yaml` is two contradictory sources of
truth for every version in the tree, and the next person to run `npm ci` out of habit
gets a silently different dependency graph from the one the containers build. There is no
additive way to adopt pnpm - the whole point of story 1.3 is that the resolution
mechanism is replaced, not supplemented.

**It is load-bearing right up until 1.3.** `Dockerfile:9-11` copies `package.json` and
`package-lock.json` and runs `npm ci`; `Dockerfile.dev:6-8` does the same. So it must not
be deleted early - it goes at the moment 1.3 rewrites the install step, and not before.

**This does not violate GR-1.** GR-1 governs `src/app/api/` and `src/server/` - the
application code whose behavior is being preserved byte-for-byte across the migration. It
does not govern the build tooling that story 1.3 is chartered to replace. The lockfile is
a generated artifact of the package manager being deliberately swapped out, not code
whose behavior anyone is trying to keep. Nothing under `src/` is deleted, gutted, or
rewritten by this initiative before Epic 8.

---

## 2. Existing root entries

Every entry present in the working tree root, excluding `node_modules/`, `.git/`, and
`.next/` (those are covered separately in [section 5](#5-generated--untracked-trees)).
Dotfiles and gitignored entries are included.

### 2.1 Moves into `frontend/`

| Entry | Destination | Reason |
| --- | --- | --- |
| `src/` | `frontend/src/` | The Next.js application source in its entirety. Path-only move; no file contents change. See [`src/middleware.ts`](#23-srcmiddlewarets---called-out-explicitly) below, which is called out separately. |
| `public/` | `frontend/public/` | Next.js static asset root; only the frontend serves it. |
| `types/` | `frontend/types/` | Ambient declaration files (`global.d.ts`, `react-table-config.d.ts`) consumed only by the frontend tsconfig. |
| `types.d.ts` | `frontend/types.d.ts` | Global ambient types (`Transaction`, `ProductStats`, `StatsSummary`, …) for the frontend. Not shared with the backend - `packages/shared` carries the session contract and nothing else (D25). |
| `next-env.d.ts` | `frontend/next-env.d.ts` | Next-generated ambient reference; must sit beside the Next app. Named in `tsconfig.json` `include` and in `Dockerfile:23`. |
| `next.config.js` | `frontend/next.config.js` | Next config; resolved relative to the Next project root. Moves **unchanged** - `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` (`next.config.js:6-16`) stay `true` per NFR-2; story 8.5 owns that fix. |
| `tailwind.config.ts` | `frontend/tailwind.config.ts` | Frontend-only styling toolchain. Its `content` globs are relative to itself, so they survive the move alongside `src/`. |
| `postcss.config.js` | `frontend/postcss.config.js` | Loads `tailwindcss` + `autoprefixer`; frontend-only, and PostCSS discovers it from the Next project root. |
| `.eslintrc.cjs` | `frontend/.eslintrc.cjs` | Lint is **per-package with no shared base** (D24). This config extends `next/core-web-vitals` and is meaningless to the backend, which gets its own flat `@typescript-eslint` config in 1.4/1.6. |
| `.eslintignore` | `frontend/.eslintignore` | Pairs with `.eslintrc.cjs`; ESLint 8 resolves it from the lint working directory, which becomes `frontend/`. Its entries (`node_modules`, `.private`, `.next`, `db_dumps`, `public`) are frontend-relative once moved. Note `db_dumps` is a pre-existing typo for `db-dumps` and is **not** fixed here (out of scope; flag only). |
| `Dockerfile` | `frontend/Dockerfile` | The image is the frontend's. **The file moves; the build context does not** - see [Consequential edits](#4-consequential-edits---the-12-checklist), item C4. |
| `Dockerfile.dev` | `frontend/Dockerfile.dev` | **Suspected unused - flagged, not deleted.** See [below](#22-dockerfiledev---suspected-unused). |
| `package.json` | **split** | See [section 3](#31-packagejson---split). |
| `tsconfig.json` | **split** | See [section 3](#32-tsconfigjson---split). |

### 2.2 `Dockerfile.dev` - suspected unused

`docker-compose.yml:46-49` builds the `next-app` service with `context: .`,
`dockerfile: Dockerfile`, `target: ${TARGET:-dev}`. The dev target is a stage *inside*
`Dockerfile` (`Dockerfile:31-35`), so `Dockerfile.dev` has **no referencing caller
anywhere in the repo** - not in Compose, not in `.github/workflows/`, not in any script.
It is also stale relative to `Dockerfile`: it is on `node:18-alpine` rather than
`node:18-bullseye` and does not copy `types/`.

Under GR-1 removal is an Epic 8 item, so it gets a destination anyway:
`frontend/Dockerfile.dev`. The suspicion is recorded here so that **1.2 does not silently
relocate it as if it were live**, and so nobody spends time in 1.2a/1.3 keeping a dead
file in sync with the real one. Recommended handling in 1.2/1.3: move it, do **not** bump
it to Node 24, do **not** convert its `npm ci` to pnpm; note it as a known-stale artifact
awaiting Epic 8.

### 2.3 `src/middleware.ts` - called out explicitly

| Entry | Destination | Reason |
| --- | --- | --- |
| `src/middleware.ts` | `frontend/src/middleware.ts` | Moves with `src/`; **nothing about it changes in Epic 1.** Listed as its own row because architecture finding **F1** identifies it as an unlisted server-side session consumer and an Epic 7 cutover blocker. |

It is singled out because the brief and PRD FR-8 both state that `src/app/page.tsx` and
`src/app/login/page.tsx` are the only non-API server-side session consumers, and **that is
wrong**. `src/middleware.ts` wraps `withAuth` from `next-auth/middleware` and gates
`/stats`, `/stats/:path*`, and `/product/:path*` (verified: `src/middleware.ts:20`) on the
NextAuth cookie. After the Epic 7.1 auth flip, a browser holding only a Nest-issued
session would be redirected away from `/stats` by middleware that still only understands
NextAuth. That is a cutover blocker, not a polish item, and Epic 6.2's seam work needs a
written record that this file exists.

Context worth carrying so the wrong fix is not reached for later: this repo is on **Next
14.0.1**, where middleware runs *exclusively* on the Edge runtime. The `runtime: 'nodejs'`
opt-out did not arrive until Next 15.2 and is experimental there. "Edge" is a Next.js
*runtime*, not a hosting location - running on EC2 behind nginx does not make middleware
run in Node.

### 2.4 Stays at root

| Entry | Reason |
| --- | --- |
| `docker-compose.yml` | Orchestrates the whole stack (`portfolio-db`, `next-app`, `redis`, `loki`, `alloy`, `prometheus`, `nginx`, `grafana`); `nest-api` joins it in 1.5. A workspace-wide concern by definition. Several paths inside it change - see [C5, C6](#4-consequential-edits---the-12-checklist). |
| `defaults.env` | Every service reads it by root-relative path (`./defaults.env` at `docker-compose.yml:26,57,139`). Shared by frontend and backend from 1.5 onward. |
| `override.env` | Same, `./override.env`. Gitignored (`.gitignore:52` `/override.env`) but present in the working tree and required for `docker compose up`. |
| `.env` | Gitignored (`.gitignore:42`); local host-side env for `prisma`/`next dev` outside Docker. Repo-level, not a package artifact. |
| `.secrets` | Gitignored (`.gitignore:43`); local secrets, repo-level. |
| `nginx/` | Reverse proxy for the whole stack. `docker-compose.yml:154-155` builds `context: ./nginx`, so **`nginx/Dockerfile` is entirely unaffected by the move.** `nginx/nginx.conf` gains the `/backend/` location block in 1.5. |
| `monitoring/` | Loki / Alloy / Prometheus / Grafana configs, mounted by root-relative path (`./monitoring/...` at `docker-compose.yml:100,115,132,180`). Observes both services once the backend exists. |
| `docs/` | BMAD planning docs for the initiative; belongs to the repo, not to either package. |
| `.claude/` | Agent definitions, commands, skills and `settings.local.json` for the whole repo. |
| `.github/` | CI workflows. **Not named in story 1.1** - see [section 6](#7-entries-story-11-did-not-anticipate). `deployment.yml` builds with `context: .` and needs an edit - see [C7](#4-consequential-edits---the-12-checklist). |
| `setup_local_https.sh` | Local HTTPS bootstrap for the whole stack. References `./nginx/...` and `./com.tubesock.loopbackalias.plist`; both stay at root, so **this script needs no edit.** |
| `com.tubesock.loopbackalias.plist` | launchd loopback alias installed by `setup_local_https.sh:101` via the root-relative path `./com.tubesock.loopbackalias.plist`. Moving it would break that script for no gain. |
| `prettier.config.mjs` | Formatting is the **one config both sides agree on** (D24), so it is shared at root and referenced from the new root `package.json`. Interacts with the frontend tsconfig `include` - see [C3](#4-consequential-edits---the-12-checklist). |
| `.prettierignore` | Stays with `prettier.config.mjs`; Prettier resolves the ignore file from the directory it is invoked in, which is the workspace root. **Its patterns need updating** - see [C8](#4-consequential-edits---the-12-checklist). |
| `.gitignore` | One repo, one ignore file. Contains the anchoring defect fixed in 1.2 - see [C9](#4-consequential-edits---the-12-checklist). |
| `.dockerignore` | Docker resolves `.dockerignore` from the **build context root**, and the context stays at the repo root (D26 / pnpm workspace resolution). So it stays put, but **its patterns need re-examination** - see [C10](#4-consequential-edits---the-12-checklist). |
| `README.md` | Repo-level entry point. Its current contents are Prisma-migration notes, which are frontend-domain, but moving it would leave the repo without a README; rewriting it is not in this initiative's scope. **Judgment call** - flagged in [section 7](#10-judgment-calls-for-owner-sign-off). |
| `OBSERVABILITY.md` | Documents the `monitoring/` stack, which stays at root. Belongs with what it documents. |
| `statsQuery.sql` | Unreferenced developer scratch/reference SQL - no build, runtime, or script consumer found anywhere in the repo. Repo-level reference material; Epic 5 reimplements this query in the backend, so filing it under `frontend/` would imply an ownership it does not have. **Judgment call** - see [section 7](#10-judgment-calls-for-owner-sign-off). |
| `db-dumps/` | Gitignored (`.gitignore:40`) local database dumps. Working-tree-only developer data, tied to `portfolio-db`, not to either package. |
| `.private/` | Gitignored (`.gitignore:41`) local CSV data (`fills-all.csv`, `transactions.csv`). Same reasoning. |
| `app/` | **Stray directory containing only `.DS_Store`.** Untracked. Not the Next app directory - that is `src/app/`. Left in place and flagged; deletion is Epic 8 (GR-1). See [section 6](#7-entries-story-11-did-not-anticipate). |
| `.DS_Store` | macOS Finder metadata; gitignored (`.gitignore:20`). Not moved, not tracked, no action. |

### 2.5 The `docker/` directory does not exist

PRD success criterion 1 names a `docker/` directory among the repo-wide concerns. **There
is no `docker/` directory at the repo root** (verified). Recorded here so no reader hunts
for it and no story tries to move it. Docker assets live at
`Dockerfile`, `Dockerfile.dev`, `.dockerignore`, `docker-compose.yml`, and
`nginx/Dockerfile`.

---

## 3. Splits

### 3.1 `package.json` - split

Both halves, explicitly:

**`frontend/package.json`** - this is **today's root `package.json`, moved essentially
intact.** It keeps:

- `name`, `version`, `private: true` (name may be normalised to `@portfolio/frontend` by
  1.3 for workspace filtering).
- The full `dependencies` and `devDependencies` blocks, unchanged.
- The Next scripts: `dev`, `build`, `start`, `lint`, `generate`, `scrapeCoins`. The
  `scrapeCoins` script path `./src/server/scripts/scrape.ts` is relative to the manifest,
  so it survives the move unchanged.
- The `"prisma": { "schema": ... }` pointer from `package.json:79-81`, **with the path
  rewritten** - see [C2](#4-consequential-edits---the-12-checklist). Prisma remains the sole
  DDL owner for the whole initiative and lives on in the frontend package (D14).
- `engines: { "node": ">=24 <25" }` - **added by story 1.2a, not by 1.2.**

**The root `package.json`** - **new, private, and small.** It is *not* the old manifest
edited down; the old one is the frontend's. It holds only:

- `private: true`, no dependencies of its own beyond what workspace-wide tooling needs.
- Workspace-wide scripts (`pnpm -r` style fan-out).
- The prettier config reference, since `prettier.config.mjs` stays at root.
- `packageManager: "pnpm@11.22.0"` - see [section 4.2](#62a-packagemanager).

Getting this backwards is the expensive mistake: if the root manifest is produced by
editing the existing one, the frontend loses its dependency block and its Next scripts.

### 3.2 `tsconfig.json` - split

Per **D24**: a root `tsconfig.base.json`, per-package tsconfigs, no config packages.

**`frontend/tsconfig.json`** - today's `tsconfig.json`, moved alongside `src/`, extending
the new base by relative path (`"extends": "../tsconfig.base.json"`). It keeps everything
frontend-specific: `noEmit`, `jsx: preserve`, `moduleResolution: bundler`, `target: es5`,
`lib`, `plugins: [{ "name": "next" }]`, `paths`, and its `include`/`exclude`.

**`tsconfig.base.json`** (new, root) - **deliberately thin.** It carries only `strict`,
`esModuleInterop`, and `skipLibCheck`. It is not an attempt to unify the two compilers,
which genuinely differ: the frontend is the list above, the backend needs
`experimentalDecorators`, `emitDecoratorMetadata`, `module: commonjs`, `target: ES2022`,
and real emit. The base exists to stop `strict` drifting between the two, and nothing
more.

Two interactions with the move are recorded as consequential edits:
[C1](#4-consequential-edits---the-12-checklist) (the `@/*` alias) and
[C3](#4-consequential-edits---the-12-checklist) (`prettier.config.mjs` in `include`).

### 3.3 The lint / prettier config set - resolved

Not a single split; three separate placements, listed together because they are usually
reasoned about as one thing and are not.

| Artifact | Owner | Reason |
| --- | --- | --- |
| `.eslintrc.cjs` | `frontend/` | Per-package lint, **no shared base** (D24). Extends `eslint-config-next`, which is meaningless to a Nest service. |
| `.eslintignore` | `frontend/` | Pairs with the config above. |
| *(backend lint config)* | `backend/eslint.config.mjs` | New flat `@typescript-eslint` config, created in 1.4/1.6. Not this story's work; named so the split is complete. |
| `prettier.config.mjs` | **root** | The one config both sides genuinely agree on. Shared, referenced from the root `package.json`. |
| `.prettierignore` | **root** | Follows the prettier config; patterns updated per [C8](#4-consequential-edits---the-12-checklist). |

---

## 4. Consequential edits - the 1.2 checklist

Every edit the move *forces*. This exists so 1.2 works from a checklist rather than
discovering these one broken build at a time. Nothing here is optional and nothing here is
a behavioral change.

| # | Location | Edit |
| --- | --- | --- |
| **C1** | `tsconfig.json:16-18` - `"@/*": ["./src/*"]` | **No change needed, and this must be stated rather than left to guess.** The alias resolves relative to the tsconfig that declares it. Because `tsconfig.json` and `src/` move *together* into `frontend/`, `./src/*` still resolves to `frontend/src/*`. **Every `@/...` import across the codebase is therefore untouched.** The alias only breaks if the tsconfig and `src/` are separated - do not separate them. |
| **C2** | `package.json:79-81` - `"prisma": { "schema": "src/server/db/schema.prisma" }` | Path resolves relative to the manifest. Since both the manifest and `src/` land in `frontend/`, the string **can stay `src/server/db/schema.prisma`**. 1.2 must *verify* this (run `npx prisma generate` from `frontend/`) rather than assume it, because `Dockerfile:29` runs `npx prisma generate` from the image WORKDIR and the pnpm-era Dockerfile changes what that directory contains. Nothing under `src/server/db/migrations/` is touched (FR-13). |
| **C3** | `tsconfig.json:25-36` - `include` names `next-env.d.ts`, `.eslintrc.cjs`, `prettier.config.mjs`, `tailwind.config.ts` | Three of the four move into `frontend/` and keep working. **`prettier.config.mjs` stays at root**, so the entry becomes a dangling reference. **Resolution: drop `prettier.config.mjs` from the frontend tsconfig `include`.** It is a formatter config, never type-checked as part of the app, and pointing at `../prettier.config.mjs` would pull a file outside `rootDir` into the frontend program for no benefit. (Also note `include` lists `next-env.d.ts` twice, lines 26 and 31, and has a trailing comma on line 35 - both pre-existing, both harmless, neither fixed here.) |
| **C4** | `Dockerfile:9-27` - the build context and every `COPY` path | **The file moves to `frontend/Dockerfile`; the build context becomes the repo root** and stays there (pnpm workspace dependency resolution requires it). These are two different edits and 1.2/1.3 must not conflate them. Every one of these paths changes: `package.json`, `package-lock.json` (lines 9-10, replaced wholesale by 1.3's pnpm install), `src` (19), `public` (20), `next.config.js` (21), `tsconfig.json` (22), `next-env.d.ts` (23), `tailwind.config.ts` (24), `postcss.config.js` (25), `types.d.ts` (26), `types` (27) - each gains a `frontend/` prefix on its source side. Layer caching comes from copying `pnpm-lock.yaml` **and every workspace manifest** before any source. |
| **C4a** | `Dockerfile.dev:6-24` | Same class of change, but this file is suspected-dead - see [2.2](#22-dockerfiledev---suspected-unused). Move it, do not maintain it. |
| **C5** | `docker-compose.yml:46-49` - `next-app` build block | `context: .` stays `.` (root context, per C4). `dockerfile: Dockerfile` becomes `dockerfile: frontend/Dockerfile`. `target: ${TARGET:-dev}` unchanged. |
| **C6** | `docker-compose.yml:59-61` - bind mounts | `./src:/app/src` → `./frontend/src:/app/frontend/src` and `./public:/app/public` → `./frontend/public:/app/frontend/public` (exact container-side paths depend on the WORKDIR 1.3 settles on). **The dev mount must stay narrow**: mounting anything that contains a `node_modules` directory is fatal under pnpm's symlinked store. Do not "simplify" this to `./frontend:/app/frontend`. |
| **C7** | `.github/workflows/deployment.yml` - `docker/build-push-action` step | Uses `context: .` with no `dockerfile` input, so it builds the root `Dockerfile` by default. Once `Dockerfile` lives at `frontend/Dockerfile` this step fails. Add `file: frontend/Dockerfile`, keeping `context: .`. **Not anticipated by story 1.1** - see [section 6](#7-entries-story-11-did-not-anticipate). (`nginx_setup.yml` copies `./nginx` and needs no change.) |
| **C8** | `.prettierignore` | Currently `node_modules`, `.private`, `.next`, `db_dumps`, `public`. Run from the workspace root, `.next` and `public` no longer match anything - they become `frontend/.next` and `frontend/public`. Update those two entries. `node_modules` is unanchored and still matches at any depth. (`db_dumps` is a pre-existing typo for `db-dumps`; **do not fix it as part of this move** - it is unrelated noise in an otherwise mechanical diff.) |
| **C9** | `.gitignore:4` - `/node_modules` | **Defect.** The leading slash anchors the pattern to the repo root, so it will not match `frontend/node_modules`, `backend/node_modules`, or `packages/shared/node_modules`. Left unfixed, the first `pnpm install` stages several thousand files. Change to unanchored `node_modules/`. **`.gitignore:52` `/override.env` is anchored and correctly so - do not "fix" it along with this one.** |
| **C9a** | `.gitignore:13` - `/.next/` | **The same defect, in the same file, one that story 1.1 did not catch.** Anchored to root, so `frontend/.next/` would be tracked after the move - and Next's build output is large. Change to unanchored `.next/`. The same applies to `/.pnp` (line 5), `/coverage` (10), `/out/` (14), and `/build` (17): all are anchored and all would miss a package-level equivalent. Recommend unanchoring the build-output set as one edit. Leave the deliberately-anchored entries alone - `/nginx/letsencrypt/`, `/nginx/certs/`, `/nginx/dhparam.pem` (47-49), `/override.env` (52), and `/docker-compose.override.yml` (55) all name genuinely root-only paths. See [section 7](#7-entries-story-11-did-not-anticipate). |
| **C10** | `.dockerignore` | Currently ignores `Dockerfile`, `db-dumps`, `.private`, `.dockerignore`, `node_modules`, `npm-debug.log`, `README.md`, `.next`, `.git`. With a root build context these need re-examination: `Dockerfile` and `.next` are root-anchored by shape and no longer match `frontend/Dockerfile` / `frontend/.next`, while `node_modules` needs to exclude every package's tree without excluding the workspace manifests the build needs. **Flagged, not solved here** - the correct pattern set depends on 1.3's final Dockerfile shape. |

---

## 5. Generated / untracked trees

| Entry | Treatment |
| --- | --- |
| `node_modules/` | **Physically removed and reinstalled with pnpm - owned by story 1.3, unambiguously.** See below. |
| `.next/` | Build output, regenerated. Moves implicitly with the build to `frontend/.next/`; needs the `.gitignore` fix in [C9a](#4-consequential-edits---the-12-checklist). |
| `.git/` | Untouched. |

### The `node_modules` reinstalls - two of them, two stories, two reasons

These need writing down precisely because `node_modules` is gitignored and neither
reinstall produces a repo change. If they are not recorded here, they are recorded
nowhere.

- **Story 1.2a - a clean reinstall that is still an npm install.** After the frontend
  runtime moves to Node 24, dependencies are re-resolved and native artifacts rebuilt
  against the new runtime. Package manager unchanged. This exists because of the *runtime*
  bump.
- **Story 1.3 - the pnpm conversion.** The existing tree is **physically removed** and
  reinstalled *with pnpm*. npm's flat hoisted layout and pnpm's symlinked
  content-addressed store are incompatible; a surviving npm tree produces half-broken
  resolution that presents as a code problem and costs hours to diagnose. This is **not**
  "1.2a-1.3" or "somewhere in Epic 1" - it belongs to **1.3** and only 1.3.

---

## 6. Net-new root entries created by the restructure

These do not exist today. Each is a root-vs-`frontend/` placement decision, which is why
they are inventoried here rather than left to the story that creates them.

| Entry | Placement | What it is for | Created by |
| --- | --- | --- | --- |
| `pnpm-workspace.yaml` | **root only** | Declares the workspace members. **No per-package copy exists.** | 1.3 |
| `pnpm-lock.yaml` | **root only** | The single lockfile for the entire workspace. | 1.3 |
| `package.json` (root) | root | New, private; workspace scripts + prettier reference + `packageManager`. See [3.1](#31-packagejson---split). | 1.3 |
| `tsconfig.base.json` | root | Thin shared compiler base: `strict`, `esModuleInterop`, `skipLibCheck`. See [3.2](#32-tsconfigjson---split). | 1.2 / 1.6 |
| `.nvmrc` | **root only**, contents `24` | One runtime for the whole workspace. See [6.3](#63-nvmrc). | 1.2a |
| `.npmrc` | **open question - write nothing** | See [6.4](#64-npmrc---open-question-not-a-guess). | 1.3, only if forced |
| `frontend/` | root-level directory | The relocated Next.js application. | 1.2 |
| `backend/` | root-level directory | The new NestJS 11 service. Named as a destination here; its contents are 1.4's. | 1.4 |
| `packages/shared/` | root-level directory | Session claim contract + verify helper. See [section 8](#8-packagesshared). | Epic 4 (see 8) |

### 6.1 `pnpm-workspace.yaml`

Root-only, listing `frontend`, `backend`, and `packages/*`. There is no per-package copy -
the file defines the workspace, and a workspace has exactly one definition.

**It must contain `injectWorkspacePackages: true` from the moment it is created, before
the first `pnpm install` (D26c).** This is an *ordering* constraint, not a config detail.
Adding the setting later, to a workspace whose lockfile predates it, fires
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` and costs a full lockfile regeneration. A lockfile
born with the setting in `settings:` is correct from the first install onward. It is what
lets the production Docker stages run a plain `pnpm deploy`.

**`--legacy` is not used anywhere.** That approach was tested and dropped; if it appears in
a Dockerfile during 1.3, it is a regression, not an alternative.

### 6.2 `pnpm-lock.yaml` - and why the frontend does not get its own

Root-only. **The frontend does not get its own lockfile, and neither does the backend or
`packages/shared`.** This deserves a sentence rather than a table cell, because a
per-package lockfile is the intuitive expectation and it is wrong here: a single lockfile
across the workspace means **one resolution pass and one source of truth for every version
in the tree**, which is most of the reason to adopt pnpm at all. Two lockfiles would let
the frontend and backend silently resolve the same transitive dependency to different
versions, which is exactly the class of bug the migration is trying not to introduce.

### 6.2a `packageManager`

Pinned in the **root** `package.json` as `"packageManager": "pnpm@11.22.0"` (D26a), for
corepack. Root, not per-package: corepack reads the manifest at the directory it is
invoked from upward, and pinning it once at the workspace root means the pnpm version is
reproducible and does not depend on whatever happens to be installed on the developer's
host or the CI runner.

**There is no `packageManager` field anywhere in the repo today** (verified) - this is a
net-new decision, not a relocation.

### 6.3 `.nvmrc`

**A single root file containing `24`**, covering the whole workspace. There is no
per-package `.nvmrc` and **no backend/frontend runtime divergence to record**: per D26e
the frontend moves to Node 24 in Epic 1 alongside the backend, reversing the earlier
position that it stayed on Node 18. The spike established empirically that Next 14.0.1
builds, boots, and serves on Node 24.13.0, that Edge middleware executes ES256 WebCrypto
successfully, and that `bcrypt@5.1.1` is unaffected because it is N-API and therefore
ABI-stable across Node majors. No Next upgrade is in scope.

The root file sits alongside `"engines": { "node": ">=24 <25" }` on **both** package
manifests (`frontend/package.json` and `backend/package.json`), so a host-side
`pnpm install` in either package matches what the containers run. Both images are
`node:24-bookworm`. Without the `.nvmrc` and the two `engines` fields, the base image in a
Dockerfile is the only record of the intended runtime and a host-side install silently
runs on whatever the developer happens to have.

**There is no `.nvmrc` anywhere in the tree today** (verified). Story 1.2a writes it; this
inventory only records that it is one root file and what it contains.

### 6.4 `.npmrc` - open question, not a guess

**There is no `.npmrc` today** (verified), and **this story does not write one.**

pnpm's strict symlinked layout sometimes needs settings - `node-linker`,
`shamefully-hoist`, or targeted `public-hoist-pattern` entries - for tools that assume
npm's flat hoisting. Next and Nest are both plausible candidates.

**The decision rule: add nothing up front. Add the narrowest possible setting only if an
actual resolution failure appears, and record which tool forced it.** Reaching for
`shamefully-hoist` preemptively discards the isolation that is the reason to use pnpm.

The empty-by-default position is **not a bet - it has evidence behind it.** Per architect
decision D26c, real `pnpm install` runs plus a full `node:24-bookworm` Docker build were
performed on a miniature workspace of this exact shape (`frontend`, `backend`,
`packages/shared` with a build step, one root lockfile) on the pinned pnpm 11.22.0, and
**no `.npmrc` was needed**. Story 1.3 confirms that against this repo's actual dependency
set.

---

## 7. Entries story 1.1 did not anticipate

Story 1.1's "Observed root contents" list was explicitly marked *re-verify, do not trust*.
Re-verification found five root entries it does not name, plus one additional defect of a
class it does name.

| Found | Classification | Note |
| --- | --- | --- |
| `.github/` | root | **The material one.** Tracked, contains `workflows/deployment.yml` and `workflows/nginx_setup.yml`. `deployment.yml` builds with `context: .` and no explicit `dockerfile`, so it builds the root `Dockerfile` - which the move relocates. This is a real consequential edit that would otherwise have been discovered by a red CI run after merge, not during 1.2. Captured as [C7](#4-consequential-edits---the-12-checklist). |
| `app/` | root, flagged | Stray untracked directory whose only content is a `.DS_Store`. It is **not** the Next app directory (`src/app/`) and has no consumers. Left alone under GR-1; a candidate for Epic 8. Worth a glance during sign-off in case it was meant to be something. |
| `db-dumps/` | root | Gitignored local data (`.gitignore:40`), already ignored by `.dockerignore`. |
| `.private/` | root | Gitignored local CSV data (`.gitignore:41`), already ignored by `.dockerignore`. |
| `.DS_Store` | root | macOS noise, gitignored. No action. |

Plus, in a file the story did examine:

- **`.gitignore:13` `/.next/` has the same anchoring defect as `/node_modules`**, and so do
  `/.pnp` (5), `/coverage` (10), `/out/` (14), and `/build` (17). Story 1.1 named only line
  4. After the move `frontend/.next/` would become tracked. Captured as
  [C9a](#4-consequential-edits---the-12-checklist).

Everything else in the story's observed list was confirmed present and correct, including
every line-number citation (`docker-compose.yml:46-49`, `:59-61`, `:154-155`;
`Dockerfile:9-27`; `tsconfig.json:16-18`, `:25-36`; `package.json:79-81`;
`next.config.js:6-16`; `.gitignore:4`, `:52`). `package-lock.json` measures 866 KiB
against the story's "~886KB"; same artifact, no consequence.

---

## 8. `packages/shared`

**Destination:** `packages/shared/` at the repo root, matched by the `packages/*` glob in
`pnpm-workspace.yaml`.

**When it is created: deferred to Epic 4. Story 1.2 does not make the directory.**

Architecture leaves this open ("can be created empty here or deferred to Epic 4 - it has
no consumers until the session type exists"). Deferring is the right call for a concrete
mechanical reason: **git does not track empty directories**, so "creating" it in 1.2 would
not survive as a repo change at all - it would exist only in the working tree of whoever
ran the story. Worse, an empty `packages/shared/` with no `package.json` is not a
workspace member; pnpm would either skip it or warn, and the first `pnpm install` in 1.3
would produce a lockfile that does not mention it either way. A `packages/*` glob matching
zero packages is entirely valid for pnpm, so nothing in 1.3 needs the directory to exist.

The package's contents - `SessionClaims`, `SessionUser`/`Session`, the `'ES256'` and cookie
name constants, and the `jose`-based `verifySessionToken` at the `./verify` subpath - are
Epic 4's business, per D25.

**One thing 1.3 must nonetheless account for:** per the architecture's Docker findings,
each image must copy the `package.json` of **every** workspace member, and omitting one
fails *silently* (exit 0, a dangling symlink, `MODULE_NOT_FOUND` at container start). While
`packages/shared` does not exist, there is nothing to copy - but the Dockerfiles written in
1.3 will need that `COPY` line added when Epic 4 creates the package. Flagged so it is not
rediscovered as a mystery runtime failure.

---

## 9. What this inventory does not decide

One line each, so the boundary is unambiguous:

- **Story 1.2 - the move itself.** This document is the plan; 1.2 executes it and makes
  every edit in [section 4](#4-consequential-edits---the-12-checklist).
- **Story 1.2a - the frontend Node 24 bump.** Editing `frontend/Dockerfile` to
  `node:24-bookworm`, writing the root `.nvmrc`, and setting `engines` on either manifest.
  This inventory records *where those files live and what they contain*; it bumps nothing.
- **Story 1.3 - the npm → pnpm conversion.** Writing `pnpm-workspace.yaml`, generating
  `pnpm-lock.yaml`, deleting `package-lock.json`, reinstalling `node_modules`, reworking
  the Docker install steps, and confirming the `.npmrc` question. This inventory records
  placement and reasoning; it performs and designs none of it.
- **Story 1.4 - backend scaffolding.** Creating `backend/`, the NestJS application, or the
  injectable config provider. This inventory names `backend/` as a destination and stops.
- **Story 1.5 - compose/nginx wiring for `nest-api`.** Adding the service to
  `docker-compose.yml` or the `/backend/` location block in `nginx/nginx.conf`.
- **Story 1.6 - the type/lint baseline.** Running the type-checker or linter, or recording
  error counts. `next.config.js`'s two ignore flags stay on per NFR-2; 8.5 owns them.
- **Epic 8 - removal work.** `Dockerfile.dev`, `src/app/api/_nextApiCompat.ts`, the stray
  `app/` directory, and anything else that looks dead. All flagged here, none deleted, all
  requiring separate approval (GR-1).
- **Contents of `packages/shared`** - Epic 4's business (D25).

Architecture findings **F2** (the two behaviorally-different `formatUSD` copies, both of
which must ship) and **F3** (`http_requests_total` and `http_request_duration_ms`
registered but never incremented) belong to stories 5.7 and 5.9. They were considered and
deliberately excluded; they have no bearing on file placement.

---

## 10. Judgment calls for owner sign-off

Four decisions in this document went beyond mechanically applying the story's inputs. Each
is defensible but each is reversible, and they are the places worth spending sign-off
attention.

1. **`statsQuery.sql` → root, not `frontend/`.** It is unreferenced by any build, script,
   or runtime path. It is reference material for the stats query that Epic 5 reimplements
   in the *backend*, so filing it under `frontend/` would attach it to the side that is
   losing that logic. If you read it as a frontend artifact, move it - the cost either way
   is zero.
2. **`README.md` → root.** Its actual content is Prisma migration instructions, which are
   frontend-domain. It stays at root because a repo without a top-level README is worse
   than a slightly misplaced one, and rewriting it is not in scope. A future story could
   split it into a root README plus `frontend/README.md`.
3. **`prettier.config.mjs` dropped from the frontend tsconfig `include` ([C3](#4-consequential-edits---the-12-checklist))**
   rather than re-pointed at `../prettier.config.mjs`. Dropping keeps the frontend program
   inside `frontend/`; re-pointing would pull a root file into it for no type-checking
   benefit. If you would rather keep the file type-checked, the `../` form works.
4. **`packages/shared` deferred to Epic 4 rather than created empty in Epic 1**
   ([section 8](#8-packagesshared)). Driven by the fact that git cannot track an empty
   directory, so "creating" it in 1.2 would be a no-op in the repo.

Also worth an explicit look during sign-off, though not a judgment call:

- The stray **`app/`** directory ([section 7](#7-entries-story-11-did-not-anticipate)) - it
  contains only a `.DS_Store` and appears to be an accident, but it is left in place under
  GR-1 rather than deleted.
- **`.github/workflows/deployment.yml`** ([C7](#4-consequential-edits---the-12-checklist)) -
  this workflow deploys to EC2 with `docker run` directly and does not use
  `docker-compose.yml` at all, so it is already divergent from the local stack. The move
  only requires the one `file:` addition, but the broader divergence is worth knowing about
  before Epic 1 ends with "the stack runs".
