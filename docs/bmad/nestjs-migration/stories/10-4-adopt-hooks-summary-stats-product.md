# Story 10.4: Adopt generated hooks - summary, stats, and product consumers

Status: Done

## Context

First adoption story. Depends on stories 10.1-10.3: `frontend/src/api/generated.ts` must
exist, be current, and be enforced by the staleness check before any component imports
from it. Every consumer in this story already calls its endpoint through
`@tanstack/react-query`'s `useQuery`, so per GR-7 each one **takes the generated hook**,
not the operation function - `useGetTokenList.ts`/`useFetchCurrentPrice.ts`/
`AddTransaction.tsx`/`product/page.tsx` are the only four call sites that take the
operation function instead, and none of them is in this story (story 10.6). This story
establishes the hook-adoption pattern; story 10.5 applies it to the price-history and
time-frame P/L set.

No runtime behavior changes: `NEXT_PUBLIC_API_TARGET` still defaults to `legacy`
(story 10.2), so every generated hook still resolves through the mutator to the same
Next.js route its hand-written predecessor called. Only the code that performs the fetch
changes.

## Acceptance Criteria

### A. Delete the wrapper hooks Orval's output now replaces outright

- [x] `frontend/src/_hooks/useCoinSummaries.ts` - delete the file. It hand-wraps
  `fetch('/api/summary/coins')` in a `useQuery`; Orval's generated `useCoinSummaries()`
  (from `coinSummaries` per story 10.1's `operationId` table) is the same shape by
  construction (FR-24's rationale: this file is "seventeen lines that Orval would
  generate almost character for character"). `StatsTable.tsx` (section B) imports the
  generated hook directly in its place.

### B. Swap each call site to the generated hook

For each file: remove the hand-written `useQuery({ queryKey, queryFn: async () =>
fetch(...) })` block (or the import of the now-deleted wrapper hook) and call the
matching generated hook from `frontend/src/api/generated.ts` instead. Import any DTO type
the file needs from the same `frontend/src/api/generated.ts` (Orval exports model types
and hooks from one file - `mode: 'single'`), not from `types/contracts`. **Confirm each
generated hook's exact parameter shape (path params, query params, options) by reading
`frontend/src/api/generated.ts` directly rather than assuming one** - Orval's react-query
output has a documented shape but this story's acceptance is "matches what was actually
generated," not a guessed signature.

- [x] `frontend/src/components/StatsTable.tsx:9,16` - replace
  `import type { CoinSummaryResponseDto } from '../../types/contracts';` and
  `import { useCoinSummaries } from '../_hooks/useCoinSummaries';` with imports of both
  from `frontend/src/api/generated.ts`. `EMPTY_STATS_DATA`'s type and all six
  `ALL_STATS_COLUMNS` accessor/Cell type annotations follow from the same import change;
  the `useCoinSummaries()` call site itself (line 111) needs no other edit if the
  generated hook's return shape (`{ data, ... }`) matches react-query's, which it does by
  construction.
- [x] `frontend/src/components/Summary/SummaryContext.tsx:5-33` - replace the inline
  `useQuery({ queryKey: ['portfolio'], queryFn: () => fetch('/api/summary/portfolio')... })`
  block with a call to the generated `usePortfolioSummary()` hook, destructuring
  `{ isPending, data: portfolioSummary }` from its result exactly as today. Replace
  `import type { PortfolioSummaryResponseDto } from '../../../types/contracts';` with the
  same type imported from `frontend/src/api/generated.ts`. `PortfolioSummaryResponseDto.roi`
  is `number | null` (story 9.1's finding, still true) - the existing `?? 0`/`|| 0`
  fallbacks in this file and its downstream readers (`BreakDown.tsx`,
  `TotalChart/Layout.tsx`) are unaffected and need no further change.
- [x] Same file, line 6 and line 36: replace
  `import { useTimeTotalFramePl } from '../../_hooks/useTimeTotalFramePl';` and the
  `useTimeTotalFramePl(selectedTimeFrame)` call with the generated `useTimeFrameTotalPl`
  hook (operationId `timeFrameTotalPl`) called directly, matching FR-25's target through
  the same mutator. **This is a cross-story dependency, resolved here rather than left
  implicit**: `_hooks/useTimeTotalFramePl.ts` is the wrapper story 10.5 deletes, and
  `SummaryContext.tsx` is its only consumer (confirmed by grep). Adopting the generated
  hook directly here means story 10.5 can delete the wrapper cleanly with no dangling
  import - do not leave this file depending on `_hooks/useTimeTotalFramePl.ts` past this
  story.
- [x] `frontend/src/components/SingleStat.tsx:6,89-105` - replace the inline
  `useQuery({ queryKey: [\`summary\`, unit], queryFn: () => fetch(\`/api/summary/${unit}\`)... })`
  block with a call to the generated `useCoinSummariesByUnit(unit)` hook (operationId
  `coinSummariesByUnit`, matching `GET /summary/{unit}`). The backend returns an array for
  this endpoint (the existing code's `data?.length !== 1` check and `data[0]` indexing
  confirm it), so the generated hook's `data` is `CoinSummaryResponseDto[] | undefined` -
  keep the existing `data?.length` / `data[0]` logic, just fed by the generated hook's
  `data` instead of the hand-written one's. Replace the `types/contracts` import with
  `frontend/src/api/generated.ts`.
- [x] `frontend/src/components/Summary/TotalChart/Layout.tsx:5,11,26-37` - replace the
  inline `useQuery` block (`GET /api/summary/profitLossChart?timeFrame=...`) with the
  generated `useProfitLossChart({ timeFrame: selectedTimeFrame })` hook (operationId
  `profitLossChart` - the query-string variant, not `profitLossChartByTimeFrame`, matching
  FR-4's "the bare name goes to the variant the frontend actually calls today"). Keep
  `emptyData`'s shape and the `data = emptyData` fallback pattern unchanged; replace the
  `types/contracts` import for `ProfitLossChartResponseDto` with
  `frontend/src/api/generated.ts`.
- [x] `frontend/src/components/product/ProductTable.tsx:12-13,36-45` - replace the inline
  `useQuery({ queryKey: ['product', unit], queryFn: () => fetch(\`/api/product/${unit}\`)... })`
  block with the generated `useProductTransactions(unit)` hook (operationId
  `productTransactions`). Keep `query.data ?? EMPTY_PRODUCT_DATA` and
  `query.isSuccess` usage unchanged (line 236) - the generated hook's return object has the
  same react-query shape. Replace the `types/contracts` import for
  `ProductTransactionResponseDto` with `frontend/src/api/generated.ts`.
- [x] Every file under `frontend/src/components/stats-table/` that imports
  `CoinSummaryResponseDto` from `../../../types/contracts` (confirmed today:
  `CoinColumn.tsx`, `CostBasisColumn.tsx`, `HoldingsColumn.tsx`, `DeltaColumn.tsx`,
  `ProfitLossColumn.tsx`, `CurrentPrice.tsx`) - same type-only import swap, to
  `frontend/src/api/generated.ts`. These files perform no fetch of their own; nothing else
  changes.

### C. No stale imports, no stray fetches

- [x] `grep -rn "from '.*types/contracts'" frontend/src` returns no hit for
  `CoinSummaryResponseDto`, `PortfolioSummaryResponseDto`, `ProfitLossChartResponseDto`,
  or `ProductTransactionResponseDto` anywhere under `frontend/src/components/` -
  paste the (empty) targeted-grep results in Dev Notes, same method story 9.5 used.
- [x] `frontend/types/contracts.ts` is **not edited or deleted** in this story - its other
  consumers (price-history/time-frame P/L set) still need it until story 10.5 lands and
  story 10.6 deletes it.
- [x] None of the six files in section B contains a `fetch(` call to a spec'd endpoint
  after this story - `grep -n "fetch(" <each file>` returns nothing for
  `StatsTable.tsx`, `SummaryContext.tsx`, `SingleStat.tsx`, `TotalChart/Layout.tsx`, or
  `ProductTable.tsx`.
- [x] `grep -rn "useTimeTotalFramePl" frontend/src` returns exactly one hit - the
  declaration inside `_hooks/useTimeTotalFramePl.ts` itself - confirming
  `SummaryContext.tsx` no longer imports it.

### D. Regression

- [x] `pnpm --filter @portfolio/frontend build` succeeds.
- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - record the
  total error count and, separately, `ProductTable.tsx`'s own count, before and after this
  story's edits (same method as story 9.5). `ProductTable.tsx` is one of story 1.6's
  originally-failing files; "unchanged count" is its pass/fail signal, not "zero errors."
  Every other file this story touches must show zero errors both before and after.
- [ ] Loading `/` and `/product?unit=...&name=...` in a browser against the running dev
  stack and confirming no console errors and no visual change **cannot be completed by
  Dev** - both routes are auth-gated and this environment has no login credentials. Do not
  mark this bullet checked; leave it for the epic's Gate (owner review), and bring up
  `docker compose up -d --build` to confirm both containers start clean with no
  error-level logs as the closest available substitute, recording that in Dev Notes.

## Technical Notes

- `frontend/src/api/generated.ts` and `frontend/src/api/http-client.ts` were created by
  stories 10.1-10.2; `frontend/types/api.d.ts` no longer exists (story 10.3 deleted it).
  `frontend/types/contracts.ts` still exists and still compiles - it has consumers outside
  this story's scope until story 10.5 lands.
- `ALL_STATS_COLUMNS` in `StatsTable.tsx` types its `accessor`/`Cell` callbacks against
  `CoinSummaryResponseDto` in six places (confirmed at story 9.5's Technical Notes); all
  six need the import swap, not just the top-level array type.

## Out of Scope

- `frontend/src/_hooks/useFetchCoinPriceHistory.ts`,
  `context/PriceHistoryProvider.tsx`, `context/StatsTableContext.tsx` - story 10.5.
  Deleting the now-unimported `_hooks/useTimeTotalFramePl.ts` wrapper file itself is also
  story 10.5's, once this story has removed its only consumer.
- `useGetTokenList.ts`, `useFetchCurrentPrice.ts`, `AddTransaction.tsx`,
  `product/page.tsx`, `useStorePriceHistory.ts`, deleting `types/contracts.ts`, trimming
  `types/global.d.ts` - story 10.6.
- Fixing any of `ProductTable.tsx`'s pre-existing type errors beyond what the import swap
  itself resolves or introduces - story 8.5's scope.

## Dev Notes

### Deviation from plan: `orval.config.ts` was missing D51's override

Before touching any consumer, a type probe (`useCoinSummaries().data` checked against
`CoinSummaryResponseDto[]`) showed the generated hooks' `data` was typed as
`{ data, status, headers }`, not the bare DTO - the opposite of D51
("`includeHttpResponseReturnType: false` - operations resolve to the bare body"). The
cause: `orval.config.ts`'s `override` block never set that flag, so Orval's fetch client
defaulted to its envelope shape even though the custom `httpClient` mutator (story 10.2)
returns the bare parsed body, matching the Next.js routes' actual JSON. The type and the
runtime value disagreed - every generated hook would have compiled against a shape that
never exists at runtime. This is a defect in story 10.1's Orval config, not something
introduced by this story, and it blocked every acceptance criterion in section B as
written (they all assume `data` is the bare DTO). Fixed by adding
`fetch: { includeHttpResponseReturnType: false }` to `orval.config.ts`'s `override`
(the flag lives under `override.fetch`, not top-level `override` - confirmed by reading
Orval's own bundled source, `node_modules/orval/dist/config-*.mjs`) and regenerating
`frontend/src/api/generated.ts` via `node scripts/generate-api-contract.mjs --only=client`.
Re-ran the type probe after regenerating: `useCoinSummaries().data` now types as
`CoinSummaryResponseDto[] | undefined`, matching the mutator's real return value.
`spec:check --only=client` passes against the regenerated file (byte-identical to a
second run), and the mutator import stays `./http-client` (D55's geometry unaffected).
This changes only Orval's config and its own generated output byte-for-byte content -
no hand-written consumer code, no response bytes over the wire, no route target.

### `SingleStat.tsx`: `data?.length`/`data[0]` kept, but not via `queryFn`'s throw

The generated `useCoinSummariesByUnit(unit)` hook has no `queryFn` for this file to
throw inside - the validation has to move to the call site. Tried a `select` option
first (`useCoinSummariesByUnit(unit, { query: { select: (data) => {...} } })`) so the
"throw on wrong array length" behavior could stay expressed the same way; the generated
hook's `options.query` type argument (`UseQueryOptions<TQueryFnData, TError, TData>`
with only 3 of react-query's 4 type params filled) makes `queryKey` a required property
once `TData` differs from `TQueryFnData` via `select`, which does not match how the
wrapper is actually called (it supplies `queryKey` internally). Rather than force a type
assertion through that mismatch, `SingleStat.tsx` now derives `isError`/`error`/
`coinSummary` from the hook's raw `data` array directly at the call site (`SingleStat.tsx`
lines 83-95): same three states (pending, error, one-row success), same displayed error
message, fed by `.length !== 1` exactly as before - just expressed as `if` logic instead
of a thrown exception inside a `queryFn`/`select` callback.

### Section C grep results (pasted, per story 9.5's method)

```
$ grep -rn "CoinSummaryResponseDto\|PortfolioSummaryResponseDto\|ProfitLossChartResponseDto\|ProductTransactionResponseDto" frontend/src --include="*.tsx" --include="*.ts" | grep "types/contracts"
(no output)

$ grep -n "fetch(" frontend/src/components/StatsTable.tsx frontend/src/components/Summary/SummaryContext.tsx frontend/src/components/SingleStat.tsx frontend/src/components/Summary/TotalChart/Layout.tsx frontend/src/components/product/ProductTable.tsx
(no output)

$ grep -rn "useTimeTotalFramePl" frontend/src
frontend/src/_hooks/useTimeTotalFramePl.ts:7:export const useTimeTotalFramePl = (selectedTimeFrame: TimeFrame) => {
```

### Verification

- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` (baseline, via
  `git stash`, before this story's edits): 18 total errors, 5 in `ProductTable.tsx`
  (the same 5 `react-table` `HeaderGroup<object>` errors story 1.6 already carries),
  2 in `StatsTable.tsx` (`row.original.productName`/`coinName` on `object`).
- Same command after this story's edits: 16 total errors. `ProductTable.tsx`: still
  exactly 5 errors, identical messages, only shifted line numbers from the removed
  `useQuery` block (confirmed via `diff` of the two full error listings) - the
  "unchanged count" signal this story's AC asks for. `StatsTable.tsx`: 0 errors - the
  2 baseline errors disappeared as a side effect of importing `CoinSummaryResponseDto`
  from `api/generated.ts` instead of `types/contracts.ts` (whose broken `./api` import,
  story 10.3's known baseline delta, degrades every type it re-exports); not something
  this story set out to fix, but a net improvement, not a regression. Every other file
  this story touches: 0 errors before and after.
- `pnpm --filter @portfolio/frontend build` - succeeded, all 13 routes generated,
  `/product` and `/stats` built as expected.
- `pnpm --filter @portfolio/frontend lint` - exit 0, 0 errors. Warnings present are
  all pre-existing and in files this story didn't touch or didn't introduce (verified
  via targeted `eslint` run over the 11 files this story edited: 5 warnings, all
  pre-existing - unused `index`/`loading`/`selectedPlType`/`_colKey`).
- `node scripts/generate-api-contract.mjs --check --only=client` - passes:
  `frontend/src/api/generated.ts is up to date`.
- `docker compose up -d --build` then `docker compose logs next-app nest-api` - both
  containers started clean (`Nest application successfully started`, Next.js
  `✓ Ready`), `curl http://localhost/` returned `200`, no error-level log lines from
  either container (the recurring `[ioredis] Unhandled error event: ... ENOTFOUND redis`
  lines are pre-existing local-Docker DNS noise, unrelated to this story, present before
  these changes too). `docker compose down` afterward. Per the AC, loading `/` and
  `/product?unit=...&name=...` as a logged-in user and confirming no console errors and
  no visual change is left for the epic's Gate - this environment has no login
  credentials for the auth-gated routes.

### Changed Files

+ orval.config.ts                                                  add missing `override.fetch.includeHttpResponseReturnType: false` (D51) so generated hooks resolve to the bare response body instead of an `{ data, status, headers }` envelope that never matches the mutator's actual return value
~ frontend/src/api/generated.ts                                    regenerated via `--only=client` after the config fix; every operation and hook now resolves to the bare DTO/array instead of the envelope type
- frontend/src/_hooks/useCoinSummaries.ts                           deleted - superseded by the generated `useCoinSummaries()`
~ frontend/src/components/StatsTable.tsx                            import `useCoinSummaries` and `CoinSummaryResponseDto` from `api/generated` instead of the deleted wrapper hook and `types/contracts`
~ frontend/src/components/Summary/SummaryContext.tsx                 replace the inline `useQuery` for `/api/summary/portfolio` with `usePortfolioSummary()`, and the `useTimeTotalFramePl` wrapper with the generated `useTimeFrameTotalPl` hook directly (its only consumer, so story 10.5 can delete the wrapper cleanly)
~ frontend/src/components/SingleStat.tsx                             replace the inline `useQuery` for `/api/summary/{unit}` with `useCoinSummariesByUnit(unit)`; single-row validation moved from a `queryFn` throw to a call-site derivation of `isError`/`error`/`coinSummary` (see Dev Notes)
~ frontend/src/components/Summary/TotalChart/Layout.tsx              replace the inline `useQuery` for `/api/summary/profitLossChart` with `useProfitLossChart({ timeFrame: selectedTimeFrame })`
~ frontend/src/components/product/ProductTable.tsx                   replace the inline `useQuery` for `/api/product/{unit}` with `useProductTransactions(unit)`
~ frontend/src/components/stats-table/CoinColumn.tsx                 `CoinSummaryResponseDto` import moved from `types/contracts` to `api/generated`
~ frontend/src/components/stats-table/CostBasisColumn.tsx            same import swap
~ frontend/src/components/stats-table/HoldingsColumn.tsx             same import swap
~ frontend/src/components/stats-table/DeltaColumn.tsx                same import swap
~ frontend/src/components/stats-table/ProfitLossColumn.tsx           same import swap
~ frontend/src/components/stats-table/CurrentPrice.tsx               same import swap
