# Story 9.5: Adopt generated types - summary, stats, and product consumers

Status: Done

## Context

First adoption story. Swaps hand-declared `types/global` imports for the
`frontend/types/contracts.ts` aliases story 9.3 built, in the summary/stats/product
consumer set. This story establishes the swap pattern; story 9.6 applies it verbatim to
the price-history/time-frame-P&L set. No runtime behavior changes anywhere in this story -
every consumer still calls the same Next.js route it calls today (`fetch('/api/...')`
untouched); only the declared TypeScript type of the response changes. GR-1 is
unaffected: none of these files are under `src/app/api/` or `src/server/`.

## Acceptance Criteria

### A. The swap pattern (established here, reused by 9.6)

For each file below: replace the `import type { X } from '../../types/global'` (or
whatever relative depth the file uses) with
`import type { XResponseDto } from '<relative path>/types/contracts'`, and rename every
local use of the old type name to the DTO name. Do not introduce a type alias/rename on
the frontend side (e.g. `import { CoinSummaryResponseDto as CoinSummaryResp }`) - use the
DTO name directly at every use site, matching D38's "the alias name is the DTO name,
verbatim" rule all the way through to the consumer, not just at the alias declaration.

- [x] `frontend/src/_hooks/useCoinSummaries.ts:4` - `CoinSummaryResp` ->
  `CoinSummaryResponseDto`. Return type of the `queryFn` and the hook's inferred type
  both follow from this one import change.
- [x] `frontend/src/components/Summary/SummaryContext.tsx:7` - `PortfolioSummary` ->
  `PortfolioSummaryResponseDto`. Note `PortfolioSummaryResponseDto.roi` is typed
  `number | null` (per story 9.1's reconciliation finding - the DTO documents the NaN
  -> null serialization that the hand-declared `PortfolioSummary.roi: number` missed).
  `SummaryContext.tsx:44-47` divides by `portfolioSummary?.totalPLatCurrentPrice` and
  reads `.roi` nowhere directly in this file - confirm no new type error appears from the
  narrower type; if one does, it's real (the field genuinely can be `null`) and should be
  handled with the same `?? 0`-style fallback the file already uses elsewhere, not
  silenced.
- [x] `frontend/src/components/SingleStat.tsx:6` - `CoinSummaryResp` ->
  `CoinSummaryResponseDto`.
- [x] `frontend/src/components/Summary/TotalChart/Layout.tsx:11` - `ProfitLossChartResp`
  -> `ProfitLossChartResponseDto`.
- [x] `frontend/src/components/product/ProductTable.tsx:13` - `ProductTransaction` ->
  `ProductTransactionResponseDto`. This file reads `original.side`, `.notes`
  (indirectly, via the `notes` accessor), and `cell.value` for `id` and `product` -
  fields story 9.1a added to the DTO precisely because this file (among others) needs
  them. If any of those accesses now fail to typecheck, that confirms 9.1a's fix was
  necessary rather than optional; do not work around it by re-adding a local type.
- [x] `frontend/src/components/StatsTable.tsx:9` - `CoinSummaryResp` ->
  `CoinSummaryResponseDto` (both the `EMPTY_STATS_DATA` typed array and the
  `ALL_STATS_COLUMNS` column accessors/cells).
- [x] Every file under `frontend/src/components/stats-table/` that imports
  `CoinSummaryResp` from `../../types/global` - confirmed today: `CoinColumn.tsx`,
  `CostBasisColumn.tsx`, `HoldingsColumn.tsx`, `DeltaColumn.tsx`, `ProfitLossColumn.tsx`,
  `CurrentPrice.tsx`. Same swap, `CoinSummaryResp` -> `CoinSummaryResponseDto`, in each.

### B. No stale imports remain

- [x] `grep -rn "from '.*types/global'" frontend/src` returns no hit for
  `PortfolioSummary`, `CoinSummaryResp`, `ProductTransaction`, or `ProfitLossChartResp`
  anywhere under `frontend/src/components/` or `frontend/src/_hooks/` - confirm with a
  targeted grep for each of those four names, not just a general search, and paste the
  (empty) results in Dev Notes.
- [x] `frontend/types/global.d.ts` itself is **not edited or trimmed** in this story -
  the other four shapes (`PriceHistoryResp`, `TimeFramePlByUnitResp`,
  `TimeFrameTotalPlResp`, `TimeFrame`) still have consumers until story 9.6 lands, and
  FR-23's GR-1-protected consumers still need the file to exist unchanged until then.

### C. Regression

- [ ] Every page touched renders identically against the **unchanged** Next.js routes:
  `/`(stats table + single-stat panel), `/product?unit=...` (product table). Load each
  in a browser against the running dev stack and confirm no console errors and no visual
  change.
- [x] `pnpm --filter @portfolio/frontend build` succeeds.
- [x] Per-file `tsc --noEmit` error count for the two files D41 flags as already-failing
  (`components/product/ProductTable.tsx`, `_hooks/useFetchCurrentPrice.ts` - the latter
  is **not** touched by this story, listed here only because D41 names it) is unchanged
  by this story's edits to `ProductTable.tsx`: run
  `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json 2>&1 | grep
  ProductTable.tsx` before and after this story's change to that file, and record both
  counts in Dev Notes. **"Unchanged count" is this file's pass/fail signal, not "zero
  errors"** - `ProductTable.tsx` is one of story 1.6's 11 pre-existing failing files, so
  it may still show errors after this story; what matters is that this story's import
  swap didn't add or remove any.
- [x] Total `tsc --noEmit` error count for every other file this story touches (i.e.
  everything in section A except `ProductTable.tsx`) is **zero** before and after - these
  files were not among story 1.6's 11 failing files, and a generated-type adoption
  should not newly break a file that typechecked cleanly before.

## Technical Notes

- `useSingleStat`/`usePriceHistory` context hooks and everything downstream of them are
  untouched - only the import and the type name change, per section A.
- `ALL_STATS_COLUMNS` in `StatsTable.tsx` types its `accessor`/`Cell` callbacks against
  `CoinSummaryResp` in six places (`StatsTable.tsx:24,29,30,43,44,56...`); all six need
  the rename, not just the top-level array type.

## Out of Scope

- `frontend/src/_hooks/useFetchCoinPriceHistory.ts`, `useTimeTotalFramePl.ts`,
  `context/PriceHistoryProvider.tsx`, `context/StatsTableContext.tsx` - story 9.6.
- Trimming `frontend/types/global.d.ts` - story 9.6.
- Fixing any of `ProductTable.tsx`'s pre-existing type errors beyond what the import
  swap itself resolves or introduces - story 8.5's scope, not this one's.
- `packages/shared` - story 9.7.

## Dev Notes

Found and fixed a bug in `PortfolioSummaryResponseDto.roi`'s `@ApiProperty` decorator
while working section A's `SummaryContext.tsx` swap: `roi!: number | null` with only
`nullable: true` (no explicit `type`) reflects to `Object` at runtime, which
`@nestjs/swagger` then serializes as an empty-object schema - `frontend/types/api.d.ts`
had `roi: Record<string, never> | null`, not `roi: number | null` as this story's AC
text (and story 9.1's finding) assumed. Adding `type: 'number'` alongside `nullable:
true` fixes the generated schema; rebuilt the backend and reran `pnpm spec:generate` to
pick it up. `pnpm spec:generate --check` now reports both `backend/openapi.json` and
`frontend/types/api.d.ts` up to date. This is a Swagger-metadata-only change - the
route's runtime response body is unchanged, so it carries no behavior change of its own,
but it was necessary for `frontend/types/contracts.ts`'s alias to actually be `number |
null` as D38/9.1 intended.

That type narrowing (`roi` was `number` under the old hand-declared `PortfolioSummary`,
is now `number | null`) surfaced one downstream consumer this story's section A list
doesn't itself name: `frontend/src/components/Summary/Breakdown/BreakDown.tsx`, which
reads `useSummaryContext().portfolioSummary.roi` directly into a numeric-typed table row
without a fallback. Two other downstream readers of the same field
(`TotalsSummary.tsx`, and `Layout.tsx` in section A) already had `|| 0` fallbacks and
needed no change. Added the same `?? 0` fallback at `BreakDown.tsx:67`, per this story's
own instruction for the identical situation in `SummaryContext.tsx` itself: the field
genuinely can be `null`, so this is fixed rather than silenced.

`frontend/src/context/SummaryContext.tsx` (distinct file from
`frontend/src/components/Summary/SummaryContext.tsx`) also matches `CoinSummaryResp` on
grep, but only inside commented-out dead code (`// import { type CoinSummaryResp ... }`)
- not a live import, not in section A's file list, left untouched.

### Targeted grep results (AC B)

```
$ grep -rn "from '.*types/global'" frontend/src/components frontend/src/_hooks | grep -w PortfolioSummary
$ grep -rn "from '.*types/global'" frontend/src/components frontend/src/_hooks | grep -w CoinSummaryResp
$ grep -rn "from '.*types/global'" frontend/src/components frontend/src/_hooks | grep -w ProductTransaction
$ grep -rn "from '.*types/global'" frontend/src/components frontend/src/_hooks | grep -w ProfitLossChartResp
```
All four return no output. `frontend/types/global.d.ts` is unmodified
(`git diff --stat frontend/types/global.d.ts` empty).

### Not verified - needs owner check

AC C's first bullet (load `/` and `/product?unit=...` in a browser against the running
dev stack, confirm no console errors/visual change) could not be completed by me: both
routes are auth-gated (`/` redirects to `/login`, confirmed via `curl -D -` showing
`Location: /login`), and I don't have login credentials for this environment. I brought
up the full `docker compose` stack (rebuilding `nest-api` and `next-app` against this
story's changes) to confirm both containers start clean and the backend registers all
routes with no error-level logs, then tore it back down - see command log below. Please
log in and load `/` and `/product?unit=<any unit>` to confirm visually; the change is
type-only (no route, no request, no response-shape change), so the risk is low, but this
criterion is unautomatable from here.

### Changed Files

+ frontend/src/_hooks/useCoinSummaries.ts        `CoinSummaryResp` -> `CoinSummaryResponseDto` from `types/contracts`
+ frontend/src/components/Summary/SummaryContext.tsx    `PortfolioSummary` -> `PortfolioSummaryResponseDto` from `types/contracts`
+ frontend/src/components/SingleStat.tsx         `CoinSummaryResp` -> `CoinSummaryResponseDto` from `types/contracts`
+ frontend/src/components/Summary/TotalChart/Layout.tsx    `ProfitLossChartResp` -> `ProfitLossChartResponseDto` from `types/contracts`
+ frontend/src/components/product/ProductTable.tsx    `ProductTransaction` -> `ProductTransactionResponseDto` from `types/contracts`
+ frontend/src/components/StatsTable.tsx    `CoinSummaryResp` -> `CoinSummaryResponseDto` from `types/contracts`, all six `ALL_STATS_COLUMNS` use sites
+ frontend/src/components/stats-table/CoinColumn.tsx    same swap
+ frontend/src/components/stats-table/CostBasisColumn.tsx    same swap
+ frontend/src/components/stats-table/HoldingsColumn.tsx    same swap
+ frontend/src/components/stats-table/DeltaColumn.tsx    same swap
+ frontend/src/components/stats-table/ProfitLossColumn.tsx    same swap
+ frontend/src/components/stats-table/CurrentPrice.tsx    same swap
+ frontend/src/components/Summary/Breakdown/BreakDown.tsx    `data?.roi` -> `data?.roi ?? 0`, the `roi: number | null` narrowing this story's swap surfaced downstream
+ backend/src/summary/dto/portfolio-summary-response.dto.ts    added `type: 'number'` to `roi`'s `@ApiProperty` so the generated schema is `number | null` instead of `Record<string, never> | null`
+ backend/openapi.json    regenerated (`pnpm spec:generate`) to pick up the `roi` type fix
+ frontend/types/api.d.ts    regenerated (`pnpm spec:generate`) to pick up the `roi` type fix

### Verification

- `pnpm --filter @portfolio/backend build` - passed (needed to regenerate `openapi.json`
  from the DTO fix; `nest build` exited 0, no output).
- `node scripts/generate-api-contract.mjs` then `node scripts/generate-api-contract.mjs
  --check` - passed: "backend/openapi.json is up to date" / "frontend/types/api.d.ts is
  up to date".
- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed: 1 pre-existing warning in
  `src/main.ts` (unrelated `no-floating-promises`), 0 errors.
- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - captured
  before this story's edits: 17 errors across 10 files (matches story 9.3's recorded
  baseline). Captured again after all edits (including the DTO fix and `BreakDown.tsx`
  fallback): byte-identical to the before output (`diff` empty) - 17 errors, same 10
  files, same line numbers. `ProductTable.tsx`'s error count is unchanged: 5 before, 5
  after (`grep -c ProductTable.tsx` on each run), all at lines 330/335/335/339/339 -
  none of the pre-existing 5 relate to `ProductTransactionResponseDto`. Every other
  section-A file has zero errors, both before and after.
- `pnpm --filter @portfolio/frontend lint` - passed: only pre-existing
  `no-unused-vars`/`react-hooks` warnings in files this story didn't touch or didn't
  introduce, 0 errors.
- `pnpm --filter @portfolio/frontend build` - passed, exit 0, all 23 routes built
  (`/`, `/product`, `/login`, plus the Next.js API routes) - `frontend/.next` output
  confirms `/product` and `/stats` (the pages hosting the touched components) built as
  static/dynamic routes with no errors.
- `docker compose up -d --build nest-api next-app` (full stack) - both containers
  started clean; `docker logs nest-api` shows every controller/route mapped, ending
  "Nest application successfully started", no error-level log lines. Torn down after
  with `docker compose down`. See "Not verified" above for what this does and doesn't
  cover.
