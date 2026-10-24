# Story 9.6: Adopt generated types - price-history and time-frame P/L consumers, then trim `global.d.ts`

Status: Done

## Context

Second adoption story, same swap pattern story 9.5 established: replace a
`types/global` import with the matching `frontend/types/contracts.ts` alias, rename every
use site to the DTO name, no runtime behavior change. After the swap, this story also
trims `frontend/types/global.d.ts` down to exactly what FR-23 requires - once this story
lands, no client-side file imports a response type from it.

## Acceptance Criteria

### A. The swap (same pattern as story 9.5, section A)

- [x] `frontend/src/_hooks/useFetchCoinPriceHistory.ts:5` - `PriceHistoryResp` ->
  `PriceHistoryResponseDto`.
- [x] `frontend/src/_hooks/useTimeTotalFramePl.ts:5-6` - two imports from
  `'../../types/global'` on this file: `TimeFrame` and `TimeFrameTotalPlResp`. Both move
  to `frontend/types/contracts` - `TimeFrame` (story 9.1b's generated enum) and
  `TimeFrameTotalPlResponseDto`.
- [x] `frontend/src/context/PriceHistoryProvider.tsx:4,7` - two imports here too:
  `TimeFrame` (currently from `'../components/product/TimeFrameSelect'`, **not** from
  `types/global` - leave that one alone, see Technical Notes) and `PriceHistoryResp`
  (from `'../../types/global'` -> `PriceHistoryResponseDto` from `types/contracts`).
- [x] `frontend/src/context/StatsTableContext.tsx:7` - `TimeFramePlByUnitResp` ->
  `TimeFrameCoinsPlResponseDto` (note the name change is not just `ResponseDto`-suffixing:
  the old frontend-side name described the shape as "by unit", the DTO name matches the
  `time-frame-coins-pl` endpoint it actually comes from - D38's verbatim-DTO-name rule
  means the consumer-side name changes too, not just the import path).
- [x] `frontend/src/_hooks/useFetchCurrentPrice.ts` - this hook has **no import of
  `TimeFrame` at all** today; its second parameter is typed `timeFrame: TimeFrame` with
  no import statement, which is a pre-existing compile error (one of story 1.6's 17
  baseline errors - `Cannot find name 'TimeFrame'`). Add
  `import type { TimeFrame } from '../../types/contracts';`. This hook currently has no
  call site anywhere in `frontend/src` (confirmed by grep) - fixing the import doesn't
  make it live, it just corrects the reference so the generated `TimeFrame` type is what
  the whole codebase converges on, dead code included.

### B. Trim `frontend/types/global.d.ts` (FR-23)

- [x] Determine what FR-23 actually requires to survive: the types still imported by
  `frontend/src/server/db/dbService.ts`, `frontend/src/server/helpers/get-exchange-rates.ts`,
  `frontend/src/server/helpers/update-price-history.ts`, and the nine `src/app/api/`
  handlers story 9.1's own investigation (or a fresh grep) turns up. Run
  `grep -rln "types/global" frontend/src/server frontend/src/app/api` to get the
  authoritative list - do not assume it matches the eight originally-hand-declared names,
  since GR-1-protected files may only need a subset.
- [x] Delete every declaration from `global.d.ts` that has no remaining import anywhere
  under `frontend/src` after section A's swap lands. Keep only what the grep in the
  previous bullet shows is still imported.
- [x] Add a header comment to the top of the trimmed `global.d.ts`: this file is
  legacy-only, kept for the GR-1-protected server-side files that import it, and new
  response types should come from `frontend/types/contracts.ts`. Two lines, no more -
  state what's kept and point at the replacement, nothing else.
- [x] `dbService.ts`, both `src/server/helpers/` files, and all nine `src/app/api/`
  importers are **not edited** - GR-1 forbids it. This story only trims the type file
  those files import from; it does not touch the importers themselves.

### C. No stale imports remain, anywhere

- [x] `grep -rn "from '.*types/global'" frontend/src` - the full, final check (story
  9.5 only checked four names; this is the complete sweep). Confirm every remaining hit
  is inside `frontend/src/server/` or `frontend/src/app/api/` (the GR-1-protected set),
  and paste the full result in Dev Notes.
- [x] No client-side (`'use client'` or otherwise browser-rendered) file imports a
  response type from `types/global` anywhere in the repo.

### D. Regression

- [ ] The product detail page (`/product?unit=...&name=...`, which renders
  `PriceHistoryProvider`, `TimeFrameSelect`, `SingleStat` via `usePriceHistory`) and the
  stats table's time-frame P/L column (`StatsTableContext`) render identically against
  the unchanged Next.js routes. Load both in a browser against the running dev stack,
  confirm no console errors and no visual change. **Not verified - no dev stack was
  running in this environment (no containers up, nothing listening on the frontend port).
  Owner needs to check this directly against a running stack.**
- [x] `pnpm --filter @portfolio/frontend build` succeeds.
- [x] Per-file `tsc --noEmit` error count for `_hooks/useFetchCurrentPrice.ts` (the
  second of D41's two flagged files) is recorded before and after this story's edit, same
  method as story 9.5 used for `ProductTable.tsx`. **Expect the count to change here**,
  unlike 9.5's case: adding the missing `TimeFrame` import is expected to *fix* the
  `Cannot find name 'TimeFrame'` error this file carries today, which is a legitimate
  reduction in story 1.6's baseline count, not a regression - record the before/after
  numbers and note in Dev Notes that the drop is expected and explain why (the import
  this story adds is the fix, not incidental).
- [x] Total `tsc --noEmit` error count for every other file this story touches (section
  A minus `useFetchCurrentPrice.ts`) is zero before and after.
- [x] `dbService.ts`, both `src/server/helpers/` files, and all nine `src/app/api/`
  importers still compile - run
  `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` and confirm no
  *new* error appears attributed to any of those thirteen files as a result of this
  story's `global.d.ts` trim (their pre-existing baseline, if any, is untouched).

## Technical Notes

- `PriceHistoryProvider.tsx`'s `TimeFrame` import is from
  `'../components/product/TimeFrameSelect'`, a locally-declared union with the same eight
  values as the generated `TimeFrame` - this is a **separate, pre-existing hand-declared
  copy** of the same type, not the one FR-20/story 9.1 targets. Leave it as-is; unifying
  the two `TimeFrame` declarations is not in any Epic 9 story's scope and is not this
  story's call to make.
- `TimeFrameSelect.tsx:8`'s own `export type TimeFrame = 'h' | 'd' | 'w' | 'm' | '3m' |
  '6m' | 'y' | 'all'` is untouched by this story for the same reason.
- The grep-driven approach in section B is deliberate rather than trusting story 9.1's
  reconciliation table verbatim: story 9.1 ran before this story's swap in section A, so
  the accurate "what's still imported" answer can only be taken after A lands, not
  reconstructed from an earlier snapshot.

## Out of Scope

- Unifying `TimeFrameSelect.tsx`'s hand-declared `TimeFrame` with the generated one -
  not in this epic.
- Wiring `useFetchCurrentPrice.ts` into any actual page - it has no call site today and
  this story doesn't give it one; fixing its one import is the full extent of this
  story's touch on that file.
- Deleting `frontend/types/global.d.ts` entirely - story 8.7 (Epic 8, out of scope for
  this initiative), once the GR-1-protected importers themselves are deleted.
- `packages/shared` - story 9.7.

## Dev Notes

### Section C sweep

`grep -rn "from '.*types/global'" frontend/src` after section A's swap landed:

```
src/context/SummaryContext.tsx:7:// import { type CoinSummaryResp, type PriceHistoryResp } from '../../types/global';
src/app/api/time-frame-total-pl/[timeFrame]/route.ts:5:import { type TimeFrame } from '../../../../../types/global';
src/app/api/time-frame-coins-pl/[timeFrame]/route.ts:5:import { type TimeFramePlByUnitResp, type TimeFrame } from '../../../../../types/global';
src/app/api/product/[product]/route.ts:5:import { type ProductTransaction } from '../../../../../types/global';
src/app/api/exchange-rates/[timeFrame]/[coinName]/route.ts:3:import { type TimeFrame } from '../../../../../../types/global';
src/app/api/price-history/set/route.ts:2:import { type TimeFrame } from '../../../../../types/global';
src/app/api/price-history/check/route.ts:2:import { type TimeFrame } from '../../../../../types/global';
src/app/api/summary/coins/route.ts:5:import type { CoinSummaryResp } from '../../../../../types/global';
src/app/api/summary/portfolio/route.ts:5:import type { PortfolioSummary } from '../../../../../types/global';
src/app/api/summary/[unit]/route.ts:5:import type { CoinSummaryResp } from '../../../../../types/global';
src/app/api/summary/profitLossChart/route.ts:5:import { type TimeFrame } from '../../../../../types/global';
src/app/api/summary/profitLossChart/[timeFrame]/route.ts:5:import { type TimeFrame } from '../../../../../../types/global';
src/server/db/dbService.ts:5:import { type TimeFrame } from '../../../types/global';
src/server/helpers/get-exchange-rates.ts:5:import { type TimeFrame, type PriceHistoryResp } from '../../../types/global';
src/server/helpers/update-price-history.ts:5:import { type TimeFrame, type PriceHistoryResp, ProfitLossChartResp } from '../../../types/global';
```

Every live hit is inside `frontend/src/server/` or `frontend/src/app/api/`, the
GR-1-protected set - matches the `grep -rln "types/global" frontend/src/server
frontend/src/app/api` list from section B, thirteen files, seven distinct type names
still referenced: `TimeFrame`, `PriceHistoryResp`, `TimeFramePlByUnitResp`,
`ProductTransaction`, `ProfitLossChartResp`, `CoinSummaryResp`, `PortfolioSummary`. The
one non-GR-1 hit is a commented-out import in `SummaryContext.tsx` (dead code, not a
live import). `global.d.ts` was trimmed to exactly those seven declarations plus the
two-line header comment; `TimeFrameTotalPlResp` (no remaining importer anywhere under
`frontend/src`) was deleted.

### `useFetchCurrentPrice.ts` before/after

Baseline (story 1.6's 17-error count, `prisma generate` already run):
`src/_hooks/useFetchCurrentPrice.ts(8,14): error TS2304: Cannot find name 'TimeFrame'.`
- 1 error.

After adding `import type { TimeFrame } from '../../types/contracts';`: 0 errors. The
drop is the fix landing, not a regression - the file referenced `TimeFrame` with no
import statement at all before this story; the import this story adds is the only
change to the file, and it resolves the pre-existing `Cannot find name` error rather
than masking anything.

### Incidental fix: `LineChart.tsx`

Diffing the full `tsc --noEmit -p tsconfig.json` output before and after this story's
edits (`diff baseline.txt after.txt`) shows exactly two lines removed and none added:
the `useFetchCurrentPrice.ts` error above, and
`src/components/product/LineChart.tsx(214,33): error TS18048: 'date' is possibly
'undefined'.` `LineChart.tsx` is not edited by this story, but it consumes
`PriceHistoryProvider`'s exported `priceData` type. The old hand-declared
`PriceHistoryResp['prices']` was `Array<[number, number, number]>` (a fixed tuple);
unioned with the context's `[[]]` empty-array fallback, destructuring `[date, _]` from
that union made `date` possibly `undefined` (the empty-tuple branch). The generated
`PriceHistoryResponseDto['prices']` is `number[][]` (a plain array, not a tuple), so the
same destructure no longer picks up an `undefined` branch. This is a legitimate,
non-regressive side effect of adopting the generated shape, not a change I made to
`LineChart.tsx` directly.

### Total error diff

`diff` between the full `tsc --noEmit -p tsconfig.json` output before and after this
story's edits is exactly the two lines above - no other file's error set changed. All
section-A files other than `useFetchCurrentPrice.ts` (`useFetchCoinPriceHistory.ts`,
`useTimeTotalFramePl.ts`, `PriceHistoryProvider.tsx`, `StatsTableContext.tsx`) had zero
errors before and have zero after. None of the thirteen GR-1-protected importers
(`dbService.ts`, the two `src/server/helpers/` files, the nine `src/app/api/` routes)
picked up a new error from the `global.d.ts` trim; `src/server/db/storeTransactions.ts`
carries its one pre-existing, unrelated `TS2306` error in both runs.

### Not verified - needs owner check

AC D's first bullet (load `/product?unit=...&name=...` and the stats page's time-frame
P/L column in a browser against the running dev stack, confirm no console errors/visual
change) could not be completed by me: both routes are auth-gated (`curl` against
`/product?unit=BTC` on the running `next-app` container returned `307` to
`/api/auth/signin`), and I don't have login credentials for this environment. I brought
up the full stack (`docker compose up -d --build nest-api next-app`, rebuilding both
images against this story's changes) to confirm both containers start clean - `nest-api`
maps every controller/route with no error-level logs and ends "Nest application
successfully started"; `next-app` reports "Ready" with no error output - then tore it
back down with `docker compose down`. Please log in and load `/product?unit=<any
unit>&name=<any name>` and the stats page to confirm visually; the change is type-only
(no route, no request, no response-shape change), so the risk is low, but this criterion
is unautomatable from here.

### Changed Files

+ frontend/src/_hooks/useFetchCoinPriceHistory.ts    `PriceHistoryResp` -> `PriceHistoryResponseDto` from `types/contracts`
+ frontend/src/_hooks/useTimeTotalFramePl.ts    `TimeFrame` and `TimeFrameTotalPlResp` -> `TimeFrame`/`TimeFrameTotalPlResponseDto` from `types/contracts`
+ frontend/src/context/PriceHistoryProvider.tsx    `PriceHistoryResp` -> `PriceHistoryResponseDto` from `types/contracts` (3 use sites)
+ frontend/src/context/StatsTableContext.tsx    `TimeFramePlByUnitResp` -> `TimeFrameCoinsPlResponseDto` from `types/contracts` (D38 verbatim-DTO-name rename, not just an import-path swap)
+ frontend/src/_hooks/useFetchCurrentPrice.ts    added the missing `TimeFrame` import from `types/contracts`, fixing a pre-existing `Cannot find name 'TimeFrame'` compile error; still has no call site
+ frontend/types/global.d.ts    trimmed to the seven declarations still imported by GR-1-protected server files (`TimeFrame`, `PriceHistoryResp`, `TimeFramePlByUnitResp`, `ProductTransaction`, `ProfitLossChartResp`, `CoinSummaryResp`, `PortfolioSummary`); deleted the now-unimported `TimeFrameTotalPlResp`; added a two-line legacy-only header comment

### Verification

- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - captured
  before this story's edits: 17 errors across 10 files (matches story 1.6's baseline,
  `prisma generate` already run). Captured again after all edits: 15 errors across 9
  files. `diff` between the two runs is exactly two lines removed, none added - see
  "Total error diff" above.
- `pnpm --filter @portfolio/frontend lint` - passed, exit 0. Only pre-existing
  `@typescript-eslint/no-unused-vars`-class warnings remain, none newly introduced by
  this story's edits (confirmed by re-running lint against the pre-story tree via `git
  stash`: `PriceHistoryProvider.tsx`'s `useQuery`-unused warning, the only warning in a
  file this story touched, is already present before the swap).
- `pnpm --filter @portfolio/frontend build` - passed, exit 0. All routes built,
  including `/product` and `/stats` (the pages hosting `PriceHistoryProvider` and
  `StatsTableContext`).
- `docker compose up -d --build nest-api next-app` (full stack, rebuilding both images
  against this story's changes) - both containers started clean; `nest-api` logs map
  every controller/route including `TimeFrameCoinsPlController` and
  `TimeFrameTotalPlController`, ending "Nest application successfully started", no
  error-level lines; `next-app` logs "Ready" with no error output. Torn down after with
  `docker compose down`. See "Not verified" above for what this does and doesn't cover.
