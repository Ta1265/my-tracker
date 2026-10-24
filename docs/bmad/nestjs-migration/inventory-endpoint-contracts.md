# Endpoint and contract inventory

Source of truth for every downstream Epic 2 story (2.2 module map, 2.3 Swagger/DTO
conventions, 2.4-2.8 controller scaffolds). Covers all 19 route handlers under
`frontend/src/app/api/` as of the Epic 1 move (base commit `523681d`). Read-only
inspection: no file under `frontend/src/app/api/` or `frontend/src/server/` was
modified to produce this document.

`frontend/src/app/api/_nextApiCompat.ts` is a dead shim, not a route, and is excluded
per the PRD's out-of-scope list.

## auth/[...nextauth] - out of contract-inventory scope

File: `auth/[...nextauth]/route.ts`. This is NextAuth's internal catch-all handler
(`NextAuth(authOptions)` bound to both `GET` and `POST`), covering NextAuth's own
signin/signout/session/csrf/providers/callback sub-routes. It is not a hand-written
endpoint with a request/response contract of its own - NextAuth owns the shape of
every sub-route. Epic 4 designs new `login`/`logout`/`session` endpoints from FR-6
through FR-11 rather than porting this route handler-for-handler, so its internal
sub-routes are not enumerated here.

**FR-2 auth decision:** n/a - out of scope, see above.

---

## transaction/add

File: `transaction/add/route.ts`

### Request

- Method: `POST`
- Path: `/api/transaction/add`, no path params, no query params.
- Body (all required unless noted):
  - `token_id: number`
  - `side: string` (`"BUY"` or `"SELL"`, case-insensitive)
  - `unit: string`
  - `size: string`
  - `price: string`
  - `fee: string`
  - `date: string`
  - `notes?: string` (optional, defaults to `''`)

### Response - success

- `200`: bare JSON string `"Transaction added"` - **not** a JSON object.

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session.
- `400` `{ error: "Missing required fields" }` - any of `token_id`, `size`, `price`,
  `fee`, `date` falsy.
- `400` `{ error: "Invalid side" }` - `side.toUpperCase()` not in `['BUY', 'SELL']`.
- `400` `{ error: "Invalid token_id" }` - no `TokenInfo` row for `token_id`.

### FR-2 auth decision

**Authenticated.** Writes a transaction owned by `session.user.id`; today's 401 is
correct and stays.

---

## transaction/[id]

File: `transaction/[id]/route.ts`

### Request

- Method: `DELETE`
- Path: `/api/transaction/{id}` - `id` (path, string, required - the transaction's
  numeric id as a string, parsed with `parseInt(id, 10)`).

### Response - success

- `204`, empty body.

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session.
- `400` `{ error: "Missing id parameter" }` - `id` falsy (unreachable in practice for a
  matched dynamic route, but the check exists).
- `500` `{ error: "An error occurred while deleting the transaction" }` - `db.transaction.delete`
  throws (e.g. no row with that id - there is no existence check before the delete).

### FR-2 auth decision

**Authenticated.** Deletes a transaction scoped to the caller's session; no ownership
check exists on the delete itself, which is a today's-behavior gap outside this
story's scope, but the endpoint stays gated behind a session per FR-2 (loosening a
today-authenticated route is not permitted).

**Amended by FR-27 - the ownership gap is now in scope, and Epic 11 closes it.** The
posture above is unchanged and correct: this endpoint was authenticated and stays
authenticated, so FR-2 has nothing to say here. What changed is the sentence calling the
missing ownership check out of scope. The new backend's delete filters on `userId` as well
as `id`, so a foreign row is not deleted and the caller gets the same `500`
`{ error: "An error occurred while deleting the transaction" }` that a nonexistent id
already produces - the two cases stay indistinguishable and no response shape moves. The
old Next.js route keeps today's unscoped behavior, because GR-1 forbids editing it. This is
the eighth row of the divergence table below and the only exception to FR-3 in the
initiative.

---

## summary/coins

File: `summary/coins/route.ts`

### Request

- Method: `GET`
- Path: `/api/summary/coins`, no path params, no query params.

### Response - success

- `200`: array of `CoinSummaryResp` objects (also the shape used by `summary/[unit]`),
  computed from `DBService.getCoinSummaries` raw SQL plus a per-unit net-cash-flow map
  computed in the route. All numeric fields are unformatted numbers (not
  pre-formatted display strings):
  - `productName: string`
  - `coinName: string`
  - `avgPurchasePrice: number`
  - `avgSellPrice: number`
  - `holdings: number`
  - `valueOfHoldings: number`
  - `profitLossAtCurrentPrice: number`
  - `percentPL: number`
  - `currentPrice: number`
  - `breakEvenPrice: number`
  - `inGreen: boolean` - derived in the route (`profitLossAtCurrentPrice > 0`), not in SQL.
  - `totalBuyCost: number`
  - `totalSellProfits: number`
  - `costBasis: number` - derived in the route (`totalBuyCost - totalSellProfits`), not in SQL.
  - `netContributions: number` - derived in the route from `getBuySellTotalFiFo`.
  - `netCashHoldings: number` - derived in the route from `getBuySellTotalFiFo`.

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session (`session?.user?.id` falsy).

### FR-2 auth decision

**Authenticated.** Returns the caller's own portfolio data; today's 401 stays.

---

## summary/portfolio

File: `summary/portfolio/route.ts`

### Request

- Method: `GET`
- Path: `/api/summary/portfolio`, no path params, no query params.

### Response - success

- `200`: single `PortfolioSummary` object, all numeric fields unformatted:
  - `purchases: number`
  - `sales: number`
  - `costBasis: number`
  - `valueOfHoldings: number`
  - `totalPLatCurrentPrice: number`
  - `netCashHoldings: number`
  - `netContributions: number`
  - `accountValue: number`
  - `realizedReturn: number`
  - `roi: number` - `NaN` when `netContributions` is `0` (division by zero produces
    `NaN`, which `JSON.stringify`/`NextResponse.json` serializes to `null`).
  - `inGreen: boolean` (`profitLoss > 0`)

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session.

### FR-2 auth decision

**Authenticated.** Returns the caller's own portfolio totals; today's 401 stays.

---

## summary/[unit]

File: `summary/[unit]/route.ts`

### Request

- Method: `GET`
- Path: `/api/summary/{unit}` - `unit` (path, string, required, e.g. `"BTC"`).

### Response - success

- `200`: identical `CoinSummaryResp[]` shape to `summary/coins`, filtered to the
  given `unit` (see `summary/coins` above for the full field list).

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session.

### FR-2 auth decision

**Authenticated.** Same rationale as `summary/coins`.

---

## summary/profitLossChart (query variant)

File: `summary/profitLossChart/route.ts`

### Request

- Method: `GET`
- Path: `/api/summary/profitLossChart`
- Query: `timeFrame` (optional, one of the `TimeFrame` union `'h'|'d'|'w'|'m'|'3m'|'6m'|'y'|'all'`,
  default `'all'`, not validated against the union at runtime - any string is cast).

### Response - success

- `200`: `ProfitLossChartResp` object read through Redis cache key
  `net-cash-flow-history-{userId}-{timeFrame}` (TTL 3600s):
  - `netRows: { date: number, valueOfHoldings: number, profitLoss: number, roi: number }[]`
    - `date` is epoch ms.
  - `lowestPointIndex: number`
  - `highestPointIndex: number`
  - When the underlying helper (`getNetCashFlowHistory` in
    `frontend/src/server/helpers/update-price-history.ts` - **not** the
    `dbService.ts` function of the same name, see landmine below) returns `undefined`
    (user has no transactions), the route substitutes
    `{ netRows: [], lowestPointIndex: 0, highestPointIndex: 0 }` and caches that
    fallback too.

### Response - non-200

- `401` `{ error: "Unauthorized" }` - checks only `session?.user` (not
  `session?.user?.id`) - the FR-2 half-auth pattern called out in Technical Notes.

### FR-2 auth decision

**Authenticated.** Returns the caller's own cash-flow history; today's check (even
though it tests `session?.user` rather than `session?.user?.id`) already gates on a
session, so the new backend keeps this authenticated - only the specific `session.user`
vs `session.user.id` check narrows, which is not a loosening.

---

## summary/profitLossChart/[timeFrame]

File: `summary/profitLossChart/[timeFrame]/route.ts`

### Request

- Method: `GET`
- Path: `/api/summary/profitLossChart/{timeFrame}` - `timeFrame` (path, string,
  required, same `TimeFrame` union, not runtime-validated).

### Response - success

- `200`: identical shape and Redis caching behavior to the query variant above.

### Response - non-200

- `401` `{ error: "Unauthorized" }` - same `session?.user` check as the query variant.

### FR-2 auth decision

**Authenticated.** Same rationale as the query variant - these two routes share
identical logic end to end.

---

## stats/[unit]

File: `stats/[unit]/route.ts`

No known frontend caller today; documented in full per the AC regardless.

### Request

- Method: `GET`
- Path: `/api/stats/{unit}` - `unit` (path, string, required).

### Response - success

- `200`: a single object - `formatted[0]` from an array-producing query, so multiple
  matching rows are silently truncated to the first. Every numeric field is
  pre-formatted:
  - `productName: string`
  - `avgPurchasePrice: string` - already `formatUSD`-formatted (e.g. `"$1,235"`), not
    a plain numeric string.
  - `avgSellPrice: string` - already `formatUSD`-formatted.
  - `holdings: string` - already `.toFixed(4)`-formatted (e.g. `"1.2345"`), not a
    plain numeric string.
  - `valueOfHoldings: string` - already `formatUSD`-formatted.
  - `profitLossAtCurrentPrice: string` - already `formatUSD`-formatted.
  - `percentPL: string` - already `.toFixed(1) + '%'`-formatted (e.g. `"12.3%"`).
  - `currentPrice: string` - already `formatUSD`-formatted.
  - `breakEvenPrice: string` - already `formatUSD`-formatted.
  - If no row matches `unit`, `formatted[0]` is `undefined` and `NextResponse.json(undefined)`
    serializes to an empty response body with `200` (Next.js does not error).

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session (`session?.user?.id` falsy).

### FR-2 auth decision

**Authenticated.** Returns the caller's own stats derived from `getCoinSummaries(userId, unit)`;
today's 401 stays even though there is no known frontend caller.

---

## product/[product]

File: `product/[product]/route.ts`

### Request

- Method: `GET`
- Path: `/api/product/{product}` - `product` (path, string, required in principle;
  an empty/falsy value is accepted and short-circuits to `200 []` rather than a 400).

### Response - success

- `200`: array of `ProductTransaction` objects (transactions for `product`, most
  recent first, running balances computed oldest-to-newest then reversed):
  - `id: number`
  - `fullName: string` (the transaction's `coinName`)
  - `product: string`
  - `date: string` - already `.toLocaleString()`-formatted, not an ISO string.
  - `side: string`
  - `size: string` - already `.toString()`-formatted (plain number stringified, no
    fixed precision).
  - `unit: string`
  - `price: string` - already formatted by the **local** `formatUSD` copy at
    `product/[product]/route.ts:7` (`value.toLocaleString('en-US', { style:
    'currency', currency: 'USD' })`, default precision, no `< 10` threshold) - see
    the two-`formatUSD` landmine below.
  - `fee: string` - same local `formatUSD` copy.
  - `total: string` - same local `formatUSD` copy.
  - `notes: string`
  - `runningBalance: string` - already `.toFixed(4)`-formatted.
  - `runningCostBasis: string` - same local `formatUSD` copy.
  - `realizedGains: { total: number, short: number, long: number }` - nested object,
    unformatted numbers, computed via FIFO tax-lot matching; all zero for `BUY` rows.
- Empty/falsy `product` path param: `200` with `[]` (no 400).

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session (`session?.user?.id` falsy).

### FR-2 auth decision

**Authenticated.** Returns the caller's own transaction history for a product; today's
401 stays.

---

## exchange-rates/[timeFrame]/[coinName]

File: `exchange-rates/[timeFrame]/[coinName]/route.ts`

No known frontend caller today; documented in full per the AC regardless.

### Request

- Method: `GET`
- Path: `/api/exchange-rates/{timeFrame}/{coinName}` - `timeFrame` (path, string,
  required, cast to `TimeFrame`, not runtime-validated), `coinName` (path, string,
  required).

### Response - success

- `200`: the raw `PriceHistoryResp` object, verbatim, no formatting:
  - `prices: [unixTimestamp: number, openPrice: number, closePrice: number][]`
  - `price_change: number`
  - `usd_price_change: number`

### Response - non-200

- No explicit error handling in the route itself. `getPriceHistoryForTimeFrame`
  throws a plain `Error('Cache miss getPriceHistoryForTimeFrame')` on a Redis cache
  miss (there is no live fetch fallback - the crypto.com fetch is commented out) and
  throws `Error('coinName and timeFrame are required')` for a falsy/invalid
  `timeFrame`. Both are uncaught in the route, so Next.js's default App Router error
  handling returns an unstructured `500` (HTML in dev, a generic JSON error shape in
  production) rather than an endpoint-defined body. No `400`/`401`/`404` path exists.

### FR-2 auth decision

**Deliberately public.** No user-scoped data - returns market price history for a
coin, not anything tied to `session.user`. Today's `none` stays `none`; no session
data is exposed by making it public.

---

## exchange-rates/unit/[unit]

File: `exchange-rates/unit/[unit]/route.ts`

### Request

- Method: `GET`
- Path: `/api/exchange-rates/unit/{unit}` - `unit` (path, string, required).

### Response - success

- `200`: **bare JSON string** (not a wrapped object) - the `formatUSD`-formatted
  exchange rate, e.g. `"$1,235"`.

### Response - non-200

- `404`: **bare JSON string** `"Exchange rate not found"` (not a wrapped object) -
  no `ExchangeRate` row for `unit`.

### FR-2 auth decision

**Deliberately public.** Returns a market exchange rate, not user-scoped data.
Today's `none` stays `none`.

---

## price-history/check

File: `price-history/check/route.ts`

### Request

- Method: `GET`
- Path: `/api/price-history/check`, no path params, no query params.

### Response - success

- `200`: array of `{ coinName: string, timeFramesNeeded: string[] }` - one entry per
  coin the resolved `userId` has transacted in, `timeFramesNeeded` listing which of
  the 8 `TimeFrame` values are missing from Redis under
  `time-frame-pl-{timeFrame}-coinName-{coinName}` (both segments lowercased).

### Response - non-200

- None today - always `200`. Reads `session?.user?.id` via `getServerSession(authOptions)`
  but never returns `401` if it is absent: `userId` becomes `undefined`, and
  `db.getUsersCoins(undefined)` runs a raw SQL query with `WHERE userId = NULL`,
  which matches zero rows and yields `200 []`. This is a bug in today's behavior,
  recorded here as a fact, not defended.

### FR-2 auth decision

**Authenticated.** This is the FR-2-flagged case: today's code reads the session but
never enforces it, silently degrading to an empty result for an unauthenticated
caller instead of rejecting the request. The new backend enforces a `401` here - this
is a tightening (public-by-accident -> deliberately authenticated), which FR-2
explicitly permits. Fixing the underlying route to actually check the session is out
of this story's scope (the old Next.js route stays untouched per GR-1); this decision
governs only the new backend's behavior.

---

## price-history/set

File: `price-history/set/route.ts`

### Request

- Method: `POST`
- Path: `/api/price-history/set`, no path params, no query params.
- Body (all required):
  - `coinName: string`
  - `timeFrame: TimeFrame` (one of `'h'|'d'|'w'|'m'|'3m'|'6m'|'y'|'all'`, not
    runtime-validated against the union)
  - `priceHistoryResp: PriceHistoryResp` (`{ prices: [unixTimestamp: number,
    openPrice: number, closePrice: number][], price_change: number,
    usd_price_change: number }`)

### Response - success

- `200`: `{ message: string }` - the message is interpolated
  (`` `Price history cached successfully: ${coinName} - ${timeFrame}` ``), not a
  fixed string.

### Response - non-200

- `400` `{ error: "Missing required fields" }` - any of `timeFrame`, `priceHistoryResp`,
  `coinName` falsy.

### FR-2 auth decision

**Deliberately public.** No `session` read at all today. This route writes a shared
cache entry keyed by coin/timeFrame, not anything scoped to a user - there is no
session-tied data to protect. Today's `none` stays `none`.

---

## time-frame-coins-pl/[timeFrame]

File: `time-frame-coins-pl/[timeFrame]/route.ts`

### Request

- Method: `GET`
- Path: `/api/time-frame-coins-pl/{timeFrame}` - `timeFrame` (path, string, required,
  cast to `TimeFrame`, not runtime-validated; an unsupported value throws inside
  `getTimeFrameStartDate` - see below).

### Response - success

- `200`: `TimeFramePlByUnitResp` - an object **keyed by product name**, not an array:
  `{ [productName: string]: { pastPl: number, curPl: number, timeFrameStartPrice:
  number } }`, all unformatted numbers.

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session (`session?.user?.id` falsy).
- No explicit `400` for an invalid `timeFrame`: `getTimeFrameStartDate` throws a
  plain `Error('Unsupported time frame: ...')` for any value outside the `TimeFrame`
  union, uncaught in the route, resulting in Next.js's default unstructured `500`.
  `getPriceHistoryForTimeFrame` can also throw on a Redis cache miss (see
  `exchange-rates/[timeFrame]/[coinName]` above), same uncaught-500 behavior.

### FR-2 auth decision

**Authenticated.** Returns the caller's own per-coin P/L breakdown; today's 401 stays.

---

## time-frame-total-pl/[timeFrame]

File: `time-frame-total-pl/[timeFrame]/route.ts`

### Request

- Method: `GET`
- Path: `/api/time-frame-total-pl/{timeFrame}` - `timeFrame` (path, string, required,
  cast to `TimeFrame`, not runtime-validated).

### Response - success

- `200`: `{ pastTotalValue: number, currentTotalValue: number, totalPastPl: number,
  totalCurPl: number }`, all unformatted numbers.

### Response - non-200

- `401` `{ error: "Unauthorized" }` - no session (`session?.user?.id` falsy).
- No explicit `400` for an invalid `timeFrame`: `getPriceHistoryForTimeFrame` throws
  `Error('coinName and timeFrame are required')` for an invalid/falsy `timeFrame`,
  uncaught, resulting in Next.js's default unstructured `500`. A Redis cache miss for
  a valid `timeFrame` throws the same way (see landmine above).

### FR-2 auth decision

**Authenticated.** Returns the caller's own aggregate P/L; today's 401 stays.

---

## token-info/[userId]

File: `token-info/[userId]/route.ts`

No known frontend caller today; documented in full per the AC regardless.

### Request

- Method: `GET`
- Path: `/api/token-info/{userId}` - `userId` (path, string, required, parsed with
  `parseInt(userId, 10)`).

### Response - success

- `200`: `{ success: boolean, userId: number }` - **the route name is misleading: it
  does not return token info.** It triggers `syncPriceHistoryToDbForUserId(userId)`
  (a price-history sync side effect for that user) and returns only a success flag
  and the parsed `userId`, not any token data.

### Response - non-200

- `400` `{ error: "Missing userId param" }` - `userId` path segment missing or parses
  to a falsy value (e.g. `"0"` -> `parseInt` `0`, which is falsy and also rejected).

### FR-2 auth decision

**Authenticated.** Today this is `none`, but it triggers a real side effect (a
price-history sync write) keyed by an arbitrary `userId` taken directly from the URL
with no ownership check - any caller can trigger a sync for any user id. FR-2 permits
tightening a public route; this one is tightened to require a session, and the new
backend additionally scopes the sync to the authenticated caller's own id rather than
trusting the path param (an id/session mismatch is rejected). This is a stricter
version of the same operation, not a new one.

---

## token-info/search/[searchTerm]

File: `token-info/search/[searchTerm]/route.ts`

### Request

- Method: `GET`
- Path: `/api/token-info/search/{searchTerm}` - `searchTerm` (path, string, required
  and non-empty; empty is rejected with a `400`).

### Response - success

- `200`: array of raw `TokenInfo` Prisma rows (`take: 10`, `OR` on `name`/`symbol`
  `startsWith` match against `searchTerm`), each shaped per the Prisma model:
  - `token_id: number`
  - `symbol: string`
  - `slug: string`
  - `name: string`
  - `rank: number`

### Response - non-200

- `400` `{ error: "Missing search query" }` - `searchTerm` empty/falsy.
- `500` `{ error: "Internal Server Error" }` - query failure.

### FR-2 auth decision

**Deliberately public.** Returns generic token metadata (symbol/name/slug lookup),
not anything scoped to a user. Today's `none` stays `none`.

---

## metrics

File: `metrics/route.ts`

### Request

- Method: `GET`
- Path: `/api/metrics`, no path params, no query params.
- Header: `Authorization: Bearer {METRICS_SECRET}`, compared for exact string
  equality against `` `Bearer ${process.env.METRICS_SECRET}` ``. If `METRICS_SECRET`
  is unset, every request is rejected.

### Response - success

- `200`: **plain text**, not JSON - Prometheus text exposition format from
  `register.metrics()`, `Content-Type: register.contentType`.

### Response - non-200

- `403`: **plain text** `Forbidden`, not JSON - missing/incorrect bearer token or
  `METRICS_SECRET` unset.

### FR-2 auth decision

**Authenticated** (bearer-token authenticated, not session-authenticated). Today's
`METRICS_SECRET` bearer check is a deliberate machine-to-machine credential (scrape
endpoint for Prometheus), not a user session - the new backend keeps this scheme as
is rather than converting it to session auth, since it is not a user-facing route.

---

### Landmines confirmed during this inventory

- **`token-info/[userId]` is misleadingly named.** It does not return token info - it
  triggers a price-history sync side effect and returns
  `{ success: boolean, userId: number }`. See the `token-info/[userId]` section above.
- **Two distinct `getNetCashFlowHistory` functions exist.**
  `frontend/src/server/db/dbService.ts`'s `getNetCashFlowHistory(userId, timeFrame)`
  reads pre-computed rows from the `NetCashFlow` table
  (`{ date: Date, netCash: number, netContributions: number, valueOfHoldings: number,
  profitLoss: number, roi: number, ror: number, totalCostBasis: number }[]`) and is
  used only inside `dbService.ts` (not called by any route directly).
  `frontend/src/server/helpers/update-price-history.ts`'s `getNetCashFlowHistory(userId,
  timeFrame)` returns `ProfitLossChartResp | undefined` and is the one actually called
  by both `summary/profitLossChart` and `summary/profitLossChart/[timeFrame]`. These
  are different functions with different signatures, different data sources, and
  different return shapes that happen to share a name - the `profitLossChart` routes
  call the **helpers** one, never the `dbService` one.
- **Two distinct USD formatters produce different output for the same input.**
  `frontend/src/server/helpers/format-usd.ts`'s `formatUSD(value, wrapIfNegative?)`
  branches on `Math.abs(value) < 10` (below 10: `maximumFractionDigits: 2`; at or
  above: `maximumFractionDigits: 0`) and is used by `stats/[unit]` directly and by
  `exchange-rates/unit/[unit]` (via `get-exchange-rates.ts`'s formatting path, called
  in that route). The **separate, local** copy at `product/[product]/route.ts:7` is a
  plain `value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })` with
  no threshold and default precision, used only by `product/[product]` for its
  `price`/`fee`/`total`/`runningCostBasis` fields. For `1234.56` the shared helper
  yields `"$1,235"` and the `product/[product]` copy yields `"$1,234.56"` - a real
  divergence, not the same fact repeated twice. Reconciling them is story 5.7's job
  (architecture D18/F2); this inventory only records where each is used.
- **`exchange-rates/unit/[unit]` returns a bare JSON string**, not a wrapped object,
  on both its `200` (the formatted rate) and its `404` (`"Exchange rate not found"`)
  path.
- **`transaction/add` returns the bare JSON string `"Transaction added"`** on success
  (`200`), not a JSON object.
- **`transaction/[id]` DELETE returns `204` with an empty body** on success.
- **`GET /metrics` returns plain text**, not JSON, on both its `403` and its `200`
  path.

### FR-2 auth decisions - the 7 `none`/half-authenticated rows

Per-route reasoning is recorded in each route's own section above; summarized here
for the seven rows the FR-1 table marks `none` or half-authenticated, none treated as
a blanket decision:

| Route | Today | New decision | Why |
| --- | --- | --- | --- |
| `exchange-rates/[timeFrame]/[coinName]` | none | deliberately public | market data, not user-scoped |
| `exchange-rates/unit/[unit]` | none | deliberately public | market data, not user-scoped |
| `price-history/check` | reads session, never enforces | authenticated | tightening a today-broken check; permitted by FR-2 |
| `price-history/set` | none | deliberately public | shared cache write, not user-scoped |
| `token-info/[userId]` | none | authenticated, scoped to caller | today an unscoped sync side effect triggerable for any userId; tightened |
| `token-info/search/[searchTerm]` | none | deliberately public | generic token metadata lookup |
| `metrics` | bearer-token secret | authenticated (bearer, not session) | machine scrape credential, kept as is |

**The eighth intentional divergence - FR-27, not FR-2.** Added after Epic 5 completed, and
kept in the same table because this is where a reader looks for "how does the new backend
differ from the old one". It is listed separately because FR-2 does not license it: FR-2
governs authentication posture and takes its candidates from the FR-1 table's `none` and
half-authenticated rows, while this endpoint is authenticated today, stays authenticated,
and changes only what an authenticated caller is authorized to reach.

| Route | Today | New behavior | Why |
| --- | --- | --- | --- |
| `transaction/[id]` DELETE | authenticated, deletes any row by bare `id` | authenticated, deletes only rows owned by the caller | sequential integer ids make every user's transactions enumerable and deletable; scoped per FR-27, Epic 11 |

No status code, response shape or error body changes: a foreign id falls into the existing
zero-rows-affected branch and returns the same `500` a nonexistent id already returns, so
"not yours" and "does not exist" remain indistinguishable to the caller. The old Next.js
route is not touched (GR-1), so the gap persists in production for the whole coexistence
window and reopens if `NEXT_PUBLIC_API_TARGET` is flipped back to `legacy` - this is
recorded as a divergence in the replacement backend, not as a security fix. FR-27 carries
the full reasoning and the argument against.

### Verification note

19 routes enumerated above as 19 `## ` sections (18 numbered endpoint sections plus
`auth/[...nextauth]` recorded as out of scope, per the AC). Every section carries a
request shape, a response shape with runtime types (pre-formatted strings flagged),
non-200 status codes and bodies, and an explicit FR-2 decision, except
`auth/[...nextauth]` which is explicitly out of scope per the AC.
