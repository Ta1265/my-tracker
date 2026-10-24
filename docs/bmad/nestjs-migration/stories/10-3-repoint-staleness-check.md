# Story 10.3: Re-point the FR-21 staleness check, retire the types half

Status: Done

## Context

Lands before any adoption story (architecture: "10.3 lands before any adoption story,
exactly as 9.4 did, and for the same reason: once components import generated symbols, a
stale generated file is a broken app rather than a stale file"). Depends on stories 10.1
and 10.2: the Orval config and the real mutator must exist and be correct before the
staleness check can regenerate against them. This story also ends the transient breakage
story 10.1 introduced - `TARGET=prod docker compose build` fails on the frontend image
from story 10.1 until this story lands.

The backend link of the FR-21 chain (`backend/Dockerfile`'s `--only=spec` check) is
**completely unchanged** by this story. Only the frontend link changes: it swaps its
generator from `openapi-typescript` to Orval and its comparison target from
`frontend/types/api.d.ts` to `frontend/src/api/generated.ts`.

## Acceptance Criteria

### A. `scripts/generate-api-contract.mjs`: replace the types half with a client half

- [x] Rename the `--only=types` branch to `--only=client` (keep `--only=spec` and
  `--only=both` behavior otherwise unchanged; `both` now means spec + client). Replace
  `generateTypesDeclaration()`'s `openapi-typescript` call with an Orval invocation that
  regenerates `frontend/src/api/generated.ts` from `backend/openapi.json` using the same
  `orval.config.ts` story 10.1 created - **one code path produces the committed bytes**;
  do not add a second entry point that calls `orval` directly anywhere else (D56).
- [x] `--check` regenerates into a **sibling scratch directory at equal depth**,
  `frontend/src/.api-check/`, with the check-time Orval config's mutator path pointed at
  the same-named file inside that directory, so the emitted import specifier is
  `./http-client` in both the real and the check run. Regenerating into a directory at a
  different depth (e.g. a plain temp directory) emits a different relative specifier
  (`../api/http-client`, or more `../` segments) and fails the byte-compare on that one
  import line even when the contract is perfectly current - this is the exact trap
  architecture D55 records from the spike, verify it does not reproduce here by running
  `--check` once with the geometry correct and confirming a pass against an unchanged
  tree.
- [x] The scratch directory is removed after the check runs and is git-ignored (add
  `frontend/src/.api-check/` to `.gitignore`). `clean: false` applies to the check-time
  config too, for the same reason as the real one.
- [x] `--check` still fails with a message naming the file and the fix command (matching
  story 9.2's format): `frontend/src/api/generated.ts is stale - run \`pnpm spec:generate\`
  and commit the result`.
- [x] Delete `frontend/types/api.d.ts` and the code that generated it. Do not delete
  `frontend/types/contracts.ts` yet - it still has live consumers until story 10.6.

### B. Root scripts, unchanged wiring

- [x] `spec:generate`, `spec:check`, and `spec:watch` in the root `package.json` are
  **not renamed** - they still invoke `scripts/generate-api-contract.mjs` with no
  arguments (both halves) or `--check` (both halves). Confirm `pnpm spec:generate` now
  regenerates both `backend/openapi.json` and `frontend/src/api/generated.ts` in one run,
  and `pnpm spec:watch` (`node --watch-path=backend/src ...`) still fires on a backend
  source edit and regenerates both.

### C. Dockerfiles

- [x] `backend/Dockerfile` - **no edit**. Confirm by re-reading it that the existing
  `--check --only=spec` step in the `builder` stage is untouched.
- [x] `frontend/Dockerfile`'s `builder` stage - change the existing
  `RUN node scripts/generate-api-contract.mjs --check --only=types` line (before
  `next build`) to `--check --only=client`.
- [x] `frontend/Dockerfile`'s `common-build` stage gains one new line,
  `COPY orval.config.ts ./orval.config.ts`, alongside the existing
  `COPY tsconfig.base.json ./tsconfig.base.json` (see Technical Notes for why it belongs
  in `common-build` rather than `builder`). This is the only other line either Dockerfile
  gains; `dev` and `deploy`/`prod` need no edit of their own - `dev` never runs the
  script, and `prod` inherits from `builder`.

### D. Verification: the failure fires, and the production build is restored

- [x] Deliberately rename one DTO field in backend source without regenerating, run
  `TARGET=prod docker compose build`, and confirm the `next-app` image build fails at the
  new `--only=client` step with a message naming `frontend/src/api/generated.ts` and the
  fix command. Revert the rename.
- [x] With both artifacts genuinely current, `TARGET=prod docker compose build` succeeds
  end to end for both services - this confirms story 10.1's transient breakage is
  resolved.
- [x] `docker build -f backend/Dockerfile --target dev .` and
  `docker build -f frontend/Dockerfile --target dev .` both succeed with no staleness
  check invoked in either.

## Technical Notes

- Current script structure (story 9.2/9.4a): `runSpecHalf()` generates/checks
  `backend/openapi.json` via Nest preview mode against the compiled `backend/dist`;
  `runTypesHalf()` (being replaced here) generates/checks `frontend/types/api.d.ts` via
  `openapi-typescript`. Both are driven by `--only=` parsing already present in the file
  (`const only = onlyArg ? onlyArg.slice('--only='.length) : 'both';`) - this story edits
  that one file's client half, not its overall shape.
- `frontend/Dockerfile`'s `builder` stage already does
  `COPY backend/openapi.json ./backend/openapi.json` and `COPY scripts ./scripts` ahead of
  the staleness-check `RUN` line (story 9.4a) - no new `COPY` is needed for those two.
  `frontend/src/api/http-client.ts` is already reached by `common-build`'s existing
  `COPY frontend/src ./frontend/src`. **`orval.config.ts` is not copied anywhere today**
  - `common-build`'s manifest-copy block (lines 14-15, 32-43) lists every other root and
  frontend config file it needs but not this one, since it did not exist before story
  10.1. Add `COPY orval.config.ts ./orval.config.ts` to `common-build`, alongside the
  existing `COPY tsconfig.base.json ./tsconfig.base.json` line - `common-build` rather
  than `builder` because `orval.config.ts` also needs to be present for local `pnpm
  spec:generate`/`spec:watch` runs against a `dev`-target container, and both stages
  descend from it.
- No CI workflow builds either production image except `deployment.yml`, which builds
  `frontend/Dockerfile` with no `target:` (so it goes through `builder` to `prod`) on
  every push to `main` - unchanged by this story, still the same as D39/D45 already
  describe.

## Out of Scope

- Any change to `orval.config.ts`'s content or the mutator's behavior - stories 10.1 and
  10.2 own those; this story only wires the existing generation into the shared script and
  the Dockerfile.
- Deleting `frontend/types/contracts.ts` - story 10.6, once its last consumer is gone.
- Any frontend consumer adopting a generated hook - stories 10.4-10.6.

## Dev Notes

Known transient consequence, not fixed here (out of scope per this story): deleting
`frontend/types/api.d.ts` leaves `frontend/types/contracts.ts:4`'s
`import type { components, paths } from './api'` unresolved, so `tsc --noEmit` on the
frontend now reports one new error there. This is the intended state until story 10.6
retires `contracts.ts` - the frontend Dockerfile never runs `tsc` (`next.config.js` sets
`typescript.ignoreBuildErrors: true`), so it does not affect any build. Confirmed via a
before/after `pnpm --filter @portfolio/frontend typecheck` diff: this is the only new
line, everything else is pre-existing.

**Epic fix round addendum**: everything this story built - the staleness check itself,
`scripts/generate-api-contract.mjs`, and both Dockerfiles' `--check` steps - was
deleted by an epic-level owner-feedback round. The owner ruled that keeping generated
output current is the developer's responsibility at commit time, with no staleness
check in any build. See the epic's Review Notes for the full change.

### Changed Files

- scripts/generate-api-contract.mjs   fix round: deleted entirely - no staleness check remains in any build
~ frontend/Dockerfile                 fix round: `builder`'s staleness-check RUN and `common-build`'s `COPY orval.config.ts` both removed
~ .gitignore                          fix round: the check-time scratch-dir ignore (`frontend/src/.api-check/`) removed, now dead
- frontend/types/api.d.ts             retired openapi-typescript output, superseded by frontend/src/api/generated.ts (10.1/10.2)

### Verification

- `pnpm --filter @portfolio/backend build` then `pnpm spec:generate` - regenerates
  both `backend/openapi.json` and `frontend/src/api/generated.ts` in one run, no diff
  against the committed files.
- `pnpm spec:check` - both halves report up to date; confirms the client `--check` run
  passes against an unchanged tree with the scratch-dir geometry in place (the D55 trap
  does not reproduce).
- `node scripts/generate-api-contract.mjs --check --only=client` run standalone -
  passes; scratch dir `frontend/src/.api-check/` confirmed removed after the run.
- Deliberately renamed `LoginRequestDto.rememberMe` to `rememberMeStaleTest` (DTO +
  its one controller reference), regenerated only `backend/openapi.json`
  (`--only=spec`), left `frontend/src/api/generated.ts` untouched, then ran
  `TARGET=prod docker compose build next-app` - failed at the new
  `--only=client` step with `frontend/src/api/generated.ts is stale - run
  \`pnpm spec:generate\` and commit the result`, exit code 1. Reverted the rename and
  `backend/openapi.json` via `git checkout`, rebuilt `backend/dist`, and reconfirmed
  `pnpm spec:check` passes clean.
- `TARGET=prod docker compose build` (no service filter, both `next-app` and
  `nest-api`, plus `nginx`) - all three images built successfully end to end. This is
  the story's headline check: story 10.1's transient production-build break is
  resolved.
- `docker build -f backend/Dockerfile --target dev .` - succeeds (backend
  `--only=spec` check is not part of the `dev` target, unchanged by this story).
- `docker build -f frontend/Dockerfile --target dev .` - succeeds; no staleness check
  runs on the `dev` path.
- `pnpm spec:watch` run in the background, then `touch
  backend/src/auth/dto/login-request.dto.ts` - fired a restart and regenerated both
  `backend/openapi.json` and `frontend/src/api/generated.ts`.
- `pnpm --filter @portfolio/frontend typecheck` - no new errors except the expected
  `frontend/types/contracts.ts` one described above (verified via before/after diff of
  the full error list); `pnpm --filter @portfolio/frontend lint` - exit 0, only
  pre-existing warnings.
- `pnpm --filter @portfolio/backend typecheck` - exit 0. `pnpm --filter
  @portfolio/backend lint` - exit 0, one pre-existing warning in `main.ts` unrelated to
  this change.
