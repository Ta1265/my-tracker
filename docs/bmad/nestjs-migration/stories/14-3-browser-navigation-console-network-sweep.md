# Story 14.3: Browser navigation console/network sweep

Status: Done

## Context

Stories 14.1 and 14.2 both work at the HTTP-response level: 14.1 diffs recorded
request/response transcripts between the two origins, and 14.2 is a container for bugs the
owner reports from using the app. Neither can see a client-side exception, a request the
cut-over frontend fires on its own that 14.1 never had reason to issue directly, a
hydration error, a 404 on a static asset, or a request going to the wrong origin - the
post-cutover regression classes a browser itself would show. This story adds that discovery
method: a real, in-browser sweep of the live app's routes with DevTools' Console and Network
panels open, driven by the Chrome DevTools MCP server rather than by an HTTP client.

This is a separate story from 14.2, not a reframe of it, because the two have different
lifecycles: 14.2 is an open-ended container the owner adds to indefinitely as they use the
app; this story is a single, scoped, agent-driven sweep with a defined route list and a real
exit condition (every route swept, every finding triaged). Folding this into 14.2 would mean
future owner reports and this sweep's own findings share one Dev Notes section with no way to
tell which discovery method found which entry.

**Tooling precondition - blocking:** this story requires the Chrome DevTools MCP server. As
of this story's drafting, no MCP servers are configured for this project (no `.mcp.json`
exists at the repo root) and the DevTools MCP server is not connected to any session. This
story cannot be executed until that server is added and connected. The first action any Dev
agent picking this up takes is confirming the MCP tool is available; if it is not, this story
stays `Draft`/`Ready` rather than being attempted with a substitute (screenshots, curl, or any
other approximation do not satisfy this story's method).

## Acceptance Criteria

- [x] Confirm the Chrome DevTools MCP server is connected and can open a page, read the
      Console panel, and read the Network panel, before proceeding with anything below.
- [x] Sweep the following routes and actions, in this order, against `https://www.tubesock.xyz`,
      with Console and Network panels captured for each step:
      1. Unauthenticated `GET /` - expect a redirect to `/login` (`frontend/src/app/page.tsx`
         redirects based on session state).
      2. Unauthenticated direct navigation to `/stats` - expect the auth middleware
         (`frontend/src/middleware.ts`) to redirect to `/login?callbackUrl=%2Fstats`.
      3. Unauthenticated direct navigation to `/product?unit=BTC&name=Bitcoin` - expect the
         same middleware redirect, with the callback URL preserving the query string.
      4. Sign in at `/login` with username `taylor`, password `test` - a real account already
         in `portfolio-db` (`User.id` 1, per story 14.1's Dev Notes), not a disposable fixture;
         do not create, modify, or delete this row or its data.
      5. Authenticated `GET /` - expect a redirect to `/stats`.
      6. Authenticated `/stats` - let `SummaryLayout` and `StatsTable` finish loading.
      7. From `/stats`, click the BTC row (`frontend/src/components/StatsTable.tsx:237`
         builds the link as `/product?unit=<productName>&name=<coinName>`) to land on
         `/product?unit=BTC&name=Bitcoin`; interact with the `TimeFrameSelect` control
         (`frontend/src/components/product/TimeFrameSelect.tsx`) to trigger at least one
         additional data fetch.
      8. Sign out via the control in `TopNav` (`frontend/src/components/TopNav.tsx`) and
         confirm the app redirects to `/login` and that `/stats` is no longer reachable
         without signing in again.
- [x] Before this sweep, verify this route list and the click paths between routes still
      match `frontend/src/app/**/page.tsx` and the components above - the PRD did not
      enumerate exact paths and `/product/*` in the owner's own phrasing is not literally
      correct (it is a query-string route, `/product?unit=...&name=...`, not a path segment).
      Note and sweep any route found that is not listed above.
- [x] Classify every Console entry and every Network request captured against the finding
      categories in Technical Notes. For each item classified as a **finding**, record: the
      route/action it occurred on, the exact console message or request (method, URL,
      status), and why it doesn't match a known-safe category.
- [x] For each finding, check it against story 14.1's summary table and this epic's three
      named excluded items (Scope section) before treating it as newly discovered - if it's
      already one of those, say so and do not re-litigate it here.
- [x] Fix any confirmed regression in the owning `frontend/src/` (or `backend/src/`, if the
      root cause is server-side) code, citing the file and line. If a fix is large enough to
      need its own review round (more than a small correction, or anything touching more than
      one domain), split it into `14.3a`, `14.3b`, ... following the `1.2a` convention and
      record the split in this story's Dev Notes rather than absorbing it here regardless of
      size.
- [x] If a fix changes a DTO's shape, regenerate and commit `frontend/src/api/generated.ts`
      (FR-26) in the same sub-item and say so.
- [x] Record a findings table (route/action, findings, disposition: pre-existing / fixed /
      split-out) in Dev Notes - a sweep that finds nothing is a complete, valid outcome and
      must be reported as such, not padded with cosmetic warnings to look thorough.

## Technical Notes

**Finding categories and thresholds** (the precision the owner asked for - report real
regressions, not benign noise):

- **Console error** - any `console.error` call, uncaught exception, or unhandled promise
  rejection shown in the Console panel. Always a finding; there is no pre-existing-noise
  exception for this category on these routes.
- **Console warning** - a finding only if its text names a `/backend/api/` or `/api/` URL, an
  auth/session/cookie term, or a hydration/React-error-boundary term. Skip warnings that are
  purely cosmetic library noise (MUI, Emotion, Framer Motion deprecation notices) unrelated to
  any of those terms.
- **Failed network request** - any Network entry with a non-2xx/3xx status. Not a finding if
  it matches a status/URL/trigger-condition combination already recorded in 14.1's summary
  table (e.g. a cache-miss 500 on `/summary/profitLossChart`) or Story 14.1's Dev Notes; a
  finding if the status, URL, or trigger condition differs from what's recorded there.
- **Request to an unexpected origin** - any Network entry whose host is not
  `www.tubesock.xyz` (same-origin relative paths included). All of the app's own data calls
  are server-proxied through `/api/` or `/backend/api/`; there is no legitimate reason for the
  browser itself to call a third-party host directly. Always a finding.
- **Duplicated request** - the same method+URL firing more than once for a single user action.
  Not a finding if the running `next-app` container was built with `TARGET=dev` (check via
  `docker inspect next-app` or the compose config in effect) and the duplicate is consistent
  with React 18 Strict Mode's dev-only double-invoke of effects - confirm this by checking
  whether the duplicate fires exactly twice, back-to-back, with identical request bodies.
  Also not a finding if the second request is an intentional re-fetch through
  `frontend/src/context/ReloadContext.tsx`'s `useReload` (e.g. after a transaction mutation).
  Everything else duplicated is a finding.

`frontend/src/middleware.ts`'s `config.matcher` (`['/stats', '/product/:path*',
'/stats/:path*']`) is what enforces the unauthenticated-redirect steps above; it runs
`nestMiddleware` (verifying the `SESSION_COOKIE_NAME` cookie) since the auth seam defaults to
`nest` per `docker-compose.yml:50-51`, same as story 14.1 confirmed for the HTTP layer.

This sweep is discovery, not new implementation - no frontend or backend code is expected to
change unless a real regression is found, same posture as story 14.1.

## Out of Scope

- Anything story 14.1's endpoint-level re-check already covers, or a bug the owner reports
  directly (14.2's container) rather than one this sweep surfaces itself.
- The three known-open observability items named in this epic's Scope.
- Any route not reachable from the navigation paths above (there is no admin panel or other
  authenticated surface in this app beyond `/`, `/login`, `/stats`, and `/product`).
- Building or wiring the Chrome DevTools MCP server itself - that is a precondition this story
  waits on, not work this story performs.

## Dev Notes

Swept 2026-08-28 against `https://www.tubesock.xyz` (local stack via `/etc/hosts` ->
192.168.200.1), Chrome DevTools MCP, one isolated browser context so the run started with no
cookies. `next-app` was confirmed running `pnpm --filter @portfolio/frontend dev`
(`TARGET=dev`), so React 18 Strict Mode's dev-only double-invoke applies to the duplicate
classification below.

### Route list verification

The route list in the Acceptance Criteria matches `frontend/src/app/**/page.tsx` exactly -
`/`, `/login`, `/stats`, `/product` are the only pages, and `/product` is a query-string
route as this story already noted. No unlisted route was found. Two corrections to the
story's own wording, neither a defect:

- `frontend/src/components/StatsTable.tsx:235-237` navigates with `router.push`, not an
  anchor. This story described it as "builds the link as"; the URL it builds is exactly as
  described, but there is no `<a>` element, so a row click cannot be found by href.
- `frontend/src/middleware.ts:53`'s matcher `/product/:path*` does match the bare
  `/product` (Next matches zero-or-more segments). Step 3 confirmed the redirect fires and
  preserves the query string.

### Step results

| # | Route / action | Result |
|---|---|---|
| 1 | Unauthenticated `GET /` | Pass - 307 to `/login` |
| 2 | Unauthenticated `/stats` | Pass - `/login?callbackUrl=%2Fstats` |
| 3 | Unauthenticated `/product?unit=BTC&name=Bitcoin` | Pass - callback preserves the encoded query string |
| 4 | Sign in `taylor` | Pass - `POST /backend/api/auth/login` 200, redirected to the callback URL |
| 5 | Authenticated `GET /` | Pass - redirect to `/stats` |
| 6 | `/stats` full load | Pass after F2 fixed; surfaced F2 |
| 7 | BTC row click -> `/product`, `TimeFrameSelect` -> Week | Pass - `exchange-rates/w/Bitcoin` 200 fired on the change |
| 8 | Sign out, then `/stats` | Pass - `POST /backend/api/auth/logout` 204, redirect to `/login`, `/stats` -> `/login?callbackUrl=%2Fstats` |

### Findings

| ID | Route/action | Finding | Disposition |
|----|--------------|---------|-------------|
| F1 | `/product` document | SSR `ReferenceError: window is not defined`, document 500 | **Fixed** - pre-existing, not a cutover regression |
| F2 | `/stats` | `POST /backend/api/price-history/set` 500 storm (`PayloadTooLargeError`), unbounded retry loop | **Fixed** - post-cutover regression |
| F3 | `/product` | `exchange-rates/d/*` 500 | **Fixed** by F2 - downstream symptom, not independent |
| F4 | `/stats`, `/product` | Coinbase WS `send()` on a CONNECTING socket, intermittently blanks the page | **Split out -> story 14.3a** |
| F5 | all authenticated routes | `GET /api/auth/session` fires alongside `/backend/api/auth/session` | Not a defect - by design during coexistence |
| F6 | all routes | `wss://.../_next/webpack-hmr` 404 | Not a finding - dev-only, nginx does not proxy the HMR socket |
| F7 | `/stats` | `price-api.crypto.com` requests direct from the browser | Pre-existing app design, unrelated to the cutover |
| F8 | `/product` | React "key prop spread into JSX" warnings; Chart.js `Filler` plugin warning | Below this story's threshold - cosmetic library noise |

**F1 - SSR crash on `/product`.** `frontend/src/components/product/LineChart.tsx` referenced
bare `window` at three sites inside the chart-options object, which is evaluated during
render and therefore on the server. `window?.innerWidth` does not help: `window` is an
undeclared identifier, so it throws `ReferenceError` before optional chaining applies. A user
hitting `/product` by direct URL or hard refresh got a 500. Introduced by `6a631be`
("Upgrade to nextjs app router"), the branch's first commit - it predates this initiative's
epics, so it is not a cutover regression, but it is a live 500 on a primary route with a
one-line root cause, so it was fixed here rather than left. Fixed by adding an
`isNarrowViewport()` helper alongside the file's existing `getCssVar()`, which already
established the `typeof window === 'undefined'` guard idiom in this same file. Server
fallback is the desktop branch; the client re-renders on hydration.

**F2 - `price-history/set` 500 storm.** This is the significant post-cutover regression and
the one story 14.1 could not have caught. `/stats` fires `price-history/check`, fetches the
missing series from `price-api.crypto.com`, then POSTs each series to
`POST /backend/api/price-history/set`. Those bodies are ~232KB (`content-length: 237344`
measured on the Ankr `all` series). NestJS's `main.ts` set no body-parser limit, so Express's
100KB default rejected them with `PayloadTooLargeError` -> 500. Because `set` never
succeeded, the cache never filled, so the next `check` re-triggered the whole cycle - an
unbounded loop, hundreds of requests and 60 backend errors observed in a single page visit,
hammering a third-party API on every render.

`main.ts:20-21` states the governing principle for exactly this class of bug: *"Permissive by
design: must never reject a request the existing Next.js routes accept."* App Router route
handlers enforce no body-size limit, so the legacy route accepted these payloads and NestJS
did not - the definition of a cutover regression. Fixed by typing the app as
`NestExpressApplication` and calling `app.useBodyParser('json', { limit: '10mb' })`. 10mb
was chosen over a tighter bound because the legacy route had no limit at all and these series
grow by one entry per day.

**F3 - `exchange-rates/d/*` 500.** Initially triaged as pre-existing, matching story 14.1's
recorded "cache miss -> 500 on both origins" (14.1 Dev Notes line 206). That triage was
wrong and is corrected here: 14.1 recorded how a *genuine* miss behaves, having seeded the
cache itself to test the hit path. In the live app the miss was caused by F2 - `set` could
never populate the `d` cache. After the F2 fix, `exchange-rates/d/Bitcoin`,
`d/bitcoin` and `d/Ethereum` all return 200 and Redis grew to 121 keys. No independent
defect, no separate fix.

**F4 - Coinbase WS feed crash (split out).** `frontend/src/context/CoinbaseWsFeedContext.tsx`
`addSubscription` (lines 74-78) queues a subscription by assigning `ws.onopen = () =>
ws.send(message)`, which overwrites the handler installed in `connect()` at line 45 - the one
that sets `this.open = true`. The instance flag then drifts out of sync with the socket's real
`readyState`, and `send()` gets called on a CONNECTING socket. The resulting uncaught
`InvalidStateError` (observed 25 times in one load, with 15 `CLOSING or CLOSED` errors
alongside) propagates to `NotFoundErrorBoundary` and unmounts the React tree, leaving a blank
page. Reproduced intermittently on `/stats`; a subsequent navigation rendered normally, so it
is a race rather than a deterministic failure.

Not fixed here. Per this story's Acceptance Criteria a fix that is "more than a small
correction" is split out, and correcting this means reworking the socket's lifecycle and
subscription queueing to key off `readyState` and additive listeners rather than a
hand-maintained flag and handler reassignment - not a small correction, and a careless fix
makes the race worse. Raised as **story 14.3a**. The file's only history in this repo is
`fbcb68f` (the story 1.2 path move), so this is pre-existing, not a cutover regression.

**F5 - dual session reads.** Under `NEXT_PUBLIC_AUTH_TARGET=nest` the app still calls the
legacy `GET /api/auth/session` on every page load, because `frontend/src/app/providers.tsx:34`
mounts NextAuth's `SessionProvider` unconditionally and
`frontend/src/auth/useCurrentSession.ts:9` must call `useSession()` unconditionally to obey
the rules of hooks. This is the coexistence design working as specified, not a regression -
GR-1 keeps the legacy route serving and NFR-5 requires the seam stay switchable. Recorded
here because it is a live dependency on `frontend/src/app/api/` that whoever proposes Epic 8
must remove in the same change that deletes those routes.

While tracing F5 the rendered component was confirmed to be the seam-aware
`frontend/src/components/top-nav/TopNav.tsx` (`Layout.tsx:4`), which correctly uses
`useCurrentSession()` and `seamSignOut`. The older `frontend/src/components/TopNav.tsx`, which
still imports `useSession`/`signIn`/`signOut` from `next-auth/react` directly, is imported by
nothing - dead code orphaned when the seam consolidation moved the component into `top-nav/`.
It is not a defect and deleting it is not this story's scope, but it is a live file that
contradicts the seam and is worth removing.

### Harness note, not an app defect

A synthetic `element.click()` on the Sign out button did not reach React's handler and fired
no request; dispatching a real `MouseEvent` on the same button produced
`POST /backend/api/auth/logout` 204 and the correct redirect. The application behaved
correctly in both the failing and passing attempt - this was an artifact of how the sweep
drove the button, recorded so a later reader does not mistake it for a sign-out bug.

### Changed Files

~ `frontend/src/components/product/LineChart.tsx`  SSR-safe viewport helper; fixes the `/product` 500
~ `backend/src/main.ts`                            10mb JSON body limit; fixes the price-history 500 storm

### Verification

```
$ pnpm --filter @portfolio/frontend typecheck
15 pre-existing errors, unchanged from baseline (verified by stashing this story's
edit and re-running: 15 before, 15 after). None in the changed code; the LineChart
error at line 123 -> 128 is the pre-existing `VerticalLiner` plugin-type error,
shifted only by the 5 added lines.

$ pnpm --filter @portfolio/frontend lint
0 errors, warnings only, none in LineChart.tsx

$ pnpm --filter @portfolio/backend typecheck
(no output - passed)

$ pnpm --filter @portfolio/backend lint
1 warning: no-floating-promises on bootstrap() at main.ts:40 - the pre-existing warning
story 14.1 recorded at line 34, moved by the 6 added lines. 0 errors.

# F1 verified
$ docker logs next-app | grep -c "window is not defined"   # after fix, since reload
0
document request for /product?unit=BTC&name=Bitcoin: 500 -> 200

# F2 verified
$ docker logs nest-api | grep -c "request entity too large"  # after restart
0
$ docker logs nginx | grep "price-history/set"   # one full /stats load after the fix
15 requests, all 200, loop terminated (was hundreds, majority 500)

# F3 verified
exchange-rates/d/Bitcoin -> 200, d/bitcoin -> 200, d/Ethereum -> 200  (all were 500)
redis keys: 121 (the d-timeframe cache now populates)

$ git status --porcelain frontend/src/api/generated.ts
(empty - neither change touches a DTO or the Swagger shape, so FR-26 regeneration
does not apply)
```

No fixture rows or Redis keys were created by this sweep. It signed in as the real `taylor`
account (`User.id` 1) per this story's Acceptance Criteria and did not create, modify or
delete that row or its data; the only writes were the app's own price-history cache fills,
which are the behavior under test.
