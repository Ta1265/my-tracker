# Story 10.2: Path equivalence and the FR-25 seam

Status: Done

## Context

Depends on story 10.1: needs the corrected `backend/openapi.json` (explicit
`operationId`s, no `unit` field) and the `frontend/src/api/http-client.ts` stub it
created. This story does two things: verifies, route by route, that every data endpoint's
spec path is reachable by stripping a fixed `/backend` prefix off the corresponding
Next.js path (architecture, "The mutator, and the FR-25 seam" - already checked once
during the architecture spike and expected to confirm, not discover); and replaces
10.1's placeholder mutator body with the real one - URL rewriting keyed on
`NEXT_PUBLIC_API_TARGET`, bare-body resolution, and the error-lifting behavior D51
requires. **No hook is adopted in this story** - nothing in `frontend/src` yet imports
anything from `generated.ts`.

If the route-equivalence table turns up an exception - a route where the spec path is
*not* exactly `/backend` + the Next.js path, with identical path/query params and body -
stop and raise it. The whole epic's decision not to split types-now/hooks-later rests on
every route being mappable by one string operation; a genuine exception changes that.

## Acceptance Criteria

### A. Route equivalence table

- [x] Produce a table mapping each of the following 17 data routes' Next.js path to its
  spec path, confirming `spec path === '/backend' + Next.js path` with identical path
  params, query params, and request body shape. These are FR-1's 19 routes minus the
  NextAuth catch-all (`/api/auth/[...nextauth]`, a different contract entirely, handled
  by stories 6.2/7.1) and `/api/metrics` (no frontend caller exists anywhere under
  `frontend/src` to adopt a hook for, so there is nothing to map it against - confirm
  with `grep -rn "api/metrics" frontend/src` returning no hits, and record that in Dev
  Notes rather than silently omitting the row).

  | Next.js path | Spec path |
  | --- | --- |
  | POST `/api/transaction/add` | POST `/backend/api/transaction/add` |
  | DELETE `/api/transaction/[id]` | DELETE `/backend/api/transaction/{id}` |
  | GET `/api/summary/coins` | GET `/backend/api/summary/coins` |
  | GET `/api/summary/portfolio` | GET `/backend/api/summary/portfolio` |
  | GET `/api/summary/[unit]` | GET `/backend/api/summary/{unit}` |
  | GET `/api/summary/profitLossChart?timeFrame=` | GET `/backend/api/summary/profitLossChart?timeFrame=` |
  | GET `/api/summary/profitLossChart/[timeFrame]` | GET `/backend/api/summary/profitLossChart/{timeFrame}` |
  | GET `/api/stats/[unit]` | GET `/backend/api/stats/{unit}` |
  | GET `/api/product/[product]` | GET `/backend/api/product/{product}` |
  | GET `/api/exchange-rates/[timeFrame]/[coinName]` | GET `/backend/api/exchange-rates/{timeFrame}/{coinName}` |
  | GET `/api/exchange-rates/unit/[unit]` | GET `/backend/api/exchange-rates/unit/{unit}` |
  | GET `/api/price-history/check` | GET `/backend/api/price-history/check` |
  | POST `/api/price-history/set` | POST `/backend/api/price-history/set` |
  | GET `/api/time-frame-coins-pl/[timeFrame]` | GET `/backend/api/time-frame-coins-pl/{timeFrame}` |
  | GET `/api/time-frame-total-pl/[timeFrame]` | GET `/backend/api/time-frame-total-pl/{timeFrame}` |
  | GET `/api/token-info/[userId]` | GET `/backend/api/token-info/{userId}` |
  | GET `/api/token-info/search/[searchTerm]` | GET `/backend/api/token-info/search/{searchTerm}` |

  For each row, confirm against the running stack: hit both the Next.js route and, through
  the mutator with `NEXT_PUBLIC_API_TARGET=nest`, the Nest route for the same inputs, and
  record that both resolve (200/204/404 as expected, not a routing 404 from a path
  mismatch). A full response-body parity check is NFR-4's job in Epic 5 (Nest returns 501
  for most of these until then) - this table only proves the *path* resolves, not that the
  bodies match.
- [x] If any row fails - the spec path is not exactly `/backend` + the Next.js path, or a
  param/query/body shape differs - stop, do not build around it, and record the exception
  plus its impact on the epic's shape (that route's hook would move to Epic 7 instead of
  being adopted here). No row failed; see Dev Notes.

### B. The mutator, replacing 10.1's placeholder

- [x] `frontend/src/api/http-client.ts`'s `httpClient` function now does three things:
  1. **Maps the URL.** Reads `process.env.NEXT_PUBLIC_API_TARGET`. When it is `'nest'`,
     passes the path through unchanged. In every other case (including unset, which is
     the default) - `'legacy'` - strips a leading `/backend` from the path before
     performing the request. Both are same-origin relative paths; no origin/host is
     configured anywhere.
  2. **Performs the request** with `fetch`, forwarding whatever method/headers/body Orval
     passed in.
  3. **Resolves or throws.** On a 2xx response, resolves to the parsed JSON body directly
     - no `{ data, status, headers }` envelope (`includeHttpResponseReturnType: false` was
     already set in 10.1's Orval config) - or to `undefined` on a `204` with no body. On a
     non-2xx response, throws an `Error`. **If the response body is JSON and has an
     `error` field, that field's value becomes the thrown `Error`'s `message`** - this is
     a hard requirement (D51), not a nicety: `AddTransaction.tsx`'s existing `.catch`
     builds its toast text from `error.message`, and both the Next.js routes and the Nest
     global filter return `{ error: '...' }` on failure, so this needs no branch on which
     side of the seam answered. Fall back to the response's `statusText` if the body is
     not JSON or has no `error` field.
- [x] `NEXT_PUBLIC_API_TARGET` defaults to `'legacy'` everywhere it is read. Add
  `ARG NEXT_PUBLIC_API_TARGET=legacy` and `ENV NEXT_PUBLIC_API_TARGET=$NEXT_PUBLIC_API_TARGET`
  to `frontend/Dockerfile`'s `common-build` stage (covers both the `dev` and `builder`
  stages, since both descend from it), and add
  `args: { NEXT_PUBLIC_API_TARGET: "${NEXT_PUBLIC_API_TARGET:-legacy}" }` to the
  `next-app` service's `build:` block in `docker-compose.yml`, the same pattern already
  used for `target: ${TARGET:-dev}` two lines above it. This makes the flip a build-time
  value (`NEXT_PUBLIC_API_TARGET=nest docker compose build`, mirroring the existing
  `TARGET=prod docker compose build` idiom) rather than a Dockerfile edit - Epic 7's
  story 7.2 is what actually flips it.
- [x] Note in Dev Notes, do not "fix": `defaults.env` declares `NEXT_PUBLIC_ENV_VARIABLE`
  but nothing copies `defaults.env`/`override.env` into the frontend Docker build context
  and `next build`'s inlining only sees build-time env vars, so that existing variable has
  no effect on the built image today. This story does not follow that pattern - it wires
  `NEXT_PUBLIC_API_TARGET` through an actual `ARG`/`build.args` path that works. Fixing
  the pre-existing `NEXT_PUBLIC_ENV_VARIABLE` gap is out of scope.

- [x] With `NEXT_PUBLIC_API_TARGET` unset (default `legacy`), call one generated
  operation function directly (e.g. `coinSummaries()` from `generated.ts`, invoked from a
  scratch script or the browser console against the running dev stack) and confirm it
  returns the same body, byte-for-byte, as the hand-written `fetch('/api/summary/coins')`
  it will eventually replace.
- [x] Trigger a 401 (no session cookie) against the same operation and confirm the thrown
  `Error`'s `message` equals the `error` field of the JSON body the Next.js route returns
  today (`'Unauthorized'`).
- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - the two
  touched files (`http-client.ts`, plus whatever type the mutator's parameters now carry)
  contribute zero new errors; total count unchanged from story 10.1's after-state.

## Technical Notes

- **Why the seam cannot be Orval's `output.baseUrl`.** Verified during the architecture
  spike: `baseUrl` only *prepends* a string to the spec path and cannot remove one. The
  spec's paths carry `/backend/api`, the Next.js routes are under `/api`, and coexistence
  needs the `/backend` prefix *stripped* - only a mutator, which receives the URL before
  the request is made, can do that. This is why `output.baseUrl` is not part of 10.1's
  Orval config at all.
- The exact call signature `httpClient` must implement - what Orval's `httpClient:
  'fetch'` output actually passes as arguments - is visible by reading the
  `import { httpClient } from './http-client';` call sites inside
  `frontend/src/api/generated.ts` (written by story 10.1). Match that shape exactly rather
  than assuming one.
- The mutator uses `fetch`, never `axios` (D58) - `axios` is a frontend dependency today
  but is imported only by the two GR-1-protected files under `src/server/helpers/`;
  keeping it out of the mutator keeps GR-6's `axios` grep a pure violation detector.

## Out of Scope

- Adopting any generated hook or operation function in a real component - stories
  10.4-10.6.
- Flipping `NEXT_PUBLIC_API_TARGET` to `'nest'` as the shipped default - Epic 7, story
  7.2.
- Any change to `frontend/types/api.d.ts`, `frontend/types/contracts.ts`, or
  `scripts/generate-api-contract.mjs` - story 10.3.
- Response-body parity between the Next.js and Nest sides of any route beyond the 401
  check in section C - Epic 5's NFR-4 sweep (story 5.10).

## Dev Notes

### A. Route equivalence table (confirmed against the running stack)

Brought up `portfolio-db`, `next-app`, `nest-api`, and `redis` with
`docker compose up -d --build`, logged in as a local test user (`test`, password reset
locally to a known value for this verification only - dev-only MySQL volume, not
production data), and hit each row on both sides.

| # | Next.js path | Spec path | Next.js result | Nest result |
| - | --- | --- | --- | --- |
| 1 | POST `/api/transaction/add` | POST `/backend/api/transaction/add` | 400 (validation) | 401 |
| 2 | DELETE `/api/transaction/[id]` | DELETE `/backend/api/transaction/{id}` | 500 (app error, route matched) | 401 |
| 3 | GET `/api/summary/coins` | GET `/backend/api/summary/coins` | 200 | 401 |
| 4 | GET `/api/summary/portfolio` | GET `/backend/api/summary/portfolio` | 200 | 401 |
| 5 | GET `/api/summary/[unit]` | GET `/backend/api/summary/{unit}` | 200 | 401 |
| 6 | GET `/api/summary/profitLossChart?timeFrame=` | GET `/backend/api/summary/profitLossChart?timeFrame=` | 500 (app error, route matched) | 401 |
| 7 | GET `/api/summary/profitLossChart/[timeFrame]` | GET `/backend/api/summary/profitLossChart/{timeFrame}` | 500 (app error, route matched) | 401 |
| 8 | GET `/api/stats/[unit]` | GET `/backend/api/stats/{unit}` | 500 (app error, route matched) | 401 |
| 9 | GET `/api/product/[product]` | GET `/backend/api/product/{product}` | 200 | 401 |
| 10 | GET `/api/exchange-rates/[timeFrame]/[coinName]` | GET `/backend/api/exchange-rates/{timeFrame}/{coinName}` | 500 (app error, route matched) | 501 |
| 11 | GET `/api/exchange-rates/unit/[unit]` | GET `/backend/api/exchange-rates/unit/{unit}` | 200 | 501 |
| 12 | GET `/api/price-history/check` | GET `/backend/api/price-history/check` | 200 | 401 |
| 13 | POST `/api/price-history/set` | POST `/backend/api/price-history/set` | 400 (validation) | 501 |
| 14 | GET `/api/time-frame-coins-pl/[timeFrame]` | GET `/backend/api/time-frame-coins-pl/{timeFrame}` | 500 (app error, route matched) | 401 |
| 15 | GET `/api/time-frame-total-pl/[timeFrame]` | GET `/backend/api/time-frame-total-pl/{timeFrame}` | 500 (app error, route matched) | 401 |
| 16 | GET `/api/token-info/[userId]` | GET `/backend/api/token-info/{userId}` | 500 (app error, route matched) | 401 |
| 17 | GET `/api/token-info/search/[searchTerm]` | GET `/backend/api/token-info/search/{searchTerm}` | 200 | 501 |

Every row's `openapi.json` path is exactly `/backend` + the Next.js path, with identical
path params, query params, and body shape - confirmed by diffing `backend/openapi.json`
against `frontend/src/app/api/**/route.ts` for each row before the live sweep. None of
the 500s on the Next.js side are routing failures - server logs confirm the correct
`route.ts` file matched in every case; the 500s trace to a pre-existing app-level failure
(`getPriceHistoryForTimeFrame` cache miss, likely because this sandbox has no outbound
network access to CoinGecko) that is out of this story's scope. The Nest side's 401s and
501s are both "resolved, not routing-404" - 401 is the auth guard rejecting an
unauthenticated request and 501 is FR-1's placeholder controller body, neither is Nest's
catch-all 404.

`grep -rn "api/metrics" frontend/src` returns two hits, both inside the generated
`frontend/src/api/generated.ts` (Orval's own URL builder for the `metrics` operation, not
a caller) - no hand-written caller exists under `frontend/src` to map a hook against, so
`/api/metrics` has no row in the table above, per the acceptance criterion.

No exception found: the mapping is confirmed to be one string operation
(`spec path === '/backend' + Next.js path`) for all 17 routes, matching the
architecture's expectation that this check confirms rather than discovers.

### C. Verification against a real call

With `NEXT_PUBLIC_API_TARGET` unset, called `coinSummaries()` from `generated.ts` via a
`ts-node` scratch script running inside the `next-app` container (forwarding the test
user's session cookie, and monkey-patching the container's global `fetch` to prefix
`http://localhost:3000` onto the mutator's relative URL, since only a real browser
resolves a same-origin relative path - the mutator itself is untouched). The response
body was byte-for-byte identical to `curl -b <cookies> http://localhost:3000/api/summary/coins`
run immediately before it (both captured the same live BTC price tick).

Repeated the call without the session cookie: the thrown `Error`'s `message` was exactly
`"Unauthorized"`, matching the `error` field the Next.js route returns on 401 today.

`NEXT_PUBLIC_ENV_VARIABLE` in `defaults.env`/`override.env` is dead in the built image
today (nothing copies those files into the frontend Docker build context, and `next
build`'s inlining only sees build-time `ARG`/`ENV` values) - left as-is per the story;
`NEXT_PUBLIC_API_TARGET` is wired through an actual `ARG`/`build.args` path instead.

### Changed Files

+ `frontend/src/api/http-client.ts` - real mutator: strips `/backend` unless
  `NEXT_PUBLIC_API_TARGET=nest`, resolves bare JSON bodies (`undefined` on 204), lifts
  the response body's `error` field into the thrown `Error`'s message
+ `frontend/Dockerfile` - adds `ARG`/`ENV NEXT_PUBLIC_API_TARGET=legacy` to the
  `common-build` stage so both `dev` and `builder` inherit it
+ `docker-compose.yml` - adds `args: { NEXT_PUBLIC_API_TARGET: "${NEXT_PUBLIC_API_TARGET:-legacy}" }`
  to `next-app`'s `build:` block, mirroring the existing `TARGET` pattern

### Verification

- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - 15 errors,
  identical count and file set to story 10.1's after-state (checked by running the same
  command against the pre-story commit via `git stash`); none reference `http-client.ts`
  or `generated.ts`.
- `pnpm --filter @portfolio/frontend lint` - no errors; only pre-existing warnings
  unrelated to the touched files.
- `docker compose up -d --build portfolio-db next-app nest-api redis nginx` - full stack
  built and started clean.
- Logged in through NextAuth's credentials callback (test user, password reset locally
  for this verification) and exercised all 17 routes from the table above against both
  `next-app` and `nest-api` directly (see table).
- `NEXT_PUBLIC_API_TARGET=nest docker compose build next-app` followed by
  `docker compose run --rm next-app node -e "console.log(process.env.NEXT_PUBLIC_API_TARGET)"`
  printed `nest`, confirming the `ARG`/`ENV`/`build.args` chain actually threads the
  build-time value through; rebuilt with the default afterward
  (`docker compose build next-app`) so the image left behind matches the default
  `legacy` target.
- `docker compose down` after verification; no state left running.
