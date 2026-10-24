# Story 1.2: Execute the root → `frontend/` move

Status: Done

## Context

Epic 1 turns this repo into a pnpm workspace shaped `frontend/` + `backend/`
(+ `packages/shared`). Story **1.1** produced the plan: a file-by-file inventory at
`docs/bmad/nestjs-migration/inventory-root-vs-frontend.md`, classifying every root entry
as *moves into `frontend/`*, *stays at root*, or *split*, plus a consequential-edits
checklist **C1-C10**. The owner has signed that inventory off (GR-4 gate closed, including
all four judgment calls in its section 10).

**This story executes that plan and nothing else.** It is a path-only change: no file's
*contents* change beyond what the new paths force. It does not re-decide any
classification - where this story and the inventory disagree, the inventory wins and the
disagreement is a bug in this story.

The rest of Epic 1 runs 1.2 → **1.2a** (bump the frontend runtime to Node 24) → 1.3
(npm → pnpm) → 1.4 (backend scaffold) → 1.5 (compose/nginx wiring) → 1.6 (type/lint
baseline). **After this story the app still runs on npm and Node 18.** That is correct and
intended; do not pull 1.2a or 1.3 forward.

The inventory is the source of truth for *what moves where*. This story restates the parts
a Dev agent needs so it can be implemented without re-reading it end to end, but the
inventory should still be open alongside it for the full row-by-row table.

### Ground rules that bind this story

- **GR-1 - Additive only.** Nothing under `src/app/api/` or `src/server/` is deleted,
  gutted, or rewritten. The relocation of `src/` into `frontend/src/` is a **path change
  only**. Removal work is Epic 8 and out of scope until separately approved. Nothing that
  looks dead gets deleted here - notably `Dockerfile.dev`, `src/app/api/_nextApiCompat.ts`,
  and the stray `app/` directory (which contains only a `.DS_Store`).
  **The single sanctioned deletion in the entire initiative is `package-lock.json`, and it
  belongs to story 1.3, not this one.** The reasoning, kept visible so nobody reads it as a
  GR-1 breach: npm and pnpm cannot coexist, a stale `package-lock.json` beside
  `pnpm-lock.yaml` is two contradictory sources of truth, and GR-1 governs the application
  code whose behavior is being preserved - not the build tooling story 1.3 is chartered to
  replace. **In this story `package-lock.json` is load-bearing**: `Dockerfile:9-11` runs
  `npm ci` from it. It moves into `frontend/` with `package.json` and stays there until
  1.3 removes it.
- **GR-3 - Nothing is committed.** All changes stay in the **working tree**. No `git add`,
  no commit, no new branch - work sits on `app-router-migration` alongside the rest of the
  initiative. "Commit" is not part of any story's definition of done.
  *(Caveat that follows from this: `git mv` stages by design - see the note under
  "Use `git mv`, not `mv`" for how to satisfy both.)*
- **GR-4 - Human sign-off between chunks.** This story ends at a sign-off gate. **1.2a does
  not start until the owner has signed off on the move.**

### Use `git mv`, not `mv`

Every relocation in this story uses **`git mv`** rather than `mv`, for tracked files.
Rename detection is heuristic; using `git mv` records the rename explicitly so history
follows each file and the eventual diff reads as "renamed" rather than "deleted 400 files,
added 400 files". On a move this broad that is the difference between a reviewable diff and
an unreviewable one, and between `git log --follow` working and not.

Two consequences to handle deliberately:

- `git mv` **stages** the rename. That is unavoidable and is not a GR-3 violation - GR-3
  forbids *committing*, not the index bookkeeping `git mv` requires. Do not `git commit`,
  do not create a branch. If you want a clean unstaged tree afterwards, `git reset` (mixed,
  no `--hard`) leaves the moved files in place on disk while emptying the index; either
  end state is acceptable so long as nothing is committed.
- Untracked and gitignored entries (`.env`, `.secrets`, `db-dumps/`, `.private/`,
  `node_modules/`, `.next/`) cannot be `git mv`'d. Per the inventory none of them move
  anyway - they all stay at root, except `.next/` and `node_modules/`, which are
  regenerated rather than moved. Do not hand-move them.

## Acceptance Criteria

### A. The move itself

- [x] A `frontend/` directory exists at the repo root and contains, moved via `git mv`
      with contents unchanged:
      `src/`, `public/`, `types/`, `types.d.ts`, `next-env.d.ts`, `next.config.js`,
      `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.cjs`, `.eslintignore`,
      `Dockerfile`, `Dockerfile.dev`, `tsconfig.json`, `package.json`, and
      `package-lock.json`.
- [x] `frontend/src/middleware.ts` exists and is **byte-identical** to the previous
      `src/middleware.ts`. It moves with `src/` and nothing about it changes in Epic 1
      (called out because architecture finding F1 makes it an Epic 7 cutover blocker - see
      Technical Notes).
- [x] These stay exactly where they are, untouched in location:
      `docker-compose.yml`, `defaults.env`, `override.env`, `.env`, `.secrets`,
      `nginx/`, `monitoring/`, `docs/`, `.claude/`, `.github/`, `setup_local_https.sh`,
      `com.tubesock.loopbackalias.plist`, `prettier.config.mjs`, `.prettierignore`,
      `.gitignore`, `.dockerignore`, `README.md`, `OBSERVABILITY.md`, `statsQuery.sql`,
      `db-dumps/`, `.private/`, `app/`, `.DS_Store`.
      **`statsQuery.sql` and `README.md` staying at root are owner-signed-off decisions -
      do not "correct" them into `frontend/`.**
- [x] Nothing under `src/app/api/`, `src/server/`, or `src/server/db/migrations/` is
      deleted, renamed within the tree, or edited. Verified by `git status` showing those
      paths only as renames under `frontend/`, with no content diff.
- [x] `package-lock.json` still exists (at `frontend/package-lock.json`). **It is not
      deleted in this story.**
- [x] `Dockerfile.dev` is moved to `frontend/Dockerfile.dev` and otherwise left alone -
      not bumped, not modernised, not deleted. It is suspected-dead (no referencing caller
      anywhere: `docker-compose.yml:46-49` builds `Dockerfile` with `target: ${TARGET:-dev}`,
      and `dev` is a stage inside `Dockerfile` at `:31-35`). Epic 8 owns its removal.

### B. Consequential edits C1-C10

Each item below is from the inventory's checklist. Two of them are deliberately
**"no change needed"** and are listed so this story does not invent work.

- [x] **C1 - `@/*` path alias: no edit.** `frontend/tsconfig.json` still declares
      `"@/*": ["./src/*"]`. The alias resolves relative to the tsconfig that declares it,
      and the tsconfig moves *with* `src/`, so it now resolves to `frontend/src/*`.
      **No `@/...` import anywhere in the codebase is rewritten.** If you find yourself
      editing imports, stop - the tsconfig and `src/` have been separated and that is the
      bug.
- [x] **C2 - Prisma schema pointer: no edit, but verified.** `frontend/package.json` still
      reads `"prisma": { "schema": "src/server/db/schema.prisma" }` (was
      `package.json:79-81`). The path is manifest-relative and both the manifest and `src/`
      landed in `frontend/`. **Verify by running `npx prisma generate` from `frontend/`**
      and confirming it succeeds - do not assume.
- [x] **C3 - `prettier.config.mjs` dropped from the frontend tsconfig `include`.**
      `frontend/tsconfig.json`'s `include` (was `tsconfig.json:25-36`) no longer lists
      `prettier.config.mjs`; the other three named entries (`next-env.d.ts`,
      `.eslintrc.cjs`, `tailwind.config.ts`) stay, since they moved into `frontend/`.
      Owner-signed-off: **drop it, do not re-point it at `../prettier.config.mjs`.**
      The pre-existing oddities in that block - `next-env.d.ts` listed twice (lines 26 and
      31) and the trailing comma on line 35 - are **not** fixed here.
- [x] **C4 - `frontend/Dockerfile` COPY paths.** The file has moved; **the build context
      stays the repo root** (`context: .` is already root today and does not change).
      Every source path in `Dockerfile:9-27` gains a `frontend/` prefix:
      `package.json` (9), `package-lock.json` (10), `src` (19), `public` (20),
      `next.config.js` (21), `tsconfig.json` (22), `next-env.d.ts` (23),
      `tailwind.config.ts` (24), `postcss.config.js` (25), `types.d.ts` (26), `types` (27).
      **Destination paths and `WORKDIR /app` do not change** - see the WORKDIR decision in
      Technical Notes. Base image stays `node:18-bullseye` and the install step stays
      `npm ci` (1.2a and 1.3 own those).
- [x] **C4a - `frontend/Dockerfile.dev` is left as-is.** Suspected-dead; do not maintain
      it, do not update its COPY paths, do not convert anything in it.
- [x] **C5 - `docker-compose.yml:46-49`.** `context: .` stays `.`;
      `dockerfile: Dockerfile` becomes `dockerfile: frontend/Dockerfile`;
      `target: ${TARGET:-dev}` unchanged.
- [x] **C6 - `docker-compose.yml:59-61` bind mounts** now read
      `./frontend/src:/app/src` and `./frontend/public:/app/public` (host side gains the
      prefix; container side is unchanged because WORKDIR stays `/app`).
      **The mounts stay narrow - do not collapse them to `./frontend:/app`.** Mounting
      anything containing a `node_modules` directory is fatal under pnpm's symlinked store
      from 1.3 onward, and it would shadow the image's build output today.
- [x] **C8 - `.prettierignore`** (stays at root): `.next` → `frontend/.next` and `public` →
      `frontend/public`, because Prettier is run from the workspace root and those two no
      longer match anything. `node_modules` is unanchored and still matches at any depth -
      leave it. **The `db_dumps` entry is a pre-existing typo for `db-dumps`; do not fix it
      here** - it is unrelated noise in an otherwise mechanical diff.
- [x] **C9 / C9a - `.gitignore` root-anchoring fixes.** These six entries are anchored to
      the repo root by their leading slash and would therefore miss the package-level
      equivalents after the move. Unanchor all six:
      `/node_modules` (line 4) → `node_modules/`,
      `/.pnp` (5),
      `/coverage` (10),
      `/.next/` (13) → `.next/`,
      `/out/` (14),
      `/build` (17).
      Unfixed, `frontend/.next/` becomes tracked (large) and the first `pnpm install` in
      1.3 stages several thousand files.
- [x] **C9b - the correctly-anchored entries are left alone.** Called out separately
      because the failure mode here is over-correcting in the same pass:
      `/nginx/letsencrypt/` (47), `/nginx/certs/` (48), `/nginx/dhparam.pem` (49),
      **`/override.env` (52)**, and `/docker-compose.override.yml` (55) all name genuinely
      root-only paths and are anchored *correctly*. **Do not touch them.** Verify by
      diffing `.gitignore` and confirming exactly the six lines above changed.
- [x] **C10 - `.dockerignore`** (stays at root, because Docker resolves it from the build
      context root and the context stays root). Apply the **minimum** patterns needed for
      the post-move build to be correct: `.next` and `Dockerfile` are context-root-anchored
      by shape and no longer match `frontend/.next` / `frontend/Dockerfile`, and
      `node_modules` must exclude every package's tree. The full re-examination is 1.3's,
      once the pnpm-era Dockerfile shape is settled. **Concretely: the build context must
      not include any `.next/` or `node_modules/` directory at any depth.** Verify this,
      do not just eyeball the patterns - see AC E.
- [x] **`tsconfig.base.json` created at root** (thin: `strict`, `esModuleInterop`,
      `skipLibCheck` only) and `frontend/tsconfig.json` gains
      `"extends": "../tsconfig.base.json"`. The three options stay written out in the
      frontend file too - they hold identical values, so this is a zero-behavior-change
      edit and keeps `frontend/tsconfig.json` readable on its own. See the note in
      Technical Notes on why this lands in 1.2.

### C. CI - `.github/workflows/deployment.yml` (C7)

This gets its own criterion rather than a checklist line because **it is the one item that
fails outside the local stack.** Every other consequential edit is caught by
`docker compose up`; this one is not exercised by any local verification and would surface
as a red CI run after merge.

- [x] **The `docker/build-push-action` step in `.github/workflows/deployment.yml` builds
      `frontend/Dockerfile` explicitly.** It currently passes `context: .` with **no
      `dockerfile`/`file` input**, so it defaults to the root `Dockerfile` - which no
      longer exists after this story. Add `file: frontend/Dockerfile`, **keep
      `context: .`**.
- [x] `.github/workflows/nginx_setup.yml` is **unchanged** - it copies `./nginx`, which
      stays at root.
- [x] The edit is verified by reading the workflow back and confirming the `file:` input
      points at a path that exists in the working tree. (This workflow deploys to EC2 with
      `docker run` directly and does not use `docker-compose.yml` at all, so no local run
      exercises it. Worth knowing: that divergence from the local stack is pre-existing and
      is not this story's to fix.)

### D. Nothing else moved or changed

- [x] `setup_local_https.sh` is **unedited**. Every path it touches - `./nginx/...` and
      `./com.tubesock.loopbackalias.plist` at line 101 - stays at root.
- [x] `nginx/Dockerfile` is **unedited**. `docker-compose.yml:154-155` builds
      `context: ./nginx`, so the move cannot affect it.
- [x] `next.config.js` moved **unchanged** - `typescript.ignoreBuildErrors` and
      `eslint.ignoreDuringBuilds` (`next.config.js:6-16`) both stay `true` per NFR-2.
      Story 1.6 records the real error counts; story 8.5 owns the fix.
- [x] `docker-compose.yml` changes are limited to C5 and C6. In particular every
      `./defaults.env` / `./override.env` reference (`:26,57,139`) and every
      `./monitoring/...` mount (`:100,115,132,180`) is unchanged.
- [x] `git status` shows renames into `frontend/` plus edits to only:
      `docker-compose.yml`, `.gitignore`, `.prettierignore`, `.dockerignore`,
      `.github/workflows/deployment.yml`, `frontend/Dockerfile`,
      `frontend/tsconfig.json`, and the new `tsconfig.base.json`. Anything else is
      scope creep and should be reverted or raised.
- [x] **Nothing is committed.** No commit exists that was not there before the story
      started; no branch was created.

### E. Verification - the app still builds and runs

A relocation this broad breaks *silently* through stale paths: a missing `COPY`, an
unmatched ignore pattern, or a mount pointing at nothing produces a container that starts
and then 404s or serves a stale build. So "it looks right" is not acceptance. All of the
following must be observed, in this order:

- [x] **`npm install` succeeds from `frontend/`** (still npm, still Node 18 - this story
      changes neither).
- [x] **`npx prisma generate` succeeds from `frontend/`** (this is C2's verification).
- [x] **`npm run build` succeeds from `frontend/`** - a real `next build`, completing
      without module-resolution errors. Note this proves less than usual because
      `ignoreBuildErrors` is on: it catches *resolution* failures (the `@/*` alias, missing
      files) but not type errors. That is expected and is why the runtime checks below are
      not optional.
- [x] **`docker compose up` builds and starts the stack**, with the `next-app` image
      building from `frontend/Dockerfile` at the root context.
- [x] **Pages are served over the local HTTPS dev flow** (per NFR-3, the stack must run at
      the end of every story in Epic 1). At minimum, confirm by loading them:
      - `/` renders,
      - `/login` renders,
      - a NextAuth login completes end to end,
      - `/stats` is reachable when authenticated and **redirects when not** - this is the
        `src/middleware.ts` path, and it is the check that proves middleware survived the
        move,
      - at least one `/product/...` page renders.
- [x] **At least one existing `/api/...` route still responds** with the same shape it did
      before the move (spot-check is sufficient here - full parity diffing is Epic 5's
      NFR-4 work, not this story's).
- [x] **The dev bind mounts still work**: with the stack up, an edit to a file under
      `frontend/src/` is picked up by the running `next-app` container. This is what proves
      C6 landed correctly rather than silently mounting an empty directory.
- [x] **The build context is clean**: confirm the Docker build does not send a
      `node_modules/` or `.next/` directory in its context (C10). The transferred context
      size reported at the start of the build is the quickest signal - if it is hundreds of
      MB, `.dockerignore` is wrong.

### F. Sign-off

- [x] The Dev Notes below record what was actually touched, anything that deviated from
      this story, and anything the inventory left ambiguous that had to be decided.
- [x] Owner has reviewed and signed off on the move. **1.2a does not start before that**
      (GR-4). *(Signed off - see Dev Notes / conversation. 1.2a is unblocked.)*

## Technical Notes

### Target shape after this story

```
/                          repo root
  docker-compose.yml       C5 + C6 edited
  defaults.env / override.env / .env / .secrets
  prettier.config.mjs      shared - the one config both sides agree on (D24)
  .prettierignore          C8 edited
  .gitignore               C9 / C9a edited (six lines, and only those six)
  .dockerignore            C10 - minimum viable edit
  tsconfig.base.json       NEW - thin: strict, esModuleInterop, skipLibCheck
  README.md  OBSERVABILITY.md  statsQuery.sql  com.tubesock.loopbackalias.plist
  setup_local_https.sh     unedited
  nginx/  monitoring/  docs/  .claude/  .github/
  db-dumps/  .private/  app/            untouched, gitignored or flagged-for-Epic-8

  frontend/                everything below moved here in this story
    src/  public/  types/
    types.d.ts  next-env.d.ts
    next.config.js  tailwind.config.ts  postcss.config.js
    .eslintrc.cjs  .eslintignore
    tsconfig.json          C3 edited; extends ../tsconfig.base.json
    package.json           keeps the "prisma": { "schema": ... } pointer (C2)
    package-lock.json      still here - 1.3 deletes it, not this story
    Dockerfile             C4 edited; still node:18-bullseye, still npm ci
    Dockerfile.dev         moved as-is, suspected dead, Epic 8
```

There is **no** `backend/`, **no** `packages/shared/`, **no** `pnpm-workspace.yaml`, **no**
`pnpm-lock.yaml`, **no** `.nvmrc`, and **no** root `package.json` after this story. Those
belong to 1.2a/1.3/1.4.

### The WORKDIR decision (affects C4 and C6)

The inventory's C6 row notes that the exact container-side mount paths "depend on the
WORKDIR 1.3 settles on". For 1.2 the answer is the minimal one: **keep `WORKDIR /app` and
keep every `COPY` destination unchanged.** Only the *source* side of each `COPY` gains a
`frontend/` prefix. The container's internal layout is therefore identical to today's,
which is what makes the "app still works" verification cheap and the diff small.

Consequence: bind mounts are `./frontend/src:/app/src`, not `./frontend/src:/app/frontend/src`.
Story 1.3 may restructure the image around the workspace root when it introduces pnpm; that
is 1.3's call to make with the workspace actually in front of it. Do not pre-empt it here.

### `tsconfig.base.json` - why it is created in this story

The inventory attributes it to "1.2 / 1.6". It lands here because the split described in
its section 3.2 has `frontend/tsconfig.json` extending `../tsconfig.base.json`, and a
dangling `extends` breaks the build immediately - so the two edits cannot be separated.
Per **D24** the base is deliberately thin: only `strict`, `esModuleInterop`,
`skipLibCheck`. It exists to stop `strict` drifting between the two packages, **not** to
unify them - the compilers genuinely differ (frontend: `noEmit`, `jsx: preserve`,
`moduleResolution: bundler`, `target: es5`; backend: `experimentalDecorators`,
`emitDecoratorMetadata`, `module: commonjs`, `target: ES2022`, real emit). Do not migrate
any other option into it.

### `src/middleware.ts` - architecture finding F1

It moves with `src/` and **nothing about it changes in Epic 1**. It is called out as its
own acceptance criterion for one reason: the brief and PRD FR-8 both state that
`src/app/page.tsx` and `src/app/login/page.tsx` are the only non-API server-side session
consumers, and **that is wrong**. `src/middleware.ts` wraps `withAuth` from
`next-auth/middleware` and gates `/stats`, `/stats/:path*`, and `/product/:path*`
(`src/middleware.ts:20`) on the NextAuth cookie. After the Epic 7.1 auth flip, a browser
holding only a Nest-issued session would be redirected away from `/stats` by middleware
that still only understands NextAuth - a cutover blocker, not a polish item. Epic 6.2's
seam work needs a written record that the file exists, and this story's job is simply not
to lose it in the move.

Context worth carrying so the wrong fix is not reached for later: this repo is on **Next
14.0.1**, where middleware runs *exclusively* on the Edge runtime. The `runtime: 'nodejs'`
opt-out did not arrive until Next 15.2 and is experimental there. "Edge" is a Next.js
*runtime*, not a hosting location - running on EC2 behind nginx does not make middleware
run in Node.

### Line-number anchors (verified against the working tree at drafting time)

- `Dockerfile:9-11` - `COPY package.json ./`, `COPY package-lock.json ./`, `RUN npm ci`.
- `Dockerfile:19-27` - `COPY src`, `public`, `next.config.js`, `tsconfig.json`,
  `next-env.d.ts`, `tailwind.config.ts`, `postcss.config.js`, `types.d.ts`, `types`.
- `Dockerfile:29` - `RUN npx prisma generate`, run from `WORKDIR /app`.
- `Dockerfile:31-35` - the `dev` stage, which is why `Dockerfile.dev` has no caller.
- `docker-compose.yml:46-49` - `next-app` build block (C5).
- `docker-compose.yml:59-61` - the two bind mounts (C6).
- `docker-compose.yml:154-155` - nginx builds `context: ./nginx` (so it is unaffected).
- `tsconfig.json:16-18` - `"@/*": ["./src/*"]` (C1, no edit).
- `tsconfig.json:25-36` - `include` (C3).
- `package.json:79-81` - `"prisma": { "schema": "src/server/db/schema.prisma" }` (C2).
- `next.config.js:6-16` - the two ignore flags that stay on.
- `.gitignore` lines 4, 5, 10, 13, 14, 17 (fix) and 47, 48, 49, 52, 55 (leave alone).

Re-verify these before editing; the tree may have moved on.

### Prisma

Prisma remains the **sole DDL owner** for the whole initiative and lives on in the frontend
package (D14). `frontend/package.json` keeps the schema pointer. Nothing under
`src/server/db/migrations/` is touched (FR-13). MikroORM never generates DDL and
`@mikro-orm/migrations` is never installed - not that any of that is this story's work; it
is here so nobody "tidies" the Prisma setup during the move.

## Out of Scope

- **Story 1.2a - the Node 24 bump.** `frontend/Dockerfile` stays on `node:18-bullseye`.
  No root `.nvmrc` is written. No `engines` field is added to any manifest. No clean
  reinstall for runtime reasons.
- **Story 1.3 - the npm → pnpm conversion.** No `pnpm-workspace.yaml`, no `pnpm-lock.yaml`,
  no root `package.json`, no `packageManager` field, no `.npmrc` (the inventory's decision
  rule is: write nothing up front, and only 1.3 may add the narrowest setting an *observed*
  resolution failure forces). `package-lock.json` is **not** deleted here. `node_modules/`
  is **not** removed and reinstalled here. The Dockerfile install step stays `npm ci`.
- **Story 1.4** - creating `backend/` or anything in it.
- **Story 1.5** - adding `nest-api` to `docker-compose.yml` or a `/backend/` location block
  to `nginx/nginx.conf`.
- **Story 1.6** - running the type-checker or linter, or recording error counts.
- **Creating `packages/shared`.** Owner-signed-off as deferred to Epic 4: git cannot track
  an empty directory, so creating it here would not be a repo change at all, and a
  `packages/*` glob matching zero packages is valid for pnpm.
- **Any deletion.** `Dockerfile.dev`, `src/app/api/_nextApiCompat.ts`, the stray `app/`
  directory, the `db_dumps` typo in `.prettierignore`, the duplicate `next-env.d.ts` and
  trailing comma in the tsconfig `include`. All flagged, none fixed. Epic 8 owns removal
  and requires separate approval (GR-1).
- **The full `.dockerignore` re-examination** (C10's larger half) - 1.3, once the pnpm-era
  Dockerfile shape is settled. This story does the minimum that keeps the build correct.
- **Re-deciding any inventory classification.** The inventory is signed off. If something
  in it looks wrong, raise it - do not silently deviate.
- **Any change to `src/app/api/`, `src/server/`, or `src/server/db/migrations/` contents.**

## Dev Notes

### Files touched

153 files `git mv`'d into `frontend/` (all recorded as R100 byte-identical renames).
Edits beyond the move, exactly matching AC D's expected set: `.dockerignore`,
`.gitignore`, `.prettierignore`, `docker-compose.yml`, `.github/workflows/deployment.yml`,
`frontend/Dockerfile`, `frontend/tsconfig.json`, plus new `tsconfig.base.json`. Nothing
committed; nothing staged beyond what `git mv` stages inherently as of this write-up -
staging the rest is left for after owner review, per the updated GR-3 (defined in
`prd.md`; the cadence it points at is in the BMAD plugin's `README.md`).

### C1 / C2 - no edit needed, as predicted

Neither the `@/*` alias nor the Prisma schema pointer needed touching. `npx prisma
generate` succeeded from `frontend/` with the pointer unchanged, confirming C2's "verified,
not assumed" instruction.

### Final `.dockerignore`

```
**/Dockerfile
db-dumps
.private
.dockerignore
**/node_modules
npm-debug.log
README.md
**/.next
.git
```

`Dockerfile` and `.next` were changed from root-anchored (`Dockerfile`, `.next`) to
`**/Dockerfile` / `**/.next` so they still match after moving under `frontend/`.
`node_modules` was already unanchored (`**/node_modules`) and needed no change. Verified
by inspecting the actual build context sent to the daemon: zero `node_modules`/`.next` at
any depth, against a working tree that has 1.2G and 278M respectively of those if leaked.

### One deviation from the story: C4 was incomplete

`frontend/tsconfig.json` extending `../tsconfig.base.json` crash-looped the container:
`FatalError: error TS5083: Cannot read file '/tsconfig.base.json'`. Cause: `WORKDIR /app`
means `../` resolves to `/` inside the image, and C4's COPY list (which predates the
`tsconfig.base.json` addition to the story) never copies it in. The host-side `npm run
build` didn't catch this - only the containerized build did. Fixed with one added line in
`frontend/Dockerfile`:

```
COPY tsconfig.base.json /tsconfig.base.json
```

### Two inventory-vs-story wording disagreements, flagged rather than silently resolved

- **C6 container-side paths.** The inventory's own C6 row literally says
  `./src:/app/src` → `./frontend/src:/app/frontend/src`, which contradicts C4 (only the
  *source* side of each COPY gets a `frontend/` prefix, so the app still lives at
  `/app/src` in the image) and would mount over nothing. The inventory hedges that the
  container-side path "depends on the WORKDIR 1.3 settles on"; this story resolves it to
  `/app/src`, which is the only version that actually works. Implemented as the story
  states, flagging the inventory text as stale.
- **C2 wording.** Inventory §3.1 says the pointer moves "with the path rewritten"; C2
  itself (and the actual result) says no edit is needed. C2 is correct.

### AC E - observed results (all commands run from `frontend/` unless noted)

- `npm install` - succeeded.
- `npx prisma generate` - succeeded, no edit to the schema pointer.
- `npm run build` - succeeded, `next build` completed without module-resolution errors
  (middleware compiled at 61 kB). Per the story's own caveat this only proves resolution,
  not type-correctness, since `ignoreBuildErrors` is on.
- `docker compose up` - full stack built and started; `next-app` built from
  `frontend/Dockerfile` at root context, `Ready in 715ms` after the C4/Dockerfile fix
  above.
- Local HTTPS dev flow at `https://www.tubesock.xyz`:
  - `/` → 307 to `/login` (unauthenticated) - confirmed.
  - `/login` → 200 - confirmed.
  - `/stats`, `/product` → 307 to signin when unauthenticated - confirmed, proves
    `src/middleware.ts` (F1) survived the move.
  - NextAuth login end-to-end, `/stats` with data, `/product` rendering while
    authenticated - the dev agent had no DB access or credentials and correctly declined
    to forge a session to route around that; **the owner tested these directly and
    confirmed all three work.**
- API spot-check: `/api/metrics` → 200 Prometheus text; `/api/summary/coins` → 401
  unauthenticated; `/api/auth/session`, `/api/auth/csrf` → 200.
- Dev bind mount (C6): appended a line to `frontend/src/middleware.ts`, confirmed the
  running container saw it immediately at `/app/src/middleware.ts`, then reverted (file
  hash back to its pre-edit value).
- Build context cleanliness (C10): confirmed via a throwaway `find` inside the actual
  build context - zero `node_modules`/`.next` at any depth.

### Still open

Nothing outstanding from an implementation standpoint. `frontend/Dockerfile` and
`tsconfig.base.json` remain unstaged pending owner review before the commit step (updated
GR-3).
