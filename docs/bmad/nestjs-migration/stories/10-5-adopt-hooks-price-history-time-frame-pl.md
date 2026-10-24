# Story 10.5: Adopt generated hooks - price-history and time-frame P/L consumers

Status: Done

## Context

Second adoption story, same pattern story 10.4 established: each call site already using
`useQuery` takes the matching generated hook (GR-7). Depends on story 10.4 having already
removed `SummaryContext.tsx`'s dependency on `_hooks/useTimeTotalFramePl.ts` - this
story's wrapper-file deletions assume that consumer is already gone.

`StatsTableContext.tsx` consumes the one response shape with no OpenAPI component schema
of its own - `time-frame-coins-pl` returns a raw `additionalProperties` map
(`Record<string, TimeFrameCoinsPlEntryDto>`, architecture D43). Under Epic 9's
`openapi-typescript` this needed a five-level `paths[...]` alias to name; Orval names the
map type directly, so this story is where that actually shows up as a plain importable
type for the first time - confirm it by reading what `frontend/src/api/generated.ts`
actually emits for it, not by assuming the shape.

## Acceptance Criteria

### A. Delete the wrapper hooks Orval's output now replaces outright

- [x] `frontend/src/_hooks/useTimeTotalFramePl.ts` - delete the file. Story 10.4 already
  moved its only consumer (`SummaryContext.tsx`) onto the generated `useTimeFrameTotalPl`
  hook directly; confirm with `grep -rn "useTimeTotalFramePl" frontend/src` returning no
  hits before deleting.

### B. Swap each remaining call site to the generated hook

- [x] `frontend/src/_hooks/useFetchCoinPriceHistory.ts` - this file itself becomes a thin
  wrapper, not a full delete like `useCoinSummaries.ts`/`useTimeTotalFramePl.ts` were,
  because it has real logic worth keeping: its `queryKey` lowercases both arguments
  independent of the generated hook's own key, and it sets `staleTime: 30 * 60 * 1000` and
  `refetchOnWindowFocus: 'always'`, neither of which the endpoint's generated hook sets by
  default. Replace the body's `fetch('/api/exchange-rates/...')` call with the generated
  `useCoinPriceHistory(timeFrame, coinName)` hook (operationId `coinPriceHistory`, per
  story 10.1's deliberate naming to avoid colliding with `/price-history/check`), passing
  the existing `staleTime`/`refetchOnWindowFocus` options through whatever options
  parameter Orval's generated hook accepts (confirm the exact shape by reading
  `generated.ts` - do not guess it). Replace the `types/contracts` import for
  `PriceHistoryResponseDto` with `frontend/src/api/generated.ts`; the `TimeFrame` import
  stays as-is (from `components/product/TimeFrameSelect`, a separate pre-existing
  hand-declared type, out of scope per story 9.6's prior note - not touched here either).
- [x] `frontend/src/context/PriceHistoryProvider.tsx:7` - replace
  `import { type PriceHistoryResponseDto } from '../../types/contracts';` with the same
  type from `frontend/src/api/generated.ts`. No other change - this file consumes
  `useFetchCoinPriceHistory` (section B's first bullet), not the generated hook directly,
  so its own logic (`priceData`, `priceChange`, `startPrice` derivation) is untouched.
- [x] `frontend/src/context/StatsTableContext.tsx:6-7,57-67` - replace the inline
  `useQuery({ queryKey: ['time-frame-coins-pl', selectedTimeFrame], queryFn: () =>
  fetch(\`/api/time-frame-coins-pl/${selectedTimeFrame}\`)... })` block with the generated
  `useTimeFrameCoinsPl(selectedTimeFrame)` hook (operationId `timeFrameCoinsPl`),
  destructuring `{ data: timeFrameCoinsPl, isLoading: timeFrameCoinsPlIsLoading }` exactly
  as today, passing the existing `staleTime: 30 * 60 * 1000` through the hook's options
  parameter. Replace `import { type TimeFrameCoinsPlResponseDto } from
  '../../types/contracts';` with the map type Orval actually generated for this shape
  (read `generated.ts` to get its exact name - do not assume it matches
  `TimeFrameCoinsPlResponseDto` verbatim, since this is the one shape with no component
  schema and D43 only guarantees Orval names it *something* importable, not what).

### C. No stale imports, no stray fetches

- [x] `grep -rn "from '.*types/contracts'" frontend/src` - confirm the only remaining hits
  are inside GR-1-protected files (`frontend/src/server/`, `frontend/src/app/api/`) and
  paste the full result in Dev Notes. (`types/contracts.ts` itself still exists after this
  story - story 10.6 deletes it, once those GR-1-protected imports move to `global.d.ts`
  per FR-23 and every other consumer is gone.)
- [x] `frontend/src/_hooks/useFetchCoinPriceHistory.ts`, `context/PriceHistoryProvider.tsx`,
  and `context/StatsTableContext.tsx` contain no `fetch(` call to a spec'd endpoint after
  this story.

### D. Regression

- [x] `pnpm --filter @portfolio/frontend build` succeeds.
- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - record the
  total error count before and after. `useFetchCurrentPrice.ts` (fixed by story 9.6, not
  touched here) should show its already-zero count unchanged; every file this story
  touches should show zero errors both before and after.
- [ ] Loading `/product?unit=...&name=...` (renders `PriceHistoryProvider`,
  `useFetchCoinPriceHistory`) and the stats page's time-frame P/L column
  (`StatsTableContext`) in a browser against the running dev stack **cannot be completed
  by Dev** - both are auth-gated and this environment has no login credentials. Do not
  mark this bullet checked; leave it for the epic's Gate, and bring up
  `docker compose up -d --build` to confirm both containers start clean with no
  error-level logs as the closest available substitute, recording that in Dev Notes.

## Technical Notes

- `TimeFrameSelect.tsx:8`'s own hand-declared `export type TimeFrame = 'h' | 'd' | 'w' |
  'm' | '3m' | '6m' | 'y' | 'all'` is a separate, pre-existing copy of the same union the
  generated `TimeFrame` enum expresses - not the one FR-20 targets, and not touched by
  this story or any other Epic 10 story (story 9.6 already made this call for Epic 9;
  unifying the two remains out of scope here too).
- Architecture D43: `time-frame-coins-pl`'s response has no `@ApiProperty`-decorated
  model because it's a `Record<string, TimeFrameCoinsPlEntryDto>` keyed by product name -
  `@ApiExtraModels` + `additionalProperties` + `getSchemaPath` is the correct OpenAPI
  expression of it, and that part is unchanged from Epic 9. What changes is only that
  Orval, unlike `openapi-typescript` plus the old `contracts.ts` alias, names the map type
  itself rather than requiring a `paths[...]` index expression.

## Out of Scope

- `AddTransaction.tsx`, `product/page.tsx`, `useGetTokenList.ts`,
  `useFetchCurrentPrice.ts`, `useStorePriceHistory.ts`, deleting `types/contracts.ts`,
  trimming `types/global.d.ts` - story 10.6.
- Unifying `TimeFrameSelect.tsx`'s hand-declared `TimeFrame` with the generated one - not
  in this epic.

## Dev Notes

`time-frame-coins-pl`'s response has no component schema, so Orval names the
`additionalProperties` map `TimeFrameCoinsPl200` (the response type at that status code) -
imported directly from `frontend/src/api/generated.ts` in place of
`TimeFrameCoinsPlResponseDto`.

Orval's generated `useTimeFrameCoinsPl`/`useCoinPriceHistory` hooks accept overrides via an
`options?.query` object typed as TanStack Query v5's `UseQueryOptions`, which makes
`queryKey` a required property on that type (v5 tightened this vs. v4) even though the
generated wrapper falls back to its own default queryKey when the caller omits it. Passing
only `staleTime`/`refetchOnWindowFocus` in `query` therefore fails typecheck; the fix is to
pass `queryKey` explicitly, using the generated `getTimeFrameCoinsPlQueryKey`/`getCoinPriceHistoryQueryKey`
helpers where the existing custom key is unchanged (`StatsTableContext.tsx`) and an inline
literal where it deliberately differs from the default (`useFetchCoinPriceHistory.ts`,
which lowercases both key segments).

`grep -rn "from '.*types/contracts'" frontend/src` after this story:

```
frontend/src/_hooks/useFetchCurrentPrice.ts:5:import type { TimeFrame } from '../../types/contracts';
```

That one remaining hit is `useFetchCurrentPrice.ts`, out of scope for this story per its
"Out of Scope" section (explicitly assigned to story 10.6) and not inside a GR-1-protected
directory - it is simply the one consumer this story does not touch. No hits remain under
`frontend/src/server/` or `frontend/src/app/api/` from `types/contracts` at this point.

`frontend/src/context/PriceHistoryProvider.tsx:5` still imports `useQuery` from
`@tanstack/react-query` without using it - a pre-existing warning (confirmed via `git
stash`, present before this story's changes too, since the file already delegated to
`useFetchCoinPriceHistory` rather than calling `useQuery` directly). Left untouched per the
AC's "no other change" instruction for this file.

### Changed Files

- `frontend/src/_hooks/useTimeTotalFramePl.ts` - deleted (last consumer moved to
  `useTimeFrameTotalPl` in story 10.4)
~ `frontend/src/_hooks/useFetchCoinPriceHistory.ts` - body now calls generated
  `useCoinPriceHistory`, keeping its own lowercased queryKey, staleTime, and
  refetchOnWindowFocus via the hook's `query` options
~ `frontend/src/context/PriceHistoryProvider.tsx` - `PriceHistoryResponseDto` import now
  from `api/generated` instead of `types/contracts`
~ `frontend/src/context/StatsTableContext.tsx` - inline `useQuery`/`fetch` block replaced
  with generated `useTimeFrameCoinsPl`; response type now `TimeFrameCoinsPl200` from
  `api/generated`

### Verification

- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - 24 errors before
  this story's changes (via `git stash`), 16 after. All 8 removed errors trace to the three
  files this story touched; `useFetchCurrentPrice.ts` shows zero errors in both runs
  (untouched by this story).
- `pnpm --filter @portfolio/frontend lint` - output byte-identical before and after (`diff`
  against a `git stash`'d run of the same command showed no difference); no new warnings.
- `pnpm --filter @portfolio/frontend build` - succeeds, all routes including `/product` and
  `/stats` compile and prerender.
- `docker compose up -d --build` - both `next-app` and `nest-api` containers start clean;
  `nest-api` logs show all routes mapped and "Nest application successfully started" with no
  error-level log lines; `next-app` logs show `Ready` with no errors. `docker compose down`
  run afterward to leave the environment as found.
- Auth-gated manual browser checks of `/product` and `/stats` were not performed - no login
  credentials available in this environment; left for the epic's Gate per the story's own
  instruction.
