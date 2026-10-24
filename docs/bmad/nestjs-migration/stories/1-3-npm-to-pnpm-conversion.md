# Story 1.3: Convert the workspace from npm to pnpm

Status: Done

## Context

Epic 1 turns this repo into a pnpm workspace shaped `frontend/` + `backend/`
(+ `packages/shared`). Story 1.2 moved the app into `frontend/` (path-only, still npm).
Story 1.2a (done) bumped the frontend runtime to Node 24 - a hard prerequisite for this
story, since **pnpm 11.22.0** (the version architecture pins) declares
`engines.node >= 22.13`, which Node 18 could not satisfy.

**This story does the actual package-manager conversion, and nothing else.** At the end
of it: `pnpm-workspace.yaml` and `pnpm-lock.yaml` exist at the repo root, a new private
root `package.json` exists, `frontend/package-lock.json` is gone, `frontend/node_modules`
is reinstalled by pnpm, and `frontend/Dockerfile` installs and builds via pnpm instead of
npm. `backend/` and `packages/shared/` do **not** exist yet - story 1.4 creates the
backend, and `packages/shared` is deferred to Epic 4 (per story 1.1's owner-signed-off
inventory, section 10). This story's `pnpm-workspace.yaml` therefore has only one real
member today: `frontend`.

The rest of Epic 1 runs 1.2 → 1.2a → **1.3 (this story)** → 1.4 (backend scaffold) → 1.5
(compose/nginx wiring) → 1.6 (type/lint baseline).

### Ground rules that bind this story

- **GR-1 - Additive only.** Nothing under `frontend/src/app/api/` or `frontend/src/server/`
  is touched. This story is build-tooling only. Story 1.1's inventory already ruled that
  deleting `frontend/package-lock.json` does **not** violate GR-1 - GR-1 governs the
  application code whose behavior is being preserved, not the build tooling this story is
  explicitly chartered to replace. That deletion is the one other sanctioned deletion in
  the initiative besides the inventory's own scope (story 1.1 named it as belonging to
  this story).
- **GR-3 - Nothing is committed.** All changes stay in the working tree. No `git add`, no
  commit, no new branch.
- **GR-4 - Human sign-off between chunks.** This story is drafted as `Status: Draft` and
  does not move to `Ready` until the owner has reviewed it. Story 1.4 does not start
  before this story's own sign-off gate (Acceptance Criteria, section G) is closed.

## Acceptance Criteria

### A. New root-level workspace files

- [x] **`pnpm-workspace.yaml` created at the repo root**, containing:
      ```yaml
      packages:
        - frontend
        - packages/*
      injectWorkspacePackages: true
      ```
      `injectWorkspacePackages: true` **must be present before the very first
      `pnpm install`** (architecture D26c). Adding it after the fact to a lockfile that
      predates it fails every subsequent `--frozen-lockfile` install with
      `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` - this workspace is created from scratch, so
      writing the line first avoids that failure mode entirely rather than working around
      it.
      **`backend` is deliberately not listed yet** - the directory does not exist until
      story 1.4. Verify empirically (a `pnpm install` against this file, with `backend/`
      absent) that a non-existent literal workspace member does not error before assuming
      either way; if it does error, list only `frontend` and `packages/*` as written above
      and record that finding in Dev Notes for story 1.4 to pick up (add `backend` when it
      creates the directory). `packages/*` matching zero directories (since
      `packages/shared` does not exist yet either) is valid for pnpm and requires no
      placeholder.
- [x] **`pnpm-lock.yaml` created at the repo root** via a real `pnpm install` (not
      `pnpm import` from the old `package-lock.json` - a fresh resolution, since the
      package manager itself is changing). Confirm `lockfileVersion: '9.0'` appears in the
      generated file (architecture D26a: pnpm 10 and 11 share this lockfile format, so this
      is a sanity check, not evidence of anything migration-hazardous).
- [x] **A new, private root `package.json` is created** (this is a genuinely new file, not
      the old root `package.json` edited down - that file no longer exists at root; it
      became `frontend/package.json` in story 1.2). Minimum required contents:
      - `"private": true`
      - `"packageManager": "pnpm@11.22.0"` - pins the pnpm version for corepack, matching
        architecture D26a. This is what makes the version reproducible regardless of what
        happens to be installed on the host or CI runner.
      - A reference to `prettier.config.mjs` if any root-level script needs one; at
        minimum a `"scripts"` object is not required to be non-empty for this story - keep
        it small. Do not invent workspace-wide `build`/`test`/`lint` scripts that aggregate
        across packages; there is only one real package (`frontend`) today, and 1.4/1.6 are
        better placed to add scripts once `backend/` exists.
      - No `"dependencies"` - nothing runs from the workspace root itself.
- [x] **`frontend/package.json`'s `"name"` field is changed from `"portfolio"` to
      `"@portfolio/frontend"`.** This is required, not cosmetic: architecture's own
      Dockerfile pattern (see Technical Notes) filters installs and builds with
      `pnpm --filter @portfolio/frontend...`, and that filter only resolves if the package
      declares that name. Confirm `pnpm --filter @portfolio/frontend... list --depth -1`
      (or equivalent) resolves the frontend package after the rename.
- [x] **`.npmrc` is not created**, per story 1.1's inventory decision rule: add nothing up
      front; add the narrowest possible setting only if an actual `pnpm install` failure
      is observed against this repo's real dependency set, and record which package forced
      it if that happens. Architecture D26c's own spike against a workspace of this shape
      needed no `.npmrc`, so the default expectation is that none is required here either -
      confirm that expectation holds (or note the specific failure and setting if it
      doesn't) in Dev Notes.

### B. `frontend/package-lock.json` deleted, `node_modules` reinstalled with pnpm

- [x] **`frontend/package-lock.json` is deleted.** npm and pnpm cannot coexist on one
      package; a stale `package-lock.json` beside the new `pnpm-lock.yaml` is a second,
      contradictory source of truth. Per story 1.1's inventory this is the sanctioned
      deletion this story owns.
- [x] **`frontend/node_modules` (and any root `node_modules` npm may have left behind) is
      removed and reinstalled with pnpm**, not npm. npm's flat hoisted layout and pnpm's
      symlinked content-addressed store (`node_modules/.pnpm` at the workspace root, with
      per-package `node_modules` holding only symlinks into it) are structurally
      incompatible; a stale npm-era tree left in place produces half-broken resolution that
      looks like a code bug. This is a **different reinstall for a different reason** than
      story 1.2a's clean reinstall (which stayed on npm and existed to rebuild native
      modules against Node 24) - do not treat 1.2a's reinstall as having already covered
      this.
- [x] `pnpm install` (from the repo root, against the newly-written
      `pnpm-workspace.yaml`) completes cleanly and produces the root `pnpm-lock.yaml` with
      `injectWorkspacePackages: true` present in its `settings:` block (confirm by
      inspecting the generated lockfile directly, not just assuming the workspace file's
      setting propagated).
- [x] A subsequent `pnpm install --frozen-lockfile` (simulating what CI/Docker will run)
      succeeds against the freshly-generated lockfile with no `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`
      or other error.
- [x] `require('bcrypt')` still succeeds from `frontend/` after the pnpm reinstall (same
      native-module spot-check as 1.2a, now on pnpm's store layout instead of npm's).

### C. `frontend/Dockerfile` converted to pnpm, and restructured around the workspace root

This is the substantial part of this story. The Dockerfile today (base image already
`node:24-bookworm` per 1.2a) is single-package-shaped: `WORKDIR /app` **is** the frontend
package, and every `COPY` destination lands directly under it. A pnpm workspace needs the
opposite shape - `WORKDIR /app` must represent the **workspace root**, with `frontend/`
living at `/app/frontend/` inside the image, because pnpm's virtual store
(`node_modules/.pnpm`) lives at the workspace root and every package's own `node_modules`
is just symlinks into it. This is architecture's own stated pattern (Deployment section,
"Every workspace manifest goes into every image", and the frontend-specific note that the
image needs "no structural difference from the backend's - same root build context, same
manifest-copy set, same filtered install, same narrow mount").

- [x] **Manifest layer (copied first, before any source, for cache efficiency):**
      ```dockerfile
      COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
      COPY frontend/package.json ./frontend/
      ```
      (No `backend/package.json` or `packages/shared/package.json` lines yet - neither
      exists. Architecture's own warning applies in reverse here: the failure mode of
      **omitting** a manifest that *does* exist is silent - a dangling symlink that only
      breaks at container start with `MODULE_NOT_FOUND`. There is nothing to omit yet, but
      when story 1.4 adds `backend/` and/or Epic 4 populates `packages/shared`, their
      manifests must be added to *both* Dockerfiles' copy-all-manifests layer, not just
      their own image's.)
- [x] **Install layer, filtered to the frontend package and its workspace dependencies:**
      ```dockerfile
      RUN pnpm install --frozen-lockfile --filter @portfolio/frontend...
      ```
      The `...` suffix is load-bearing (pulls in workspace dependencies of
      `@portfolio/frontend` - none exist yet, but the filter should be written this way now
      so it does not need revisiting when `packages/shared` becomes a real dependency).
      A `--mount=type=cache,id=pnpm,target=/pnpm/store` BuildKit cache mount on this layer
      is recommended (architecture's own pattern) but not mandatory for this story's
      acceptance - note in Dev Notes if omitted and why.
- [x] **Source layer, copied after install:**
      ```dockerfile
      COPY frontend/src ./frontend/src
      COPY frontend/public ./frontend/public
      COPY frontend/next.config.js ./frontend/
      COPY frontend/tsconfig.json ./frontend/
      COPY frontend/next-env.d.ts ./frontend/
      COPY frontend/tailwind.config.ts ./frontend/
      COPY frontend/postcss.config.js ./frontend/
      COPY frontend/types.d.ts ./frontend/
      COPY frontend/types ./frontend/types
      COPY tsconfig.base.json ./tsconfig.base.json
      ```
      `tsconfig.base.json` now lands at `/app/tsconfig.base.json`, which is exactly
      `../tsconfig.base.json` relative to `/app/frontend/tsconfig.json` - i.e. the
      `extends` path already declared in `frontend/tsconfig.json` (added in story 1.2)
      resolves correctly **without** the `/tsconfig.base.json`-at-image-root workaround
      1.2's Dev Notes had to add for the old flat `WORKDIR /app` shape. Confirm this
      works and remove the old workaround copy if it's still present from 1.2's edit
      (`COPY tsconfig.base.json /tsconfig.base.json`) - it should no longer be needed with
      the new layout, but verify by building rather than assuming.
- [x] **Prisma generation** becomes:
      ```dockerfile
      RUN pnpm --filter @portfolio/frontend exec prisma generate
      ```
      run after the install and source-copy layers, before any build step (architecture:
      "must survive the pnpm conversion... run after the install and before `next build`,
      since the Prisma client is generated into `node_modules` and the Next build imports
      it").
- [x] **`dev` stage** (built by `docker compose up` via `target: ${TARGET:-dev}`) runs the
      frontend's dev script filtered through pnpm, e.g.
      `CMD ["pnpm", "--filter", "@portfolio/frontend", "dev"]` (or an equivalent that
      resolves to `next dev` running with `frontend/` as its effective working directory -
      confirm hot reload and the dev server both work end to end in verification section
      F, not just that the container starts).
- [x] **`builder` stage** runs `RUN pnpm --filter @portfolio/frontend build` in place of
      `RUN npm run build`.
- [x] **`prod` stage** - the standalone-output production image. Next's
      `output: 'standalone'` build now produces its output under
      `/app/frontend/.next/standalone` and `/app/frontend/.next/static` instead of
      `/app/.next/...`; update the `COPY --from=builder` source paths in the `prod` stage
      accordingly. Verify the resulting image actually starts and serves - Next's
      standalone tracer output layout under a workspace root vs. a flat package root is
      exactly the kind of thing that looks right in the Dockerfile text and fails at
      runtime with a missing `server.js` or missing traced dependency if a path is off by
      one directory level.
- [x] **All references to `npm ci` / `npm install` / `npm run` are gone from
      `frontend/Dockerfile`.** Confirm with a `grep -n npm frontend/Dockerfile` showing no
      matches (aside from anything in a comment predating this story that isn't this
      story's job to clean up - if any such comment exists, leave it, don't scope-creep).
- [x] **`frontend/Dockerfile.dev` is not touched** - same suspected-dead status carried
      forward from 1.2/1.2a; it is not this story's job to convert or remove it (Epic 8).

### D. `docker-compose.yml` - bind mounts follow the new `WORKDIR`

- [x] **The two `next-app` bind mounts change container-side paths** to match the new
      `WORKDIR /app` = workspace root:
      `./frontend/src:/app/src` → `./frontend/src:/app/frontend/src`,
      `./frontend/public:/app/public` → `./frontend/public:/app/frontend/public`
      (currently `docker-compose.yml:59-61`; re-verify the line numbers before editing,
      the file may have moved on since drafting).
      **The mounts stay narrow** - do not mount `./frontend:/app/frontend` wholesale.
      Architecture is explicit and this is a hard constraint, not a style preference:
      mounting anything containing a `node_modules` directory is fatal under pnpm's
      symlinked store, because it would shadow the image's real `node_modules` (whose
      packages resolve as symlinks into the workspace-root virtual store) with whatever the
      host has, or with nothing.
      `build.context` and `build.dockerfile` for `next-app` do not change (still `context:
      .`, `dockerfile: frontend/Dockerfile`).
- [x] No other part of `docker-compose.yml` changes in this story (no `nest-api` service -
      that is 1.5; the frontend's own service block otherwise stays as story 1.2 left it).

### E. CI - check for anything that assumes npm or a specific lockfile path, and fix if found

- [x] **Confirm whether `.github/workflows/deployment.yml` or
      `.github/workflows/nginx_setup.yml` reference `package-lock.json`, `npm`, or any
      install step directly.** As of story 1.2a's own check (still true as of this
      story's drafting): `deployment.yml` builds and pushes the frontend image entirely via
      `docker/build-push-action@v5` with `context: .`, `file: frontend/Dockerfile` - it
      never runs `actions/setup-node`, `npm ci`, or any bare package-manager command on the
      runner itself. All install/build work happens *inside* the Docker build, which this
      story already converts to pnpm. `nginx_setup.yml` has no package-manager involvement
      at all. **Re-verify this directly** (`grep -n -i "npm\|pnpm\|package-lock\|setup-node"`
      against both files) rather than trusting this restated finding - if either workflow
      does reference the old lockfile path or `npm` directly, that is a required edit for
      this story, not a deferred item.
- [x] If no such reference is found (the expected outcome, consistent with 1.2a's finding),
      record that explicitly in Dev Notes rather than silently skipping the check.

### F. Verification - the app still builds and runs, now on pnpm

Same standard as every prior Epic 1 story: a package-manager conversion fails at points a
diff review cannot see (a missed manifest copy producing a dangling symlink that only
surfaces at container start, a `WORKDIR` change that breaks Next's standalone trace
output, a bind mount that shadows the image's `node_modules`). All of the following must
be observed, in this order:

- [x] **`pnpm install` succeeds from the repo root** (already covered by section B, but
      restated here as the entry point to this verification sequence).
- [x] **`pnpm --filter @portfolio/frontend build` succeeds from the repo root** (host-side,
      outside Docker) - a real `next build`, same `ignoreBuildErrors` caveat as every prior
      story (NFR-2 - it proves resolution, not type-correctness).
- [x] **`docker build` succeeds** against `frontend/Dockerfile` with the new pnpm-based
      install and the restructured `WORKDIR`/`COPY` layout - confirm at minimum the layer
      running `pnpm install --frozen-lockfile --filter @portfolio/frontend...`, the Prisma
      generation layer, and the `builder` stage's `pnpm --filter @portfolio/frontend build`
      all complete. Use `docker compose build next-app` or an equivalent direct `docker
      build -f frontend/Dockerfile` with the repo root as context (unchanged from prior
      stories).
- [x] **`docker compose up` builds and starts the stack** with `next-app` now built via
      pnpm end to end.
- [x] **The dev bind mounts still work** with their new container-side paths: with the
      stack up (`dev` target), an edit to a file under `frontend/src/` is picked up by the
      running `next-app` container. This is what proves section D's mount-path change
      landed correctly rather than silently mounting an empty directory or shadowing
      `node_modules`.
- [x] **Pages are served over the local HTTPS dev flow** (NFR-3), same spot-checks as every
      prior Epic 1 story:
      - `/` renders,
      - `/login` renders,
      - a NextAuth login completes end to end - **owner manual verification required**,
        same as 1.2a: a Dev agent has no real application credentials to exercise this
        with. Record in Dev Notes that this specific check is deferred to the owner, do not
        attempt to forge or bypass it.
      - `/stats` is reachable when authenticated and **redirects when not** - exercises
        `frontend/src/middleware.ts`'s Edge path, confirming it still resolves and runs
        correctly after the workspace restructure (nothing about middleware's own logic
        changes in this story, but its build inputs and module resolution do).
      - at least one `/product/...` page renders.
- [x] **At least one existing `/api/...` route still responds** with the same shape it did
      before the conversion (spot-check, same standard as prior stories).
- [x] **Also verify the `prod` target builds and starts**, not just `dev` - this story
      changes `output: 'standalone'`'s copy paths in the `prod` stage (section C), which
      `dev`-target verification alone would not catch. `docker build --target prod -f
      frontend/Dockerfile .` followed by running the resulting image and confirming it
      serves at least `/` is sufficient; it does not need the full HTTPS spot-check list
      that the `dev`-target stack gets above.

### G. Nothing else changed, and sign-off

- [x] `git status` shows changes limited to: new `pnpm-workspace.yaml`, new
      `pnpm-lock.yaml`, new root `package.json`, deleted `frontend/package-lock.json`,
      edited `frontend/package.json` (the `name` rename), edited `frontend/Dockerfile`,
      edited `docker-compose.yml` (the two mount lines), and - only if section E's
      re-verification finds a real reference to fix - edits to one or both GitHub Actions
      workflow files. `frontend/node_modules` changes are not visible in `git status`
      (gitignored). Anything else is scope creep.
- [x] `frontend/src/`, `frontend/src/app/api/`, `frontend/src/server/` - unedited (GR-1).
- [x] `backend/` and `packages/shared/` are **not** created in this story.
- [x] Nothing is committed. No commit exists that was not there before the story started;
      no branch was created (GR-3).
- [x] The Dev Notes below record what was actually touched, the observed `pnpm install` /
      `docker build` / `docker compose up` output, the `pnpm-workspace.yaml` `backend`-entry
      finding from section A, the `.npmrc` finding from section A, and the CI re-verification
      finding from section E.
- [x] Owner has reviewed and signed off. **Story 1.4 does not start before that** (GR-4).
      Owner additionally verified the NextAuth login manually, same as every prior story
      that touches the build/runtime layer.

## Technical Notes

### Why this story restructures `WORKDIR`, not just the install command

A tempting shortcut is "swap `npm ci` for `pnpm install` and leave everything else alone."
That does not work for a workspace. pnpm's isolated node-linker puts real packages in a
**content-addressed virtual store at the workspace root**
(`node_modules/.pnpm`) and leaves only symlinks in each package's own `node_modules`. If
`WORKDIR /app` stays pinned to the frontend package itself (as it is today, a leftover of
the pre-workspace single-package Dockerfile), there is no workspace root inside the image
for that store to live at, and `pnpm install --filter` has nothing coherent to resolve
against. The fix - confirmed by architecture's own verified miniature-workspace build - is
`WORKDIR /app` becomes the **workspace root**, with `frontend/` (and, from story 1.4
onward, `backend/`) living under it as subdirectories. This is exactly what forces the bind
mount path change in section D and the `prod`-stage output path change in section C.

### The manifest-completeness trap (architecture, Deployment section)

Documented here because it is the single nastiest failure mode in this conversion and it
fails **silently**: if a Dockerfile's manifest-copy layer omits a workspace member's
`package.json` that actually exists, `pnpm install --frozen-lockfile --filter <pkg>...`
still **exits 0**, having created a dangling symlink for the missing dependency. The build
passes, the image is published, and the failure only surfaces at container start as
`MODULE_NOT_FOUND`. This story has no such trap yet (there is exactly one real workspace
member, `frontend`, and it is not skipped), but the pattern **must** be followed correctly
here so that story 1.4 (which adds `backend/package.json` to the copy set) and Epic 4
(which adds `packages/shared/package.json`) inherit a Dockerfile shape that already does
this right, rather than a shortcut that happens to work with one package and breaks
silently with two.

### `injectWorkspacePackages: true` - why it must be in the workspace file before the first install

Recorded in architecture as D26c, restated here because getting the ordering wrong costs a
full lockfile regeneration, not just a warning: the production stage's `pnpm deploy`
(not used by this story - `packages/shared` doesn't exist yet to need it, and `backend/`
doesn't either - but this workspace file is the one both later stories will inherit)
requires this setting to deploy a package that depends on another workspace package. The
setting is recorded inside the lockfile itself, under `settings:`. Adding it to a workspace
whose lockfile predates it fails every subsequent `--frozen-lockfile` install with
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Since this story generates the lockfile from scratch,
writing the setting into `pnpm-workspace.yaml` **before** running `pnpm install` for the
first time means it is simply never a problem - confirmed by architecture's own verified
spike.

Locally, injection changes nothing about the day-to-day dev loop: pnpm 11.22.0 still
records `link:../packages/shared`-style symlinks for workspace dependencies and only
materializes hard copies inside `pnpm deploy` output, which this story does not invoke.

### `packageManager` and pnpm version

**`pnpm@11.22.0`**, pinned via the `packageManager` field in the new root `package.json`
(architecture D26a). This is what lets corepack reproduce the exact version regardless of
what's on the host or CI runner's PATH. Do not pin it anywhere else (no
`frontend/package.json` `packageManager` field - one workspace, one pin, at the root).

### Files this story touches (and only these)

```
pnpm-workspace.yaml         NEW, root-level
pnpm-lock.yaml               NEW, root-level, generated by `pnpm install`
package.json                 NEW, root-level, private, packageManager pin only
frontend/package.json        EDITED: "name" -> "@portfolio/frontend"
frontend/package-lock.json   DELETED
frontend/node_modules/       reinstalled clean via pnpm (gitignored, not a repo change)
frontend/Dockerfile          EDITED: WORKDIR/COPY restructure, npm -> pnpm throughout
docker-compose.yml           EDITED: next-app's two bind mount container-side paths
.github/workflows/*.yml      EDITED only if section E's re-verification finds a real
                              npm/lockfile-path reference (expected: no edit needed)
```

### What this story explicitly does not create

No `backend/` directory, no `backend/package.json`, no `packages/shared/` directory. The
`pnpm-workspace.yaml` packages list and the Dockerfile's manifest-copy layer both reflect
that - they are not pre-populated with entries for directories that don't exist yet, per
the same reasoning story 1.1's inventory applied to deferring `packages/shared` (git
cannot track an empty directory, so "creating" either now would not be a real repo change,
and a `packages/*` glob matching zero packages is valid pnpm).

## Out of Scope

- **Story 1.4** - creating `backend/`, its `package.json`, its own Dockerfile, or adding
  `backend` to `pnpm-workspace.yaml`'s `packages` list (unless section A's empirical check
  finds that a literal non-existent `backend` entry actually errors, in which case this
  story records that finding for 1.4 to act on - it does not itself add `backend/`).
- **Story 1.5** - compose/nginx wiring for `nest-api`.
- **Story 1.6** - running the type-checker or linter, or recording error counts.
- **Epic 4** - creating `packages/shared/`, its build step, or adding it to any
  `pnpm-workspace.yaml`/Dockerfile manifest-copy set.
- **Any `.npmrc` content.** Story 1.1's inventory rule stands: add nothing preemptively;
  only add the narrowest setting an actually-observed `pnpm install` failure forces, and
  record which dependency forced it if that happens.
- **BuildKit cache mounts on the pnpm store** are recommended by architecture but not a
  hard acceptance requirement of this story - note in Dev Notes whether one was added.
- **Renaming anything under `frontend/src/`, `frontend/src/app/api/`, or
  `frontend/src/server/`, or changing their contents.** GR-1.
- **`frontend/Dockerfile.dev`.** Suspected-dead per stories 1.1/1.2's findings; not
  touched, removal is Epic 8's.
- **Root-level `tsconfig.base.json` content changes.** It already exists (story 1.2) and
  is unedited by this story - only its Dockerfile `COPY` destination path changes, per
  section C.
- **Adding workspace-wide `lint`/`test`/`build` aggregation scripts to the new root
  `package.json`.** Premature with one real package; deferred to whichever later story
  first needs to run something across both packages at once.

## Dev Notes

**Environment used**: pnpm 11.22.0 via corepack (`corepack enable`; `corepack pnpm ...`),
Node 24.13.0 host / `node:24-bookworm` in Docker, Docker 29.0.1 / Compose v2.40.3.

**Files touched** (matches the story's "Files this story touches" list exactly, confirmed
by `git status --short` at the end):
- `pnpm-workspace.yaml` - new, root-level. Contents match the AC exactly, plus one field
  pnpm itself required (see `.npmrc`/allowBuilds finding below).
- `pnpm-lock.yaml` - new, root-level, generated by `pnpm install`.
- `package.json` - new, root-level: `{"private": true, "packageManager": "pnpm@11.22.0"}`.
  No scripts, no dependencies, per the AC's "keep it small" instruction.
- `frontend/package.json` - `"name"` changed `"portfolio"` -> `"@portfolio/frontend"`.
- `frontend/package-lock.json` - deleted.
- `frontend/node_modules/` and root `node_modules/` - both deleted and reinstalled clean
  via `pnpm install` (gitignored, not a repo diff).
- `frontend/Dockerfile` - restructured per section C (see below).
- `docker-compose.yml` - `next-app`'s two bind mounts: `./frontend/src:/app/src` ->
  `./frontend/src:/app/frontend/src`, `./frontend/public:/app/public` ->
  `./frontend/public:/app/frontend/public`. Nothing else in the file changed.
- `.github/workflows/*.yml` - **not edited** (see section E finding below).
- Incidental: `frontend/next-env.d.ts` was auto-rewritten by Next during the host-side
  `pnpm build` / `docker build` verification runs (same known Next codegen quirk noted in
  1.2a's Dev Notes - it drops the
  `/// <reference types="next/navigation-types/compat/navigation" />` line). Reverted with
  `git checkout -- frontend/next-env.d.ts` to keep the diff scoped to this story.

### Section A finding: `backend`-entry empirical check

Tested directly (not assumed): copied the real `pnpm-workspace.yaml`/`package.json`/
`frontend/` into a scratch directory (outside the repo), added a `backend` entry to
`packages:` with no `backend/` directory present, and ran a real `pnpm install` against it.
**Result: it did not error.** pnpm silently treats the non-existent literal member as
contributing zero packages (identical to how `packages/*` matching zero directories
behaves) - `Done in 10.1s using pnpm v11.22.0`, no warning, no non-zero exit. Per the AC's
own fallback instruction, since it does not error, the real `pnpm-workspace.yaml` stays as
written in the AC (only `frontend` and `packages/*`, no `backend` entry) - no change needed.
This finding is recorded here for story 1.4 to note when it adds `backend/`: no special
handling is required either way, but 1.4 will still need to add the `backend` entry itself
once the directory exists (pnpm won't discover it automatically without a listing).

### Section A finding: `.npmrc`

**No `.npmrc` was created or needed** - confirms the AC's default expectation. However, the
very first `pnpm install` against this repo's real dependency set (not a spike/toy
workspace) surfaced one real, unavoidable finding that isn't `.npmrc`-shaped but is the
`pnpm-workspace.yaml`-equivalent of the same "narrowest setting an actual failure forces"
rule: pnpm 10+/11 ignores lifecycle/build scripts for dependencies by default
(supply-chain-attack mitigation) and printed `[ERR_PNPM_IGNORED_BUILDS]` naming
`@prisma/client`, `@prisma/engines`, `bcrypt`, `prisma`, and `unrs-resolver`, auto-appending
an `allowBuilds:` block to `pnpm-workspace.yaml` with each set to
`set this to true or false`. This is load-bearing, not cosmetic: `bcrypt` needs its
native-module `node-pre-gyp install` step to run (npm always ran this; pnpm does not by
default), and without approving it `require('bcrypt')` would fail exactly as this story's
own AC B spot-check is designed to catch. Set all five to `true` (matching npm's historical
default of running every lifecycle script) and confirmed: `pnpm install` completes cleanly,
`bcrypt`'s native binary builds successfully (`node-pre-gyp info ok`), and
`require('bcrypt')` succeeds afterward both on the host and inside the Docker image (arm64
host, linux/arm64 in Docker - both build from source via node-pre-gyp's release download,
no compiler needed in either case). This is recorded in `pnpm-workspace.yaml` itself
(pnpm's own mechanism for this), not `.npmrc` - the AC's `.npmrc` decision rule is honored
in spirit (nothing added preemptively; only the narrowest thing an observed failure forced),
just via the file pnpm itself chose to write to.

### Section B verification output

- `pnpm install` (fresh, from repo root): resolved 648 packages, `Packages: +614`, completed
  with the build-approval step above; re-run afterward is `Already up to date` in ~150ms.
- `pnpm-lock.yaml` confirmed: `lockfileVersion: '9.0'` on line 1; `settings:` block contains
  `injectWorkspacePackages: true` (plus pnpm's own defaults `autoInstallPeers: true`,
  `excludeLinksFromLockfile: false`).
- `pnpm install --frozen-lockfile`: `Already up to date`, `Done in 155ms` - no
  `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, no other error.
- `pnpm --filter @portfolio/frontend... list --depth -1`: resolves
  `@portfolio/frontend@0.1.0 /Users/taylor/projects/portfolio/frontend (PRIVATE)`.
- `node -e "require('bcrypt')"` from `frontend/`: prints `bcrypt OK`.

### Section C: Dockerfile restructure

Rewrote `frontend/Dockerfile` per the AC's exact shape: `WORKDIR /app` is now the workspace
root in every stage. Manifest layer copies `pnpm-lock.yaml pnpm-workspace.yaml package.json`
to `/app/` and `frontend/package.json` to `/app/frontend/`, install layer runs
`pnpm install --frozen-lockfile --filter @portfolio/frontend...` under a
`--mount=type=cache,id=pnpm,target=/pnpm/store` BuildKit cache mount (added, not omitted -
architecture's recommended pattern, straightforward to include). Source layer copies land
under `frontend/` as listed in the AC, plus `tsconfig.base.json` at `/app/tsconfig.base.json`
(one level up from `frontend/tsconfig.json`'s `extends`) - confirmed by building that this
resolves correctly and removed the old `COPY tsconfig.base.json /tsconfig.base.json`
workaround from story 1.2 (no longer present in any stage). Prisma generation is
`pnpm --filter @portfolio/frontend exec prisma generate`, run after the source copy and
before any build step, in both the `dev` and `builder` lineage (they share `common-build`).
`dev` stage CMD is `["pnpm", "--filter", "@portfolio/frontend", "dev"]`. `builder` stage runs
`pnpm --filter @portfolio/frontend build`. `prod` stage's `COPY --from=builder` source paths
updated to `/app/frontend/.next/standalone` and `/app/frontend/.next/static` (confirmed by
inspecting the actual builder output: `next build`'s standalone tracer auto-detects the
pnpm-workspace monorepo root and nests `server.js` at
`.next/standalone/frontend/server.js`, with root-level `node_modules/.pnpm` alongside it -
not a flat `.next/standalone/server.js` - exactly the "off by one directory level" trap the
AC warns about, and it was verified by inspecting the built output directly rather than
assumed). `prod` stage's `CMD` updated to `node frontend/server.js`.
`grep -n npm frontend/Dockerfile` shows only substring matches inside the string `pnpm`
itself (lines calling `pnpm install`/`pnpm --filter ...`/etc.) - no bare `npm ci`,
`npm install`, or `npm run` remain. `frontend/Dockerfile.dev` was not touched (confirmed via
`git status`/`git diff` showing no changes to that file).

### Section D: docker-compose.yml

Only the two `next-app` bind-mount container-side paths changed, as described above. Mounts
stay narrow (`frontend/src`, `frontend/public` only) - `./frontend:/app/frontend` wholesale
was **not** used, avoiding shadowing the image's pnpm-symlinked `node_modules`.
`build.context`/`build.dockerfile` unchanged. No other part of the file touched (confirmed
via `git diff --stat docker-compose.yml`: 2 lines changed, nothing else).

### Section E: CI re-verification

Re-ran the grep directly (not trusted from the restated finding):
`grep -n -i "npm\|pnpm\|package-lock\|setup-node" .github/workflows/deployment.yml
.github/workflows/nginx_setup.yml` returned **no matches in either file**. Confirms 1.2a's
finding still holds: `deployment.yml` builds/pushes the frontend image entirely via
`docker/build-push-action@v5` with `context: .`, `file: frontend/Dockerfile` - no
`setup-node`, no bare `npm`/`pnpm` command on the runner itself; `nginx_setup.yml` has no
package-manager involvement at all. **No CI workflow edits were made** - none were needed.

### Section F: full verification, in order

1. `pnpm install` from repo root - see Section B output above.
2. `pnpm --filter @portfolio/frontend build` from repo root (host-side, outside Docker) -
   real `next build` succeeded (had to run
   `pnpm --filter @portfolio/frontend exec prisma generate` first, same as the Dockerfile
   does explicitly in its own layer - host-side there's no automatic postinstall-triggered
   generate under pnpm's default ignored-builds behavior, matching the AC's own stated
   reason for why the Dockerfile has an explicit Prisma-generation layer). Full route
   manifest printed, all `/api/*` routes, `/login`, `/product`, `/stats` listed as expected,
   `ignoreBuildErrors`/`ignoreDuringBuilds` caveat unchanged (NFR-2, proves resolution only).
3. `docker build -f frontend/Dockerfile --target dev` - succeeded end to end; confirmed the
   `pnpm install --frozen-lockfile --filter @portfolio/frontend...` layer, the
   `prisma generate` layer, and (separately, target `prod`) the `builder` stage's
   `pnpm --filter @portfolio/frontend build` layer all completed without error.
4. `docker compose build next-app` then `docker compose up -d` (full stack, all 8 services)
   - all containers reached `Up`/`Running`. `next-app` logs show `next dev` starting and
   `✓ Ready in 648ms`.
5. Dev bind-mount hot-reload: added a one-line comment marker to
   `frontend/src/app/login/page.tsx` (outside `app/api/` and `src/server/`, so GR-1-safe)
   while the stack was running; `next-app`'s logs immediately showed
   `○ Compiling /login/page ...` / `✓ Compiled /login/page`, and `curl` to `/login`
   continued returning 200. Reverted the marker immediately after; confirmed
   `git diff frontend/src/app/login/page.tsx` shows no residual diff.
6. HTTPS spot-checks via `https://www.tubesock.xyz` (local nginx + `/etc/hosts` dev setup,
   unauthenticated session):
   - `/` -> 307 (redirect, expected - unauthenticated).
   - `/login` -> 200.
   - NextAuth login end-to-end - **not verified by this agent; no real credentials or DB
     access available. Deferred to the owner**, same pattern as story 1.2a's Dev Notes.
   - `/stats` -> 307 (redirect when unauthenticated, as required) - confirms
     `frontend/src/middleware.ts`'s Edge path still resolves and runs after the workspace
     restructure.
   - `/product` and `/product/bitcoin` -> 307 (consistent with the rest of the app being
     auth-gated in this unauthenticated spot-check; pages resolve and respond, not a
     module-resolution error).
   - `/api/metrics` -> 403 without the shared-secret `Authorization` header (route's own
     intended behavior, confirmed by reading `frontend/src/app/api/metrics/route.ts`), 200
     with the correct header from `override.env`'s `METRICS_SECRET`.
   - `/api/summary/coins` -> 401 unauthenticated (expected shape for a session-gated route,
     same as pre-conversion).
7. `docker build --target prod -f frontend/Dockerfile .` succeeded (full `next build` output
   printed inside the layer, all routes listed). Ran the resulting image standalone
   (`docker run -p ... prod-image`): with no `NEXTAUTH_SECRET` set it correctly surfaced
   NextAuth's own `NO_SECRET` config error (500, config problem, not a pnpm/module-resolution
   problem); with `NEXTAUTH_SECRET` set it returned 307 for `/` (same redirect-when-
   unauthenticated behavior as the dev stack) - confirms `server.js` starts and serves from
   the new `frontend/server.js` path inside the standalone output, and that the standalone
   tracer's nested `frontend/` output layout (verified directly by listing
   `frontend/.next/standalone/`) was wired correctly in the `prod` stage's `COPY`/`CMD`.
   Test images and containers removed after verification (`docker rmi`, containers ran with
   `--rm`).

### Section G: scope check

`git status --short` at completion shows exactly: new `pnpm-workspace.yaml`, new
`pnpm-lock.yaml`, new root `package.json`, deleted `frontend/package-lock.json`, edited
`frontend/package.json` (name rename only), edited `frontend/Dockerfile`, edited
`docker-compose.yml` (the two mount lines only). No `.github/workflows/*.yml` edits (section
E found nothing to fix). `frontend/src/`, `frontend/src/app/api/`, `frontend/src/server/`
unedited. No `backend/` or `packages/shared/` created. Nothing committed, no branch created
(GR-3) - all changes remain in the working tree for owner review.

### Deferred to owner

- NextAuth login end-to-end (real credentials) - per story pattern, not verifiable by this
  agent.
- Final sign-off checkbox in section G is left unchecked for the owner per GR-4 - the
  Reviewer phase advancing Status to `Done` means the diff is ready for that sign-off, not
  that sign-off has happened.

## Review Notes

**Scope reviewed**: full working-tree diff against this story's file list - `docker-compose.yml`
(modified), `frontend/Dockerfile` (modified), `frontend/package.json` (modified),
`frontend/package-lock.json` (deleted), plus new root-level `pnpm-workspace.yaml`,
`pnpm-lock.yaml`, `package.json`. Checked against every checked-off AC in sections A-G, this
repo's root `CLAUDE.md`, and `prd.md`'s ground rules (GR-1, GR-3).

**Already-fixed-before-review**: `frontend/Dockerfile`'s `base` stage cache mount
(`RUN --mount=type=cache,id=pnpm,target=/pnpm/store`) was pointed at a path pnpm never
actually writes to by default - pnpm's real store lives under `PNPM_HOME` (or
`~/.local/share/pnpm/store` if unset), which the Dockerfile never set, making the cache
mount silently inert (always-empty, no caching, but no build error either - exactly the
"looks right, is inert" failure shape this skill's Correctness section calls out). This was
fixed in the working tree (not by me) by adding `ENV PNPM_HOME="/pnpm"` right after
`corepack enable` in the `base` stage (line 11), with explanatory comments at that line, the
cache-mount line, and the `node_modules` COPY lines in `common-build`. I independently
verified the fix is correct rather than trusting the comment: ran `pnpm store path` inside a
clean `node:24-bookworm` container (matching this Dockerfile's base image) both without and
with `PNPM_HOME=/pnpm` set. Without it: `/root/.local/share/pnpm/store/v11`. With it:
`/pnpm/store/v11` - one level below the cache mount's `target=/pnpm/store`, so the mount now
covers pnpm's actual store directory. Also independently re-ran
`docker build -f frontend/Dockerfile --target dev .`, which succeeded end to end. No change
needed on my part here - recording it because the story's Dev Notes don't yet mention it (the
fix landed after Dev finished).

**Checked and confirmed correct (no changes needed)**:
- AC A: `pnpm-workspace.yaml` contents match (plus the documented `allowBuilds` block pnpm
  itself required - not scope creep, it's pnpm's own mechanism for the `.npmrc`-equivalent
  finding Dev Notes already explains). Root `package.json` matches the minimum-required shape
  exactly (`private: true`, `packageManager` pin, no scripts, no dependencies). `pnpm-lock.yaml`
  has `lockfileVersion: '9.0'` on line 1 and `injectWorkspacePackages: true` under `settings:`.
  No `.npmrc` was created.
- AC B: `frontend/package-lock.json` is deleted. `frontend/package.json`'s `name` is
  `@portfolio/frontend`.
- AC C: Dockerfile restructure matches the AC's exact shape - manifest layer copies
  `pnpm-lock.yaml pnpm-workspace.yaml package.json` before `frontend/package.json`, install
  layer uses `--filter @portfolio/frontend...` under the (now-correct) cache mount, source
  layer lands under `frontend/`, `tsconfig.base.json` lands at `/app/tsconfig.base.json` and
  the old 1.2-era workaround copy is gone, Prisma generation runs via
  `pnpm --filter @portfolio/frontend exec prisma generate` after install/source-copy and before
  build, `dev`/`builder`/`prod` stages all reference the new `frontend/`-nested paths correctly
  (including the standalone-output `frontend/server.js` nesting the AC specifically warned
  about). `grep -n npm frontend/Dockerfile` shows no bare `npm` commands, only substrings inside
  `pnpm`. `frontend/Dockerfile.dev` has no diff (confirmed via `git diff --stat`) - still npm
  based, correctly left alone as out of scope.
- AC D: `docker-compose.yml`'s only diff is the two `next-app` bind-mount container-side paths;
  mounts stay narrow (`frontend/src`, `frontend/public`), no wholesale `./frontend:/app/frontend`
  mount that would shadow the image's pnpm-symlinked `node_modules`. `build.context`/
  `build.dockerfile` unchanged.
- AC E: re-ran `grep -n -i "npm\|pnpm\|package-lock\|setup-node"` against both workflow files
  myself - no matches in either, confirming the Dev Notes finding independently.
- AC G: `git status --short` shows exactly the expected file set (new `pnpm-workspace.yaml`,
  new `pnpm-lock.yaml`, new root `package.json`, deleted `frontend/package-lock.json`, modified
  `frontend/package.json`/`frontend/Dockerfile`/`docker-compose.yml`) plus this session's own
  unrelated BMAD tooling (then `.claude/agents/` and `docs/bmad/`, since reorganized into
  `.claude/skills/bmad/`) which predates and
  is outside this story. `frontend/src/`, `frontend/src/app/api/`, `frontend/src/server/` are
  untouched (GR-1). No `backend/` or `packages/shared/` created. Nothing committed (GR-3).
  `frontend/next-env.d.ts` has no diff, confirming Dev Notes' claim that the Next codegen quirk
  was reverted.

**Security note (not a finding, judgment already made correctly)**: the `allowBuilds:` block
in `pnpm-workspace.yaml` re-enables lifecycle/postinstall scripts for 5 packages
(`@prisma/client`, `@prisma/engines`, `bcrypt`, `prisma`, `unrs-resolver`) that pnpm blocks by
default as a supply-chain mitigation. This restores npm's historical default (which always ran
lifecycle scripts) rather than introducing new risk, and is narrowly scoped to exactly the
packages that failed without it (`bcrypt`'s native build in particular is load-bearing for
AC B's own `require('bcrypt')` check) - not a blanket opt-out. No action needed.

**Open findings for the owner**: none. No judgment-call or scope-changing issues found.

**Status**: setting to `Done` - the diff is ready for the owner's final read and sign-off
(the last AC-G checkbox, "Owner has reviewed and signed off," is intentionally left unchecked
for the owner to check themselves).
