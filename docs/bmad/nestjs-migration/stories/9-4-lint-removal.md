# Story 9.4: Lint taken out of the backend build

Status: Done

## Context

D40's reversal of story 1.6: the owner decided an image build produces an artifact and
does not run quality gates, so lint no longer fails any build. This removes the two
`lint` `RUN` lines story 1.6 added to `backend/Dockerfile`. Independent of the contract
pipeline (stories 9.1-9.3) - nothing here reads or writes `backend/openapi.json` or
`frontend/types/api.d.ts`. Runs before story 9.4a: 9.4a adds a new `RUN` step to stage 4
`builder` immediately after the existing `RUN pnpm --filter @portfolio/backend build`
line, and that line is only the last one in the stage once this story's removal has
already landed - landing lint-removal first means 9.4a never has to describe its
insertion point relative to a line this story is about to delete.

## Acceptance Criteria

- [x] Remove `RUN pnpm --filter @portfolio/shared lint` from stage 2, `common-build`
  (`backend/Dockerfile:44` today - added in Epic 4's review, per that epic's Changed
  Files).
- [x] Remove `RUN pnpm --filter @portfolio/backend lint` from stage 4, `builder`
  (`backend/Dockerfile:57` today - added by story 1.6). After removal, the last line in
  stage 4 `builder` is `RUN pnpm --filter @portfolio/backend build`.
- [x] `backend/package.json`'s and `packages/shared/package.json`'s `lint` scripts are
  **not removed** - they stay for developers and editors, per NFR-2's amended text
  ("Lint is a developer and editor tool with no build-failing behavior anywhere in this
  repo"). Only the Dockerfile `RUN` lines go.
- [x] `frontend/Dockerfile` is checked and left alone - it has no equivalent lint `RUN`
  to remove (`next build` runs ESLint internally, but `next.config.js`'s
  `eslint.ignoreDuringBuilds: true` already suppresses it, so the frontend already
  behaves the way the backend is being changed to behave).
- [x] Verify by deliberately introducing a lint-error-worthy line (e.g. a Prettier
  formatting violation the `prettier/prettier` rule flags at `error` severity, same
  technique story 1.6 used) in `backend/src`, running
  `docker build -f backend/Dockerfile --target builder .`, and confirming the build now
  **succeeds** (where before this story it would have failed at the lint step). Revert
  the deliberate violation afterward. Confirm `pnpm --filter @portfolio/backend lint`
  still reports it when run directly (lint still works, it just doesn't gate).

## Technical Notes

- Exact current stage layout: `backend/Dockerfile` stages are `base` -> `deps` ->
  `common-build` -> `dev` -> `builder` -> `deploy` -> `prod`. Both lines removed here sit
  in `common-build` and `builder` respectively; `dev`, `deploy`, and `prod` carry no lint
  step today and need no edit.
- Raising the two `'warn'`-level backend lint rules to `'error'` is unrelated to this
  story - it's about rule severity, not build-failing behavior, and is out of scope here
  same as it was for story 1.6.

## Out of Scope

- FR-21's staleness check - story 9.4a.
- Any adoption of the generated types by a frontend consumer - stories 9.5/9.6.
- Adding any GitHub Actions workflow or pre-commit hook - unrelated to this story's
  change (D39/D48, decided at the architecture level).

## Dev Notes

`backend/package.json` and `packages/shared/package.json` `lint` scripts were left
untouched - only the two Dockerfile `RUN` lines were removed. `frontend/Dockerfile` was
inspected and has no lint `RUN` line; confirmed `frontend/next.config.js` still sets
`eslint.ignoreDuringBuilds: true`.

### Changed Files

~ backend/Dockerfile   removed the `common-build` and `builder` stage `RUN ... lint` lines (D40); build now gates on type checking (via `nest build`/`tsc`) only

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no errors.
- `pnpm --filter @portfolio/backend lint` - passed with one pre-existing warning
  (`@typescript-eslint/no-floating-promises` in `main.ts`), no errors.
- Deliberately broke `backend/src/main.ts`'s formatting (split an import statement's
  trailing semicolon onto its own line, a `prettier/prettier` `error`-severity
  violation). Ran `pnpm --filter @portfolio/backend lint` directly: it reported the
  violation as an error and exited 1, confirming lint still works when invoked
  directly. Ran `docker build -f backend/Dockerfile --target builder .` with the
  violation still present: the build completed successfully (`common-build`'s
  `RUN pnpm --filter @portfolio/shared build` and `builder`'s
  `RUN pnpm --filter @portfolio/backend build` both ran and the image was exported),
  confirming the lint step no longer gates the build. Reverted the violation
  afterward; `git diff --stat backend/src/main.ts` shows no changes remaining.
