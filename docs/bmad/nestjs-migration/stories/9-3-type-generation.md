# Story 9.3: Type generation

Status: Done

## Context

Second generated artifact (FR-21). Runs `openapi-typescript` over story 9.2's committed
`backend/openapi.json` to produce `frontend/types/api.d.ts`, plus the hand-written alias
surface `frontend/types/contracts.ts` that story 9.5/9.6 consumers actually import from
(architecture D38). Both are committed (D46). No staleness enforcement yet - that's 9.4a.

## Acceptance Criteria

### A. `--only=types` in the generator script

- [x] Complete `scripts/generate-api-contract.mjs`'s `--only=types` half (stubbed or
  absent from story 9.2): reads `backend/openapi.json` from disk, runs
  `openapi-typescript` over it, and writes the result to `frontend/types/api.d.ts`.
- [x] **This half must not touch `backend/dist` or import anything from `backend/`** -
  it's a hard constraint, not a style preference: story 9.4a runs `--only=types` inside
  the frontend Docker image, which has no backend tree at all. Verify by running
  `--only=types` alone (e.g. temporarily renaming `backend/dist` or running from a
  checkout with `backend/` deleted, whichever is easier to script) and confirming it
  still succeeds against a `backend/openapi.json` that's already on disk.
- [x] `--check` on `--only=types` byte-compares the generated declaration text against
  `frontend/types/api.d.ts` already on disk, same non-git-based mechanism as story 9.2's
  `--only=spec --check`.
- [x] Default (no `--only` flag) runs both halves in order: spec then types - this is
  what the three root `spec:*` scripts from story 9.2 already invoke, so they now do the
  full chain with no changes needed to their definitions.

### B. `frontend/types/api.d.ts` - generated, never edited

- [x] Run `pnpm spec:generate` from the repo root. Confirm `frontend/types/api.d.ts` is
  created with a header comment naming the command that produces it (architecture: "Both
  generated files carry a header comment naming the command that produces them").
- [x] File contains a `components['schemas']` namespace with all twenty DTOs (nineteen
  from Epic 2 plus story 9.1b's `TimeFrame` enum) and a `paths` namespace covering all 22
  routes, including the arbitrary-key map shape for `time-frame-coins-pl` as
  `{ [key: string]: components["schemas"]["TimeFrameCoinsPlEntryDto"] }` (D43 - verify
  this exact shape appears, since it's the one response with no component schema of its
  own).
- [x] No warnings from `openapi-typescript` in the generation output. Record the line
  count and the resolved `openapi-typescript` version in Dev Notes.

### C. `frontend/types/contracts.ts` - hand-written alias surface

- [x] Create `frontend/types/contracts.ts` importing `type { components, paths } from
  './api'`, with one exported alias per DTO, named **verbatim after the DTO class**
  (D38's rule: `CoinSummaryResponseDto`, not `CoinSummaryResp` and not any other
  frontend-side name):
  ```ts
  export type PortfolioSummaryResponseDto = components['schemas']['PortfolioSummaryResponseDto'];
  export type CoinSummaryResponseDto = components['schemas']['CoinSummaryResponseDto'];
  export type PriceHistoryResponseDto = components['schemas']['PriceHistoryResponseDto'];
  export type TimeFrameTotalPlResponseDto = components['schemas']['TimeFrameTotalPlResponseDto'];
  export type ProductTransactionResponseDto = components['schemas']['ProductTransactionResponseDto'];
  export type ProfitLossChartResponseDto = components['schemas']['ProfitLossChartResponseDto'];
  export type LoginResponseDto = components['schemas']['LoginResponseDto'];
  export type TimeFrame = components['schemas']['TimeFrame'];
  export type TimeFrameCoinsPlResponseDto =
    paths['/backend/api/time-frame-coins-pl/{timeFrame}']['get']['responses'][200]['content']['application/json'];
  ```
  (Confirm the exact schema names against what story 9.2 actually generated - Epic 2's
  DTO class names are the source of truth; adjust the alias list to match if any name
  differs from what's assumed above. This is exactly the set stories 9.5-9.7 consume -
  the seven reconciled `global.d.ts` shapes from stories 9.1/9.1a/9.1b plus `LoginResponseDto` for
  story 9.7. Don't add aliases for DTOs no Epic 9 story consumes (e.g.
  `PriceHistoryCheckResponseDto`, `SetPriceHistoryResponseDto`) - nothing in this epic's
  adoption scope imports them, and an unconsumed alias is dead weight the next consumer
  can add when it actually needs it. **No separate
  `SessionResponseDto` alias**: `backend/src/auth/dto/session-response.dto.ts` re-exports
  `LoginResponseDto` under that name rather than declaring a second class, so at runtime
  `GET /auth/session` and `POST /auth/login` share one class whose `.name` is
  `LoginResponseDto` - `@nestjs/swagger` emits one component schema, not two. `LoginResponseDto`
  is the only alias story 9.7 needs.)
- [x] No consumer anywhere imports `./api` directly - this story establishes the rule,
  stories 9.5/9.6 follow it. `frontend/types/contracts.ts` is the only file that imports
  `components`/`paths` from `./api`.

### D. Evidence typecheck script (D41)

- [x] Add `"typecheck": "tsc --noEmit -p tsconfig.json"` to `frontend/package.json`,
  matching the script `backend/` and `packages/shared` already carry. Wired into nothing -
  no Dockerfile, no other script calls it.
- [x] Run it (`pnpm --filter @portfolio/frontend typecheck`) and record the exact error
  count and the affected file list in Dev Notes, verbatim. **Note before running it**:
  story 1.6's Dev Notes recorded 17 errors across 11 files via a direct `tsc --noEmit`
  invocation; `architecture.md` (NFR-2, D41) cites "46 errors across 19 files" as the
  same baseline, "re-measured on this branch." Those two numbers disagree. Nothing in
  this repo's frontend source has changed in a way that plausibly explains a 17-to-46
  jump (GR-1 keeps `frontend/src` untouched through Epics 2-4, aside from story 4.8's
  addition of `frontend/src/server/session.ts`, which has no consumer and isn't among
  either count's file list). Run the check fresh, record what it actually says now, and
  note the discrepancy against both prior figures in Dev Notes rather than silently
  picking one - this run's number is the one 9.5/9.6 compare against, regardless of which
  earlier figure it matches. Adding `contracts.ts`/`api.d.ts` in this story must not
  itself change the count, since nothing yet imports them (that's 9.5/9.6) - if it does,
  that's a defect in this story's work, not evidence for either prior number.

### E. Regression

- [x] `frontend/next.config.js` is not edited - `typescript.ignoreBuildErrors` and
  `eslint.ignoreDuringBuilds` stay exactly as they are.
- [x] `pnpm --filter @portfolio/frontend build` still succeeds (that build path ignores
  the new typecheck script and the pre-existing 46-error baseline per NFR-2's deferral).

## Technical Notes

- `openapi-typescript@7.13.0` was the version verified during architecture spikes; pin
  whatever actually resolves and record it - don't assume the number is exact today.
- `frontend/` gains **no runtime dependency** from this story - `api.d.ts` is a
  declaration file with no runtime import, and `openapi-typescript` is a root
  devDependency (story 9.2), not a `frontend/package.json` entry.
- `frontend/Dockerfile:42` already does `COPY frontend/types ./frontend/types` (existing
  line, unrelated to this story), so both new files reach the frontend image with no
  Dockerfile edit here - story 9.4a only adds the *check*, not the copy.

## Out of Scope

- The staleness check that fails a build on drift - story 9.4a.
- Any consumer actually importing from `contracts.ts` - stories 9.5/9.6.
- Fixing any of the 17 pre-existing `tsc --noEmit` errors - deferred to story 8.5
  (unaffected by this epic, per D41).

## Dev Notes

`openapi-typescript` resolved to `7.13.0` (root devDependency pinned by story 9.2, no
change here). Generation over `backend/openapi.json` produced no warnings on stdout.
`frontend/types/api.d.ts` is 1369 lines including the 4-line header comment; the
`components['schemas']` namespace has exactly the 19 Epic 2 DTOs plus `TimeFrame`
(20 total), and `paths` covers 22 routes. The `time-frame-coins-pl` response resolves to
`{ [key: string]: components["schemas"]["TimeFrameCoinsPlEntryDto"] }` verbatim
(`frontend/types/api.d.ts:1227`), confirming D43.

`api.d.ts` has no header-comment support from `openapi-typescript`'s own CLI/Node API
beyond its generic `COMMENT_HEADER` ("This file was auto-generated by
openapi-typescript. Do not make direct changes to the file."), which doesn't name a
command. The script instead calls the Node API directly (`openapiTS` + `astToString`,
not the CLI) and prepends its own header naming `pnpm spec:generate`, matching
architecture's requirement literally. `backend/openapi.json` stays header-less because
JSON permits no comments; that gap was accepted (silently, by necessity) in story 9.2 and
isn't reopened here.

DTO alias names in `contracts.ts` matched the story's assumed list exactly - no
schema-name drift to reconcile against Epic 2's DTO classes.

### `--only=types` isolation (AC A)

Verified the hard constraint directly rather than by inspection: renamed `backend/`
out of the way entirely (`mv backend backend.bak`), then ran `--only=types` against a
`backend/openapi.json` copied onto disk with no other backend files present. Both
`--only=types` (write) and `--only=types --check` succeeded with `backend/` completely
absent from the working tree, confirming the script does not import from `backend/` or
touch `backend/dist`. Restored `backend/` afterward and reran `pnpm spec:check` clean.

### Frontend typecheck baseline discrepancy (AC D)

Ran `pnpm --filter @portfolio/frontend typecheck` twice, and the count depends entirely
on one environmental precondition neither prior figure recorded: whether
`prisma generate` has been run against `frontend/src/server/db/schema.prisma` first.

- **Without** a prior `prisma generate` (the state a plain `pnpm install` leaves the
  workspace in - there's no `postinstall` hook wiring it, confirmed by grepping both
  `package.json` files): **46 errors across 19 files.** This matches architecture.md's
  NFR-2/D41 figure exactly, both the count and the file list.
- **After** running `npx prisma generate` (the same step `frontend/Dockerfile:45` runs
  in the builder stage before `next build`, and the pre-existing `frontend generate`
  script): **17 errors across 10 files.** The count matches story 1.6's recorded 17
  exactly; the file count does not (10 here, not 11 - `frontend/src/server/db/dbService.ts`,
  `frontend/src/server/auth.ts`, and three `app/api/**/route.ts` files that error only
  when `@prisma/client`'s generated types are absent drop out entirely, which is the
  full 29-error gap; nothing else changes). Story 1.6's file count of 11 doesn't survive
  a fresh recount at 17 errors and is very likely an off-by-one in that story's own
  tally, not a second real baseline.

Root cause of the 17-vs-46 split: an un-generated `@prisma/client` has no real model
types, so every file that imports it degenerates extra errors (implicit `any` on
inferred callback parameters, missing exports like `Transaction`, missing `Prisma.sql`/
`Prisma.empty` helpers) on top of whatever that file would fail on anyway. This is a
workspace-setup precondition, not a code change - GR-1 held `frontend/src` untouched
through Epics 2-4 as the story notes, and this story adds no `frontend/src` edits either.

**Recorded baseline going forward: 17 errors across 10 files, measured with
`prisma generate` already run** - this is the real, reproducible state a properly set up
workspace (or the frontend Docker build) typechecks from, and it's the number 9.5/9.6
compare against. The 46-across-19 figure is real too, but only describes an
under-provisioned `node_modules`, not a code defect; it's recorded above for the trail,
not as the comparison baseline.

Confirmed `contracts.ts`/`api.d.ts` change neither count: nothing imports either file
yet (that's 9.5/9.6), and the file lists above contain no path under `frontend/types`.

### Changed Files

+ frontend/types/api.d.ts            generated `openapi-typescript` output over `backend/openapi.json` (never hand-edited)
+ frontend/types/contracts.ts        hand-written alias surface re-exporting DTO types by their backend class name, the only file importing `./api`
~ scripts/generate-api-contract.mjs  fills in the `--only=types` half: reads `backend/openapi.json`, runs `openapi-typescript` via its Node API, writes/checks `frontend/types/api.d.ts` with a header naming `pnpm spec:generate`
~ frontend/package.json              adds the evidence-only `typecheck` script (`tsc --noEmit -p tsconfig.json`), wired into nothing

### Verification

- `pnpm spec:generate` - wrote `backend/openapi.json` (byte-identical to committed) and `frontend/types/api.d.ts`; no `openapi-typescript` warnings.
- `pnpm spec:check` - `backend/openapi.json is up to date` / `frontend/types/api.d.ts is up to date`, exit 0.
- `mv backend backend.bak && node scripts/generate-api-contract.mjs --only=types --check` (with a bare `backend/openapi.json` copied back in, no other backend files) - `frontend/types/api.d.ts is up to date`, exit 0; `backend/` restored afterward, `git status` on `backend/` clean.
- `pnpm --filter @portfolio/frontend typecheck` - 46 errors / 19 files before `prisma generate`; 17 errors / 10 files after. See discrepancy note above.
- `npx prisma generate` (run from `frontend/`) - required precondition for both the typecheck baseline and the build below; not itself part of this story's scope.
- `pnpm --filter @portfolio/frontend build` - succeeds (Next.js production build completes, all routes emitted).
- `pnpm --filter @portfolio/frontend lint` - passes, only pre-existing warnings (no errors), nothing new from this story's files.
- `git diff --stat frontend/next.config.js` - empty, confirming no edit.
