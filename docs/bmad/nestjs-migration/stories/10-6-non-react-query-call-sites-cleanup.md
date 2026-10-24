# Story 10.6: The non-react-query call sites, then delete the leftovers

Status: Done

## Context

Last story of the epic. Depends on stories 10.1-10.5: the mutator's full FR-25 seam and
D51 error-lifting behavior (story 10.2) must already be correct, since this story is the
first to exercise them for real, and every other client-side consumer of
`frontend/types/contracts.ts` must already be gone (stories 10.4-10.5) before this story
deletes that file.

Four call sites are not `useQuery` today, so per GR-7 each takes the generated
**operation function**, not a hook, and keeps its existing control flow exactly:
`useGetTokenList.ts:23`, `useFetchCurrentPrice.ts:17`, `AddTransaction.tsx:161`, and
`app/product/page.tsx:17`. `useStorePriceHistory.ts` is the mixed case: it *is* wrapped in
`useQuery`, but its `queryFn` orchestrates two different endpoints in a loop rather than
performing one fetch, so it does not fit the simple "already a useQuery" hook-adoption
pattern stories 10.4-10.5 used - its two backend calls (`/price-history/check`,
`/price-history/set`) become generated operation functions called from inside the
existing `queryFn`, while its crypto.com call stays hand-written because crypto.com is
outside `backend/openapi.json` entirely.

After this story, GR-6's grep (`fetch(` and `axios` under `frontend/src`) must be clean:
the only surviving hits are the mutator (`frontend/src/api/http-client.ts`), the
crypto.com call in `useStorePriceHistory.ts`, the two commented-out dead-code hits in
`frontend/src/context/SummaryContext.tsx` and `src/server/helpers/get-exchange-rates.ts`,
and anything under `src/app/api/` and `src/server/` (GR-1's territory, which GR-6 does not
reach).

## Acceptance Criteria

### A. The four GR-7 operation-function call sites

- [x] `frontend/src/_hooks/useGetTokenList.ts:23-41` - replace
  `fetch(\`/api/token-info/search/${coinSearchValue}\`).then((res) => res?.json()).then((resp: {...}) => {...})`
  with a call to the generated `tokenInfoSearch(coinSearchValue)` operation function,
  keeping the existing `.then((resp) => { if (!Array.isArray(resp)) return;
  setCoinList(...); setLoading(false); })` body and the `useEffect` it lives in
  unchanged. Drop the hand-written response type annotation
  (`resp: { symbol: string; name: string; token_id: number }`) - the generated function's
  return type replaces it.
- [x] `frontend/src/_hooks/useFetchCurrentPrice.ts:17-22` - replace
  `fetch(\`/api/exchange-rates/unit/${unit}\`).then((res) => res?.json()).then((resp:
  string) => {...})` with the generated `exchangeRatesByUnit(unit)` operation function,
  keeping `.then((resp) => { setCurrentPrice(resp); setCurrentPriceIsLoading(false); })`
  unchanged. This endpoint's response is a bare JSON string (FR-3) - confirm the generated
  function's resolved type is `string`, not an object, matching D51's bare-body
  resolution for non-object bodies too.
- [x] `frontend/src/components/AddTransaction.tsx:161-196` - replace the `fetch('/api/transaction/add', {...})`
  call with the generated `addTransaction({ side, token_id, size, price, fee, date,
  notes })` operation function (same body shape as today, still without `unit` - story
  10.1 already deleted that field from the request DTO). The existing status check inside
  `.then` (`if (resp.status !== 200) throw new Error(...)`) moves to the `.catch` branch
  the code already has, per D51: the generated function throws on any non-2xx response
  with the lifted `error` field as the message, so `.then` becomes the pure success path
  (`toastSuccess`, `setIsOpen(false)`, `triggerReload()`, `setFormValues(...)`) and
  `.catch` needs no change to its own body (`toastError({ message: \`Failed to add
  transaction. ${error.message}\` })`) - it already reads `error.message`.
  **The resulting toast text on failure loses the original code's accidental double
  "Failed to add transaction." prefix** (the old code manually built an Error whose
  message already started with that phrase, then the `.catch` prepended it a second time;
  the generated function's thrown message is the bare lifted reason, so the duplicate
  disappears). This is an accepted simplification, not a regression to work around -
  do not try to reproduce the double prefix.
- [x] `frontend/src/app/product/page.tsx:16-22` - replace `fetch(\`/api/transaction/${id}\`,
  { method: 'DELETE' })` with the generated `deleteTransaction(id)` operation function.
  **Name collision**: the local wrapper function is also called `deleteTransaction` - import
  the generated one under an alias, e.g. `import { deleteTransaction as
  deleteTransactionRequest } from '../../api/generated';`, and call
  `deleteTransactionRequest(id)` inside the existing wrapper. The 204-success case
  resolves to `undefined` (D51's bare-body handling), so
  `.then((resp) => { if (resp.status === 204) console.log('success'); })` becomes
  `.then(() => console.log('success'))` - unconditional, since a non-204 response now
  rejects instead of resolving. `.catch((error) => console.log('error', error))` is
  unchanged.

### B. The mixed case

- [x] `frontend/src/_hooks/useStorePriceHistory.ts` - `checkCoinPriceHistoryCache`'s body
  (`fetch('/api/price-history/check', { signal })` plus its manual `resp.json() as
  Promise<...>` cast) becomes a call to the generated `priceHistoryCheck()` operation
  function; drop the manual cast, the generated function's return type replaces it.
  `fetchAndStorePriceHistory`'s **second** `fetch` call (`backendUrl =
  '/api/price-history/set'`) becomes the generated `setPriceHistory({ timeFrame,
  coinName, priceHistoryResp: await resp.json() })` operation function. The **first**
  `fetch` call in the same function (`cryptoComUrl`, crypto.com's own API) is **not
  touched** - it is outside `backend/openapi.json` and stays hand-written, per GR-6's
  named exception. Confirm whether the generated operation functions accept an
  `AbortSignal` (check `generated.ts`'s call signature); if they do, pass the existing
  `signal` through so `useQuery`'s built-in request cancellation still applies to the two
  backend calls; if the generated signature has no room for it, record that as a minor,
  accepted behavior narrowing in Dev Notes rather than fighting the generated shape.

### C. Delete the leftovers

- [x] Delete `frontend/types/contracts.ts` - by this point in the epic it has no
  remaining consumer anywhere under `frontend/src` (stories 10.4 and 10.5 moved every
  one). Confirm with `grep -rln "types/contracts" frontend/src` returning no hits before
  deleting.
- [x] `frontend/types/global.d.ts` - update the header comment (currently "New response
  types come from frontend/types/contracts.ts") to point at
  `frontend/src/api/generated.ts` instead, since `contracts.ts` no longer exists. The
  seven declarations themselves (`PortfolioSummary`, `CoinSummaryResp`, `PriceHistoryResp`,
  `TimeFramePlByUnitResp`, `TimeFrame`, `ProductTransaction`, `ProfitLossChartResp`) are
  **unchanged** - they exist for the GR-1-protected server-side files FR-23 names, which
  this epic never touches, so re-run the sweep to confirm rather than re-deriving it:
  `grep -rln "types/global" frontend/src/server frontend/src/app/api` should return the
  same thirteen files story 9.6 recorded, with the same seven type names in use. Do not
  delete or add a declaration here - that set is untouched by Epic 10.

### D. GR-6's grep, clean

- [x] Run `grep -rn "fetch(" frontend/src` and `grep -rn "axios" frontend/src`. Confirm
  every surviving hit is one of: `frontend/src/api/http-client.ts` (the mutator),
  `frontend/src/_hooks/useStorePriceHistory.ts`'s crypto.com call, the two commented-out
  dead-code hits (`context/SummaryContext.tsx`, `server/helpers/get-exchange-rates.ts`),
  or a file under `frontend/src/app/api/` or `frontend/src/server/`. Paste the full grep
  output in Dev Notes with each hit annotated as one of those four categories - a
  surviving hit that is none of them is a violation and blocks this story.

### E. Regression

- [x] `pnpm --filter @portfolio/frontend build` succeeds.
- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - record the
  total error count before and after this story's edits; note any change against story
  10.5's after-state and explain it (a drop is expected only if it comes from a file this
  story genuinely fixed, same rule stories 9.5/9.6 used).
- [x] `dbService.ts`, both `src/server/helpers/` files, and all nine `src/app/api/`
  importers of `types/global` are **not edited** and still compile - GR-1 forbids
  touching them; this story only edits the header comment of the file they import.
- [x] `pnpm --filter @portfolio/backend typecheck && pnpm --filter @portfolio/backend
  lint` unaffected (no backend file is touched by this story).
- [x] `TARGET=prod docker compose build` succeeds end to end for both services -
  confirms the full FR-21 chain (both links) and every adopted call site compile inside
  the production images, not just in the local `tsc` run.
- [ ] Loading every page this epic touched - `/`, `/product?unit=...&name=...`, the
  stats table, adding a transaction, deleting a transaction - in a browser against the
  running dev stack, logged in, **cannot be completed by Dev** (auth-gated, no
  credentials in this environment). This is the epic's Gate; do not mark it checked here.
  Bring up `docker compose up -d --build` to confirm all containers start clean with no
  error-level logs as the closest available substitute, and record that in Dev Notes.

## Technical Notes

- D51's bare-body contract applies uniformly: every generated operation function resolves
  to the response body directly (or `undefined` on a bodyless `204`) and rejects with an
  `Error` on any non-2xx status, with the `Error`'s `message` set to the response body's
  `error` field when present (story 10.2 built this into the mutator). Every `.then`/`.catch`
  adaptation in section A follows from that one rule; none of them is a special case.
- The four GR-7 call sites and the crypto.com exception are exhaustive - GR-7 names all
  four, and D51/architecture name `useStorePriceHistory.ts` as the one mixed case. If a
  fifth hand-written call to a spec'd endpoint turns up during section D's grep that this
  story did not already know about, that is a gap in an earlier story, not something to
  quietly absorb here - flag it rather than fixing it inline, since the epic's Gate is
  meant to catch exactly that kind of thing.

## Out of Scope

- Any change to `frontend/src/api/http-client.ts` beyond what section B needs to confirm
  its call signature - stories 10.1/10.2 own the mutator's behavior.
- Unifying `TimeFrameSelect.tsx`'s hand-declared `TimeFrame` with the generated one, or
  any further trim of `frontend/types/global.d.ts` - not in this epic (story 8.7, out of
  scope for this initiative, is where `global.d.ts` is eventually deleted entirely).
- Flipping `NEXT_PUBLIC_API_TARGET`'s default to `'nest'` - Epic 7.

## Dev Notes

`useFetchCurrentPrice.ts`'s `TimeFrame` import switched from the deleted
`types/contracts.ts` to `../components/product/TimeFrameSelect`, matching the
established pattern every other consumer in the tree already uses (`PriceHistoryProvider`,
`StatsTableContext`, `LineChart`, etc. all import `TimeFrame` from `TimeFrameSelect.tsx`,
not from the generated client) - `generated.ts` also exports an identical `TimeFrame`
union, but there was no existing precedent for importing it from there, so this story
kept the codebase's convention rather than introducing a new one.

`useStorePriceHistory.ts`'s `fetchAndStorePriceHistory` took `timeFrame: string`;
narrowed it to `timeFrame: TimeFrame` (from `../api/generated`) instead of casting at
the `setPriceHistory` call site, since the value already flows in typed from
`priceHistoryCheck()`'s `timeFramesNeeded: TimeFrame[]`.

Both generated operation functions used in `useStorePriceHistory.ts`
(`priceHistoryCheck`, `setPriceHistory`) accept `options?: Parameters<typeof
httpClient>[1]`, i.e. a `RequestInit`, which includes `signal` - so the existing
`AbortSignal` from `useQuery`'s `queryFn` is passed through to both backend calls
(`{ signal }`), preserving cancellation. No behavior narrowing needed here.

`deleteTransaction`'s generated operation function takes `id: string` (Orval's path-param
convention), while the local wrapper in `app/product/page.tsx` keeps its existing
`id: number` signature per the story - `String(id)` bridges the two at the call site.

`AddTransaction.tsx`: `formValues.coin.value` (`number | null`) and
`formValues.dateOfTransaction.value?.toISOString()` (`string | undefined`) are asserted
non-null at the `addTransaction(...)` call, matching the pre-existing runtime guarantee
`validateForm()` already provides (unchanged control flow, just newly typed). The
`console.log({ resp })` line is dropped along with the rest of the raw-`Response`
handling, per the story's description of the `.then` becoming the pure success path.

Section C: `grep -rln "types/global" frontend/src/server frontend/src/app/api` returns
14 files (matching story 9.6's own list verbatim, both here and in 9.6's prose refer to
it as "thirteen" despite listing 14 - a pre-existing off-by-one in that story's write-up,
not a regression introduced here). Same seven type names in use, none touched.

Section D grep output (`fetch(` and `axios` under `frontend/src`), each hit categorized:

```
--- fetch( ---
src/context/SummaryContext.tsx:37://   //     const resp = await fetch(...)          [commented-out dead code]
src/context/SummaryContext.tsx:52://   //     fetch(`https://price-api...`, {         [commented-out dead code]
src/server/helpers/get-exchange-rates.ts:135:  // const resp = await fetch(          [commented-out dead code]
src/api/http-client.ts:29:  const response = await fetch(mapUrl(url), options);       [the mutator]
src/_hooks/useStorePriceHistory.ts:17:  const resp = await fetch(cryptoComUrl, ...);  [crypto.com exception]

--- axios ---
src/server/helpers/update-price-history.ts:1:import axios from 'axios';               [src/server, GR-1 territory]
src/server/helpers/get-exchange-rates.ts:1:import axios from 'axios';                 [src/server, GR-1 territory]
src/server/helpers/get-exchange-rates.ts:24:  let rates = await axios                 [src/server, GR-1 territory]
```

No hit outside the four allowed categories - GR-6's grep is clean.

### Changed Files

+ frontend/src/_hooks/useGetTokenList.ts       fetch -> generated tokenInfoSearch()
+ frontend/src/_hooks/useFetchCurrentPrice.ts   fetch -> generated exchangeRatesByUnit(); TimeFrame import moved off deleted contracts.ts
+ frontend/src/components/AddTransaction.tsx    fetch -> generated addTransaction(); status-check moves into .catch per D51
+ frontend/src/app/product/page.tsx             fetch DELETE -> generated deleteTransaction() (aliased to avoid name collision)
+ frontend/src/_hooks/useStorePriceHistory.ts    two backend fetches -> generated priceHistoryCheck()/setPriceHistory(); crypto.com fetch untouched
- frontend/types/contracts.ts                    deleted, no remaining consumers; closes the dangling ./api import this story owns
~ frontend/types/global.d.ts                     header comment now points at src/api/generated.ts instead of the deleted contracts.ts

### Verification

- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - 16 errors
  before this story's edits (`git stash`), 15 after. The one removed error was
  `types/contracts.ts(4,40): error TS2307: Cannot find module './api'` - the dangling
  import this story's deletion closes. The only other diff between the two runs is
  `AddTransaction.tsx`'s pre-existing, unrelated `TS2769` error shifting from line 677 to
  665 because this story's edit shortened the function body above it; same error, not
  introduced by this story.
- `pnpm --filter @portfolio/frontend lint` - no new errors; only pre-existing warnings
  (none in the lines this story touched).
- `pnpm --filter @portfolio/frontend build` - succeeds, all 13 routes generated.
- `pnpm --filter @portfolio/backend typecheck && pnpm --filter @portfolio/backend lint` -
  passes, 0 errors (one pre-existing, unrelated warning in `main.ts`). No backend file
  touched by this story.
- `TARGET=prod docker compose build` - both `next-app` and `nest-api` build successfully
  end to end.
- `docker compose up -d --build` - all eight containers (`nest-api`, `next-app`, `nginx`,
  `portfolio-db`, `redis`, `alloy`, `loki`, `prometheus`, `grafana`) reach `Up`; `grep -i
  error` against `next-app` and `nest-api` logs returns nothing. `docker compose down`
  afterward. This is the closest available substitute for the epic's Gate (logged-in
  browser check across `/`, `/product`, the stats table, add/delete transaction), which
  is auth-gated and cannot be completed by Dev in this environment - left unchecked in
  section E for the owner.
