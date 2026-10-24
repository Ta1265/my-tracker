# Story 2.1: Endpoint and contract inventory

Status: Done

## Context

Epic 2 (API scaffold and Swagger sign-off gate) builds every controller, DTO, and
Swagger annotation the finished backend will have, ending at the GR-2 hard gate - this
epic's Owner Review gate, specified in `epics/2-api-scaffold.md` - where the owner
reviews the generated Swagger UI against this inventory. This is
the first story of Epic 2 and precedes 2.2 (module map), 2.3 (Swagger/DTO conventions),
and 2.4-2.8 (the scaffolds themselves) - all of them are written against this document,
not against the old route source directly, so gaps or vagueness here become gaps in
every DTO downstream.

**No code is written in this story.** The sole deliverable is a written inventory
document. FR-1 names the 19 existing route handlers this must cover; FR-2 requires an
explicit, documented auth decision per endpoint (not a restatement of today's
behavior); FR-3 requires every field's exact runtime shape, including pre-formatted
display strings, to be captured so nothing is silently "improved"; FR-5 requires status
codes and error bodies to be captured, not just the 200 path. Architecture's
"Migration/Rollout Strategy" section is explicit that this story "must record, per
field, the runtime JS type and not just the field name" - that phrasing is deliberate:
list `avgPurchasePrice: string ("$1,235")`, not `avgPurchasePrice: string`.

GR-1 applies passively: nothing under `frontend/src/app/api/` or `frontend/src/server/`
is touched, read-only inspection only.

## Acceptance Criteria

- [x] A single inventory document exists at
      `docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`, covering all 19
      routes from the table in Technical Notes below, each as its own section
      cross-referenced to its route file path.
- [x] For each route: exact **request shape** - method(s), full path with every path
      param name, every query param (name, whether required, default value if any), and
      for POST/PUT the exact body field names and types (see the request-body facts
      already captured in Technical Notes for `transaction/add` and `price-history/set`
      - verify and reproduce them, do not re-derive from scratch).
- [x] For each route: exact **response shape on success** - every field name and its
      **runtime JS type** (`string`, `number`, `boolean`, array-of-X, nested object,
      or `null`/`undefined` where a field can be absent), with pre-formatted display
      strings explicitly flagged per FR-3 (e.g. `holdings: string, already ".toFixed(4)"
      formatted - not a plain numeric string`). A field typed merely `string` without
      that flag is not acceptable for any of the pre-formatted fields named in FR-3 or
      found while reading the route.
- [x] For each route: every **non-200 status code** it can return today, with the exact
      body for each - JSON object, bare JSON string, plain text, or empty (204). Do not
      document only the happy path.
- [x] An explicit **FR-2 auth decision** recorded per route - `authenticated` or
      `deliberately public` - with one line of reasoning each, for all 19 routes. The 7
      rows in the FR-1 table marked `none` or the half-authenticated
      `price-history/check` get individual, deliberate treatment (not a blanket
      decision applied to all seven) - see Technical Notes. Per FR-2, tightening a
      route that is public today is permitted; loosening one that is authenticated
      today is not.
- [x] `auth/[...nextauth]` is recorded as **out of contract-inventory scope**: it is
      NextAuth's internal catch-all (signin/signout/session/csrf/providers/callback
      sub-routes), and Epic 4 designs new `login`/`logout`/`session` endpoints rather
      than porting this route handler-for-handler. The inventory states this plainly
      instead of enumerating NextAuth's internal sub-routes.
- [x] Both `summary/profitLossChart` variants (FR-4), `stats/[unit]`, and
      `token-info/[userId]` are documented in full despite having no known frontend
      caller - nothing is skipped for being unused.
- [x] The inventory explicitly calls out each of these landmines (facts already
      confirmed in Technical Notes, reproduce and verify them, do not silently smooth
      them over):
  - `token-info/[userId]` does not return token info - it triggers a price-history sync
    and returns `{ success: boolean, userId: number }`. The route name is misleading.
  - Two distinct `getNetCashFlowHistory` functions exist with different signatures and
    return shapes (`frontend/src/server/db/dbService.ts` vs
    `frontend/src/server/helpers/update-price-history.ts`) - the `profitLossChart`
    routes call the **helpers** one, not the `dbService` one.
  - Two distinct USD formatters exist (`formatUSD` in
    `frontend/src/server/helpers/format-usd.ts` vs the local copy in
    `frontend/src/app/api/product/[product]/route.ts:7`) and they produce different
    output for the same input - record both call sites and the divergence; do not
    treat them as one fact repeated twice. (Reconciling them is story 5.7's job per
    architecture D18/F2, not this story's - just record where each is used.)
  - `exchange-rates/unit/[unit]` returns a **bare JSON string**, not a wrapped object,
    on both its 200 and its 404 path.
  - `transaction/add` returns the bare JSON string `"Transaction added"` on success
    (200), not a JSON object.
  - `transaction/[id]` DELETE returns `204` with an empty body on success.
  - `GET /metrics` returns **plain text**, not JSON, on both its 403 and its 200 path.
- [x] No file outside `docs/bmad/nestjs-migration/` is created, moved, or modified.
      Verified by `git status` showing only the new inventory document and this story
      file.

## Technical Notes

### The 19 routes (current paths, post-Epic-1-move)

All route files live under `frontend/src/app/api/`. The table below is FR-1's
inventory with paths corrected for the Epic 1 move (`src/` -> `frontend/src/`) and the
exact file for each. `frontend/src/app/api/_nextApiCompat.ts` is a dead shim, not a
route - excluded per the PRD's explicit out-of-scope list.

| # | Route | File (under `frontend/src/app/api/`) | Method(s) | Auth today |
| - | --- | --- | --- | --- |
| 1 | `auth/[...nextauth]` | `auth/[...nextauth]/route.ts` | GET, POST | n/a - see AC above |
| 2 | `transaction/add` | `transaction/add/route.ts` | POST | 401 if no session |
| 3 | `transaction/[id]` | `transaction/[id]/route.ts` | DELETE | 401 if no session |
| 4 | `summary/coins` | `summary/coins/route.ts` | GET | 401 if no session |
| 5 | `summary/portfolio` | `summary/portfolio/route.ts` | GET | 401 if no session |
| 6 | `summary/[unit]` | `summary/[unit]/route.ts` | GET | 401 if no session |
| 7 | `summary/profitLossChart` (`?timeFrame=`) | `summary/profitLossChart/route.ts` | GET | 401 if no session |
| 8 | `summary/profitLossChart/[timeFrame]` | `summary/profitLossChart/[timeFrame]/route.ts` | GET | 401 if no session |
| 9 | `stats/[unit]` | `stats/[unit]/route.ts` | GET | 401 if no session |
| 10 | `product/[product]` | `product/[product]/route.ts` | GET | 401 if no session |
| 11 | `exchange-rates/[timeFrame]/[coinName]` | `exchange-rates/[timeFrame]/[coinName]/route.ts` | GET | none |
| 12 | `exchange-rates/unit/[unit]` | `exchange-rates/unit/[unit]/route.ts` | GET | none |
| 13 | `price-history/check` | `price-history/check/route.ts` | GET | reads session, never enforces it |
| 14 | `price-history/set` | `price-history/set/route.ts` | POST | none |
| 15 | `time-frame-coins-pl/[timeFrame]` | `time-frame-coins-pl/[timeFrame]/route.ts` | GET | 401 if no session |
| 16 | `time-frame-total-pl/[timeFrame]` | `time-frame-total-pl/[timeFrame]/route.ts` | GET | 401 if no session |
| 17 | `token-info/[userId]` | `token-info/[userId]/route.ts` | GET | none |
| 18 | `token-info/search/[searchTerm]` | `token-info/search/[searchTerm]/route.ts` | GET | none |
| 19 | `metrics` | `metrics/route.ts` | GET | `METRICS_SECRET` bearer token |

### Shared helpers each route pulls from - read these, don't just read the route file

A route's own file is often a thin wrapper; the actual query and shape logic lives in
one of these. Reading only the route file will under-document several endpoints.

- `frontend/src/server/db/dbService.ts` - `getCoinSummaries`, `getPortfolioSummary`,
  `getBuySellTotalFiFo`, `getNetCashFlowHistory` (used only inside `dbService.ts`
  itself, **not** by the `profitLossChart` routes - see the landmine above),
  `getPriceHistoryMap`, `getTokensForUserId`. Several return `db.$queryRaw<any>` -
  the actual field set is only visible in the raw SQL's column aliases (e.g.
  `getCoinSummaries`'s `AS productName`, `AS currentPrice`, etc.), not in a TS type.
- `frontend/src/server/helpers/update-price-history.ts` - `getNetCashFlowHistory`
  (returns `ProfitLossChartResp | undefined`: `{ netRows: { date: number
  (epoch ms), valueOfHoldings: number, profitLoss: number, roi: number }[],
  lowestPointIndex: number, highestPointIndex: number }`, `undefined` when the user has
  no transactions), `syncPriceHistoryToDbForUserId`, `updateNetCashFlowTableData`.
- `frontend/src/server/helpers/get-exchange-rates.ts` - `getExchangeRates` (called for
  its side effect in several summary routes, its own return value is not part of
  those responses), `getPriceHistoryForTimeFrame` (returns the `PriceHistoryResp` shape
  declared in `price-history/set/route.ts`: `{ prices: [unixTimestamp: number,
  openPrice: number, closePrice: number][], price_change: number, usd_price_change:
  number }` - this is exactly what `exchange-rates/[timeFrame]/[coinName]` returns
  verbatim).
- `frontend/src/server/helpers/format-usd.ts` - `formatUSD(value, wrapIfNegative?)`.
  Branches on `Math.abs(value) < 10`: below 10 uses `maximumFractionDigits: 2`, at or
  above uses `maximumFractionDigits: 0`. Used by `stats/[unit]` and (via
  `get-exchange-rates.ts`) `exchange-rates/unit/[unit]`. The **separate, different**
  copy at `product/[product]/route.ts:7` is a plain `toLocaleString` with default
  precision and no threshold - for `1234.56` the shared helper yields `"$1,235"` and
  the product-route copy yields `"$1,234.56"`.
- `frontend/src/server/auth.ts` - `getServerAuthSession()`, `authOptions`. Session
  shape: `session?.user?.id`, `session?.user` (falsy check patterns vary by route -
  some check `session?.user?.id`, `price-history/check` and the two
  `profitLossChart` routes check only `session?.user`, which is the FR-2 half-auth
  case worth noting verbatim).

### Per-route facts already confirmed (verify, don't re-derive)

- `transaction/add` - body `{ token_id: number, side: string, unit: string, size:
  string, price: string, fee: string, date: string, notes?: string }`. `400` with
  `{ error: string }` for missing fields, invalid `side` (must be `BUY`/`SELL`
  case-insensitive), or unknown `token_id`. `200` returns the bare string
  `"Transaction added"`.
- `transaction/[id]` - `400` `{ error: string }` for missing `id`; `204` empty body on
  success; `500` `{ error: string }` on delete failure (no existence check first).
- `summary/coins` / `summary/[unit]` - response is an array of `CoinSummaryResp`
  objects with derived fields `inGreen: boolean`
  (`profitLossAtCurrentPrice > 0`) and `costBasis: number` (`totalBuyCost -
  totalSellProfits`), computed in the route, not in SQL.
- `summary/portfolio` - single `PortfolioSummary` object, includes `inGreen: boolean`
  (`profitLoss > 0`), all numeric fields unformatted.
- `summary/profitLossChart` (query) and `.../profitLossChart/[timeFrame]` - identical
  logic, one reads `?timeFrame=` (default `'all'`), the other reads the path param.
  Both cache in Redis under `net-cash-flow-history-{userId}-{timeFrame}` for 3600s and
  fall back to `{ netRows: [], lowestPointIndex: 0, highestPointIndex: 0 }` when the
  helper returns `undefined`.
- `stats/[unit]` - every numeric field is pre-formatted: `avgPurchasePrice`,
  `avgSellPrice`, `valueOfHoldings`, `profitLossAtCurrentPrice`, `currentPrice`,
  `breakEvenPrice` via `formatUSD`; `holdings` via `.toFixed(4)`; `percentPL` via
  `.toFixed(1) + '%'`. Returns a single object (`formatted[0]`), not an array, even
  though the underlying query can return multiple rows.
- `product/[product]` - returns an array of `ProductTransaction`, each with
  `price`/`fee`/`total`/`runningCostBasis` formatted via the **local** `formatUSD`
  copy, `size`/`runningBalance` as fixed-decimal strings, `date` via
  `.toLocaleString()`, and a nested `realizedGains: { total: number, short: number,
  long: number }` object (unformatted numbers). Empty `product` param returns `200`
  with `[]` rather than a 400.
- `exchange-rates/[timeFrame]/[coinName]` - no auth, returns the raw
  `PriceHistoryResp` object described above verbatim, no formatting.
- `exchange-rates/unit/[unit]` - no auth. `200`: bare JSON string, the formatted rate
  (`formatUSD` output). `404`: bare JSON string `"Exchange rate not found"`.
- `price-history/check` - reads `session?.user?.id` but never returns 401 if absent;
  queries Redis existence (`EXISTS`) per coin per timeframe under
  `time-frame-pl-{timeFrame}-coinName-{coinName}` (both segments lowercased); returns
  `{ coinName: string, timeFramesNeeded: string[] }[]`. This is the FR-2-called-out bug
  - record it as a fact about today's behavior, the auth *decision* for the new
  backend is this story's job, not a defense of the bug.
- `price-history/set` - no auth. Body `{ coinName: string, timeFrame: TimeFrame,
  priceHistoryResp: PriceHistoryResp }`. `400` `{ error: string }` on any missing
  field. `200` returns `{ message: string }` (interpolated, not a fixed string).
- `time-frame-coins-pl/[timeFrame]` - returns an object **keyed by product name**
  (not an array): `{ [productName: string]: { pastPl: number, curPl: number,
  timeFrameStartPrice: number } }`.
- `time-frame-total-pl/[timeFrame]` - returns `{ pastTotalValue: number,
  currentTotalValue: number, totalPastPl: number, totalCurPl: number }`, all
  unformatted numbers.
- `token-info/[userId]` - no auth. `400` `{ error: string }` for missing/falsy
  `userId`. `200` returns `{ success: boolean, userId: number }` - it does not return
  token info (see landmine above).
- `token-info/search/[searchTerm]` - no auth. `400` `{ error: string }` for empty
  search term. `200` returns an array of raw `TokenInfo` Prisma rows (`take: 10`,
  `OR` on `name`/`symbol` `startsWith`). `500` `{ error: string }` on query failure.
- `metrics` - checks `Authorization: Bearer {METRICS_SECRET}` exactly. `403` plain
  text `Forbidden` on mismatch or missing secret. `200` returns
  `register.metrics()`'s Prometheus text exposition format with
  `Content-Type: register.contentType` - not JSON.

### Verification

This story writes no code, so there is no build or test to run. `Done` requires all of:

```
test -f docs/bmad/nestjs-migration/inventory-endpoint-contracts.md
grep -c '^## ' docs/bmad/nestjs-migration/inventory-endpoint-contracts.md   # expect 19
```

plus a read-back confirming each of the 19 sections carries a request shape, a response
shape with runtime types, status codes, and an explicit FR-2 auth decision. A section
present but empty does not count - the whole value of this story is that every later DTO
is written from it.

## Out of Scope

- Deciding the Nest module each endpoint belongs to - that is story 2.2.
- Wiring `@nestjs/swagger`, writing DTO classes, or the `@FormattedValue` decorator
  convention - that is story 2.3.
- Writing any controller, service, or stub - that is stories 2.4-2.8.
- Reconciling the two `formatUSD` implementations - that is story 5.7 (architecture
  D18/F2). This story records where each is used and that they diverge; it does not
  unify them.
- Fixing `price-history/check`'s unenforced auth check - this story records the FR-2
  decision for the new backend; the old Next.js route is unmodified per GR-1.
- Any MikroORM, entity, or database work - Epic 3.
- Auditing NextAuth's internal sub-routes under `auth/[...nextauth]` - out of scope per
  the AC above; Epic 4 designs the replacement endpoints from FR-6 through FR-11, not
  from this route's internals.

## Dev Notes

Wrote the inventory by reading every one of the 19 route files directly (not just the
Technical Notes table) plus the shared helpers they call (`dbService.ts`,
`update-price-history.ts`, `get-exchange-rates.ts`, `format-usd.ts`,
`schema.prisma` for the `TokenInfo` model), and confirmed each landmine and
per-route fact named in Technical Notes against the actual source rather than
copying the notes verbatim. One addition beyond what Technical Notes called out:
`exchange-rates/[timeFrame]/[coinName]`, `time-frame-coins-pl/[timeFrame]`, and
`time-frame-total-pl/[timeFrame]` all call `getPriceHistoryForTimeFrame`, which
throws a plain, uncaught `Error` on a Redis cache miss or invalid `timeFrame` (the
live crypto.com fetch fallback is commented out) - this surfaces as an unstructured
Next.js default 500, not an endpoint-defined body, and is recorded under each of
those three routes' non-200 section since the AC requires every non-200 path, not
just the ones the route explicitly handles.

### Changed Files

+ docs/bmad/nestjs-migration/inventory-endpoint-contracts.md   19-route endpoint/contract inventory (request/response shapes, status codes, FR-2 auth decisions, landmines) for Epic 2

### Verification

```
$ test -f docs/bmad/nestjs-migration/inventory-endpoint-contracts.md && echo "file exists"
file exists

$ grep -c '^## ' docs/bmad/nestjs-migration/inventory-endpoint-contracts.md
19

$ git status --porcelain
?? .claude/skills/bmad/
?? CLAUDE.md
?? docs/
```

(`docs/` was already untracked in its entirety before this story - it is the whole
`docs/bmad/` initiative tree, not something introduced here. The only files this
story added or modified are `docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`
and this story file itself, both under `docs/bmad/nestjs-migration/`.)

Read back all 19 sections plus the `auth/[...nextauth]` out-of-scope section: each
route section carries a request shape, a response shape with runtime types (with
`FR-3` pre-formatted-string flags on `stats/[unit]` and `product/[product]`), every
non-200 status code and body, and an explicit FR-2 decision with one-line reasoning.
No code was written or run; this story has no build/lint/test to execute per its own
Technical Notes.
