# Story 14.1: Automated parity re-check

Status: Done

## Context

Story 5.10 (Epic 5) recorded one pre-cutover parity sweep: for each of the 19 FR-1 rows
(18 numbered endpoints, `auth/[...nextauth]` excluded per its own scope), it hit both the
old Next.js route and the new NestJS route with the same seeded data and pasted the full
request/response transcripts plus a summary table into its own Dev Notes
(`docs/bmad/nestjs-migration/stories/5-10-full-surface-parity-sweep.md`). That was a single
point-in-time snapshot. Since then, Epics 7 (cutover), 11 (`DELETE /transaction/:id`
ownership scoping), 12 (auth-seam refile) and 13 (docs) have all landed, any one of which
could have introduced a silent divergence 5.10 never had the chance to catch.

Both origins are still live: GR-1 keeps every file under `frontend/src/app/api/` and
`frontend/src/server/` serving traffic unedited for the whole initiative, and Epic 7 only
flipped which one the frontend's configured seams (`NEXT_PUBLIC_API_TARGET`,
`NEXT_PUBLIC_AUTH_TARGET`, both defaulting to `nest` per `docker-compose.yml:50-51`) point
at. So this story can re-run the same two-origin comparison 5.10 did, not just diff the new
backend against a frozen recording.

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md` is the per-endpoint contract
5.10 checked against and this story checks against again - its divergence table (the seven
FR-2 rows, plus the eighth FR-27 row added for `DELETE /transaction/:id`) and story 5.9's
Dev Notes (the F3 additive-metrics divergence) are the two categories of intentional,
already-decided difference. Anything found outside those two categories is a regression.

## Acceptance Criteria

- [x] Reconstruct 5.10's fixtures: a temporary `User` row (bcrypt-hashed, not one of the two
      real accounts), and the same three-row `BTC` lot shape 5.10 used - `BUY` 2024-01-01
      size 0.5 @ 40000 fee 50; `BUY` 2025-06-01 size 0.5 @ 60000 fee 50; `SELL` 2026-08-01
      size 0.3 @ 70000 fee 20 - inserted directly into `portfolio-db`, following the
      disposable-row convention 5.10 and 11.1 both used.
- [x] For each of the 18 numbered FR-1 endpoints (same exclusion of `auth/[...nextauth]` as
      5.10), issue the same request(s) 5.10 recorded against both the old Next.js route and
      the new NestJS route, using a real NextAuth session for the old route and a real
      `POST /backend/api/auth/login` session for the new one (both cookies can be held
      simultaneously, per 5.10's own note).
- [x] Diff each response against 5.10's recorded transcript for that same row, field by
      field, including runtime JS type for every numeric field. For fields whose value is
      expected to move with live market or clock state (e.g. `currentPrice`,
      `valueOfHoldings`, anything downstream of the crypto.com price feed or the injected
      clock) diff shape and type, not the literal value; for everything else, an exact
      value match is expected given identical seeded inputs.
- [x] Also re-run the at-least-one non-200 case per endpoint 5.10 recorded (bad input,
      missing session, unknown id) and diff its status code and body shape the same way.
- [x] Classify every difference found: either it is already recorded as one of the two
      intentional-divergence categories (the seven FR-2 rows plus the FR-27 row in
      `inventory-endpoint-contracts.md`'s divergence table, or story 5.9's F3
      additive-metrics divergence) - in which case confirm it is exactly that divergence and
      no more - or it is a **regression**.
- [x] Fix every regression found in the owning domain's `backend/src/<domain>/` code, citing
      which story originally established the now-diverging behavior, and re-run that
      endpoint's comparison until it matches. If a fix is large enough to need its own
      review round as a separate unit (a new endpoint-level behavior change, not a small
      correction), stop and record it as a follow-up item in this story's Dev Notes rather
      than expanding this story's diff indefinitely - do not silently absorb it. **No
      regression was found; this AC is satisfied vacuously (see Dev Notes).**
- [x] If any fix changes a DTO's shape, regenerate and commit `frontend/src/api/generated.ts`
      in this story (FR-26) and say so in Dev Notes. **N/A - no fix was needed.**
- [x] Record a summary table (endpoint, 5.10's recorded result, this story's result,
      match/regression-and-fix) in Dev Notes - the artifact this epic's Owner Review reads
      to confirm the surface is still safe.
- [x] Delete every temporary row this story inserted and confirm via row count that none
      remain.

## Technical Notes

`inventory-endpoint-contracts.md`'s divergence table lives around lines 92-101 (the eighth,
FR-27 row) and its earlier seven-row table for the FR-2 tightenings; read the endpoint's own
section there rather than re-deriving the auth posture from scratch.

5.10's full transcripts and summary table are in
`docs/bmad/nestjs-migration/stories/5-10-full-surface-parity-sweep.md`'s Dev Notes - that is
the recorded baseline this story diffs against, not `prd.md` or `architecture.md`.

This is a sweep, not new implementation: no controller or service code is expected to change
unless the sweep finds a real regression. If every comparison matches 5.10's recording (given
the value/type distinction above), this story's Dev Notes are the re-check's transcript plus
"no regressions found" - that is a complete, successful outcome.

A one-off comparison script/harness is expected (same NFR-4 permission 5.10 used) - not
committed, no test runner, no assertions library, no CI hook.

## Out of Scope

- Any new endpoint, DTO, or module.
- Bugs the owner reports from manual use of the app - story 14.2's container, not this
  story's automated re-check.
- The three known-open observability items named in this epic's Scope (Epic 13's F2, the
  pre-existing Prometheus 403/down bug, the stale `prometheus.yml:11` comment) - none is a
  post-cutover regression this endpoint-level re-check would surface.

## Dev Notes

### Result: no regressions found

Re-ran all 18 numbered FR-1 endpoints against both live origins (old Next.js route via
`https://www.tubesock.xyz/api/...`, new NestJS route via
`https://www.tubesock.xyz/backend/api/...`, both through nginx per `nginx/nginx.conf`'s
`location /` and `location /backend/` blocks) and diffed each response against 5.10's
recorded transcript. Every difference found is one of the two already-decided
categories (the FR-2/FR-27 divergence table, or 5.9's F3 additive-metrics divergence),
confirmed to be exactly that divergence and no more. No new regression exists in the
live backend or frontend as of this story's run. No `backend/src/` file was touched;
no DTO shape changed; `frontend/src/api/generated.ts` regeneration produced an empty
diff.

### Method

Fixtures, following 5.10's and 11.1's disposable-row convention:

- Temp `User` row `story141temp` (`User.id: 3`), bcrypt-hashed inside `nest-api`
  (`bcrypt.hash('story141temp', 10)`), not one of the two real accounts
  (`Taylor`/`test`, `User.id` 1/2).
- Same three-row `BTC` (`token_info_id` 1) lot shape 5.10 used, inserted directly:
  `BUY` `2024-01-01` size 0.5 @ 40000 fee 50 (total `-20050`); `BUY` `2025-06-01` size
  0.5 @ 60000 fee 50 (total `-30050`); `SELL` `2026-08-01` size 0.3 @ 70000 fee 20
  (total `20980`) - `total`s computed with the same formula
  `transaction/add/route.ts` uses, confirmed against 5.10's own recorded
  `totalBuyCost`/`totalSellProfits` (50100/20980), which matched exactly.
- Old-route session: real NextAuth CSRF (`GET /api/auth/csrf`) +
  `POST /api/auth/callback/credentials` flow, cookie
  `__Secure-next-auth.session-token`. New-route session: real
  `POST /backend/api/auth/login` (story 4.5), cookie `portfolio_session`. Both
  verified via `GET .../auth/session` resolving to `User.id: 3` before any comparison
  ran.
- Redis: `time-frame-pl-d-coinName-bitcoin`, `time-frame-pl-all-coinName-bitcoin`, and
  `net-cash-flow-history-3-d` were seeded/cleared per check exactly as 5.10 did, to
  exercise both cache-hit and cache-miss paths deliberately.

All temporary rows/keys were deleted after every check. Final state confirmed:
`SELECT COUNT(*) FROM Transaction` = 236 (same as pre-sweep baseline),
`SELECT COUNT(*) FROM User` = 2 (`Taylor`, `test` only), `KEYS "*story141*"` empty.

### Full comparison transcript (18 endpoints)

**`POST /transaction/add`** - valid body (ISO date), both origins ->
`200 "Transaction added"`, byte-identical. Errors: missing `size` -> both
`400 {"error":"Missing required fields"}`; `side:"HOLD"` -> both
`400 {"error":"Invalid side"}`; no session -> both `401 {"error":"Unauthorized"}`.
Match - no divergence from 5.10. (One harness mistake along the way, not a defect:
a first attempt used a bare `YYYY-MM-DD` date string against the *old* route only;
Prisma's `date` column requires a full ISO-8601 datetime and threw
`Invalid value for argument date: premature end of input`, a client-input error in
this test's own request, not a route behavior difference - the NestJS route was never
sent that malformed input. Retried with `2026-08-28T00:00:00.000Z` and both origins
returned `200` identically.)

**`DELETE /transaction/:id`** - own written row on each origin -> both `204` empty
body. Nonexistent id (`9999999`) -> both
`500 {"error":"An error occurred while deleting the transaction"}`. No session -> both
`401 {"error":"Unauthorized"}`. Match. Also re-confirmed FR-27's ownership scoping
(Epic 11): seeded a second temp user (`story141temp2`, `User.id: 4`) with its own
transaction row (`id 2004`); `DELETE /backend/api/transaction/2004` under user 3's
session returned the same `500 {"error":"An error occurred while deleting the
transaction"}` as a nonexistent id, and the row was confirmed still present
(`SELECT COUNT(*) FROM Transaction WHERE id=2004` = 1) - the divergence table's own
row, present and correct, not a new one.

**`GET /summary/coins`** - both origins, byte-identical:
`[{"productName":"BTC","coinName":"Bitcoin","avgPurchasePrice":50100,"avgSellPrice":69933.33055443245,"holdings":0.699999988079071,"valueOfHoldings":55824.999049305916,"profitLossAtCurrentPrice":26704.999049305916,"percentPL":53.30339131597987,"currentPrice":79750,"breakEvenPrice":41600.00070844379,"inGreen":true,"totalBuyCost":50100,"totalSellProfits":20980,"costBasis":29120,"netContributions":50100,"netCashHoldings":20980}]`
(`currentPrice`/`valueOfHoldings`/`profitLossAtCurrentPrice`/`percentPL` differ from
5.10's recorded values only because live market price moved, per the value/type
distinction the AC calls for - same shape, same runtime types on every field). No
session -> both `401`. Match.

**`GET /summary/portfolio`** - both origins, byte-identical:
`{"purchases":50100,"sales":20980,"costBasis":29120,"valueOfHoldings":55824.999049305916,"totalPLatCurrentPrice":26704.999049305916,"netCashHoldings":20980,"netContributions":50100,"accountValue":76804.99904930592,"realizedReturn":-29120,"roi":53.30339131597987,"inGreen":true}`
- same live-price-driven fields as above, everything else exact. No session -> both
`401`. Match.

**`GET /summary/BTC`** - both origins, identical single-element array to
`summary/coins` above, byte-identical. No session -> both `401`. Match.

**`GET /summary/profitLossChart?timeFrame=d`** - cache-miss case first (cleared
`time-frame-pl-d-coinName-bitcoin`): both `500` (old: empty body, new:
`{"error":"Internal Server Error"}`) - the already-documented uncaught-throw pattern
(5.2's Dev Notes), not new. Cache-hit case: seeded a two-point series spanning before
and after the seeded `SELL`, cleared `net-cash-flow-history-3-d` before each call:
`old`/`new` both -> `{"netRows":[{"date":1749945600000,"valueOfHoldings":50000,"profitLoss":-100,"roi":-0.19960079840319359},{"date":1786752000000,"valueOfHoldings":48999.99916553497,"profitLoss":19879.999165534973,"roi":39.68063705695604}],"lowestPointIndex":0,"highestPointIndex":1}`
- byte-identical (deterministic given the seeded price series and seeded
transactions - no live-price dependency on this endpoint since the price series is
provided directly). Match.

**`GET /summary/profitLossChart/d`** (path variant) - re-ran identically with the
cache cleared again first: byte-identical to the query variant above on both origins.
No session -> both `401` (checked on both variants). Match.

**`GET /stats/BTC`** - both origins, byte-identical:
`{"productName":"BTC","avgPurchasePrice":"$50,100","avgSellPrice":"$69,933","holdings":"0.7000","valueOfHoldings":"$55,825","profitLossAtCurrentPrice":"$26,705","percentPL":"53.3%","currentPrice":"$79,750","breakEvenPrice":"$41,600"}`.
`GET /stats/NOPE` (no matching rows) - old `500` empty body (framework crash on
`NextResponse.json(undefined)`), new `200` `content-length: 0` - the already-documented
intentional divergence (5.7's Dev Notes), reconfirmed exactly as recorded, not a new
shape. No session -> both `401`. Match.

**`GET /product/BTC`** - both origins, byte-identical full 3-row body (most-recent-
first, `realizedGains` on the `SELL` row: `{"total":8970,"short":0,"long":8970}`
matching the FIFO math the seeded lot shape produces). `GET /product/NOPE` -> both
`200 []`. No session -> both `401`. Match.

**`GET /exchange-rates/d/bitcoin`** (seeded cache) - both origins, byte-identical:
`{"prices":[[1787486400,60000,60500]],"price_change":0.02,"usd_price_change":600}`.
Cache miss (`d/nonexistentcoinxyz1401`) -> both `500` (old empty body, new
`{"error":"Internal Server Error"}`), matching 5.2's documented pattern. Public - no
session tested, per FR-2. Match.

**`GET /exchange-rates/unit/BTC`** - both origins: `"$79,470"` (bare string), byte-
identical (value differs from 5.10's recording only because live price moved). Unknown
unit (`unit/NOPE1401`) -> both `404 "Exchange rate not found"` (bare string). Public.
Match.

**`GET /price-history/check`** - authenticated, both origins, byte-identical:
`[{"coinName":"Bitcoin","timeFramesNeeded":["h","all"]}]` (`w`/`m`/`3m`/`6m`/`y`
already cached from earlier sweep and manual-testing activity on this coin, same as
5.10 observed - `d` was populated by this sweep's own seeding, hence not listed as
needed). No session: old `200 []` (today's silent fall-through), new
`401 {"error":"Unauthorized"}` - the documented FR-2 tightening, confirmed to be
exactly that and no more. Match.

**`POST /price-history/set`** - identical body, both origins -> both
`200 {"message":"Price history cached successfully: <coinName> - <timeFrame>"}`; both
Redis writes read back byte-identical
(`{"prices":[[1700000000,100,101]],"price_change":0.01,"usd_price_change":1}`),
confirming 5.10's own DTO fix (`PriceHistoryResponseDto`'s class-validator decorators)
is still in effect - the nested body is not stripped. Missing `coinName` -> both
`400 {"error":"Missing required fields"}`. Public. Match.

**`GET /time-frame-coins-pl/d`** (seeded 3-point cache spanning the lot's full date
range) - both origins, byte-identical:
`{"BTC":{"pastPl":5879.999403953552,"curPl":12879.999284744263,"timeFrameStartPrice":50000}}`
(`curPl` differs from 5.10's recorded value only because live price moved; `pastPl`
and `timeFrameStartPrice` are deterministic from the seeded series and match exactly).
Unsupported `timeFrame` (`bogus`) -> both `500` (old empty body, new
`{"error":"Internal Server Error"}`). No session -> both `401`. Match.

**`GET /time-frame-total-pl/d`** - both origins, byte-identical:
`{"pastTotalValue":34999.99940395355,"currentTotalValue":55629.20686514024,"totalPastPl":5879.999403953552,"totalCurPl":26509.206865140237}`
(`currentTotalValue`/`totalCurPl` live-price-driven, everything else exact). No
session -> both `401`. Match.

**`GET /token-info/3`** - old (no guard, unauthenticated request) and new (own
session), both -> `200 {"success":true,"userId":3}` once the shared
`time-frame-pl-all-coinName-bitcoin` cache was seeded (both origins' sync reads
through the same cache-or-throw path 5.2 already documented - an initial attempt with
that cache empty threw `500`/`{"error":"Internal Server Error"}` identically on both
origins, confirming it is the same shared pre-existing behavior and not a new
divergence between them). `GET /token-info/0` -> both
`400 {"error":"Missing userId param"}`. New-only tightenings: session for a different
user's id (`/token-info/1` with user 3's session) -> `403 {"error":"Forbidden"}`; no
session -> `401 {"error":"Unauthorized"}` - both the documented FR-2 tightening, no
old-route equivalent to diff against. Match.

**`GET /token-info/search/bit`** - both origins: identical 10-row arrays, led by
`{"token_id":1,"symbol":"BTC","slug":"bitcoin","name":"Bitcoin","rank":1}`. Space-only
term (`%20`) -> both a single identical row. Public. Match.

**`GET /metrics`** - with the real `METRICS_SECRET` bearer token, both origins:
`200`, `text/plain` (`charset`/`version` parameters present on both, in a different
order between origins - a media-type-parameter ordering artifact of the two
frameworks' own Prometheus client libraries, not a body or behavior difference; every
scraper parses media-type parameters independent of order), Prometheus exposition
format. Compared every `# HELP`/`# TYPE` line between origins: identical set of 70
lines on both, new backend's four additional D31 metrics
(`external_api_calls_total`, `redis_cache_results_total`, `http_requests_total`,
`http_request_duration_ms`) present on both origins in this run because 5.9's
D31 metrics module ships in the running backend - the documented F3 additive
divergence, reconfirmed, not a new one. No/incorrect token -> both `403` plain text
`Forbidden` (byte-identical, not JSON, on both origins). Match.

**`auth/[...nextauth]`** - not re-tested, per the AC's own exclusion (out of contract-
inventory scope per story 2.1; Epic 4's stories 4.5/4.6/4.8 cover the new auth
endpoints).

### Summary table (Epic 14 Owner Review artifact)

| Endpoint | 5.10's recorded result | This story's result | Match / regression-and-fix |
| --- | --- | --- | --- |
| `POST transaction/add` | Match (200/400/400/401) | Match (200/400/400/401) | Match - byte-identical |
| `DELETE transaction/:id` | Match (204/500/401) | Match (204/500/401); FR-27 ownership scoping re-confirmed on a foreign row | Match |
| `GET summary/coins` | Match, byte-identical | Match, byte-identical shape/type (live-price fields excepted) | Match |
| `GET summary/portfolio` | Match, byte-identical | Match, byte-identical shape/type | Match |
| `GET summary/:unit` | Match, byte-identical | Match, byte-identical shape/type | Match |
| `GET summary/profitLossChart` (query) | Match (post-F3 fix) | Match, byte-identical on the deterministic seeded-price-series case | Match |
| `GET summary/profitLossChart/:timeFrame` | Match | Match, byte-identical | Match |
| `GET stats/:unit` | Match on rows; recorded no-match divergence (5.7) | Match on rows; same recorded divergence, no more | Match |
| `GET product/:product` | Match, byte-identical incl. FIFO artifact | Match, byte-identical | Match |
| `GET exchange-rates/:timeFrame/:coinName` | Match on status; recorded 500-body divergence (5.2) | Match on status; same recorded divergence | Match |
| `GET exchange-rates/unit/:unit` | Match, byte-identical | Match, byte-identical | Match |
| `GET price-history/check` | Match on success; recorded FR-2 tightening on unauth | Match on success; same recorded tightening | Match |
| `POST price-history/set` | Match (5.10's own DTO fix) | Match - fix still in effect, nested body not stripped | Match |
| `GET time-frame-coins-pl/:timeFrame` | Match on status; recorded 500-body divergence | Match on status; same recorded divergence | Match |
| `GET time-frame-total-pl/:timeFrame` | Match, byte-identical | Match, byte-identical shape/type | Match |
| `GET token-info/:userId` | Match on shared cases; recorded FR-2 tightening (Epic 11 ownership) | Match on shared cases; same recorded tightening | Match |
| `GET token-info/search/:searchTerm` | Match, byte-identical | Match, byte-identical | Match |
| `GET metrics` | Match on shape; recorded F3 additive-metrics divergence | Match on shape; same recorded divergence (param order differs, immaterial) | Match |
| `auth/[...nextauth]` | Out of contract-inventory scope | Out of contract-inventory scope, not re-tested | N/A |

No regression found. Every difference in the table above is exactly one of the two
already-decided categories this story checked against
(`inventory-endpoint-contracts.md`'s FR-2/FR-27 divergence table, or 5.9's F3 additive-
metrics divergence) - none is newly discovered, and none needed a fix.

### Changed Files

None - this sweep found no regression, so no `backend/src/`, frontend, or generated-client
file was touched. The temporary fixture rows/keys created for the sweep (`User.id` 3/4,
`Transaction.id` 1996-2004, and the Redis keys named in Method above) were all deleted
before this story was marked Done; none is a repository file and none appears in
`git status`.

### Verification

```
$ pnpm --filter @portfolio/backend typecheck
$ tsc --noEmit -p tsconfig.json
(no output - passed)

$ pnpm --filter @portfolio/backend lint
$ eslint "{src,test}/**/*.ts"
backend/src/main.ts 34:1  warning  no-floating-promises on bootstrap() - pre-existing, untouched by this story
✖ 1 problem (0 errors, 1 warning)

$ pnpm --filter @portfolio/backend build
$ nest build
(no output - passed)

$ docker compose up -d --build
(full stack rebuilt cleanly from the current tree; alloy, grafana, loki, nest-api,
next-app, nginx, portfolio-db, prometheus, redis all "Up")
$ curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
{"status":"ok"}

# full 18-endpoint parity re-check - see "Full comparison transcript" above for the
# complete request/response transcripts and the summary table above for the
# consolidated result. No regression found; no code changed.

$ docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!
$ git status --porcelain frontend/src/api/generated.ts
(empty - no DTO/Swagger shape changed; nothing to commit)

# temporary fixture cleanup verification
$ docker exec portfolio-db mysql -uroot -proot PORTFOLIO -e \
  "SELECT COUNT(*) FROM Transaction; SELECT COUNT(*) FROM User;"
236
2
$ docker exec portfolio-db mysql -uroot -proot PORTFOLIO -e \
  "SELECT id, username FROM User;"
1  Taylor
2  test
$ docker exec redis redis-cli KEYS "*story141*"
(empty)
```
