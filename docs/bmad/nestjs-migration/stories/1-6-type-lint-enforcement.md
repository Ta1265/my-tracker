# Story 1.6: Type/lint enforcement

Status: Done

## Context

Epic 1 sequence: 1.2 -> 1.2a -> 1.3 -> 1.4 (done) -> 1.5 (done) -> **1.6 (this story,
closes Epic 1)**. After this story, GR-4's epic-boundary sign-off applies before Epic 2
(the Swagger scaffold) starts.

This story has two genuinely different halves, per NFR-2:

1. **Backend: a real fix.** `backend/` gets build-failing type-check and lint
   enforcement, with no `ignoreBuildErrors`/`ignoreDuringBuilds`-style escape hatch.
   This is new work - story 1.4 created `backend/eslint.config.mjs` but deliberately
   left it non-runnable (missing devDependencies, not wired into any build step; see
   that story's Review Notes F4) and never added a `lint` script or a dedicated
   type-check step.
2. **Frontend: evidence, not a fix.** `frontend/next.config.js`'s
   `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` **stay enabled** -
   this is a decision already made in `prd.md` (NFR-2), not something this story
   revisits. The deliverable is running the checker and linter with those flags
   bypassed, recording the real error/warning counts, and writing down the deferral
   rationale. Fixing any of what's found is explicitly story 8.5's job (Epic 8, not
   started under this initiative).

### Ground rules and architecture decisions that bind this story

- **GR-1 - Additive only.** Nothing under `frontend/src/app/api/` or
  `frontend/src/server/` is touched. This story may add backend devDependencies, a
  backend `lint` script, edit `backend/Dockerfile`'s `builder` stage, and touch
  `backend/eslint.config.mjs` if a rule needs adjusting to make it runnable - it does
  not edit any frontend source file.
- **GR-3 - Nothing is committed.** Changes stay in the working tree until owner
  sign-off.
- **GR-4 - Human sign-off between chunks.** Drafted as `Status: Draft`. This is also
  Epic 1's last story, so sign-off here doubles as the Epic 1 boundary review before
  Epic 2 starts.
- **NFR-2 (PRD)** - the operative requirement. Quoted precisely because this story's
  two halves both trace to it: "`backend/` is type-checked and linted from its first
  commit, with no equivalent of `next.config.js`'s `typescript.ignoreBuildErrors` or
  `eslint.ignoreDuringBuilds` escape hatch, and a failing check fails the build. This is
  non-negotiable for the backend... The frontend flags... stay on for this initiative...
  Story 1.6 therefore enumerates the real error count and records that number and this
  rationale, and story 8.5... carries the fix forward."
- **Success criterion 11 (PRD)** - "story 1.6 records the error count and the rationale
  for leaving it that way, with story 8.5 carrying it as scheduled follow-up." This
  story's own Dev Notes are where that record lives - there is no other file it could
  go in without editing `prd.md`, which is out of bounds.

## Acceptance Criteria

### A. Backend type-check enforcement

- [x] **`backend/package.json` gains a dedicated `typecheck` script**:
      `"typecheck": "tsc --noEmit -p tsconfig.json"`. This exists alongside `build`
      (`nest build`, which already compiles via `tsc` and already fails non-zero on a
      type error, since `backend/tsconfig.json` extends the root `tsconfig.base.json`'s
      `strict: true`) - the dedicated script is for running a type check without also
      producing `dist/` output, e.g. from a future CI step or a quick local check.
- [x] **Verify `nest build` already fails the way NFR-2 requires, rather than assuming
      it**: temporarily introduce one deliberate type error in `backend/src` (e.g. assign
      a `string` to a variable typed `number`), run `pnpm --filter @portfolio/backend
      build`, confirm a non-zero exit and a `tsc`-style `error TS...` message, then
      revert the change and confirm a clean build again. Record both runs in Dev Notes.

### B. Backend lint enforcement, wired into the build

- [x] **Add the missing devDependencies** `backend/eslint.config.mjs` (from story 1.4)
      already imports but that are not yet in `backend/package.json`: `eslint`,
      `@eslint/js`, `typescript-eslint`, `eslint-plugin-prettier`, `globals`, `prettier`.
      Use `pnpm add -D --filter @portfolio/backend <packages>` and record the exact
      resolved versions in Dev Notes (matching the precedent story 1.4 set for its own
      dependency list). Nest CLI 11's own generator currently pins ESLint 9.x for this
      flat-config shape - do not downgrade to ESLint 8 to match the frontend; the two
      lint stacks are already deliberately unmediated per architecture ("Lint is
      per-package with no shared base").
- [x] **`backend/package.json` gains a `lint` script**:
      `"lint": "eslint \"{src,test}/**/*.ts\""` (no `--fix` - a fix-on-run script is a
      convenience for local use, not what a build-failing check should do; add a
      separate `lint:fix` script only if it's free, not required). Do **not** add
      `--max-warnings 0`: `backend/eslint.config.mjs` already sets
      `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-unsafe-argument`
      to `'warn'` as a deliberate choice (not an oversight - nothing in this story's scope
      revisits that), and ESLint's own default behavior already exits non-zero on any
      `'error'`-level violation while leaving warnings non-fatal, which is the intended
      split.
- [x] **`pnpm --filter @portfolio/backend lint` runs successfully against the current
      `backend/src`** (i.e. the four files from story 1.4 - `main.ts`, `app.module.ts`,
      `health/health.controller.ts`, `config/*` - pass with zero errors; any warnings
      from the two rules above are fine and do not need fixing).
- [x] **`backend/Dockerfile`'s `builder` stage runs lint before build**, so a lint error
      fails the same Docker build stage a type error already fails:
      ```dockerfile
      FROM common-build AS builder
      WORKDIR /app
      RUN pnpm --filter @portfolio/backend lint
      RUN pnpm --filter @portfolio/backend build
      ```
      (Two `RUN` lines, not one `&&`-joined line - keeps the Docker build log clear about
      which check failed.) The `dev` stage is untouched - it never ran `tsc` or `eslint`
      at container-start time before this story and doesn't need to now; enforcement
      lives in the `builder` stage that both `docker build --target prod` and CI-style
      builds go through.
- [x] **Verify the wiring, not just the script**: temporarily introduce one deliberate
      lint error (e.g. an unused `const` the `no-floating-promises`/base ESLint rules
      would flag as an error, not one of the two `warn`-level rules), run `docker build
      -f backend/Dockerfile --target builder .` (or `--target prod`, which depends on
      `builder`), confirm the Docker build fails at the `lint` `RUN` step, then revert and
      confirm a clean build again. Record both runs in Dev Notes.

### C. Frontend - evidence, not a fix

- [x] **`frontend/next.config.js` is not edited.** `typescript.ignoreBuildErrors: true`
      and `eslint.ignoreDuringBuilds: true` stay exactly as they are - this is the one
      constraint this whole story revolves around; do not "helpfully" flip them even
      temporarily as part of gathering evidence (see the two commands below, both of
      which bypass the flags without touching the file, since neither goes through
      `next build`).
- [x] **Run a real type check and record the exact error count**:
      `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json`. This
      compiles under `frontend/tsconfig.json`'s existing `strict: true` and is entirely
      independent of `next.config.js`'s flags (those only suppress `next build`'s own
      internal check, not a direct `tsc` invocation). Record the final `Found N errors`
      count (or equivalent) in Dev Notes, verbatim.
- [x] **Run a real lint check and record the exact error/warning counts**:
      `pnpm --filter @portfolio/frontend lint` (runs `next lint` against
      `frontend/.eslintrc.cjs`, `next/core-web-vitals` plus the repo's
      `@typescript-eslint` rules). Like `tsc --noEmit`, this is a direct lint run,
      independent of `eslint.ignoreDuringBuilds` (which only affects `next build`).
      Record the summary line's error and warning counts verbatim in Dev Notes.
- [x] **No frontend source file is edited to make either count smaller.** The point of
      this story is an honest baseline for story 8.5, not a partial cleanup that leaves
      8.5's scope ambiguous. If a count is surprisingly large or small, record it as
      found rather than investigating individual findings - that triage is 8.5's job.

### D. The recorded decision

- [x] **Dev Notes for this story contain, verbatim**: the exact `tsc --noEmit` error
      count, the exact `next lint` error and warning counts, and the deferral rationale
      (point at NFR-2's own text rather than re-deriving it - "these are pre-existing
      frontend issues unrelated to this migration; fixing them on the same branch as a
      monorepo move would make the change unreviewable; story 8.5 owns the fix, sequenced
      after Epic 8's other cleanup stories (8.1-8.4) so much of the count will already be
      gone from deleted code by the time 8.5 runs").
- [x] **Confirm story 8.5 already exists in `prd.md`'s Epic 8 as the scheduled follow-up**
      (it does, as of this writing - "Remove `typescript.ignoreBuildErrors` and
      `eslint.ignoreDuringBuilds`... This is the story's **entire** scope"). No edit to
      `prd.md` is needed or permitted; this bullet is a read-and-confirm, not a write.

### E. Nothing else changed, and sign-off

- [x] `git status` shows changes limited to: `backend/package.json` (typecheck + lint
      scripts, new devDependencies), `pnpm-lock.yaml` (regenerated), possibly
      `backend/eslint.config.mjs` (only if a rule needed adjusting to make it runnable -
      note any such change explicitly in Dev Notes with a reason), `backend/Dockerfile`
      (the two-`RUN` `builder` stage change). No file under `frontend/` is edited.
- [x] `frontend/src/`, `frontend/src/app/api/`, `frontend/src/server/`, and
      `frontend/next.config.js` - unedited (GR-1, and this story's own C section).
- [x] Nothing is committed (GR-3).
- [ ] Owner has reviewed and signed off - this closes Epic 1 (GR-4's epic-boundary
      review), so also confirm with the owner that Epic 2 (API scaffold, ending in the
      GR-2 Swagger sign-off gate) is the correct next epic before `bmad-sm` drafts 2.1.

## Technical Notes

### Current state this story builds from

`backend/eslint.config.mjs` (written in story 1.4) already contains the full flat-config
shape - `eslint.configs.recommended`, `tseslint.configs.recommendedTypeChecked`,
`eslintPluginPrettierRecommended`, Node globals, `sourceType: 'commonjs'`,
`projectService: true` - but none of `@eslint/js`, `eslint-plugin-prettier`, `globals`,
`typescript-eslint` are in `backend/package.json`'s `devDependencies` yet, so the file
cannot currently execute (story 1.4's Review Notes F4, still Open, recorded exactly this
gap and named the missing set). `backend/package.json` has no `lint` or `typecheck`
script. `backend/tsconfig.json` already extends `../tsconfig.base.json`'s `strict: true`,
and `nest build` already fails on a type error today - that half of NFR-2 is closer to
"verify" than "build."

`backend/Dockerfile`'s `builder` stage currently has one `RUN pnpm --filter
@portfolio/backend build` line and nothing else (see story 1.5's Technical Notes for the
full six-stage layout, unchanged by that story).

### Frontend baseline, for context (not to be fixed here)

`frontend/next.config.js` sets both flags to `true`, per a decision already made in
`prd.md` NFR-2 and reaffirmed in the out-of-scope list ("removing the frontend's
`next.config.js` type/lint suppression... is a recorded deferral... rather than an
omission"). `frontend/tsconfig.json` has `strict: true`; `frontend/.eslintrc.cjs` extends
`next/core-web-vitals` plus a small set of `@typescript-eslint` rules, several already at
`'warn'` (`consistent-type-imports`, `no-unused-vars`) and one at error severity
(`no-misused-promises`, literal `2`). Both commands in section C run today without any
new tooling - `typescript` and `eslint`/`eslint-config-next` are already
`frontend/package.json` dependencies.

### Why lint enforcement lives in the Docker `builder` stage, not a separate CI step

There is no CI workflow in this repo that runs `pnpm build`/`pnpm test` today (checked:
`.github/workflows/` only has `nginx_setup.yml` and `deployment.yml`, neither of which
type-checks or lints). The `builder` Docker stage is the one place a broken commit
concretely fails to produce a runnable image, for both `docker build --target prod` and
this initiative's own dev-container workflow up through it, so that is where "a failing
check fails the build" (NFR-2's own words) is made literally true. If a CI workflow is
added later, it should call the same `pnpm --filter @portfolio/backend lint` /
`typecheck` scripts this story adds rather than re-implement the check.

## Out of Scope

- **Fixing anything `tsc --noEmit` or `next lint` reports on the frontend** - that is
  story 8.5's entire scope, deferred to Epic 8, not started under this initiative.
- **Editing `frontend/next.config.js`** - the flags stay enabled; see section C.
- **Any CI workflow** (GitHub Actions or otherwise) that runs these new backend scripts
  automatically. None exists in this repo today; this story only makes the scripts and
  the Docker-build wiring exist and work when invoked.
- **Raising `backend/eslint.config.mjs`'s two `'warn'`-level rules to `'error'`** - that
  was architecture's own deliberate choice (see `backend/eslint.config.mjs`'s existing
  comments/rules block from story 1.4), not this story's to revisit.
- **Epic 2 and beyond** - the Swagger scaffold, DTOs, domain modules. This story only
  closes out Epic 1.

## Dev Notes

### A. Backend type-check enforcement

- Added `"typecheck": "tsc --noEmit -p tsconfig.json"` to `backend/package.json`,
  alongside the existing `build` script.
- Verification run 1 (deliberate error): added `const deliberateTypeError: number = 'this
  is a string, not a number';` to `backend/src/main.ts`'s `bootstrap()`, then ran `pnpm
  --filter @portfolio/backend build`. Result: exit 1, with
  `src/main.ts:5:9 - error TS2322: Type 'string' is not assignable to type 'number'.` and
  a final `Found 1 error(s).` line.
- Verification run 2 (revert): removed the line, ran the same build again. Result: exit 0,
  no output beyond the `nest build` command echo - clean build confirmed.

### B. Backend lint enforcement, wired into the build

- Installed devDependencies via `pnpm add -D --filter @portfolio/backend`. Resolved
  versions actually written to `backend/package.json`:
  - `@eslint/js@^9.39.5` (updated in review round 1 - see Review Notes F1; originally
    resolved as `^10.0.1`, an unmet peer against `eslint@^9.39.5`)
  - `eslint@^9.39.5`
  - `eslint-plugin-prettier@^5.5.6`
  - `globals@^17.11.0`
  - `prettier@^3.9.6`
  - `typescript-eslint@^8.67.0`
  - `eslint-config-prettier@^10.1.8` (see deviation note below)

  Deviation from the story's exact package list: a plain `pnpm add -D ... eslint ...`
  (no version pin) initially resolved `eslint@8.57.1`, not the 9.x the story requires -
  pnpm was choosing the lowest version satisfying `typescript-eslint@8.67.0`'s peer range
  (`^8.57.0 || ^9.0.0`) rather than the npm `latest` dist-tag (which today is `10.8.1`).
  Reinstalled as `pnpm add -D --filter @portfolio/backend "eslint@^9" ...`, which
  resolved `eslint@9.39.5` as required.

  Second deviation: `eslint-plugin-prettier` was not enough on its own to make
  `backend/eslint.config.mjs` runnable. Its `recommended.js` export (already imported by
  `eslint.config.mjs` from story 1.4 as `eslintPluginPrettierRecommended`) hard-requires
  `eslint-config-prettier` at runtime, even though the package lists it only as an
  *optional* peer dependency (`peerDependenciesMeta.eslint-config-prettier.optional:
  true`) - without it, `pnpm --filter @portfolio/backend lint` fails immediately with
  `Cannot find module 'eslint-config-prettier'`. Added `eslint-config-prettier@^10.1.8` as
  a devDependency to fix this; it was not on the story's original six-package list because
  that list only named the packages `eslint.config.mjs` directly imports, not this
  transitive runtime requirement of one of them.

  Third deviation: even with all of the above installed, `pnpm --filter
  @portfolio/backend lint` still failed with
  `Cannot find package 'prettier-plugin-tailwindcss' imported from
  /Users/taylor/projects/portfolio/backend/noop.js`. Cause: `backend/` has no Prettier
  config of its own, so Prettier's config search (used internally by
  `eslint-plugin-prettier`) walks up the directory tree and picks up the repo-root
  `prettier.config.mjs`, which loads `prettier-plugin-tailwindcss` - a package that is
  only a `frontend` devDependency, not hoisted anywhere `backend`'s lint run can resolve
  it from. Added `backend/.prettierrc.json` (`{ "singleQuote": true, "printWidth": 100 }`
  - the same non-plugin settings the root config carries) so Prettier's nearest-config
  rule stops the search at `backend/` instead of reaching the root file. This is a new
  file under `backend/`, additive only, does not touch `frontend/` or the root
  `prettier.config.mjs`, and is consistent with architecture's "lint is per-package with
  no shared base."
- Added `"lint": "eslint \"{src,test}/**/*.ts\""` to `backend/package.json` (no `--fix`,
  no `--max-warnings 0`, per the story).
- `pnpm --filter @portfolio/backend lint` now runs against the current `backend/src`
  (`main.ts`, `app.module.ts`, `health/health.controller.ts`, `config/*`) and exits 0,
  with exactly one warning: `no-floating-promises` on `main.ts:9:1` (the un-awaited
  `bootstrap()` call, expected and unrelated to this story).

  One fix was required to get to zero errors:
  `backend/src/config/app-config.service.ts` had a `throw new Error(...)` call formatted
  across three lines that Prettier's `printWidth: 100` says should collapse to one line
  (it fits in 92 characters); `prettier/prettier` flags this as an `error`-severity
  violation (per `eslint.config.mjs`'s `'prettier/prettier': ['error', ...]`). Collapsed
  it to a single line at `backend/src/config/app-config.service.ts:13`. This is a pure
  formatting change (no logic change) and was necessary to satisfy this story's AC that
  `lint` runs with zero errors against the existing four files - it could not have been
  caught before this story because `eslint.config.mjs` had no dependencies installed
  until now (story 1.4's Review Notes F4).
- `backend/Dockerfile`'s `builder` stage now runs
  `RUN pnpm --filter @portfolio/backend lint` before `RUN pnpm --filter @portfolio/backend
  build` (two separate `RUN` lines, per the story). The `common-build` stage also now
  copies `backend/eslint.config.mjs` and `backend/.prettierrc.json` (previously it only
  copied `src`, `tsconfig.json`, and `nest-cli.json`), since lint needs both config files
  present in the image to run at all.
- Verification run 1 (clean, before introducing an error):
  `docker build -f backend/Dockerfile --target builder .` - both `RUN` steps completed,
  lint step reported `0 errors` (1 warning, the same `no-floating-promises` one), build
  succeeded, image exported.
- Verification run 2 (deliberate lint error): added
  `const   badlyFormatted   =    'this violates prettier formatting rules';` plus a
  `console.log(badlyFormatted);` to `backend/src/main.ts`'s `bootstrap()`, then ran the
  same `docker build -f backend/Dockerfile --target builder .`. Result: the build failed
  at the `RUN pnpm --filter @portfolio/backend lint` step specifically (step
  `[builder 2/3]`), with `prettier/prettier` reporting the spacing violation as an
  `error`, `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`, and Docker's own
  `process "/bin/sh -c pnpm --filter @portfolio/backend lint" did not complete
  successfully: exit code: 1` - the build never reached the `build` `RUN` step.
- Verification run 3 (revert): removed the two added lines from `main.ts`, ran the same
  Docker build again. Result: clean pass again (Docker reused the cached, already-passing
  layers for the now-identical file content, which itself confirms those layers succeed).
- Ran `docker image prune -f` afterward to remove the dangling test images left by these
  three throwaway builds; nothing under `docker-compose.yml`'s named services was
  affected.

### C/D. Frontend - evidence and the recorded decision

- `frontend/next.config.js` was not touched at any point (`git status` never showed it as
  modified during this story).
- `tsc --noEmit` (`pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json`,
  and independently via `./node_modules/.bin/tsc --noEmit -p tsconfig.json` from
  `frontend/`): exit code 1/2. This TypeScript version does not print a `Found N errors`
  summary line for this invocation, so the count was taken as the number of `error TS...`
  diagnostic lines in the output: **17 errors**, across 11 files (`useFetchCurrentPrice.ts`,
  `AddTransaction.tsx`, `ModalContextProvider.tsx`, `NumberFormatCustom.tsx`,
  `LineChart.tsx` (product, x2), `ProductTable.tsx` (x5), `SortArrow.tsx`,
  `TableComponent.tsx` (x2), `TickerDisplay.tsx` (x2), `storeTransactions.ts`).
- `next lint` (`pnpm --filter @portfolio/frontend lint`, i.e. `pnpm lint` from
  `frontend/`): exit code 0. **0 errors, 71 warnings** (counted via `grep -c "Warning:"`
  against the captured output; no `Error:` lines present). All warnings are
  `@typescript-eslint/no-unused-vars`, `@typescript-eslint/consistent-type-imports`, or
  one `react-hooks/exhaustive-deps` instance, across roughly 30 files under `src/app/api/`,
  `src/components/`, `src/context/`, and `src/server/`.
- Side effect noted and reverted: running `tsc`/`next lint` caused Next.js to regenerate
  `frontend/next-env.d.ts` (it dropped a `/// <reference types="next/navigation-types/
  compat/navigation" />` line - a stale reference from an older Next/TypeScript version
  combination, unrelated to anything this story touched). That file is explicitly marked
  "should not be edited" by hand and is tooling-generated, so it was reverted with
  `git checkout -- frontend/next-env.d.ts` to keep `frontend/` at zero diff for this
  story, per section E.
- Deferral rationale (per NFR-2 and Success Criterion 11, quoted rather than
  re-derived): these are pre-existing frontend issues unrelated to this migration; fixing
  them on the same branch as a monorepo move would make the change unreviewable; story
  8.5 owns the fix, sequenced after Epic 8's other cleanup stories (8.1-8.4) so much of
  the count will already be gone from deleted code by the time 8.5 runs.
- Confirmed story 8.5 exists in `prd.md`'s Epic 8 (`## Epic 8: Deferred cleanup - NOT IN
  SCOPE`), listed as: "8.5 - Remove `typescript.ignoreBuildErrors` and
  `eslint.ignoreDuringBuilds` from `next.config.js` and fix the resulting frontend
  errors. This is the story's **entire** scope..." `prd.md` was not edited.

### E. Final diff scope

`git status --short` at the end of this story:
```
 M backend/Dockerfile
 M backend/package.json
 M backend/src/config/app-config.service.ts
 M pnpm-lock.yaml
?? backend/.prettierrc.json
```
(plus the pre-existing untracked `.claude/skills/bmad/`, `CLAUDE.md`, `docs/`, which
predate this story and are deliberately untracked per the handoff). No file under
`frontend/` is modified. Nothing was committed.

The two deviations from the story's exact expected-file list (`app-config.service.ts`'s
formatting fix and the new `backend/.prettierrc.json`) are documented above in section B,
with the reason each was necessary to satisfy the AC ("lint runs successfully... with
zero errors").

The final owner sign-off/Epic-2-confirmation checkbox in section E is left unchecked -
that is the owner's action, not something this story's implementation can check off
itself.

## Review Notes

### Round 1

- **F1** [blocking · dependency correctness] `backend/package.json:25` - `@eslint/js` is
  pinned a major version ahead of the `eslint` it is paired with, leaving an unsatisfiable
  peer dependency in the dependency set this story exists to create.
  The diff adds `"@eslint/js": "^10.0.1"` next to `"eslint": "^9.39.5"`, but
  `backend/node_modules/@eslint/js/package.json` declares
  `"peerDependencies": {"eslint": "^10.0.0"}` - so the installed pair violates the
  package's own declared contract, and pnpm resolves it only because
  `strict-peer-dependencies` defaults to false (no `.npmrc` in this repo overrides it).
  The lockfile records the mismatch explicitly:
  `'@eslint/js': specifier ^10.0.1, version: 10.0.1(eslint@9.39.5(...))`. This also
  contradicts the shape the story's section B told Dev to keep - Nest CLI 11's own
  generator template
  (`@nestjs/schematics@11.1.0/dist/lib/application/files/ts/package.json`) pins
  `"@eslint/js": "^9.18.0"` alongside `"eslint": "^9.18.0"`. Concrete failure: `^10.0.1`
  floats freely across the 10.x line whose recommended config is authored against ESLint
  10's config schema, so a future `pnpm update` (or any fresh `pnpm install` resolving a
  newer 10.x) can break `backend/eslint.config.mjs`'s
  `eslint.configs.recommended` - i.e. break the build-failing lint gate this story just
  installed - with no change to any file in the repo. Lint passes today; the defect is the
  pin, not the current run. Fix: `pnpm add -D --filter @portfolio/backend "@eslint/js@^9"`
  and re-record the resolved version in Dev Notes section B.
  - Status: Fixed - re-ran `pnpm add -D --filter @portfolio/backend "@eslint/js@^9"`,
    which re-resolved `@eslint/js` to `^9.39.5` (matching `eslint@^9.39.5` exactly, not
    just same-major) in `backend/package.json:25`. Re-ran
    `pnpm --filter @portfolio/backend typecheck` (exit 0) and
    `pnpm --filter @portfolio/backend lint` (exit 0, same single
    `no-floating-promises` warning on `main.ts:9:1`, zero errors) locally, then
    `docker build -f backend/Dockerfile --target builder .` end to end - the
    `RUN pnpm --filter @portfolio/backend lint` step again reported `0 errors,
    1 warning` and the build completed through `build` and image export. Dev Notes
    section B's resolved-version list is updated to match.

- **F2** [advisory · blast radius] `pnpm-lock.yaml` - adding the backend lint stack
  re-resolved parts of the *frontend*'s dependency closure, so the frontend image content
  changes even though no frontend file was edited.
  Beyond the expected new `backend` importer entries, the lockfile's `frontend` importer
  block changes peer-resolved variants, e.g.
  `axios: 1.19.0(debug@4.4.3(supports-color@8.1.1))(supports-color@7.2.0)` becomes
  `...(supports-color@8.1.1)`, with the same 7.2.0 -> 8.1.1 swap across `@emotion/react`,
  `@emotion/styled`, `@mui/material`, `@mui/joy`, `@mui/x-date-pickers`, `ioredis` and the
  ESLint 8 chain, plus `eslint-config-prettier@10.1.8` now injected into the frontend's
  `eslint-plugin-prettier` resolution. This is pnpm dedupe, not a source edit, and section
  E does permit a regenerated lockfile - so it is not a scope violation. Recording it only
  so the Epic 1 boundary sign-off knows the frontend container's installed closure is not
  byte-identical to the last commit's and deserves the usual `/stats` + `/product` smoke
  check.
  - Status: Open

**Verified this round (no finding):**

- **Deviation 1 (`eslint-config-prettier` as a seventh devDependency) - justified.**
  `eslint-plugin-prettier@5.5.6`'s `recommended.js` does require it at runtime, and it is
  not merely a defensible addition: Nest CLI 11's own generator template lists
  `"eslint-config-prettier": "^10.0.1"` in the exact devDependency set this backend is
  modeled on. The story's six-package list was the under-specification, not Dev's install.
- **Deviation 2 (`backend/.prettierrc.json`) - justified and stylistically consistent.**
  Root `prettier.config.mjs` is `{ plugins: ['prettier-plugin-tailwindcss'], singleQuote:
  true, printWidth: 100 }`; the new backend config is `{ "singleQuote": true,
  "printWidth": 100 }` - identical minus the frontend-only plugin, so no new formatting
  style is introduced. There is no `frontend/.prettierrc*`, so the frontend still uses the
  untouched root config.
- **Deviation 3 (`backend/src/config/app-config.service.ts:13`) - in bounds.** The diff is
  a pure reflow of one `throw new Error(...)` to a 92-column single line, no logic change,
  and it is exactly what section B's "lint runs successfully... with zero errors" AC
  requires now that `prettier/prettier` is executable for the first time. Section E's file
  list under-enumerated rather than forbidding it, and Dev Notes records the reason.
- **`frontend/` is at genuine zero diff.** `git status --short` shows no path under
  `frontend/` in any state; `git diff -- frontend/` is empty, so `next.config.js` and the
  reverted `next-env.d.ts` are both byte-identical to `HEAD` (804e480).
- **Section A/B verification evidence is credible.** `@nestjs/cli@11.0.24`'s
  `lib/compiler/compiler.js:58` does emit ``Found ${diagnostics.length} error(s).``,
  matching the `Found 1 error(s).` line Dev quoted (which is a Nest-specific string, not
  something a generic `tsc` transcript would contain), and `main.ts`'s `bootstrap()` body
  starts at line 5, matching the reported `src/main.ts:5:9`. Independently re-ran
  `pnpm --filter @portfolio/backend typecheck` (exit 0) and
  `pnpm --filter @portfolio/backend lint` (exit 0, `1 problem (0 errors, 1 warning)` -
  the `no-floating-promises` warning on `main.ts:9:1`, as recorded).
- **`common-build` copies everything the lint `RUN` needs.** Verified by running the lint
  inside the built image rather than by reading the Dockerfile:
  `docker build -f backend/Dockerfile --target builder` then
  `docker run --rm <image> sh -c "pnpm --filter @portfolio/backend lint"` exits 0 with the
  same single warning. `/app/backend` contains `.prettierrc.json`, `eslint.config.mjs`,
  `tsconfig.json`, `package.json`, `src` and `node_modules`, and
  `backend/tsconfig.json`'s `../tsconfig.base.json` resolves to the copied
  `/app/tsconfig.base.json`, so `projectService: true` has a real project to load. The
  review image was removed afterward.
- **Frontend counts reproduce exactly.** `tsc --noEmit -p tsconfig.json` from `frontend/`:
  exit 1, 17 `error TS` lines. `eslint --ext .js,.jsx,.ts,.tsx src`:
  `71 problems (0 errors, 71 warnings)`. Both match Dev Notes verbatim, and neither run
  left the working tree dirty.
- **Nothing is committed.** `HEAD` is still `804e480` (story 1.5), and the working tree
  matches Dev Notes section E's `git status --short` listing exactly.

### Round 2

- **F1** [blocking · dependency correctness] `backend/package.json:25` - carried from
  round 1.
  - Status: Resolved - verified independently, not on the strength of Dev's claim.
    `backend/package.json:25` now reads `"@eslint/js": "^9.39.5"` against
    `"eslint": "^9.39.5"` (line 29). `pnpm-lock.yaml` carries no `@eslint/js` 10.x entry at
    all: the only versions present are `9.39.5` and the pre-existing frontend `8.57.1`, and
    the backend importer entry is now `specifier: ^9.39.5 / version: 9.39.5` with no peer
    suffix - `@eslint/js@9.x` declares no `peerDependencies`, so the unmet peer is gone
    rather than merely relocated. `backend/node_modules/@eslint/js` resolves to
    `.pnpm/@eslint+js@9.39.5`. The re-resolution introduced no new unmet peer: the only
    other peer-bearing addition, `eslint-config-prettier@10.1.8`, declares
    `"eslint": ">=7.0.0"`, satisfied by 9.39.5.
- **F2** [advisory · blast radius] `pnpm-lock.yaml` - carried from round 1.
  - Status: Open (advisory, correctly left as-is at the coordinator's direction; recorded
    for the owner's Epic 1 boundary smoke check, not for Dev to act on).

**Verified this round (no new finding):**

- **The lock regeneration added no churn beyond what F2 already noted.** The round-2
  lockfile diff against `HEAD` is `534 insertions(+), 194 deletions(-)`, versus round 1's
  `547 insertions(+), 194 deletions(-)` - identical deletions and 13 fewer insertions,
  exactly the dropped `@eslint/js@10.0.1` package and snapshot entries. Filtering the
  `frontend` importer block of the diff for lines that are not the
  `supports-color@7.2.0 -> 8.1.1` swap or the `eslint-config-prettier` peer injection
  returns nothing, so the frontend-side churn is unchanged from what F2 describes and
  strictly a subset of round 1's.
- **The Docker `builder` lint gate did not become a no-op.** Rebuilt
  `docker build -f backend/Dockerfile --target builder .` (passes), then, without touching
  the working tree, built a throwaway image `FROM` that builder image which appends
  `const   badlyFormatted   =    'gate test';` + a `console.log` to
  `/app/backend/src/main.ts` inside the container and re-runs the identical
  `RUN pnpm --filter @portfolio/backend lint`. That build failed as required:
  `10:7  error  Replace `··badlyFormatted···=···` with `badlyFormatted·=`  prettier/prettier`,
  `✖ 2 problems (1 error, 1 warning)`, `[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL]`, and Docker's
  own `process "/bin/sh -c pnpm --filter @portfolio/backend lint" did not complete
  successfully: exit code: 1`. So an error-severity lint violation still fails the build
  step after the dependency change, and the `'warn'`-level `no-floating-promises` still
  does not - the intended split from section B. Both review images were removed afterward.
- **Lint and type-check still pass on the current tree.**
  `pnpm --filter @portfolio/backend typecheck` exit 0;
  `pnpm --filter @portfolio/backend lint` exit 0 with
  `✖ 1 problem (0 errors, 1 warning)` - the same `no-floating-promises` warning on
  `main.ts:9:1`.
- **Scope and commit state unchanged.** `git status --short` shows exactly
  `M backend/Dockerfile`, `M backend/package.json`,
  `M backend/src/config/app-config.service.ts`, `M pnpm-lock.yaml`,
  `?? backend/.prettierrc.json` (plus the pre-existing untracked `.claude/`, `CLAUDE.md`,
  `docs/`). `git diff --stat -- frontend/` is empty - `frontend/` remains at genuine zero
  diff, `next.config.js` and `next-env.d.ts` included. `HEAD` is still `804e480`; nothing
  was committed.

**Round 2 outcome:** the one blocking finding is Resolved and no regression was introduced
by the fix. Status set to `Done` - ready for the owner's final read, the commit, and the
GR-4 Epic 1 boundary sign-off (which per section E also asks the owner to confirm Epic 2
is the correct next epic before `bmad-sm` drafts 2.1). Note for that sign-off: F2 remains
open as advisory, so a `/stats` + `/product` smoke check of the frontend container is
worth doing before the commit is considered final.
