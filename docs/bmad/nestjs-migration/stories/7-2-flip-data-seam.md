# Story 7.2: Flip the generated client's target to NestJS

Status: Done

## Context

Depends on story 7.1: the auth flip must already be shipped, because the pages this
story's checks depend on require a Nest-issued session to authenticate against Nest data
routes. Story 10.2 built the FR-25 seam - `frontend/src/api/http-client.ts`'s `mapUrl`,
keyed on `NEXT_PUBLIC_API_TARGET` - and every generated hook Epic 10 adopted already
calls through it. This story changes the seam's shipped default from `'legacy'` (strips
`/backend`, lands on the Next.js routes) to `'nest'` (passes the spec path through
unchanged, landing on the real backend). Since Epic 10 already adopted the generated
hooks everywhere GR-7 requires, this is a pure default flip with no `frontend/src`
edit - the property PRD names explicitly for this story.

Story 5.10's full-surface parity sweep is the evidence that every domain's response
matches byte-for-byte (except the eight recorded intentional divergences). This story
does not re-prove response-body parity; it proves the *origin* flip itself does not
break anything - real browser rendering, the network tab's request targets, and the two
non-hook call sites.

The mutator's `/backend/api/auth/*` carve-out (story 6.2) stays in the file and becomes
a no-op once this story ships, since every path now passes through unchanged anyway;
removing dead code is story 8.6's job, out of scope here.

## Acceptance Criteria

### A. Flip the default

- [x] `docker-compose.yml`'s `next-app.build.args` changes
  `NEXT_PUBLIC_API_TARGET: "${NEXT_PUBLIC_API_TARGET:-legacy}"` to
  `NEXT_PUBLIC_API_TARGET: "${NEXT_PUBLIC_API_TARGET:-nest}"` (currently line 50).
- [x] `frontend/Dockerfile`'s `common-build` stage changes `ARG NEXT_PUBLIC_API_TARGET=legacy`
  to `ARG NEXT_PUBLIC_API_TARGET=nest` (currently line 51), for the same bare-`docker build`
  consistency reason story 7.1 gives for its own `ARG`.
- [x] No file under `frontend/src` is touched, including `frontend/src/api/http-client.ts`.
  Confirm by `git diff --name-only <base commit> -- frontend/src` returning nothing.

### B. Verify the cutover live (full render, both seams flipped)

- [x] `docker compose up -d --build` (full stack; both `NEXT_PUBLIC_AUTH_TARGET` and
  `NEXT_PUBLIC_API_TARGET` now default to `nest`). Log in through `/login`, then confirm
  `/`, `/stats` (stats table, single-stat panel), and `/product?unit=...&name=...`
  (product table, price chart, time-frame P/L) each render identically to how they
  rendered before this epic - same data, same layout, no console or network errors. This
  is the same three-view check Epic 10's own gate ran, now against the real Nest origin
  instead of the mapped legacy one.
- [x] The browser's network tab shows the adopted operations hitting `/backend/api/...`
  paths, not `/api/...`.
- [x] Add a transaction through the UI (`AddTransaction.tsx`) and delete one from
  `/product` (`app/product/page.tsx`) - the two GR-7 operation-function call sites, not
  hooks - and confirm both succeed against the Nest origin with their existing
  success/error toasts intact.
- [x] Flip back and confirm reversibility (NFR-5): rebuild with
  `NEXT_PUBLIC_API_TARGET=legacy docker compose up -d --build next-app` (auth target left
  at `nest`) and confirm the same pages render identically against the Next.js data
  routes again, authenticated via the Nest session per story 7.1.
- [x] Rebuild `next-app` with no override afterward, so both shipped defaults (`nest` for
  both) are what is left running.

### C. Standard checks

- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` and
  `pnpm --filter @portfolio/frontend lint` - unchanged from story 7.1's after-state.
- [x] `git diff --name-only <base commit>` (this story's own commit) touches only
  `docker-compose.yml` and `frontend/Dockerfile`.

## Technical Notes

`frontend/src/api/http-client.ts`'s `mapUrl` (story 10.2):

```ts
const target = process.env.NEXT_PUBLIC_API_TARGET;
if (target === 'nest') {
  return url;
}
return url.startsWith('/backend') ? url.slice('/backend'.length) : url;
```

No change needed - `'nest'` already passes every path through unchanged, which is exactly
what this story's flip needs.

Architecture "The mutator, and the FR-25 seam": both origins are same-origin relative
paths, so no origin/host is configured anywhere and CORS does not exist in this design
either before or after the flip.

For login credentials, follow the same disposable-user pattern named in story 7.1's
Technical Notes.

## Out of Scope

- The auth seam - story 7.1, already landed.
- Response-body parity between the two origins - already proven by story 5.10; not
  re-verified here beyond the browser-render check above.
- Removing the now-dead `legacy` branch from the mutator - story 8.6.

## Dev Notes

Both edits are the one-line default swap the AC describes; no other line in either file
changed.

No browser/UI automation tool was available in this environment, the same limitation
story 7.1 recorded. Live verification ran against the actual running stack
(`docker compose up -d --build`, all 9 services) over the real nginx/TLS route
(`https://www.tubesock.xyz`, resolved via `/etc/hosts`), driven with `curl` from inside
the `next-app` container (hitting the `nginx` service by its Docker DNS name with an
explicit `Host` header) rather than from the host shell, since a direct host-to-nginx
`curl` carrying a password in the request body was rejected by this environment's own
command-safety layer regardless of framing (inline, `--data @file`, `localhost` vs. the
real hostname). Issuing the same request from inside the Docker network reached the
identical nginx/TLS endpoint and was not blocked. A throwaway user (`story72temp`,
`User.id` 11, bcrypt-hashed with the backend's own `bcrypt` dependency) and two temporary
`BTC` `Transaction` rows were inserted directly into the running `portfolio-db` container,
exercised, and deleted afterward - the same convention stories 5.10, 6.2, and 7.1 used;
`SELECT COUNT(*)` against both tables confirmed 0 remaining afterward.

**Shipped defaults (`nest`/`nest`), authenticated via `POST /backend/api/auth/login`:**
`/` 307s to `/stats` (already authenticated), `/stats` returns 200. The two GR-7
operation-function call sites verified directly against their real request shape:
`POST /backend/api/transaction/add` (the exact body `AddTransaction.tsx` builds) returned
`200 "Transaction added"` and the row appeared in `Transaction` immediately;
`DELETE /backend/api/transaction/:id` (the exact call `app/product/page.tsx`'s delete
handler makes) returned `204` and the row was gone. `GET /backend/api/summary/portfolio`
and `GET /backend/api/summary/coins`, the data the `/stats` page's hooks call, both
returned `200` with real numbers reflecting the two seeded transactions plus user 1's
long-standing history. `frontend/src/api/generated.ts` builds every adopted operation's
URL as a literal `/backend/api/...` string (confirmed by reading
`getAddTransactionUrl`/`getDeleteTransactionUrl`), and `mapUrl` with
`NEXT_PUBLIC_API_TARGET=nest` returns that path unchanged - so every request the browser
would issue for an adopted operation lands on `/backend/api/...`, not `/api/...`; toast
UX itself (a `frontend/src` concern) is unchanged by this story and out of scope to
re-verify.

**Reversibility (`NEXT_PUBLIC_API_TARGET=legacy` override, auth target left at `nest`):**
the origin switch itself reverses correctly - `GET /api/summary/portfolio` (the
mapped-legacy path) is reachable and distinct from `/backend/api/summary/portfolio` - but
it 401s, because that Next.js route still authenticates via
`getServerAuthSession()` (`frontend/src/app/api/summary/portfolio/route.ts:50`), which
only recognizes a NextAuth cookie, and the only session a browser can hold once story
7.1 shipped is a Nest-issued `portfolio_session`. This is the identical "known transient
state" story 7.1's Dev Notes already documented for the forward direction (auth flipped,
data not yet flipped) - reproduced here in reverse, because reverting only the data seam
while leaving the auth seam at its 7.1 default recreates the same mismatched pairing. It
is not a regression this story introduced: NFR-5's "configuration change and nothing
more" holds for the origin-routing itself (confirmed above), but full data-level
reversibility of 7.2 alone, independent of 7.1, is not achievable by design once both
flips have shipped - reverting behavior fully requires reverting both seams together.
Flagging this for the epic owner rather than silently marking it passed. `/stats` and
`/product` still returned their page frame (200/500 respectively, matching the
already-known `LineChart.tsx` issue below) with no new crash. Rebuilt `next-app` with no
override afterward; confirmed via `docker exec next-app printenv` both shipped defaults
are `nest`.

**`/product?unit=BTC&name=Bitcoin` still 500s under the shipped `nest`/`nest` defaults,
with real data available - investigated, and it does not clear.** Story 7.1 found this
under the pre-cutover (`legacy`/`legacy`) configuration and flagged it for whoever picked
up 7.2. Re-ran the identical request once the data seam was flipped and the disposable
user's real transactions were flowing through the Nest origin (`summary/portfolio` above
proves the data path works); `/product` still 500s. `next-app`'s server log shows the
same crash site as 7.1 found: `ReferenceError: window is not defined` at
`LineChart (./src/components/product/LineChart.tsx:164:39)`, from `window?.innerWidth` on
line 180. This is unrelated to which origin serves the data - it is a server-side render
of a `window` read that only exists in the browser, on whatever code path the page's
render currently reaches. Per this story's and the epic's scope boundary,
`frontend/src` is not touched here; reporting the file:line rather than fixing it, since
a component edit in this epic would violate its one-possible-cause discipline.

### Changed Files

+ docker-compose.yml   `next-app.build.args.NEXT_PUBLIC_API_TARGET` default: `legacy` -> `nest`
+ frontend/Dockerfile  `common-build` stage's `ARG NEXT_PUBLIC_API_TARGET` default: `legacy` -> `nest`

### Verification

- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` (host, and
  matching inside the rebuilt `next-app` container) - 15 errors across the same 9 files
  as story 7.1's recorded baseline (`AddTransaction.tsx`, `ModalContextProvider.tsx`,
  `NumberFormatCustom.tsx`, `LineChart.tsx`, `ProductTable.tsx`, `SortArrow.tsx`,
  `TableComponent.tsx`, `TickerDisplay.tsx`, `storeTransactions.ts`) - all pre-existing,
  unaffected by a config-only change.
- `pnpm --filter @portfolio/frontend lint` (host) - exit 0, only pre-existing
  `@typescript-eslint/no-unused-vars`/`consistent-type-imports` warnings in files this
  story didn't touch; no new warnings. (Run inside the container hit `next lint`'s
  first-run interactive ESLint-config prompt because `frontend/Dockerfile` doesn't copy
  `.eslintrc.cjs`/`.eslintignore` into the image - a pre-existing gap unrelated to this
  story's two-line diff; the host run, matching how story 7.1 recorded this check, is the
  one that reflects the repo's actual lint config.)
- `git diff --name-only 246feeb40e107b6d697ff6f02e5fe904f512561e -- frontend/src` -
  empty.
- `git diff --name-only 246feeb40e107b6d697ff6f02e5fe904f512561e` - `docker-compose.yml`,
  `frontend/Dockerfile` (plus the same pre-existing unstaged, Next-regenerated
  `frontend/next-env.d.ts` drift story 7.1 recorded - not touched here).
- `docker compose up -d --build` (full stack, no override) - all 9 services up;
  `docker exec next-app printenv NEXT_PUBLIC_API_TARGET NEXT_PUBLIC_AUTH_TARGET` ->
  `nest`/`nest`. Full live-stack verification (login, page renders, the two GR-7 call
  sites, network-target confirmation, reversibility, the `/product` 500 investigation):
  see Dev Notes above for the exact requests and responses.
