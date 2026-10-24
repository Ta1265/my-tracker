# Story 7.1: Flip the auth seam's shipped default to NestJS

Status: Done

## Context

Story 6.2 built a single switchable seam - `getAuthTarget()` in `frontend/src/auth/target.ts`,
read by `frontend/src/middleware.ts`, `frontend/src/server/authSession.ts`,
`frontend/src/auth/useCurrentSession.ts`, and `frontend/src/auth/actions.ts` - covering
login, logout, client-side and server-side session reads, and Edge middleware gating of
`/stats` and `/product/*` (architecture finding F1). Both branches are fully implemented
and were exercised end to end at Epic 6's gate; only the `'legacy'` (NextAuth) branch is
the shipped default today. This story changes the default to `'nest'`. It is FR-8 and
F1's cutover: after this story, a real Nest-issued session gates every page a NextAuth
session used to gate.

Auth flips before the data seam (story 7.2) because a NestJS data endpoint cannot
authorize a browser that only holds a NextAuth cookie - the data flip is meaningless
until the browser carries a Nest-issued one.

**A known transient state, not a defect to fix here.** Epic 6's review (Round 1, F1
discussion) found that the twelve `frontend/src/app/api/**` handlers authenticate via
`getServerAuthSession()` and 401 without a NextAuth cookie. With this story's flip
applied and `NEXT_PUBLIC_API_TARGET` still `'legacy'` (story 7.2 not yet run), a browser
holds only `portfolio_session`: login, logout, the nav's username, and `/stats`/`/product/*`
middleware gating all work correctly, but every legacy data route the pages call still
401s, so `/stats` and `/product/*` render their frame with no data. That is expected
given this story's scope and is resolved by story 7.2 landing next in this same epic -
do not attempt to fix it here.

## Acceptance Criteria

### A. Flip the default

- [x] `docker-compose.yml`'s `next-app.build.args` changes
  `NEXT_PUBLIC_AUTH_TARGET: "${NEXT_PUBLIC_AUTH_TARGET:-legacy}"` to
  `NEXT_PUBLIC_AUTH_TARGET: "${NEXT_PUBLIC_AUTH_TARGET:-nest}"` (currently line 51).
- [x] `frontend/Dockerfile`'s `common-build` stage changes `ARG NEXT_PUBLIC_AUTH_TARGET=legacy`
  to `ARG NEXT_PUBLIC_AUTH_TARGET=nest` (currently line 53), so a bare
  `docker build -f frontend/Dockerfile ...` with no explicit build arg - as used in prior
  epics' review verification - also produces the shipped default rather than silently
  reverting to `legacy`. Compose always passes the arg explicitly, so this has no effect
  on a `docker compose` build; it keeps the two defaults from drifting apart.
- [x] No file under `frontend/src` is touched. Confirm by
  `git diff --name-only <base commit> -- frontend/src` returning nothing.

### B. Verify the cutover live (FR-8, F1)

- [x] `docker compose up -d --build` (full stack, no env override - exercises the new
  shipped default). Log in through the real `/login` form: `POST /backend/api/auth/login`
  is called, `portfolio_session` is set (not `next-auth.session-token`), the nav shows the
  logged-in username from `GET /backend/api/auth/session`, a page reload preserves the
  session, and signing out clears `portfolio_session` and returns to `/login`.
- [x] `rememberMe`: log in once with it unchecked and once checked; confirm
  `portfolio_session`'s `Max-Age` matches the 8-hour and 30-day lifetimes story 4.5 set,
  respectively.
- [x] `/` and `/login` (server components) redirect correctly for both an authenticated
  and an unauthenticated Nest session - the same `getSession()` check story 6.2 wrote,
  now exercised as the default.
- [x] `/stats` and `/product/*` are reachable (not redirected to `/login`) once
  authenticated via the Nest cookie, and redirect to `/login` with the `callbackUrl`
  query param intact when not authenticated - middleware's `'nest'` branch (F1) is what
  gates them now. Confirm the pages' *data* does not populate yet (the known transient
  state above); do not treat that as a failure.
- [x] Flip back and confirm reversibility (NFR-5): rebuild with
  `NEXT_PUBLIC_AUTH_TARGET=legacy docker compose up -d --build next-app` and confirm the
  full NextAuth flow - login, reload, sign-out, `/stats`/`/product/*` gating - behaves
  exactly as it did before this story.
- [x] Rebuild `next-app` with no override afterward, so the container left running
  matches the shipped default (`NEXT_PUBLIC_AUTH_TARGET` unset -> `nest`).

### C. Standard checks

- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - error
  count and file set unchanged from the pre-story baseline (this is a config-only change;
  record both counts as evidence, not a gate).
- [x] `pnpm --filter @portfolio/frontend lint` - no new warnings.
- [x] `git diff --name-only <base commit>` touches only `docker-compose.yml` and
  `frontend/Dockerfile`.

## Technical Notes

Both branches of the seam already exist and were verified end to end at Epic 6's gate -
see `frontend/src/auth/target.ts`, `frontend/src/middleware.ts`,
`frontend/src/server/authSession.ts`, `frontend/src/auth/useCurrentSession.ts`,
`frontend/src/auth/actions.ts`. This story changes none of them.

Architecture D11: flipping the auth seam forces a re-login - the two cookies have
different names and different signing keys, so neither system can accept the other's
token. That is expected, not a regression to chase.

For a real login without a known password, follow the disposable-user convention prior
stories used: insert a temporary `User` row with a bcrypt hash via the running
`nest-api`/`portfolio-db` containers, exercise it, then delete the row (see story 6.2's
Dev Notes and story 5.10's Dev Notes for the exact pattern).

## Out of Scope

- The data seam (`NEXT_PUBLIC_API_TARGET`) - story 7.2.
- Any edit to `frontend/src/middleware.ts`, `frontend/src/auth/**`, or
  `frontend/src/server/{session,authSession}.ts` - both branches are already correct;
  this story only changes which one is default.
- Fixing the transient no-data state on `/stats`/`/product/*` between this story and
  story 7.2 - expected, and resolved by 7.2 landing next.
- Refiling `frontend/src/server/session.ts`/`authSession.ts` into `frontend/src/auth/` -
  Epic 12, which runs after this epic.

## Dev Notes

Both edits are exactly the one-line default swap the AC describes; no other line in
either file changed.

Live verification ran against the actual running stack (`docker compose up -d --build`,
all 9 services), driven with `curl` over the real nginx/TLS route
(`https://www.tubesock.xyz`, resolved via `/etc/hosts` to this host, `-k` for the
self-signed cert) rather than a browser, since no browser/UI automation tool was
available in this environment - same limitation story 6.2 recorded. A throwaway user
(`story71temp`, `User.id` 9 then 10 after a second insert, bcrypt-hashed locally with the
backend workspace's own `bcrypt` dependency) was inserted directly into the running
`portfolio-db` container and deleted afterward, the same convention stories 5.10 and 6.2
used; `SELECT COUNT(*)` confirmed 0 remaining both times.

**Nest branch (shipped default), authenticated via `POST /backend/api/auth/login`:**
`portfolio_session` set on login (`Max-Age=28800` for `rememberMe:false`,
`Max-Age=2592000` for `rememberMe:true` - the 8-hour/30-day lifetimes story 4.5 set),
`GET .../auth/session` resolves the user while the cookie is present and persists across
repeated requests (reload-equivalent), `POST .../auth/logout` clears the cookie via
`Set-Cookie: portfolio_session=; ...Expires=Thu, 01 Jan 1970...` and a subsequent session
check with the updated cookie jar returns 401. Unauthenticated: `/`, `/stats`, and
`/product?unit=BTC&name=Bitcoin` all 307 to `/login` (`/stats`/`/product` preserve
`callbackUrl`). Authenticated: `/` and `/login` both 307 to `/stats` (`getSession()`
redirect), `/stats` returns 200 with a full 37,979-byte body.

**Legacy branch (`NEXT_PUBLIC_AUTH_TARGET=legacy` override), reversibility check:**
rebuilding `next-app` with the override flips the container's env var back to `legacy`
and the unauthenticated `/stats` redirect target changes to
`/api/auth/signin?callbackUrl=%2Fstats` (NextAuth's own default sign-in page, from
`middleware.ts`'s unmodified `legacyMiddleware = withAuth(...)` branch) - confirming the
correct branch is active. Ran the full NextAuth credentials flow against it
(`GET /api/auth/csrf`, `POST /api/auth/callback/credentials` with the CSRF token and
cookie jar, `GET /api/auth/session`, `POST /api/auth/signout` with a freshly-fetched CSRF
token): login sets `__Secure-next-auth.session-token`, session resolves the user,
`/stats` returns 200, sign-out clears the session-token cookie and `/stats` then redirects
back to `/api/auth/signin`. (First sign-out attempt reused the login-time CSRF token and
was rejected - NextAuth's signout endpoint needs its own freshly-fetched token, not a
CSRF/auth-seam issue.) Rebuilt `next-app` with no override afterward; confirmed via
`docker exec next-app printenv` that the running container is back on the shipped default
(`nest`), and `NEXT_PUBLIC_API_TARGET` is untouched (`legacy`), matching story 7.2's
starting point.

**`/product` returns 500, not an empty frame, while `NEXT_PUBLIC_API_TARGET` is still
`legacy` - investigated, not a defect of this story.** The known transient state described
in Context predicts "no data," not a 500. Server logs show the 500 is
`ReferenceError: window is not defined` at `frontend/src/components/product/LineChart.tsx:180`,
a pre-existing `window.innerWidth` read that only executes on a code path the missing-data
condition reaches. Confirmed this is unrelated to the auth-seam flip, not a regression it
introduced: ran the identical `/product?unit=BTC&name=Bitcoin` request authenticated via
the **legacy** branch with `NEXT_PUBLIC_API_TARGET` still `legacy` (i.e. the exact
pre-cutover configuration, real data available, nothing this epic has touched) and it also
500s, from the same `LineChart.tsx:180` reference. `frontend/src` is out of this story's
scope regardless of cause; flagging the file:line for whoever picks up 7.2 or a later
cleanup, since `/product` rendering a 500 rather than a data-free frame is a slightly worse
symptom of the same documented transient state, not a new one.

### Changed Files

+ docker-compose.yml         `next-app.build.args.NEXT_PUBLIC_AUTH_TARGET` default: `legacy` -> `nest`
+ frontend/Dockerfile        `common-build` stage's `ARG NEXT_PUBLIC_AUTH_TARGET` default: `legacy` -> `nest`

### Verification

- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - 15 errors
  across 9 files both before (stashed this story's two edits) and after; identical file
  set (`AddTransaction.tsx`, `ModalContextProvider.tsx`, `NumberFormatCustom.tsx`,
  `LineChart.tsx`, `ProductTable.tsx`, `SortArrow.tsx`, `TableComponent.tsx`,
  `TickerDisplay.tsx`, `storeTransactions.ts`) - all pre-existing, unaffected by a
  config-only change.
- `pnpm --filter @portfolio/frontend lint` - exit 0, only pre-existing
  `@typescript-eslint/no-unused-vars`/`consistent-type-imports` warnings in files this
  story didn't touch; no new warnings.
- `git diff --name-only 246feeb40e107b6d697ff6f02e5fe904f512561e -- frontend/src` -
  empty.
- `git diff --name-only 246feeb40e107b6d697ff6f02e5fe904f512561e` - `docker-compose.yml`,
  `frontend/Dockerfile` (plus a pre-existing unstaged `frontend/next-env.d.ts` change that
  predates this story - not touched here, and not part of this story's diff; Next
  regenerates that file and it's marked "should not be edited").
- `docker compose up -d --build` (full stack, no override) - all 9 services up;
  `docker exec next-app printenv NEXT_PUBLIC_AUTH_TARGET` -> `nest`. Full live-stack
  login/session/redirect/logout verification against both branches: see Dev Notes above
  for the exact requests and responses.
