<!--
Owned by: bmad-pm
Read by: bmad-architect

Requirements only - no technical design here, that's the Architect's job. Break work
into epics (a coherent slice of the feature) and stories (small, independently
implementable/testable units) within each epic.
-->

# PRD: NestJS Backend Migration

## Summary

Restructure this repo into a pnpm monorepo (`frontend/` + `backend/`) and stand up a
new, standalone NestJS service that reproduces the entire API surface currently served
by the 19 App Router handlers under `src/app/api/`, backed by MikroORM entities mapped
onto the existing MySQL 5.7 schema and by per-domain Nest services decomposed out of
`src/server/db/dbService.ts`. NestJS also takes over authentication - verifying against
the existing `User` table and bcrypt hashes - and issues a session that Next.js server
components can still read. Every existing Next.js API route and every file under
`src/server/` stays in place and working for the whole initiative; the new service is
built alongside, proven at parity, and the frontend is pointed at it. This is a
learning exercise: there is no uptime or deadline pressure, and clarity beats speed
everywhere the two conflict.

## Ground rules

These rules bind every epic and every story below. A story that violates any of them is
invalid regardless of what its own acceptance criteria say.

GR-1, GR-2, GR-5, GR-6, and GR-7 are live, and all of them are specific to this
initiative. The workflow's own commit cadence and sign-off gates are defined in the BMAD
plugin's `README.md` and are deliberately not restated here - a second copy is how the two
drift apart.

**GR-1 - Additive only.** No file under `src/app/api/` or `src/server/` is deleted,
moved out of the Next.js app, gutted, or rewritten as part of this initiative. Those
routes keep serving traffic and keep passing their own auth checks until the entire
initiative is signed off. Moving `src/` wholesale into `frontend/src/` as part of the
monorepo restructure (Epic 1) is the one permitted relocation, and it is a path change
only - contents are unchanged. Removal is Epic 8, which is explicitly out of scope
until separately approved.

*Clarified for Epic 12, not relaxed.* GR-1 protects the files that were under
`src/app/api/` and `src/server/` **when this initiative started** - which is how Success
Criterion 9 already states it. Two files now sitting under `frontend/src/server/` were
created *by* this initiative and were never in that set: `session.ts` (Epic 4) and
`authSession.ts` (story 6.2). Epic 12 relocates those two into `frontend/src/auth/` and
nothing else. Every file GR-1 was written for keeps its path and its contents, including
`src/server/auth.ts`, which Epic 12 does not edit and which `authSession.ts` keeps
importing after the move. A story that touches any third file under `src/server/` is a
GR-1 violation exactly as before.

**GR-2 - Scaffold-first, hard human gate.** After the NestJS service boots (Epic 1) and
before any real implementation (Epics 3 onward), Epic 2 produces the complete API
scaffold: every module, controller, and service that the finished backend will have,
with every endpoint present as a no-op stub carrying a comment describing what it will
eventually do, fully decorated with `@nestjs/swagger`. The deliverable being reviewed
is the **generated Swagger UI**, not the controller source. The owner signs off on that
Swagger document. Until that sign-off, no story from Epic 3 or later may start. A
scaffold that compiles but produces thin or inaccurate Swagger output does not pass.

**GR-5 - A frontend import of `@portfolio/shared` ships its Dockerfile wiring.**
`frontend/Dockerfile` copies and builds no workspace package other than the frontend
itself, so the `node_modules/@portfolio/shared` symlink dangles inside the shipped
`next-app` image.

One such import already exists: `frontend/src/server/session.ts:2` imports
`SESSION_ALGORITHM` and `SessionClaims`, landed by Epic 4. It is inert only because
nothing imports `session.ts`, so Next never pulls it into a bundle and the dangling
symlink is never followed. That is a property of the current call graph, not a safeguard -
the first file that imports `session.ts`, or any other new import of the package, breaks
the production image.

Therefore: any story that makes `@portfolio/shared` reachable from a file Next actually
bundles - by adding an import, or by giving an existing importer like `session.ts` its
first consumer - must, in that same story, add the `packages/shared` copy and build step
to `frontend/Dockerfile` and verify the production image target builds and serves. A
story that lands the import and leaves the Dockerfile for later is invalid. Landing the
Dockerfile wiring earlier than strictly required is always permitted and never a
violation. This binds every epic, not just the one that happens to trip it first - it is
Epic 4's open advisory F10 written as a rule so it cannot be lost between epics.

**GR-6 - The generated client is the only HTTP client for a backend endpoint.** From the
end of Epic 10 onward, no frontend file may contain a hand-written `fetch(...)`, `axios`
call, or `useQuery`/`useMutation` `queryFn` that targets an endpoint described by the
backend's OpenAPI document - which, as Epic 10 shipped, is the live Swagger JSON the
backend serves at `/backend/docs-json` and which `frontend/src/api/generated.ts` is
generated from. There is no committed spec file; `backend/openapi.json` is deleted, and a
GR-6 citation naming it should be read as naming the generated client instead. Exactly one
exception: the Orval mutator at
`frontend/src/api/http-client.ts`, which is the generated client's own transport and is
therefore the one place a spec'd endpoint may be called by hand. Every other such call goes
through the generated client. A second hand-written client anywhere else is a violation
even if it is also called a mutator, and the generated output itself needs no exemption -
it calls the mutator rather than `fetch` or `axios`.

The test is mechanical: grep `frontend/src` for `fetch(` and `axios`, and every surviving
hit must be either the mutator or outside the spec. Outside the spec today means exactly
the crypto.com price API at `frontend/src/_hooks/useStorePriceHistory.ts:16`, anything
under `src/app/api/` and `src/server/`, which GR-1 protects and which this rule does not
reach, and the commented-out hits in the wholly dead `frontend/src/context/SummaryContext.tsx`
and `src/server/helpers/get-exchange-rates.ts`. `axios` stays in the grep because the
mutator is fetch-based: an `axios` hit outside `src/server/helpers/` is always a violation.
A story that adds a hand-written call to a spec'd endpoint is invalid even if it works.

The `next-auth/react` calls in `LoginClient.tsx` and the nav components are not a violation:
they are a library's own client for a contract that is not in the spec, and FR-11 requires
them to keep working until Epic 7 flips story 6.2's seam. What the rule does forbid is
replacing them with a hand-rolled fetch to `/backend/api/auth/...` - that seam's NestJS side
is the generated login, logout and session operations.

**GR-7 - Adopting the generated client never restructures a component.** Orval emits both
a plain operation function and a TanStack Query hook for every operation. A call site that
is already a `useQuery` takes the hook; a call site that is not - a `useEffect` with a bare
`fetch`, a click handler, a server component - takes the operation function and keeps its
existing control flow. Converting a `useEffect` fetch into a `useQuery`, hoisting state, or
splitting a component to accommodate a hook is a frontend rewrite, which the brief puts out
of scope, and it destroys the property that makes Epic 10 low-risk: that every page renders
identically before and after. Four call sites are affected -
`frontend/src/_hooks/useGetTokenList.ts:23`, `useFetchCurrentPrice.ts:17`,
`src/components/AddTransaction.tsx:161`, and `src/app/product/page.tsx:17`. If a story
believes a restructure is unavoidable, it stops and raises it rather than doing it.

### Retired rules

**GR-3 and GR-4 no longer exist.** Epic 1's stories cite them, so they are recorded here
rather than deleted outright - a citation that resolves to nothing is worse than one that
resolves to an explanation.

Both restated the BMAD process as it stood when Epic 1 was built: GR-3 required one
commit per story *after* review and owner sign-off, and GR-4 required an owner review at
every epic boundary *in addition to* the per-story gates. The workflow has since moved
review and sign-off to the epic boundary, and made the per-story commit automatic and
ungated. Their intent survives in the plugin's `README.md`; their text was wrong the
moment that changed, which is exactly the drift the note above warns about.

Read a GR-3 or GR-4 citation in an Epic 1 story as a historical record of how that story
was actually built. Do not apply either rule to new work.

## Requirements

### Functional - API surface

**FR-1.** The NestJS backend must expose an equivalent for all 19 existing route
handlers. The complete inventory, with the auth behavior each one has *today*:

| Existing route | Method(s) | Auth today |
| --- | --- | --- |
| `src/app/api/auth/[...nextauth]` | GET, POST | n/a (is the auth) |
| `src/app/api/transaction/add` | POST | 401 if no session |
| `src/app/api/transaction/[id]` | DELETE | 401 if no session |
| `src/app/api/summary/coins` | GET | 401 if no session |
| `src/app/api/summary/portfolio` | GET | 401 if no session |
| `src/app/api/summary/[unit]` | GET | 401 if no session |
| `src/app/api/summary/profitLossChart` | GET (`?timeFrame=`) | 401 if no session |
| `src/app/api/summary/profitLossChart/[timeFrame]` | GET | 401 if no session |
| `src/app/api/stats/[unit]` | GET | 401 if no session |
| `src/app/api/product/[product]` | GET | 401 if no session |
| `src/app/api/exchange-rates/[timeFrame]/[coinName]` | GET | **none** |
| `src/app/api/exchange-rates/unit/[unit]` | GET | **none** |
| `src/app/api/price-history/check` | GET | **reads session, does not enforce** |
| `src/app/api/price-history/set` | POST | **none** |
| `src/app/api/time-frame-coins-pl/[timeFrame]` | GET | 401 if no session |
| `src/app/api/time-frame-total-pl/[timeFrame]` | GET | 401 if no session |
| `src/app/api/token-info/[userId]` | GET | **none** |
| `src/app/api/token-info/search/[searchTerm]` | GET | **none** |
| `src/app/api/metrics` | GET | `METRICS_SECRET` bearer token |

**FR-2.** Every endpoint's auth posture in the new backend is an **explicit, documented
decision**, not an accident of what the old handler happened to do. Seven of the rows
above are unauthenticated or half-authenticated today, including `price-history/check`,
which reads `session?.user?.id` and then queries with it without ever checking it was
present (`src/app/api/price-history/check/route.ts:11-14`). Epic 2 must record a
decision per endpoint - "authenticated" or "deliberately public" - and Swagger must
reflect it. Tightening an endpoint that is public today is permitted and expected;
loosening one that is authenticated today is not.

*Unamended, and deliberately so.* The intentional-divergence table in
`inventory-endpoint-contracts.md` has eight rows, of which **seven are FR-2's**. The eighth
is FR-27's ownership scoping of `DELETE /transaction/:id`, which is an authorization change
inside an endpoint that is authenticated today and stays authenticated - not a posture
change, and so not something this requirement licenses or needs to.

**FR-3.** Response contracts are preserved exactly, including server-side display
formatting. Concretely, this must survive byte-for-byte:
- `formatUSD(...)` output (`src/server/helpers/format-usd.ts`, and the separate local
  copy at `src/app/api/product/[product]/route.ts:7`) - e.g. `"$1,234.56"`
- percentages as `.toFixed(1) + '%'` (`src/app/api/stats/[unit]/route.ts:15`)
- fixed-decimal holdings/balance strings, `.toFixed(4)`
  (`src/app/api/stats/[unit]/route.ts:12`, `src/app/api/product/[product]/route.ts:68`)
- `GET /exchange-rates/unit/[unit]` returning a bare JSON string, not an object
  (`src/app/api/exchange-rates/unit/[unit]/route.ts:13`)
- derived booleans and computed fields such as `inGreen` and `costBasis` in
  `src/app/api/summary/coins/route.ts:53-58`

**FR-3 has exactly one exception, and it is named: FR-27.** `DELETE /transaction/:id` in the
NestJS backend deletes only rows the caller owns, where today's route deletes any row by id.
The exception is bounded to that endpoint, changes no response shape, status code or error
body, and is reviewed at Epic 11's own gate. Everything else in this initiative preserves
behavior as written above; a story that proposes a second exception is out of scope until
the PRD names it here.

No response-shape "improvements" are in scope. The frontend must not need refactoring to
consume the new backend beyond adopting the generated client in Epic 10, the auth seam in
Epic 6, and the origin/auth flip in Epic 7 - and GR-7 bounds what "adopting" is allowed to
mean.

**FR-4.** Two routes serve the same data via different shapes -
`summary/profitLossChart?timeFrame=x` (used by
`src/components/Summary/TotalChart/Layout.tsx:29`) and
`summary/profitLossChart/[timeFrame]` (no frontend caller found). Both are ported. Same
for `stats/[unit]` and `token-info/[userId]`, which also have no frontend caller today.
Nothing in the inventory is dropped on the grounds of being unused.

**FR-5.** Status codes and error bodies are preserved: `401` with
`{ error: 'Unauthorized' }` for session failures, `403` with the plain-text body
`Forbidden` for a bad metrics token (`src/app/api/metrics/route.ts:12`).

**FR-27 - `DELETE /transaction/:id` is scoped to the caller's own rows.** *Added after
Epic 5 completed; it is the one deliberate exception to FR-3, and Epic 11 carries it.*

The new backend's delete filters on the transaction's `userId` as well as its `id`, so a
transaction belonging to another user is not deleted. A request for an id the caller does
not own is answered exactly as a request for an id that does not exist is answered today -
`500` with `{ error: 'An error occurred while deleting the transaction' }` - so the two
cases stay indistinguishable to the caller and no new response shape, status code or error
body is introduced. FR-5's bodies are untouched.

**What is wrong today.** `frontend/src/app/api/transaction/[id]/route.ts:13` deletes by bare
`id` after checking only that *a* session exists. The ids are sequential integers from the
`Transaction` primary key, so any logged-in user can delete any other user's transactions by
counting. The NestJS port reproduced this faithfully and on purpose - see
`backend/src/transactions/transactions.controller.ts:95-97`, which says so in a comment - and
recorded it as out of scope under FR-3. This requirement reverses that decision.

**Why this is its own requirement and not an eighth FR-2 tightening.** FR-2 is about each
endpoint's *authentication posture*, it takes its candidates from the FR-1 table's `none`
and half-authenticated rows, and it licenses exactly one move: "tightening an endpoint that
is public today". `DELETE /transaction/:id` is not public today - FR-1 marks it `401 if no
session` and that is accurate. Its posture does not change here and must not: it was
authenticated before and stays authenticated. What changes is *authorization within an
already-authenticated endpoint*, which is a different axis, and stretching FR-2 to cover it
would mean either editing text that completed stories 2.1 and 5.1 cite or leaving FR-2
asserting a rule that its own table now contradicts. FR-2 keeps its seven rows and its
meaning.

The divergence is nevertheless **recorded as the eighth row of the intentional-divergence
table in `inventory-endpoint-contracts.md`**, citing FR-27 rather than FR-2. That table is
where a reader goes to ask "where does the new backend differ from the old one", and an
answer that lives somewhere else because of a taxonomy argument is an answer nobody finds.
The nearest precedent is already in that table: `token-info/[userId]` is scoped to the
caller as well as authenticated, so ownership scoping is not a new kind of entry there - it
is only the first one that arrives without a posture change beside it.

**Scope, stated exhaustively.** This requirement covers `DELETE /transaction/:id` in the
NestJS backend and nothing else. It is not a licence to scope, harden or audit any other
endpoint: another ownership gap found later is a new requirement and a new owner decision,
not an application of this one. The Next.js route is not edited - GR-1 forbids it, and that
prohibition is not relaxed here.

**Timing: this must land before Epic 7 completes, which is why Epic 11 exists.** Until the
cutover both routes serve traffic, so the tightening can be diffed against the old route
with NFR-4's harness and written down as an intentional divergence next to the seven that
already exist. After cutover the NestJS route is the only route, there is nothing left to
diff against, and the same change becomes an unscoped edit to live behavior.

**The argument against doing it at all, recorded because it is real.** FR-3 exists so that
every response delta is either zero or deliberate, which is what makes NFR-4's parity
evidence and Epic 7's cutover safety mean anything; story 5.10's sweep was gathered under
that assumption. More sharply: **this is not a security fix, and calling it one would be
wrong.** The hole stays open in production for the whole of coexistence, because GR-1 keeps
the Next.js route serving traffic unpatched, and NFR-5's reversibility means flipping
`NEXT_PUBLIC_API_TARGET` back to `legacy` silently reopens it after cutover too. It is
genuinely closed only once Epic 8 deletes the old route - and Epic 8 is out of scope. What
this requirement buys is therefore narrower than it looks and worth naming honestly: the
backend that replaces the old one does not carry the flaw forward, and the decision to not
carry it forward is recorded and reviewed rather than inherited by default.

Against that: the cost is one predicate in one query, the response contract does not move,
and the only frontend caller (`frontend/src/app/product/page.tsx:17-18`, deleting ids taken
from the caller's own product table) cannot notice the difference. The owner has weighed
both and chosen the exception.

### Functional - authentication

**FR-6.** A user can log in to the NestJS backend with their existing username and
password. Existing bcrypt hashes in the `User` table keep working - no forced reset, no
rehash-on-login requirement, no schema change.

**FR-7.** `rememberMe` continues to control session lifetime: 8 hours when false,
30 days when true (`src/server/auth.ts:58,101-104`).

**FR-8.** The session issued by NestJS is readable by Next.js **server components**, not
just by browser JavaScript. `src/app/page.tsx` and `src/app/login/page.tsx` gate and
redirect server-side and must keep doing so after cutover.

**FR-9.** The identity exposed to callers is the same whitelisted shape NextAuth
produces today: `isAuthenticated` plus `user: { id, username, email, name }`
(`src/server/auth.ts:115-132`). Internal token fields are not exposed.

**FR-10.** A user can log out, and logging out invalidates the session as far as both
the browser and Next.js server components are concerned.

**FR-11.** The existing NextAuth setup (`src/server/auth.ts`, the
`api/auth/[...nextauth]` handler, `next-auth/react` usage in `LoginClient.tsx` and the
nav components) remains present and functional throughout, per GR-1. During the cutover
window the frontend must be able to fall back to it without code changes.

### Functional - data layer

**FR-12.** MikroORM entities model the existing MySQL schema as it stands today:
`User`, `Transaction`, `TokenInfo`, `TokenPriceHistory`, `ExchangeRate`, `NetCashFlow`,
`OuathToken` (`src/server/db/schema.prisma`). Column names, types, and nullability match
the live database.

**FR-13.** No schema changes, no data migration, no engine change, and no modification
to the Prisma migration history under `src/server/db/migrations/`. MikroORM never runs
schema generation or auto-sync against this database.

**FR-14.** The legacy Prisma layer and the new MikroORM layer point at the same database
simultaneously for the whole initiative. That is expected.

**FR-15.** The query logic in `src/server/db/dbService.ts` (436 lines) is decomposed
into per-domain injectable services - transactions, summary, stats, exchange rates,
price history, token info, auth - rather than lifted wholesale into one provider. The
same applies to the helpers in `src/server/helpers/` (`get-exchange-rates.ts`,
`update-price-history.ts`, `format-usd.ts`, `unitToNameMap.ts`) and
`src/server/db/storeTransactions.ts`.

### Functional - cross-cutting

**FR-16.** The backend exposes a Prometheus scrape endpoint guarded by the same
`METRICS_SECRET` bearer-token check, and emits at minimum the equivalents of the metrics
`src/server/metrics.ts` registers today. Both `next-app` and the backend expose metrics
during coexistence; Prometheus scrapes both.

**FR-17.** Backend logs reach Loki through the existing Alloy Docker-log scraping
(`monitoring/alloy-config.alloy`) with the same structured-log shape Winston produces
today, so existing Grafana dashboards (`monitoring/grafana/provisioning/dashboards/`)
keep working against the new container.

**FR-18.** The backend uses Redis for the caches that exist today - the
`time-frame-pl-{timeFrame}-coinName-{coin}` keys read in
`src/app/api/price-history/check/route.ts:22` and written by the price-history and
exchange-rate helpers - with the same key naming, so old and new share cache state
harmlessly.

**FR-19.** Swagger UI is served by the backend and reachable in local development from
the browser, through nginx, over the existing local HTTPS flow.

### Functional - response type contract

**Amended for Orval (Epic 10).** FR-20 through FR-23 were written for Epic 9's pipeline,
which generated *types only*, with `openapi-typescript` over a committed snapshot and a
hand-written alias file in front of it. The owner has since decided the frontend generates
its **whole API client** - types and TanStack Query hooks - with Orval. FR-20 is amended
below rather than rewritten, because its intent is unchanged and Epic 9's stories cite it;
FR-22 and FR-23 are untouched and still read as written. FR-24 and FR-25 are new and carry
the parts of the decision the old text has no room for.

**Amended again after Epic 10 shipped.** Three rounds of owner feedback during Epic 10
removed the committed-spec-plus-staleness-check design entirely, so the requirements that
encoded it no longer describe the repo. **FR-21 is superseded by FR-26** and NFR-6 is
narrowed; both are marked in place below. The shipped toolchain is `frontend/orval.config.ts`
reading `http://localhost:3002/backend/docs-json` (the live Swagger JSON the existing
`SwaggerModule.setup('backend/docs', ...)` in `backend/src/main.ts` already serves) plus one
`spec:generate` script in `frontend/package.json`. `backend/openapi.json`,
`scripts/generate-api-contract.mjs`, `frontend/types/api.d.ts` and
`frontend/types/contracts.ts` are all deleted. The single committed generated artifact is
`frontend/src/api/generated.ts`; the single hand-written one is the mutator at
`frontend/src/api/http-client.ts`.

**FR-20 - One source of truth for HTTP response types.** The frontend's TypeScript view
of a backend response is *derived from* the backend's OpenAPI document, never
hand-declared alongside it. `frontend/types/global.d.ts` today hand-declares eight
shapes - `PortfolioSummary`, `CoinSummaryResp`, `PriceHistoryResp`,
`TimeFramePlByUnitResp`, `TimeFrameTotalPlResp`, `ProductTransaction`,
`ProfitLossChartResp`, `TimeFrame` - consumed across roughly fifteen frontend files
including `src/_hooks/useCoinSummaries.ts`, `src/context/StatsTableContext.tsx`,
`src/components/Summary/TotalChart/Layout.tsx`, `src/components/product/ProductTable.tsx`
and every `src/components/stats-table/*` column. Those consumers move to generated
types. Where the generated type and the hand-declared one disagree, the discrepancy is
resolved rather than papered over: if the DTO is wrong, the DTO is corrected in the
backend; if the hand-declared type was wrong, that is recorded.

*Amendment for Epic 10.* Epic 9 satisfied this by generating `frontend/types/api.d.ts` and
putting a hand-written alias file, `frontend/types/contracts.ts`, in front of it so
consumers could name a DTO without indexing a namespace. Orval emits named model types
directly, so the alias file has nothing left to do and is deleted; consumers import the
model name from the generated output. The requirement - no client-side file hand-declares a
response shape - is unchanged, and Epic 10 satisfies it more directly, since after it there
is no hand-written file in the path between the DTO and the consumer at all.

**FR-21 - SUPERSEDED by FR-26. Do not implement, do not cite as binding.** As written it
required a committed OpenAPI snapshot and a build-time staleness check that regenerated the
document from backend source and failed the build on any difference. Epic 9 built exactly
that; Epic 10's owner-feedback rounds deleted it. There is no committed spec, no
`--check` byte-compare, and no staleness step in `backend/Dockerfile`,
`frontend/Dockerfile`, or anywhere else. **The owner has ruled this twice, explicitly, and
has separately ruled out adding a CI check. A story that reintroduces a staleness check in
any form is invalid.**

The identifier is kept because Epic 9's stories (9.2, 9.4) and Epic 10's stories (10.1,
10.3) cite it, and a citation resolving to nothing is worse than one resolving to an
explanation. Read an FR-21 citation in a completed story as a record of what that story was
built against. FR-26 states what is required now.

**FR-22 - `packages/shared` holds only what has no HTTP representation.** The package
exports `SessionClaims`, `SessionUser`, `Session`, `SESSION_ALGORITHM`, and
`SESSION_COOKIE_NAME`. `Session` and `SessionUser` *are* the response body of
`GET /auth/session` (backend `SessionResponseDto`, which re-exports `LoginResponseDto`),
so under FR-20 they are generated, not hand-declared. `SessionClaims` is the JWT payload
and by FR-9's design never appears in any HTTP response, so it cannot be generated;
`SESSION_ALGORITHM` is not an HTTP surface either; `SESSION_COOKIE_NAME` appears in the
spec only as the name of a cookie security scheme, which neither `openapi-typescript` nor
Orval emits as a value. The resulting boundary is the requirement: **HTTP contract generated
from OpenAPI, token and cookie contract hand-declared in `packages/shared`.**

**FR-23 - GR-1 files keep the types they import.** `global.d.ts` is imported by files
GR-1 protects - `frontend/src/server/db/dbService.ts`, `src/server/helpers/get-exchange-rates.ts`,
`src/server/helpers/update-price-history.ts`, and nine handlers under `src/app/api/`. Those
files are not edited and not broken. Any part of `global.d.ts` still needed by them stays
in place until Epic 8 deletes the code that needs it. FR-20's deletion therefore applies
to the *client-side* consumers, and the residue is a scheduled Epic 8 item rather than an
overlooked leftover.

**FR-24 - The HTTP client is generated, not just the types.** Orval generates, from the
backend's OpenAPI document, both a plain operation function and a TanStack Query hook for
every operation in the spec, plus the model types those operations use. The frontend
consumes the generated output and writes no client code of its own for a spec'd endpoint
(GR-6), and adopting it restructures no component (GR-7).

*Amended after Epic 10 shipped.* The original text named `backend/openapi.json` as the
input. That file is deleted; Orval reads the live Swagger JSON at
`http://localhost:3002/backend/docs-json` instead. The requirement is unchanged - operation
functions, hooks and models are generated rather than hand-written - only the input moved.

The evidence behind choosing Orval, recorded so it is not re-derived: it is roughly six
times as widely used as the main alternative, Kubb - 1.91M weekly npm downloads against
318K for `@kubb/core` and 97K for `@kubb/plugin-react-query` - and it is batteries-included
where Kubb is modular, which matters for a one-person repo that wants a config file rather
than a plugin assembly. Decisively, the frontend is already on `@tanstack/react-query`
v5.62 across twelve files and the hand-written hooks are **already the exact shape Orval
emits**: a `useQuery` with a `queryKey` and a fetch-based `queryFn`. See
`frontend/src/_hooks/useCoinSummaries.ts`, which is seventeen lines that Orval would
generate almost character for character. Adoption is therefore replacement, not conversion.

**FR-25 - The generated client's origin is a single configured value, and during
coexistence it points at the Next.js routes.** The spec's paths carry the backend's global
prefix - `/backend/api/summary/coins` - while the frontend today calls
`/api/summary/coins`. The generated client must route every request through one configured
seam that decides which origin and which prefix a call lands on, so that pointing the whole
frontend back at the Next.js routes is a configuration change (NFR-5) rather than a
regeneration or an edit to a dozen call sites. Orval supports exactly this: a custom
mutator that every generated operation calls, receiving the URL before the request is made.
The mechanism is the Architect's to specify; the requirement is that one value decides it
and that the default value is the Next.js routes until Epic 7 flips it.

This is what used to be story 6.1's hand-built base-URL seam. It moves here because the
generated client already has a designated place for it, and building a second seam in front
of a client that ships one would be inventing structure the tool provides.

*As shipped.* The seam is `frontend/src/api/http-client.ts`, the Orval custom mutator every
generated operation calls. The configured value is `NEXT_PUBLIC_API_TARGET`, defaulting to
`legacy`, which strips the `/backend` prefix so the call lands on the Next.js route; `nest`
passes the path through unchanged and is what Epic 7's story 7.2 sets. The mutator also
centralises what every hand-written call site used to repeat - throwing on a non-2xx,
parsing JSON, returning `undefined` on a 204 - which is why it is the one hand-written
client GR-6 permits.

**FR-26 - The generated client is committed, and keeping it current is the developer's
responsibility at commit time.** `frontend/src/api/generated.ts` is committed, so a clean
checkout typechecks and both images build with no code generation, no running backend and
no database. Regenerating it is a manual step - `pnpm --filter @portfolio/frontend
spec:generate` - and **no automated check anywhere verifies it is up to date**: not in
`backend/Dockerfile`, not in `frontend/Dockerfile`, not in CI. This is the owner's explicit
ruling and it replaces FR-21, which required the opposite. Adding such a check back, in a
build, a script, a git hook, or CI, is a violation rather than an improvement.

Two workflow consequences follow, and stories that touch DTOs must plan for them:
- Because Orval's input is a URL, `spec:generate` requires the backend to be running and
  reachable on the host: `docker compose up -d nest-api`, then generate. `nest-api`
  publishes `127.0.0.1:3002:3001` in `docker-compose.yml` for exactly this reason - host
  3001 belongs to Grafana, and the binding is loopback-only so the API, Swagger UI and
  `/backend/api/metrics` are not exposed outside nginx and TLS.
- Any story that changes a DTO must regenerate the client and commit the result **in that
  same story**, and say in its acceptance criteria that it did. Nothing will catch it
  otherwise; the failure mode is a renamed field that compiles clean and renders
  `undefined` at runtime. This is the discipline FR-21 used to automate.

### Non-functional

**NFR-1 - Testability without tests.** No test suite is written in this initiative, but
every line written must be unit-testable afterwards without a restructuring pass:
collaborators arrive via Nest DI rather than module-level singletons or direct imports
of concretes; business logic lives in injectable per-domain services and controllers
stay thin (parse, delegate, respond); the EntityManager, the current user/session, and
the clock (`Date.now()`, `new Date()`, `moment()`) are injected or passed in, never
referenced from inside domain logic. Note `dbService.ts` and the time-frame date
arithmetic duplicated at `dbService.ts:250-271` and `dbService.ts:372-392` are exactly
the style that would satisfy "it works" while failing this requirement.

**NFR-2 - Type checking gates the backend build. Lint gates nothing.** `backend/` and
`packages/shared` are type-checked from their first commit, with no equivalent of
`next.config.js`'s `typescript.ignoreBuildErrors` escape hatch, and a type error fails
the backend image. This is non-negotiable for the backend, and it needs no dedicated
build step: `nest build` *is* `tsc` and `packages/shared`'s build script is literally
`tsc`, so the gate is a side effect of needing the compiled JavaScript.

**Lint is a developer and editor tool with no build-failing behavior anywhere in this
repo.** Every package keeps its `lint` script and keeps it wired into editors; what lint
does not get is the ability to stop an artifact from being produced. The principle is
that an image build produces an artifact rather than running quality gates. No lint step
runs in any Dockerfile and none is added to CI.

*This is an amendment, not the original plan.* NFR-2 previously bound type checking and
lint together - "type-checked and linted ... and a failing check fails the build" - and
story 1.6 implemented that faithfully, adding build-failing lint to `backend/Dockerfile`.
The owner has since decided the lint half was the wrong call, so the backend half of
story 1.6 is superseded rather than retroactively re-described. Architecture D40 records
the decision; the two Dockerfile lint removals it calls for are carried by story 9.4,
which is the story that decides what the backend image enforces. Story 1.6's frontend
half stands untouched.

*The paragraph that stood here is void.* It read that the amendment did not weaken
correctness enforcement generally, because FR-21's OpenAPI staleness check still failed a
build. That check no longer exists (FR-21, superseded by FR-26), so type checking is now
the only thing that fails a backend image build. Contract staleness is caught by the
developer at commit time or not at all - a deliberate owner ruling, recorded under FR-26.

The frontend flags are a separate matter, and the decision is already made: **they stay
on for this initiative.** Removing `typescript.ignoreBuildErrors` would mean fixing
pre-existing frontend breakage - 46 type errors across 19 files, re-measured on this
branch - that has nothing to do with this migration, on the same branch, at the same
time as a monorepo move, which is exactly the kind of coupling that makes a large change
unreviewable. `eslint.ignoreDuringBuilds` is no longer a deferral at all: with lint
gating no build anywhere, the frontend already behaves the way the backend is being
changed to behave, and that flag simply stays. Story 1.6 therefore enumerates the real
error count and records that number and this rationale, and story 8.5 carries the type
errors forward into the deferred cleanup epic so it is a scheduled decision rather than a
thing that quietly evaporated.

This deferral covers the type/lint flags only. It is not a general licence to park
frontend-side risk: the frontend's EOL Node 18 runtime was considered under the same
"unrelated breakage" reasoning and was deliberately *not* deferred - it is fixed in story
1.2a, for the parity-evidence reasons recorded there. Once 1.2a lands, the frontend is on
a supported Active LTS runtime, and no standing "we ship on an unsupported runtime" risk
remains in this initiative.

**NFR-3 - Runs under Docker Compose behind nginx.** `docker compose up` brings up the
full stack including the new backend container; nginx knows about it; the local HTTPS
dev flow (`setup_local_https.sh`, `nginx/`) still works end to end. This must hold at
the end of *every* epic, not just at the end. From story 1.2a onward, "the full stack"
means both services on Node 24 - the runtime does not change again during the initiative,
so every subsequent epic's verification and every NFR-4 parity comparison is taken on the
runtime that ships.

**NFR-4 - Parity is demonstrated, not asserted.** For each domain, before its endpoints
are considered done, the new response is compared against the old route's response for
the same user and the same inputs, and the comparison is recorded in the story. A
throwaway comparison script is fine.

To be unambiguous about the "no tests" non-goal: what NFR-4 permits is a **one-off
comparison harness** - a script that hits both origins with the same inputs and diffs
the JSON, run by hand, whose output is pasted into the story as evidence. It is not
committed, it has no test runner, no assertions library, no CI hook, and no fixtures. It
is scaffolding for a human eyeball, discarded once the story is signed off. Writing the
actual test suite remains deferred follow-up work, and NFR-4 is not a back door to
starting it early.

**NFR-5 - Reversibility.** Until final sign-off, pointing the frontend back at the
Next.js API layer must be a configuration change, not a code change.

**NFR-5 stands unamended, and FR-25 is what keeps it true.** This was the sharpest question
the Orval decision raised, so the reasoning is recorded rather than assumed. The obvious
reading is that NFR-5 breaks: swapping hand-written hooks for generated ones is a code
change, and reverting it is a revert of code. That reading is only forced if adoption and
cutover are the same event. They are not, and separating them is the same move the PRD
already makes for Epics 6 and 7 - "make the switch possible" first, "throw the switch"
second.

Concretely: the generated hooks are adopted in Epic 10 with FR-25's seam pointing at the
Next.js routes, so the app calls exactly the endpoints it calls today and renders
identically. Epic 7 then flips one configured value. **The cutover story is the flip, and
the flip is configuration.** Adoption is not a cutover story and NFR-5 never applied to it,
any more than it applied to Epic 9's type adoption.

What this costs, stated plainly: the seam must map a spec path onto its Next.js equivalent,
which is only possible because the two surfaces are path-equivalent modulo the
`/backend/api` prefix. That equivalence is an assumption until story 10.2 verifies it route
by route, and if any route breaks it, that route's hook cannot be adopted before Epic 7 and
the story says so rather than working around it. It is also one more piece of coexistence
machinery, which story 8.6 deletes along with the rest.

The owner may still prefer to amend NFR-5 instead - it is their requirement. This design
was chosen because it needs no amendment, not because amendment was ruled out.

**NFR-6 - Building and typechecking run offline. Generation does not.** *Narrowed after
Epic 10 shipped; the identifier is kept because Epic 9's and Epic 10's stories cite it.*

**What still binds:** a clean checkout must typecheck, and both images must build, with no
MySQL, no Redis, no network access, no running backend process, and no code-generation step
of any kind. `frontend/src/api/generated.ts` is committed (FR-26), so this holds more
simply than it did under the snapshot pipeline - there is nothing in either Dockerfile that
reads a spec at all.

**What is void:** the original text also required *generation itself* to run offline, and
stated outright that Orval's input is a committed file on disk and never a URL. That is
reversed. Orval's input is `http://localhost:3002/backend/docs-json`, so running
`spec:generate` requires the stack up (`docker compose up -d nest-api`). This is a
developer-workstation requirement only; nothing in a build or a fresh clone depends on it.
The reasoning that used to forbid a URL - that the backend reaches MySQL at boot, so a
`curl` of `/backend/docs-json` could not be made offline - is not disputed, it is simply no
longer a constraint the owner wants paid for. `SWAGGER_ENABLED` still gates document
construction in `backend/src/main.ts` and still defaults to true; it must be on for
`spec:generate` to work, which is the same flag the Swagger UI needs.

### Explicitly out of scope

Per the brief: writing tests, frontend/component rewrites, moving formatting to the
client, any database change, new endpoints or auth providers, redesigning observability,
and any hosting change. Also out of scope: deleting the dead
`src/app/api/_nextApiCompat.ts` shim - it is a cleanup item (Epic 8), not a migration
item. Also out of scope: fixing the 46 frontend type errors and removing
`next.config.js`'s `typescript.ignoreBuildErrors`, which is a recorded deferral (NFR-2,
stories 1.6 and 8.5) rather than an omission - `eslint.ignoreDuringBuilds` is not a
deferral but a permanent setting under NFR-2's lint rule. Note
that the frontend's Node 24 bump is *in* scope and lands in story 1.2a; it is not a
deferred item.

## Epics

Epic 2 ends in the hard gate of GR-2. The `## Execution graph` section below is
authoritative on what may run when.

**Epics 9 and 10 appear out of numeric order, between Epics 4 and 5, and that is
deliberate.** The epics below are in *execution* order: Epic 9 ran fifth and Epic 10 runs
sixth. Both were added after Epics 5-8 were already drafted, and `architecture.md`, the
drafted epic files, and many story files cite those numbers (5.9, 6.2, 7.1, 8.5 and
others), so renumbering would invalidate all of it. A fresh number in the right reading
position costs less than a rename that silently breaks every existing citation. Epic 10 is
subject to the same rule: it takes the next free number even though it supersedes most of
Epic 9 and absorbs half of Epic 6. **Epic 11 is the same case again** - added after Epic 5
completed, it appears between Epics 6 and 7 because that is where it runs. **Epic 12** is the
mildest instance: added at Epic 6's review gate, it takes the next free number and sits
between Epics 7 and 8 because it runs after the cutover, and because Epic 8's position at the
end of this list is a fence rather than a schedule slot.

**On cross-cutting concerns.** Configuration, structured logging, the injectable clock,
global error shaping, Redis, and Prometheus metrics are deliberately *not* gathered into
an infrastructure epic. Each is introduced by the earliest story that genuinely needs
it, so a working endpoint arrives sooner. The risk this trades against is that a
concern gets introduced after several domains have already hardcoded around its absence,
or gets applied inconsistently across domains - so each one below names its owning story
explicitly, and those stories are load-bearing for the epics that follow them:

| Concern | Introduced by | Why there |
| --- | --- | --- |
| Injectable configuration | 1.4 | The backend cannot boot or reach MySQL without it |
| Structured logging | 4.1 | First real consumers are the auth failure paths |
| Injectable clock | 4.2 | `rememberMe` expiry is the first clock read; NFR-1 requires no code hardcode `Date.now()` before this lands |
| Global error/response shaping | 4.3 | The `401` guard is the first FR-5 consumer; must exist before *any* domain endpoint returns an error |
| Redis provider | 5.2 | Exchange rates is the first cache consumer |
| Prometheus metrics | 5.9 | Self-contained; it is itself one of the FR-1 endpoints |

Stories 4.2 and 4.3 are called out specifically: the clock underpins NFR-1's
testability constraint and error shaping underpins FR-5's preserved status codes and
error bodies. Both must land before the first domain story in Epic 5, not be
retrofitted.

### Epic 1: Monorepo restructure and backend skeleton

Get to a repo shaped `frontend/` + `backend/` on pnpm and Node 24, with an empty-but-booting NestJS
service wired into Compose and nginx, and with the application behaving exactly as it
does today. No API work happens here. Every story in this epic ends with `docker compose
up` working over local HTTPS (NFR-3).

**Stories**
- [ ] 1.1 - Root-vs-`frontend/` file inventory. Produce a written, file-by-file
  inventory of everything at the repo root, each marked *moves into `frontend/`*, *stays
  at root*, or *is duplicated/split*, with a one-line reason each. Must cover at least:
  `src/`, `public/`, `types/`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`,
  `tsconfig.json`, `package.json`, `package-lock.json`, `.eslintrc.cjs`, prettier config,
  `Dockerfile`, `nginx/Dockerfile`, `docker-compose.yml`, `defaults.env`, `override.env`,
  `setup_local_https.sh`, `nginx/`, `monitoring/`, `docs/`, `.claude/`, `.gitignore`,
  and the `prisma.schema` pointer in `package.json:79-81`. Deliverable is the inventory
  document; no files move in this story. Owner signs off on the inventory before 1.2.
- [ ] 1.2 - Execute the move per the approved inventory. Path-only change: no file
  contents change beyond what the new paths force (import aliases, config paths, Docker
  build contexts, volume mounts in `docker-compose.yml:59-61`, the Prisma schema path).
  Acceptance: the app is byte-for-byte behaviorally identical, all pages load, all
  existing `/api/...` routes still respond.
- [ ] 1.2a - Bump the frontend runtime to Node 24. Update `frontend/Dockerfile` to
  `node:24-bookworm`, add a root `.nvmrc` containing `24`, and set
  `engines: { node: ">=24 <25" }` on both package manifests. Acceptance: clean dependency
  reinstall, `next build` succeeds, `docker compose up` serves all pages over local HTTPS,
  NextAuth login works end to end (this exercises bcrypt), and middleware-gated `/stats`
  still redirects correctly. Architecture D26e carries the spike evidence - Next 14.0.1
  was built and served on Node 24.13.0, Edge middleware executed ES256 WebCrypto, and
  `bcrypt@5.1.1` is unaffected because it is N-API and ABI-stable across Node majors. No
  Next.js upgrade is needed or in scope. **This story must land before 1.3 and must not be
  reordered after it**: 1.3 pins pnpm 11.22.0, and pnpm 11 declares
  `engines.node >= 22.13`, which Node 18 cannot satisfy.

  *Why this is in Epic 1 rather than Epic 8:* NFR-4 requires per-domain response parity
  diffing throughout Epic 5, and NFR-3 requires the stack to run at the end of every
  epic. If the frontend runtime changed in Epic 8, every parity comparison gathered
  during Epics 5 and 7 would have been measured on a runtime the project no longer uses,
  making the shipped state the one state never validated. Bumping here means all
  subsequent work is built, diffed, and signed off on the runtime that ships. (An earlier
  argument from lockfile-format migration was tested and found false - pnpm 10 and 11
  both write `lockfileVersion: '9.0'` - and is deliberately not the reasoning here.)
- [ ] 1.3 - Convert the workspace from npm to pnpm across the monorepo, including the
  Docker builds. Requires 1.2a, because the pinned pnpm major will not run on Node 18.
  Acceptance: clean install from lockfile, `next-app` image builds, stack runs.
- [ ] 1.4 - Create the `backend/` NestJS application: boots, serves a health endpoint,
  and reads the same env vars the Next.js app does from the existing
  `defaults.env`/`override.env` mechanism **via an injectable configuration provider**,
  not via scattered `process.env` reads. That provider is the one piece of cross-cutting
  infrastructure that has to exist up front, because nothing else boots without it.
  No domain modules yet.
- [ ] 1.5 - Add the backend to `docker-compose.yml` and route to it from `nginx/nginx.conf`
  under a distinct path prefix or host, so it is reachable over the local HTTPS dev flow
  alongside the untouched `next-app`. Acceptance: the health endpoint from 1.4 answers
  through nginx.
- [ ] 1.6 - Type/lint enforcement. Turn on strict type-check and lint for `backend/`
  with build-failing behavior (NFR-2 **as it read at the time**). For the frontend, the
  decision is already taken (see NFR-2): `next.config.js`'s `ignoreBuildErrors` and
  `ignoreDuringBuilds` **stay enabled for this initiative**. This story's frontend
  deliverable is therefore evidence, not a fix - run the type-checker and linter against
  `frontend/` with the flags bypassed, record the actual error and warning counts, and
  write both those numbers and the deferral rationale into the story. Acceptance: the
  recorded decision exists, and story 8.5 is confirmed as its scheduled follow-up. This
  is a decision made and parked, not an item overlooked.

  **Partly superseded after completion.** NFR-2 has since been amended so that lint fails
  no build anywhere (architecture D40), which reverses this story's backend
  lint-enforcement half. The two `backend/Dockerfile` lint steps it added are removed by
  story 9.4. Everything else here stands: the backend type gate is still required, and the
  frontend evidence and its 8.5 follow-up are untouched. The story is left as written
  because it was correct against the requirement in force when it was built.

### Epic 2: API scaffold and Swagger sign-off gate

Produce the complete planned API surface as annotated stubs whose generated Swagger doc
is a faithful, reviewable picture of the finished backend. Nothing here talks to a
database.

This epic ends in GR-2's hard gate, which is **this epic's Owner Review gate** rather
than a story of its own. What the owner reviews there is the generated Swagger UI browsed
as a document, not the controller source, and Epics 3 onward do not start until it
passes. The specifics live in the `## Gate` section of `epics/2-api-scaffold.md`.

**Stories**
- [ ] 2.1 - Endpoint and contract inventory. For each of the 19 routes in FR-1: exact
  request shape (path params, query params, body), exact current response shape with
  every field's runtime type including which are pre-formatted strings (FR-3), status
  codes, and the FR-2 auth decision. This is the source of truth every DTO is written
  from. No code.
- [ ] 2.2 - Domain module map. Assign every endpoint from 2.1 to a Nest module - auth,
  transactions, summary, stats, product, exchange rates, price history, token info,
  metrics - and note which parts of `dbService.ts` and `src/server/helpers/` each module
  will absorb (FR-15). No code.
- [ ] 2.3 - Swagger bootstrap and DTO conventions. Wire `@nestjs/swagger`, serve the UI
  (FR-19), define the per-domain tag set, and settle the convention for documenting
  pre-formatted string fields - typed `string`, with an example showing the real
  formatted value and a description saying the formatting is server-side and
  intentional. One or two endpoints documented end to end as the worked example.
- [ ] 2.4 - Scaffold: auth module. Stub endpoints for login, logout, and session/current
  user, DTOs and Swagger annotations complete, each stub carrying its descriptive
  comment.
- [ ] 2.5 - Scaffold: transactions and product modules.
- [ ] 2.6 - Scaffold: summary and stats modules (all four `summary/*` endpoints plus
  `stats/[unit]`).
- [ ] 2.7 - Scaffold: exchange rates, price history, and time-frame P/L modules.
- [ ] 2.8 - Scaffold: token info and metrics modules.

### Epic 3: MikroORM data layer

Map MikroORM onto the existing database without touching it.

**Stories**
- [ ] 3.1 - MikroORM installed and configured against the existing MySQL 5.7 database,
  with schema generation/sync disabled (FR-13). Connection verified from the running
  backend container.
- [ ] 3.2 - Entities for `User`, `Transaction`, and `TokenInfo` matching
  `src/server/db/schema.prisma`, verified by reading real rows.
- [ ] 3.3 - Entities for `TokenPriceHistory`, `ExchangeRate`, `NetCashFlow`, and
  `OuathToken`, verified the same way.
- [ ] 3.4 - Establish how domain services obtain the EntityManager via DI and how
  request scope is handled, plus the pattern for the raw/aggregate queries that
  `dbService.ts` relies on. Demonstrated on one real read. This story sets the pattern
  every Epic 4-5 story follows, so it is worth doing carefully.

### Epic 4: Authentication - the first end-to-end slice

The first place the backend does real work, and the smallest vertical slice that proves
the stack: a browser posts credentials, MySQL is read through MikroORM, a session comes
back. NestJS owns credentials and the session from here on. The NextAuth setup stays
live and untouched (FR-11); the frontend does not switch to this until Epic 7.

Three cross-cutting concerns land here rather than in an infrastructure epic, because
auth is their first genuine consumer. 4.2 and 4.3 in particular must be finished before
any Epic 5 story starts - a clock or an error filter retrofitted after six domains have
been written against its absence is the failure mode this ordering exists to avoid.

**Stories**
- [ ] 4.1 - Structured logging to stdout in the shape Alloy and Loki already expect
  (FR-17), injectable, with request correlation. First consumers are the auth failure
  paths that `src/server/auth.ts:156,165` logs today (`Auth Error`, `Invalid password
  attempt`).
- [ ] 4.2 - Injectable clock abstraction (NFR-1). The first read is `rememberMe`'s
  expiry calculation, which is `Date.now()` today at `src/server/auth.ts:103`. Landing
  it now means no domain service in Epic 5 ever has a direct `new Date()` / `moment()`
  call to unpick later - including the time-frame date arithmetic duplicated at
  `dbService.ts:250-271` and `dbService.ts:372-392`. **Blocks Epic 5.**
- [ ] 4.3 - Global error handling and response shaping so error bodies and status codes
  match FR-5 uniformly across every module. First consumer is the `401` +
  `{ error: 'Unauthorized' }` of the auth guard, but the point is that every Epic 5
  domain inherits it rather than hand-rolling its own error responses. **Blocks Epic 5.**
- [ ] 4.4 - Credential verification against the existing `User` table and bcrypt hashes
  (FR-6), as an injectable service with no HTTP dependency.
- [ ] 4.5 - Login endpoint issuing a session, with `rememberMe` producing 8-hour vs
  30-day lifetimes (FR-7) via the 4.2 clock, and a logout endpoint that invalidates it
  (FR-10).
- [ ] 4.6 - Session/current-user endpoint returning the FR-9 whitelisted shape.
- [ ] 4.7 - Auth guard and current-user injection for protected endpoints, returning
  `401` + `{ error: 'Unauthorized' }` through 4.3's shaping, applied per the FR-2
  decisions from 2.1.
- [ ] 4.8 - Demonstrate that a Next.js server component can read a NestJS-issued session
  (FR-8), proven against `src/app/page.tsx`'s gating pattern without yet changing how
  that page behaves.

### Epic 9: Generated API types - one enforced response contract

Make the backend's OpenAPI document the single source of truth for the frontend's view
of every response, and make a stale copy fail the build (FR-20, FR-21, FR-22, FR-23,
NFR-6).

**Complete, and largely superseded by Epic 10.** The owner has since decided the frontend
generates its whole API client with Orval, which replaces the generator half of what this
epic built. This epic is left exactly as written, for the same reason story 1.6 is: it was
correct against the requirements in force when it ran, and its stories are cited by
`architecture.md` and by decisions D35-D48. What survives and what goes is settled
explicitly in Epic 10's preamble rather than left for a story to discover. The short
version: **the snapshot half survives, the type-generation half goes.** Stories 9.1, 9.1a,
9.1b, 9.2 and 9.7 stand entirely - the reconciliation, the DTO corrections, the committed
snapshot, and the `packages/shared` boundary are all upstream of which generator reads that
snapshot. Story 9.4's lint removal is unrelated and stands. Stories 9.3, 9.5 and 9.6 are the
ones Epic 10 redoes.

**The paragraph above is how it looked before Epic 10 ran; it is wrong about the snapshot.**
Epic 10's owner-feedback rounds went further than planned and deleted the snapshot half too:
`backend/openapi.json` and `scripts/generate-api-contract.mjs` are both gone, and so are
both Dockerfiles' staleness checks. Of story 9.2's output nothing survives as a file - only
the DTO corrections it and 9.1 forced, which are in the backend controllers and are what the
live spec is generated from. What still stands from Epic 9 is 9.1/9.1a/9.1b's contract
reconciliation, 9.4's lint removal, and 9.7's `packages/shared` boundary. Read Epic 9's
story files as a historical record of a pipeline that no longer exists.

**Why this runs before Epic 5 rather than after Epic 7.** Epic 5 is the epic that writes
every response shape - ten stories, each one touching DTOs. With the pipeline and the
staleness check already in place, every Epic 5 story that changes a DTO must regenerate
the snapshot, and the build refuses the commit if it does not. Drift is then impossible
during exactly the window where it would otherwise accumulate. Run after Epic 7 instead
and the same work only cleans up drift that already happened, one shape at a time, by
hand.

**Why adoption is possible now, before Epic 7's data flip.** The DTOs already exist and
are complete: Epic 2 delivered seventeen DTO classes and the owner signed off on the
generated Swagger at the GR-2 gate. FR-3 and NFR-4 require the backend's responses to be
byte-identical to the old routes', so a type generated from a DTO describes the current
Next.js response just as accurately as the hand-declared type it replaces. Adoption here
is a type-level change with no runtime effect; the frontend still calls the Next.js
routes throughout this epic and renders identically. Where a generated type does *not*
describe what the old route returns, that is a scaffold-fidelity defect in the DTO, and
story 9.1 is where it gets found and fixed - well before Epic 5 implements against it.

**Known input details.** The backend serves the spec JSON at `/backend/docs-json`, not
under the `backend/api` global prefix - `SwaggerModule.setup('backend/docs', ...)` in
`backend/src/main.ts` is independent of `setGlobalPrefix`. Two shapes need attention up
front: `TimeFrameCoinsPlResponseDto` is documented as a raw `additionalProperties` schema
on the controller rather than a named model, and the `timeFrame` path params in
`exchange-rates.controller.ts:9`, `time-frame-total-pl.controller.ts:14`, and
`time-frame-coins-pl.controller.ts:26` carry `example: '24h'`, which is not a member of
the `TimeFrame` union the frontend actually sends (`'h' | 'd' | 'w' | 'm' | '3m' | '6m' |
'y' | 'all'`) and which `summary.controller.ts:72` documents correctly as `'all'`.

Nothing in this epic is expected to make `@portfolio/shared` reachable from a bundled
frontend file - the generated types come from a generated declaration file, and
`frontend/src/server/session.ts`'s existing import stays unreferenced - so GR-5's
Dockerfile work is expected to fall to Epic 6 or 7. If a story here does trip it, GR-5
applies and that story lands the Dockerfile wiring.

**Stories**
- [ ] 9.1 - Contract reconciliation. Diff each of the eight `global.d.ts` shapes against
  the DTO that produces it, field by field, and record every difference with a verdict:
  DTO is wrong (fix the DTO), hand-declared type was wrong (record it), or the shape is
  not generatable at all. Covers the `'24h'` examples above and the question of whether
  `TimeFrame` becomes a generated enum by adding `enum` to those `@ApiParam`s or stays
  hand-declared as a request-side type. Also settles which parts of `global.d.ts` must
  survive for the GR-1 files of FR-23. Deliverable is the reconciliation table plus any
  DTO corrections; no generation yet.
- [ ] 9.2 - Committed spec snapshot. A repeatable command produces the OpenAPI JSON and
  writes it to a committed path, satisfying NFR-6 - no database, no network, no running
  service. Output must be byte-stable across runs on unchanged source, or the FR-21 diff
  is meaningless. Acceptance: two consecutive runs produce identical bytes, and the
  snapshot's path list matches the live `/backend/docs-json` from a running container.
- [ ] 9.3 - Type generation. Wire `openapi-typescript` over the 9.2 snapshot and commit
  its output. Acceptance: a clean checkout typechecks the frontend with no generation
  step, no backend running, and no database.
- [ ] 9.4 - Staleness check wired into the build, and lint taken out of it. Regenerate the
  snapshot from backend source and fail if it differs from the committed copy. The repo has
  no typecheck/lint CI workflow, so this story chooses and justifies a home for the check.
  It also carries NFR-2's amendment into the same file: remove the two lint steps from
  `backend/Dockerfile` so lint fails no build, which reverses the backend half of story 1.6.
  The two changes are one story because they are the same decision about what an image build
  enforces, and they edit the same Dockerfile. Acceptance: deliberately renaming a DTO field
  without regenerating fails the build and the failure message says what to run; a
  deliberate lint violation does not fail any image build; `pnpm lint` still reports it.
  **This is the story that makes the epic worth doing; it lands before any adoption story.**
- [ ] 9.5 - Adopt generated types in the summary, stats, and product consumers:
  `useCoinSummaries.ts`, `SummaryContext.tsx`, `SingleStat.tsx`, `StatsTable.tsx`,
  `Summary/TotalChart/Layout.tsx`, `product/ProductTable.tsx`, and every
  `components/stats-table/*` column. Acceptance: those files no longer import
  `PortfolioSummary`, `CoinSummaryResp`, `ProductTransaction`, or `ProfitLossChartResp`
  from `types/global`, and every affected page renders identically against the unchanged
  Next.js routes.
- [ ] 9.6 - Adopt generated types in the price-history and time-frame P/L consumers:
  `useFetchCoinPriceHistory.ts`, `useTimeTotalFramePl.ts`, `PriceHistoryProvider.tsx`,
  `StatsTableContext.tsx`. Then reduce `global.d.ts` to exactly the declarations FR-23
  keeps alive for GR-1 files, with a header comment saying it is legacy-only and pointing
  at the generated types. Acceptance: no client-side file imports a response type from
  `types/global`; `dbService.ts`, both `src/server/helpers/` files, and all nine
  `src/app/api/` importers are unedited and still compile.
- [ ] 9.7 - Shrink `packages/shared` to the FR-22 boundary. `Session` and `SessionUser`
  come from the generated types at their consumers; `SessionClaims`,
  `SESSION_ALGORITHM`, and `SESSION_COOKIE_NAME` stay hand-declared. Record the reasoning
  in the package's own source, not only here: the JWT payload and the cookie name have no
  HTTP representation to generate from. Acceptance: backend and shared both typecheck and
  lint, and the backend still boots and serves a session.

### Epic 10: Orval - generate the API client, not just the types

Replace Epic 9's generator with Orval, so the frontend's models *and* its TanStack Query
hooks are generated from the backend's OpenAPI document, and delete every hand-written HTTP
call to a spec'd endpoint (FR-24, FR-25, FR-26, GR-6, GR-7). The frontend still talks to the
Next.js routes at the end of this epic and every page renders identically; what changes is
who wrote the code that calls them.

**What of Epic 9 survives - as shipped, not as planned.** This table originally kept the
committed snapshot, the generation script, and both staleness checks. Three rounds of owner
feedback removed all of them. What follows is the shipped state, verified in the working
tree; the superseded plan is recorded in `epics/10-orval-generated-client.md`'s
`## Owner Feedback` and `## Review Notes`.

| Artifact | Fate |
| --- | --- |
| `backend/openapi.json`, committed and pretty-printed | **Gone.** Orval reads the live Swagger JSON at `http://localhost:3002/backend/docs-json` instead. |
| Nest preview-mode generation of the snapshot | **Gone**, with the script that did it. The spec now comes from the running app's own `SwaggerModule.setup('backend/docs', ...)`. |
| `scripts/generate-api-contract.mjs`, both halves | **Gone.** The whole toolchain is `frontend/orval.config.ts` plus one `spec:generate` script. |
| `frontend/types/api.d.ts` | **Gone**, replaced by Orval's output. |
| `frontend/types/contracts.ts` (the hand-written aliases) | **Gone.** Orval emits named model types, so there is nothing to alias. |
| Root devDependency `openapi-typescript@7.13.0` | **Gone**, replaced by `orval@8.26.0` - declared in `frontend/package.json`, not the root. |
| Root `spec:generate` / `spec:check` / `spec:watch` | **Gone from the root.** One `spec:generate` lives in `frontend/package.json`. `spec:check` had nothing left to check; `spec:watch` would race the backend's hot-reload, since Orval's `--watch` watches files and the input is a URL. |
| The two `builder`-stage staleness checks, one per Dockerfile | **Gone**, and not to be reinstated - see FR-21/FR-26. Neither Dockerfile reads a spec at all. |
| `frontend/src/api/generated.ts` | **The one committed generated artifact**: models plus TanStack Query hooks, Prettier-formatted, never hand-edited. |
| `frontend/src/api/http-client.ts` | **The one hand-written client artifact**: the Orval mutator, and FR-25's seam. |

**Why this runs before Epic 5, and why Epic 5 must depend on it.** Epic 5 is ten stories,
each one touching DTOs. Every one of them would otherwise regenerate Epic 9's artifacts and
hand-edit `frontend/types/contracts.ts` to add or rename an alias - a hand-maintained file
in a pipeline whose whole purpose is to have none, kept alive through exactly the epic that
produces the most churn against it. Doing Orval first means `contracts.ts` never gets those
edits because it no longer exists. This is the same argument that put Epic 9 ahead of Epic
5, applied to what Epic 9 left behind.

**Why the hooks can be adopted now, and not only after Epic 5.** The apparent blocker is
real: the spec's paths are the backend's (`/backend/api/summary/coins`), Orval generates
against the spec, and NestJS returns 501 for every data endpoint until Epic 5. Adopting a
generated hook that calls NestJS today would break the app. FR-25's seam is what removes
the blocker - the generated hooks call through one configured mapping that, by default,
rewrites a spec path onto its Next.js equivalent. The hooks then hit the routes the
frontend hits today, and FR-3 guarantees the responses match the types. **This is the
whole reason the epic does not split**, and it is load-bearing, so story 10.2 verifies the
path equivalence route by route before any hook is adopted rather than assuming it.

Two consequences worth naming. It keeps NFR-5 intact with no amendment, for the reasons
recorded under NFR-5 itself. And it means the risky moment - the origin changing - is
separated from the noisy moment - a dozen call sites changing - which is the separation
Epics 6 and 7 already exist to create.

**What this does to Epic 6.** Story 6.1 is absorbed here: the base URL is now a
configuration option of the generated client, and building a hand-rolled seam in front of a
client that ships one would be inventing structure. Epic 6 is amended in place to the auth
seam alone. It is not marked superseded, because story 6.2 is untouched and genuinely still
needed - NextAuth-versus-Nest session reading has nothing to do with code generation.

**What this does to Epic 7.** Story 7.2 becomes a true configuration flip with no component
edits, which is what it always claimed to be and could not have been under a hand-written
hook layer.

Nothing here is expected to make `@portfolio/shared` reachable from a bundled frontend file
- the generated client imports from generated files, and `frontend/src/server/session.ts`
stays unreferenced - so GR-5's Dockerfile work is still expected to fall to Epic 6 or 7. If
a story here does trip it, GR-5 applies and that story lands the Dockerfile wiring.

**Browser verification is part of this epic's gate.** Stories 9.5 and 9.6 each left one
acceptance bullet unchecked - a browser check of `/`, `/product`, and the stats page - which
Dev could not perform because those routes are auth-gated. This epic rewrites the same
consumers, so its own verification absorbs those bullets rather than carrying them forward
a second time. Since the obstacle is auth and not effort, the check belongs to the owner at
the Owner Review gate, and the epic should say so instead of assigning Dev a task Dev cannot
do.

**Stories**
- [ ] 10.1 - Orval in, `openapi-typescript` out. *As shipped, this landed differently:*
  `orval` is a `frontend/` devDependency with its config at `frontend/orval.config.ts`,
  reading the live Swagger JSON at `http://localhost:3002/backend/docs-json`. The
  "never a URL - NFR-6" clause below is reversed; see the NFR-6 entry. Install and configure
  `orval` at the repo
  root, reading the committed `backend/openapi.json` (never a URL - NFR-6), emitting models
  and `@tanstack/react-query` hooks to a committed generated path, and commit the output.
  Remove the `openapi-typescript` root devDependency. Nothing consumes the generated client
  yet; `frontend/types/api.d.ts` and `contracts.ts` are still in place and still compile.
  Two dependency items ride along because this is the story that touches the manifests and
  the lockfile: **(a)** remove `react-query@^3.39.3` from `frontend/package.json:64` - it is
  the deprecated pre-TanStack package, sitting alongside `@tanstack/react-query@^5.62.0`,
  and nothing under `frontend/src` imports it (verified); **(b)** measure what swapping the
  generator does to Epic 9's open advisory F2, which recorded `openapi-typescript` moving
  `debug`'s optional `supports-color` peer from 8.1.1 to 10.2.2 across the whole graph
  including the backend production closure. Do not assume removing it resolves F2 - Orval is
  a far larger devDependency and may pull the same version or a different one. Record
  `pnpm why supports-color` before and after, state plainly whether F2 is resolved, made
  worse, or unchanged, and note anything else in the backend production closure that moved.
  Acceptance: `pnpm install --frozen-lockfile` is clean, generation is byte-stable across
  two consecutive runs, and the F2 measurement is in the story.
- [ ] 10.2 - Path equivalence and the FR-25 seam. Produce a route-by-route table for all 19
  FR-1 endpoints mapping the spec path to the Next.js path it must reach during
  coexistence, covering path params, query params, and request bodies, and flagging any
  route where the two are *not* equivalent modulo the `/backend/api` prefix. The auth routes
  are expected to be the exception - NextAuth's `/api/auth/[...nextauth]` is a different
  contract, not a prefixed one - and they are excluded here and handled by stories 6.2 and
  7.1. Then build the seam: one configured value selecting the target, defaulting to the
  Next.js routes. Acceptance: the table is complete, every non-equivalent route is named
  with what makes it non-equivalent, and a generated hook called through the seam returns
  the same body as the hand-written fetch it will replace. **No hook is adopted in this
  story.** If the table shows a route that cannot be mapped, this story stops and raises it -
  the epic's shape depends on the answer.
- [ ] 10.3 - Re-point the FR-21 staleness check, and retire the types half of the script.
  **Superseded in flight - what shipped is the opposite.** The owner ruled during this epic
  that there is no staleness check anywhere, so this story instead deleted
  `scripts/generate-api-contract.mjs`, `backend/openapi.json`, and both Dockerfiles' check
  steps. The text below is the plan it was drafted from, kept because the story file cites
  it; FR-26 is what binds now. The frontend link now regenerates the Orval output from
  the committed snapshot and fails the build if it differs from the committed copy, still
  with no `.git`, no database, no network, and no backend tree in the image. Reduce
  `scripts/generate-api-contract.mjs` to the spec half, delete `frontend/types/api.d.ts`,
  and re-point `spec:generate`, `spec:check` and `spec:watch` so watch mode keeps both
  artifacts current. Acceptance: renaming a DTO field without regenerating fails a
  production image build and the message says what to run; a clean checkout typechecks the
  frontend with no generation step, no backend running, and no database. **This lands
  before any adoption story**, for the same reason 9.4 did.
- [ ] 10.4 - Adopt the generated hooks in the summary, stats, and product consumers:
  `useCoinSummaries.ts`, `SummaryContext.tsx`, `SingleStat.tsx`, `StatsTable.tsx`,
  `Summary/TotalChart/Layout.tsx`, `product/ProductTable.tsx`, and every
  `components/stats-table/*` column. Each hand-written `useQuery` is replaced by the
  generated hook for the same operation; each `import ... from '../../types/contracts'`
  becomes an import of the generated model. Acceptance: no `fetch(` remains in these files,
  none imports from `types/contracts`, and a per-file type-error count before and after is
  recorded rather than a "does it typecheck" claim - two of these files are already among
  the 46 pre-existing frontend errors, so the aggregate number proves nothing.
- [ ] 10.5 - Adopt the generated hooks in the price-history and time-frame P/L consumers:
  `useFetchCoinPriceHistory.ts`, `useTimeTotalFramePl.ts`, `PriceHistoryProvider.tsx`,
  `StatsTableContext.tsx`. Note `StatsTableContext.tsx` consumes the one shape with no
  component schema, the `time-frame-coins-pl` arbitrary-key map, so this story is where
  Orval's handling of it is confirmed against what the `paths[...]` alias expressed.
  Acceptance as 10.4.
- [ ] 10.6 - The call sites that are not react-query, then delete the leftovers. Four sites
  keep their existing control flow and take the generated *operation function* rather than a
  hook, per GR-7: `useGetTokenList.ts:23`, `useFetchCurrentPrice.ts:17`,
  `AddTransaction.tsx:161`, and `app/product/page.tsx:17`. `useStorePriceHistory.ts` is the
  mixed case - its two calls to `/api/price-history/check` and `/api/price-history/set`
  become generated operations while the crypto.com call at line 16 stays hand-written, being
  outside the spec. Then delete `frontend/types/contracts.ts`, and reduce
  `frontend/types/global.d.ts` to exactly the declarations FR-23 keeps alive for GR-1 files,
  with a header comment saying it is legacy-only. Acceptance: GR-6's grep is clean - the only
  surviving `fetch(`/`axios` hits in `frontend/src` are the mutator at
  `src/api/http-client.ts`, the crypto.com call, the dead commented-out ones, and files under
  `src/app/api/` and `src/server/`; `dbService.ts`, both `src/server/helpers/` files, and all
  nine `src/app/api/` importers are unedited and still compile.

### Epic 5: Domain endpoint implementation

Replace scaffold stubs with real behavior, domain by domain. Each story ends with the
NFR-4 parity comparison against the corresponding old route, and each keeps Swagger
accurate as it goes. Do not start until 4.2, 4.3, and all of Epics 9 and 10 are done.

**Every story here that changes a DTO must regenerate `frontend/src/api/generated.ts` and
commit it in that same story, and must say so in its acceptance criteria.** Nothing
enforces this - the staleness check FR-21 once required does not exist and must not be
added (FR-26). Regeneration is `docker compose up -d nest-api`, then `pnpm --filter
@portfolio/frontend spec:generate`, because Orval reads the running backend's Swagger JSON.
A story that changes a DTO and leaves the generated client stale ships a frontend type that
silently disagrees with the response, which is exactly the failure mode this epic is most
able to produce - ten stories, all of them touching DTOs.

Epic 10 is a hard predecessor and not merely a preference: without it these ten stories
would each hand-edit `frontend/types/contracts.ts` to keep a hand-written alias file in step
with the DTOs they are rewriting, which is the maintenance burden Epic 10 exists to delete.

**Stories**
- [ ] 5.1 - Transactions: `POST /transaction/add`, `DELETE /transaction/[id]`
  (absorbing `src/server/db/storeTransactions.ts`). First data domain end to end, so it
  is also where the Epic 3 EntityManager pattern and the Epic 4 guard, clock, and error
  shaping get exercised together for the first time.
- [ ] 5.2 - Redis client as an injectable provider sharing today's key naming (FR-18),
  then exchange rates: both `exchange-rates/*` endpoints, absorbing
  `src/server/helpers/get-exchange-rates.ts`, including the bare-string response of
  `exchange-rates/unit/[unit]` (FR-3). Redis rides along here because exchange rates is
  its first real consumer; every later cache user takes the provider as given.
- [ ] 5.3 - Token info: `token-info/[userId]` and `token-info/search/[searchTerm]`.
- [ ] 5.4 - Price history: `price-history/check` and `price-history/set`, absorbing
  `src/server/helpers/update-price-history.ts` and the Redis cache checks.
- [ ] 5.5 - Summary, part 1: `summary/coins` and `summary/portfolio`, including the
  FIFO net-cash/contributions logic currently inline at
  `src/app/api/summary/coins/route.ts:11-31`.
- [ ] 5.6 - Summary, part 2: `summary/[unit]` and both `summary/profitLossChart`
  variants (FR-4).
- [ ] 5.7 - Stats and product: `stats/[unit]` and `product/[product]`, the two most
  formatting-heavy endpoints - `formatUSD`, `.toFixed(1) + '%'`, `.toFixed(4)` - with
  the duplicated local `formatUSD` at `product/[product]/route.ts:7` reconciled against
  `src/server/helpers/format-usd.ts` and any behavioral difference between them called
  out rather than silently unified.
- [ ] 5.8 - Time-frame P/L: `time-frame-coins-pl/[timeFrame]` and
  `time-frame-total-pl/[timeFrame]`.
- [ ] 5.9 - Metrics: Prometheus registry, default and custom metrics matching
  `src/server/metrics.ts`, and the `METRICS_SECRET`-guarded scrape endpoint returning
  `403 Forbidden` on a bad token (FR-16, FR-5). Add the backend as a scrape target in
  `monitoring/prometheus.yml`. Self-contained and dependency-free, hence its position -
  it can move earlier if wanted.
- [ ] 5.10 - Full-surface parity sweep: every endpoint in FR-1 exercised against the new
  backend and diffed against the old route with the NFR-4 one-off harness, results
  recorded. This is the evidence that Epic 7's cutover is safe.

### Epic 6: Frontend auth access seam

**Amended in place, and now a single-story epic.** As drafted this epic built two seams -
a data base URL (6.1) and an auth seam (6.2). Epic 10 absorbs the first: with the frontend
on a generated client, the base URL is a configuration option of that client (FR-25), and
hand-rolling a second seam in front of it would be inventing structure the tool already
provides. Story 6.1 is therefore **removed, not deferred**, and 6.2 keeps its number so the
`architecture.md` and story-file citations that name it keep resolving.

What remains is genuinely untouched by code generation. Story 6.2 abstracts over *how the
frontend learns who is logged in*, and the two implementations it spans are NextAuth and a
Nest-issued session cookie - a question about auth mechanics, not about who wrote the fetch.

Nothing observable changes here: at the end of it the frontend is still NextAuth-backed. The
seam is what Epic 7 then flips. Story 6.2 is also the likely first trigger for GR-5, since a
frontend session read wants `SESSION_COOKIE_NAME` from `@portfolio/shared`.

**Stories**
- [ ] 6.2 - Consolidate auth access: the `next-auth/react` usage in
  `LoginClient.tsx` and the nav components, and the `getServerAuthSession()` calls in
  `src/app/page.tsx` and `src/app/login/page.tsx`, behind a single switchable seam.
  Still NextAuth-backed at the end of this story. The seam's NestJS side is the generated
  login, logout and session operations from Epic 10, not a hand-written fetch (GR-6) - it is
  written but not selected here, which is what makes 7.1 a configuration flip.

### Epic 11: Ownership scoping on transaction delete

Implement FR-27: `DELETE /transaction/:id` in the NestJS backend deletes only rows belonging
to the authenticated caller. One behavior change, one endpoint, recorded as the eighth
intentional divergence.

**Why this is an epic of its own rather than a story bolted onto 6 or 7.** Epic 5 is complete
and signed off; reopening it would put work outside the gate that reviewed it and make the
record of what was approved untrue. Epic 6 is the frontend auth seam - a backend
authorization change shares nothing with it but the word "auth", and folding it in means one
gate covering two unrelated things. Epic 7 is the cutover, whose entire discipline is that
nothing is written there beyond configured values, so that a post-flip regression has exactly
one possible cause; landing a behavior change in that diff destroys the property the epic
exists to have. A separate epic gets this its own owner gate, which is the right amount of
review for a deliberate exception to FR-3.

It takes the next free number rather than slotting in as 5.11 or 7.0, for the reason recorded
above Epic 1: this PRD's epic numbers are cited by `architecture.md` and by story files, and a
fresh number in the right reading position costs less than a renumber. Like Epics 9 and 10, it
appears here in **execution** order, not numeric order.

**Timing is the constraint, and the execution graph enforces it.** This runs after Epic 5
(there must be a real delete endpoint to scope) and before Epic 7 (after cutover there is no
old route left to diff against). `depends-on: 5` plus Epic 7's `depends-on: ... 11` is what
makes that mechanical rather than a note someone has to remember.

**What the change actually is.** `backend/src/transactions/transactions.service.ts:56`
filters on `id` alone; it gains the caller's id, which the controller already holds and
already passes to `addTransaction`. `nativeDelete` returns an affected-row count, so a row the
caller does not own returns `0` and falls into the existing "affected === 0" branch - the same
`500` a nonexistent id produces today. No new branch, no new body, and no way for a caller to
tell "not yours" from "does not exist". The deliberate-gap comment at
`transactions.controller.ts:95-97` is deleted, since it will then describe the opposite of
what the code does.

**Two things a story here must not skip.** The Swagger `@ApiResponse` text for the `500` still
says "there is no existence check", which stops being true, so it changes - and per FR-26 any
spec change means checking whether `frontend/src/api/generated.ts` moves and committing it in
the same story if it does, because nothing else will catch it. And per NFR-4 the divergence is
*demonstrated*: both routes are still live here, so the story records the old route's response
and the new one's for the same foreign id, which is the evidence that only this case differs.

**Stories**
- [ ] 11.1 - Scope the delete to the caller (FR-27), record the NFR-4 comparison for an owned
  id and a foreign id against both routes, update the Swagger `500` description, and add the
  eighth row to the divergence table in `inventory-endpoint-contracts.md`.

### Epic 7: Cutover - throw the switch

Flip the two seams - Epic 10's generated-client target (FR-25) and Epic 6's auth seam -
from the Next.js routes to the NestJS backend. No frontend code is written here beyond
changing configured values; if a story in this epic finds itself editing components, the
seam it is flipping was incomplete and the fix belongs in the epic that built it.

Two sequencing decisions are baked in. **Auth flips first**, because a NestJS data
endpoint cannot authorize a browser that holds only a NextAuth session, so the data flip
is meaningless until the browser carries a Nest-issued one. **The data flip is
all-at-once, not per-domain** - one switch for all domains, with the 5.10 parity sweep
as the evidence that it is safe. Per-domain flipping would buy finer-grained rollback at
the cost of running the app in mixed states for far longer, which is the harder thing to
reason about. Reverting any story in this epic must be a configuration change and
nothing more (NFR-5).

**The developer documentation is no longer here; it is Epic 13.** As drafted this epic
carried a fourth story, 7.4, updating `README.md` and `OBSERVABILITY.md` for the monorepo
layout and the two-service topology. The owner has moved that work to its own later epic.
The reason is the paragraph above: this epic's value comes from its diff containing nothing
but configured values, so that a post-flip regression has exactly one possible cause, and a
prose story riding along dilutes the property even though prose cannot cause a regression -
it makes "did anything else land here" a question rather than a glance. **7.4 is moved, not
dropped**: its drafted content was folded into Epic 13's own section below, which is what
Epic 13's stories are written from, and the story file that carried it is retired. The
number 7.4 is retired with it: read a citation of it as pointing at Epic 13.

**Stories**
- [ ] 7.1 - Flip the auth seam from 6.2 to the NestJS endpoints: login, logout,
  client-side session reads, and the server-component gating in `src/app/page.tsx` and
  `src/app/login/page.tsx` (FR-8). Acceptance: a full login/reload/logout cycle works,
  `rememberMe` lifetimes behave, and flipping the config back restores NextAuth.
- [ ] 7.2 - Flip the generated client's target from the Next.js routes to the NestJS
  backend for all domains at once, with the 5.10 parity sweep as the evidence. Since Epic 10
  already adopted the generated hooks, the requests stop being rewritten onto `/api/...` and
  go to `/backend/api/...` as the spec describes them. Acceptance: every page renders
  identically to before, no console or network errors, flipping the value back restores the
  old routes, and the diff of this story contains no file under `frontend/src`. *As Epic 10
  shipped, the value is `NEXT_PUBLIC_API_TARGET`, a `next-app` build arg in
  `docker-compose.yml` defaulting to `legacy`; setting it to `nest` stops
  `frontend/src/api/http-client.ts` stripping the `/backend` prefix. The strip itself stays
  in the mutator after the flip - removing the now-dead `legacy` branch is story 8.6's job -
  so this story remains a configuration change with no `frontend/src` edit.*
- [ ] 7.3 - Full-stack verification from a cold `docker compose up`: all pages, both
  Prometheus scrape targets, Grafana dashboards populated from backend logs, Swagger UI
  reachable, local HTTPS intact.

### Epic 12: Refile the auth seam's server modules out of `frontend/src/server/`

Move `frontend/src/server/session.ts` and `frontend/src/server/authSession.ts` into
`frontend/src/auth/`, beside `target.ts`, `actions.ts` and `useCurrentSession.ts`, and update
their importers. A path change and nothing else: no exported name, no signature, and no
runtime behavior moves.

**Raised by the owner at Epic 6's review gate and deliberately deferred there** rather than
reopening an epic that had already passed; the wording is in
`epics/6-frontend-auth-seam.md`'s `## Owner Feedback`. The argument is that
`frontend/src/server/` reads as "server code that goes away once everything is in NestJS" -
which is exactly what stories 8.1 and 8.2 do to it - while these two files are the opposite.
They are the frontend's side of the auth seam, and `authSession.ts` exists specifically to
read a *Nest-issued* session. They survive the migration rather than dying with it, and a
folder whose name predicts deletion is the wrong place for them.

**This is not a GR-1 relaxation**, for the reasons set out in the clarification under GR-1
above. Both files were created by this initiative - `session.ts` by Epic 4, `authSession.ts`
by story 6.2 - so neither was ever in the set GR-1 protects, which Success Criterion 9
defines as the files that existed at the start. Every one of those keeps its path and its
contents, `src/server/auth.ts` included: `authSession.ts` keeps importing
`getServerAuthSession` from it after the move, as `@/server/auth` rather than `./auth`.

**Why it runs after Epic 7 rather than before.** It touches `frontend/src/middleware.ts`,
which story 7.1 flips, and both seam files that the flip is exercised through. Epic 7's
whole discipline is that nothing is written there beyond configured values, so that a
post-flip regression has exactly one possible cause; a rename landing in or just before that
window gives it a second. After the cutover the flip is proven and a pure path change is
diffable on its own.

**The importers are four, and one of them is Edge.** `frontend/src/app/page.tsx:2` and
`frontend/src/app/login/page.tsx:2` import `getSession` from `@/server/authSession`;
`frontend/src/middleware.ts:6` imports `verifySessionToken` from `@/server/session`; and
`authSession.ts:6` imports `toSession` and `verifySessionToken` from its sibling. The
middleware one is the one to watch, because it runs on the Edge runtime and reaches
`@portfolio/shared` through the file being moved. Three runtime - not type-only - imports of
that package sit on this path: `SESSION_COOKIE_NAME` in `middleware.ts:4` and
`authSession.ts:2`, and `SESSION_ALGORITHM` in `session.ts:2`. GR-5's Dockerfile wiring,
landed by story 6.2, therefore stays load-bearing across the move, and a production
`next-app` image build is part of this epic's evidence rather than an assumption.

**One hazard the destination folder creates.** `frontend/src/auth/` is client code today -
`actions.ts` and `useCurrentSession.ts` both carry `'use client'` - and these two arrivals
are the opposite, `authSession.ts` importing `next/headers` and being server-only. Mixing
them is fine while every import names a file directly, which all four above do. What would
break it is an `index.ts` barrel, which would pull `next/headers` into a client bundle, so
this epic introduces none.

**Five architecture citations go stale, not two.** `architecture.md` writes every path
citation of these two files against the pre-move location on purpose, because it is correct
until story 12.2 executes the move. Five passages state that location as a live fact and
stop being true the moment it lands. Referenced by heading and quoted phrase rather than by
line number, since that document is still being revised and line numbers drift out from
under a citation almost as fast as they are written:

1. `## Overview` - the paragraph headed *"One qualification, scheduled rather than done."*,
   which names both files and closes with *"Until story 12.2 lands, both files are still
   where this document cites them"*.
2. `### Session design` - the paragraph headed *"Library split: the backend uses
   `@nestjs/jwt`, the frontend uses `jose`."*, which locates the frontend's verify
   implementation *"in `frontend/src/server/session.ts`"*.
3. `### packages/shared - scope and build` - the paragraph headed *"The verify helper is
   not here - it lives in `frontend/src/server/session.ts`."*, and its follow-up headed
   *"Its exact path is scheduled to change; the fact that it is frontend-owned is not."*
4. `## Key Decisions`, decision **D25** (`packages/shared` limited to the session claim
   contract) - *"it now lives in `frontend/src/server/session.ts` - the live path until
   Epic 12 moves that file"*.
5. `## Key Decisions`, decision **D64** (the move itself) - *"Every path citation in this
   document stays on the pre-move location until story 12.2 executes it"*, which is the
   sentence licensing the other four and retires with them.

Alongside these, the `## Migration / Rollout Strategy` paragraph headed *"Epic 12 - refile
the auth seam's server modules"* carries `architecture.md`'s own inventory of which
citations are deliberately pre-move; it is bookkeeping about the five above rather than a
sixth citation, and it is reviewed in the same pass. The backstop against any of these
being missed is a grep of `architecture.md` for `src/server/session.ts` and
`src/server/authSession.ts` after the move, with every surviving hit having to be
defensibly historical rather than a live path.

That document is the Architect's and this epic does not edit it; the inventory is recorded
here so the refresh is a known item rather than a discovery. Who discharges it has since
been settled by the Architect, in `architecture.md`'s D64 and its
`## Migration / Rollout Strategy` paragraph on this epic: story 12.2 is the *trigger*, not
the owner - it hands the citation inventory off in its Dev Notes and edits nothing in that
document - and the repointing is done by a separate `bmad-architect` pass once 12.2 has
landed. That pass sits between this epic and Epic 13, and Epic 13's section records why the
order is not optional.

**Stories**
- [ ] 12.1 - Survey what is left in `frontend/src/server/` and give every remaining entry a
  verdict - *created by this initiative, refile* or *GR-1-protected, dies with Epic 8* - with
  a one-line reason each, covering at least `auth.ts`, `logger.ts`, `metrics.ts`,
  `redisClient.ts`, `db/`, and `helpers/`. The expectation is that `session.ts` and
  `authSession.ts` are the only two in the first category, and the story confirms that rather
  than assuming it. Finding a third is not licence to move it: GR-1's clarification names
  exactly those two, so a third would be an owner decision and a PRD amendment before any
  file moves. Also settles the naming question the move creates: whether
  `auth/authSession.ts` keeps its name inside a folder already called `auth`. Deliverable is
  the table and the naming decision; no files move. Owner signs off before 12.2.
- [ ] 12.2 - Execute the approved move as a rename plus import updates, with no content
  change beyond the import specifiers and the `./auth` to `@/server/auth` adjustment.
  Acceptance: both branches of the auth seam still behave - login, logout, the nav username,
  `/stats` and `/product/*` gating, and the server-side redirects on `/` and `/login` - the
  production `next-app` image still builds with the `@portfolio/shared` wiring intact, no
  barrel file was added, and no file under `src/app/api/` or the remainder of `src/server/`
  is touched.

### Epic 13: Developer-setup docs for the monorepo and the two-service topology

Write the setup documentation this repo has never had - the pnpm workspace, the Node 24 /
pnpm 11 toolchain, bringing the stack up, and the `next-app` + `nest-api` topology behind
nginx - and correct the one place the migration made an existing doc wrong,
`OBSERVABILITY.md`'s `METRICS_SECRET` rotation steps. Prose only: no file under
`frontend/src`, `backend/src`, or any config or compose file is edited.

**This was story 7.4 and is now its own epic**, by owner decision at Epic 7's drafting. The
reasoning is recorded under Epic 7: the cutover's whole discipline is that its diff contains
nothing but configured values, and the epic is easier to trust when that is true by
inspection rather than after subtracting a documentation story. It takes the next free
number, 13, for the reason recorded above Epic 1 - numbers here are cited by
`architecture.md` and by story files, so a fresh number costs less than a renumber - and
unlike Epics 9-12 it needs no explanation for its reading position, because it runs last
among the in-scope epics and is numbered last.

**Why it runs after Epic 12 and not earlier.** The obvious placement is straight after Epic
7, since every fact about the toolchain and the topology is already true by then. The
constraint is not truth, it is *durability*: this epic writes a repo-layout section that
names paths, and Epic 12 moves two of them - `frontend/src/server/session.ts` and
`frontend/src/server/authSession.ts` into `frontend/src/auth/`. Documenting the frontend's
layout in the window before that move means writing a section that goes stale one epic
later, and a setup doc that is wrong about where a file lives is worse than one that does
not mention it, because a reader has no way to tell which parts aged. Running after 12 also
means story 12.1's survey of what remains under `frontend/src/server/` - and its verdict of
*refile* or *dies with Epic 8* on each entry - already exists as source material for the
layout section rather than being re-derived here.

**A `bmad-architect` repointing pass runs between Epic 12 and this epic, and this epic waits
for it.** Story 12.2's move leaves five path citations in `architecture.md` stale - the ones
inventoried in Epic 12's section above. The Architect has ruled how that is discharged
(`architecture.md`, D64 and the `## Migration / Rollout Strategy` paragraph on Epic 12):
story 12.2 is the trigger and hands the inventory off in its Dev Notes, it does not edit
`architecture.md` itself, and the repointing is a separate `bmad-architect` pass run once
12.2 has landed. That ruling binds this epic because story 13.1 writes its repo-layout
section *from those citations*. Drafting or building Epic 13 before the pass lands means
copying paths already known to be stale - the same failure the placement after Epic 12
exists to prevent, arriving through the architecture document rather than through the code,
and harder to spot because the doc it was copied from looked authoritative. The sequence is
therefore: 12.2 lands, `bmad-architect` repoints, then Epic 13 is drafted. This is an
obligation between two epics, not an epic and not a dependency line - the pass has no number
for the graph to reference, which is why it is written here.

There is a second, weaker reason worth naming so it is not mistaken for the main one: Epic
12 is the last in-scope epic that changes the shape of the repo at all, so writing the docs
after it is the only placement where "the docs describe the shipped state" needs no
qualification. Epic 8 would break that again, but Epic 8 is out of scope and its own
re-planning owns its documentation.

**The `OBSERVABILITY.md` fix belongs here because this initiative created the gap.** That
document's `METRICS_SECRET` rotation procedure says the secret is shared between exactly two
places and ends with `docker compose restart next-app prometheus`. Story 5.9 made that
false: it added the backend's `METRICS_SECRET`-guarded scrape endpoint (FR-16) and a second
Prometheus job, `nestjs-backend`, in `monitoring/prometheus.yml`, so the secret now has a
third consumer and rotating it by the documented steps leaves `nest-api` running on the old
value until something else restarts it. The symptom is the one the document itself warns
about - `403 Forbidden` scrape errors and metrics silently stopping - arriving from a
service the document never mentions. This is an accuracy defect the migration introduced,
not a documentation improvement, which is why it is in scope for an initiative whose brief
puts redesigning observability out of scope: nothing here changes what is monitored or how,
it makes a procedure match the services that now exist.

**Stories**
- [ ] 13.1 - Add the setup section to `README.md`: prerequisites and pinned toolchain, the
  pnpm workspace layout including `packages/shared`, that installs go through pnpm and not
  npm, bringing up the stack over local HTTPS, and the nginx topology including where
  Swagger UI is served. Every fact verified against its source file rather than written from
  memory; the existing Orval section's content is unchanged.
- [ ] 13.2 - Correct `OBSERVABILITY.md`'s `METRICS_SECRET` rotation steps for the backend:
  the restart covers `nest-api`, and the `monitoring/prometheus.yml` step names both scrape
  jobs the secret gates rather than only the one that predates this initiative.

### Epic 14: Post-cutover validation and regression fixing

Find and fix regressions in the live NestJS backend and the cut-over frontend that story
5.10's pre-cutover parity sweep either did not catch or that appeared after it ran. This
epic exists because the owner, using the app after Epic 7's cutover, is seeing errors that
were not present before it - which means either a silent divergence 5.10's sweep missed, or
a regression introduced by Epics 11 through 13 after 5.10 was recorded.

**Numbering.** 13 is the highest epic number in this PRD, so this epic takes the next free
number, 14, for the same reason recorded above Epic 1: numbers here are cited by
`architecture.md` and by story files once drafted, and a fresh number costs less than a
renumber. Unlike Epics 9-12, it needs no explanation for its reading position among the
in-scope epics - it runs last and is numbered last, taking over that property from Epic 13.

**Why it depends on Epic 13 and not directly on Epic 7.** The regressions this epic exists to
find can only have been introduced anywhere between Epic 7's cutover and the end of the
current execution graph, and Epic 13 is that graph's last epic before this one - its own
`depends-on: 7, 12` already makes it strictly later than the cutover and later than Epic 12's
refile. Depending on 13 therefore transitively requires every epic that could have introduced
a regression to be finished and signed off first, without this epic's line having to enumerate
them. Epic 13 itself is prose-only and touches no `frontend/src`, `backend/src`, or config
file, so it is not a code dependency in the way Epic 5 is a code dependency of Epic 11 - it is
the same kind of "run last among what currently exists" placement Epic 13 held before this
epic was added.

**Why this must exist, and why it gates Epic 8.** Epic 8 deletes the superseded
`src/app/api/` and `src/server/` code (stories 8.1, 8.2) that GR-1 has protected for the whole
initiative. Doing that while the NestJS backend that replaces it still has unknown
regressions would remove the only remaining fallback - reversibility (NFR-5) still points the
frontend's configured seams at the legacy routes, but once those routes' code is deleted that
reversibility is gone too. This epic is what closes that gap: it is the validation pass that
must find and fix what it finds before removal of the fallback is even on the table. **Epic 8
remains out of scope and its `depends-on: OUT OF SCOPE` line is unchanged by this epic** -
approving Epic 8 still requires its own separate PRD, per the existing rule recorded at that
line and in its section above. What this epic establishes is that *when* Epic 8 is eventually
proposed, its planning should treat this epic as the prerequisite: a fresh PRD for Epic 8
should not be approved, and its own execution graph should not be written, as depending on
anything earlier than this epic's completion.

**Where the bugs come from.** None are known yet; this section intentionally names no specific
defect. Two sources will supply them once this epic is drafted for real by `bmad-sm`:

1. An automated re-check of story 5.10's recorded pre-cutover request/response pairs,
   re-run against the live NestJS responses, to surface any divergence 5.10's manual sweep
   did not catch.
2. The owner's own reports from using the live app, logged as they occur.

**Stories**
- [ ] 14.1 - Automated parity re-check. Take story 5.10's recorded pre-cutover
  request/response pairs and re-run each request against the live NestJS backend, diffing
  the recorded pre-cutover response against the current one. Every silent divergence found -
  a difference not already recorded as one of the two intentional-divergence categories in
  `inventory-endpoint-contracts.md` (FR-2's auth-posture tightenings, FR-27's ownership
  scoping) - is a regression, and this story fixes it or, if the fix is large enough to need
  its own review, records it as a follow-up item inside this epic rather than closing over it
  silently.
- [ ] 14.2 - Owner-reported bug fixes. An open-ended container for defects the owner reports
  from manual use of the live app after cutover. Empty until reports arrive; each reported
  bug is investigated and fixed as its own tracked item added to this story (or split into
  its own story if a single fix is large), with no bug closed without a recorded root cause
  in the file or endpoint it came from.

### Epic 8: Deferred cleanup - NOT IN SCOPE

Listed for completeness and sequencing only. **No story here may be started under this
initiative.** It requires its own separate approval after Epics 1-7 are signed off, at
which point it should be re-planned as its own initiative. This epic is where deferred
decisions are parked so they stay visible - 8.5 in particular is the scheduled follow-up
to a decision made deliberately in story 1.6, not a loose end.

**Stories (deferred)**
- [ ] 8.1 - Remove the superseded route handlers under `src/app/api/` (excluding
  anything still in use).
- [ ] 8.2 - Remove the superseded `src/server/` code, including `dbService.ts`, the
  helpers, and `src/server/auth.ts`.
- [ ] 8.3 - Remove NextAuth and Prisma dependencies from the frontend package.
- [ ] 8.4 - Delete the dead `src/app/api/_nextApiCompat.ts` shim.
- [ ] 8.5 - Fix the 46 frontend type errors and remove `typescript.ignoreBuildErrors` from
  `next.config.js`, so `next build` type-checks. This is the story's **entire** scope. The
  frontend's Node runtime is *not* part of it, having moved to story 1.2a, and
  `eslint.ignoreDuringBuilds` is no longer part of it either: under NFR-2 as amended, lint
  fails no build anywhere, so that flag stays on permanently and removing it would put a
  lint gate back into an image build. Story 1.6 recorded the count and the reason for
  deferring the type errors; this is that deferral coming due. Much of the count will have
  shrunk by then, since 8.1-8.4 delete a large share of the code the checker is complaining
  about - which is also why it is sequenced after them rather than before.
- [ ] 8.6 - Collapse the now-unneeded switchable seams: Epic 6's auth seam, and the
  legacy-path branch of Epic 10's generated-client seam (FR-25), whose only reason to exist
  was reaching the Next.js routes during coexistence. Once 8.1 deletes those routes the
  branch is unreachable, and the seam reduces to a plain base URL.
- [ ] 8.7 - Delete what remains of `frontend/types/global.d.ts`. Epic 9 removes every
  client-side consumer, but FR-23 keeps the declarations that `dbService.ts`, the two
  `src/server/helpers/` files, and nine `src/app/api/` handlers still import, because
  GR-1 forbids editing them. Stories 8.1 and 8.2 delete those importers, at which point
  the file has no consumers left. Sequenced after them for that reason.

## Execution graph

<!-- Scheduling data, read by /bmad:run. Epics run one at a time. -->

- **Epic 1** depends-on: none
- **Epic 2** depends-on: 1
- **Epic 3** depends-on: 2
- **Epic 4** depends-on: 3
- **Epic 9** depends-on: 4
- **Epic 10** depends-on: 4, 9
- **Epic 5** depends-on: 4, 9, 10
- **Epic 6** depends-on: 4, 9, 10
- **Epic 11** depends-on: 5
- **Epic 7** depends-on: 5, 6, 11
- **Epic 12** depends-on: 6, 7
- **Epic 13** depends-on: 7, 12
- **Epic 14** depends-on: 13
- **Epic 8** depends-on: OUT OF SCOPE

**Epic 14 is the prerequisite for whenever Epic 8 is proposed.** Epic 8 deletes the
`src/app/api/` and `src/server/` code GR-1 has protected for the whole initiative, and doing
that while the NestJS backend that replaces it still has unknown regressions would remove
the last fallback this initiative keeps in place. `depends-on: OUT OF SCOPE` on Epic 8's own
line is unchanged - approving Epic 8 still requires a new PRD, not an edit to this line - but
whoever writes that future PRD's execution graph should not schedule Epic 8 to depend on
anything earlier than Epic 14's completion. Epic 14 exists specifically to find and fix
post-cutover regressions before that deletion is even proposed, and a driver reading this
graph after Epic 13 completes should draft Epic 14 next, via `bmad-sm`, rather than treat the
chain as finished.

This initiative is close to a straight chain. Epics 9, 10 and 11 are the three places the
graph carries information the numbering does not, and the first two carry it in two
directions.

```
1 ──> 2 ──> 3 ──> 4 ──> 9 ──> 10 ──> 5 ──> 11 ──> 7 ──> 12 ──> 13 ──> 14
                               └──> 6 ───────────┘
```

**Epic 11 is the third late-numbered epic that belongs early, and its two lines say different
things.** `depends-on: 5` is a code dependency - there is no delete endpoint to scope until
Epic 5 has written one. Epic 7's `depends-on: ... 11` is the interesting one: it is not a code
dependency at all, since the cutover flips configuration and would work perfectly with the
unscoped delete in place. It is FR-27's timing constraint written as a dependency, because
that is the only form the driver can read. While both routes run, the tightening is diffable
against the old route and lands as a recorded divergence; after 7.2 flips the target there is
no old route left to diff and the same edit is an unscoped change to live behavior. Left
implicit, "before Epic 7" is a sentence someone has to remember at exactly the moment they are
busy with a cutover.

Epic 11 could be pulled forward to run immediately after Epic 5, ahead of Epic 6, and nothing
would break - it shares no file, no seam and no requirement with Epic 6. The driver will pick
6 first because 6 is the lower number and both are eligible, and that default is fine. The
order between them carries no meaning; the only ordering that matters is that both precede 7.

**Epic 10 runs next, and the graph is what makes that happen.** The driver takes the
lowest-numbered epic whose `depends-on` list is fully satisfied. Epic 10 carries the highest
number in this PRD, so `depends-on: 4, 9` alone would not be enough - with Epics 1-4 and 9
complete, Epics 5 and 6 would both be eligible and both would be picked ahead of it. The
ordering therefore has to be stated as dependencies of 5 and 6 on 10, which it is. This is
exactly the situation Epic 9 was in one epic ago, for the same structural reason: a
late-numbered epic that belongs early.

Both new dependencies are real, not bookkeeping:

- **Epic 5 on 10.** Epic 5's ten stories each touch DTOs. Under Epic 9's pipeline every one
  of them would also hand-edit `frontend/types/contracts.ts`, the hand-written alias file
  Epic 10 deletes. Running Epic 5 first means paying that maintenance ten times for a file
  that is about to be removed.
- **Epic 6 on 10.** Story 6.2 builds the seam over "how does the frontend learn who is
  logged in", and Epic 7 flips it to NestJS. After Epic 10 the Nest side of that seam is a
  *generated* operation, so the seam should be designed around the generated client rather
  than around a hand-written fetch that would then be deleted. This is the same argument
  that already makes Epic 6 depend on 4 - do not design an abstraction while guessing at one
  of the two implementations it spans.

Listing 9 alongside 10 on both lines is redundant, since 10 depends on 9. It is left
explicit because the lines are read by a scheduler and by people, and a transitive
dependency that has to be computed is one a reader can get wrong.

**Epic 10 could not have been pulled further forward, though for a weaker reason than this
line originally gave.** The original reasoning was that Epic 10 reads
`backend/openapi.json`, which story 9.2 produces. As Epic 10 shipped it reads the live
Swagger JSON instead, so that file dependency is gone and only Epic 4's running backend is
strictly needed to generate against. What remains real is that Epic 10 deletes the artifacts
stories 9.3, 9.5 and 9.6 created and depends on 9.1's DTO reconciliation for the spec to be
worth generating from. It ran immediately after Epic 9, which is the earliest that mattered.
Had the Orval decision been taken earlier, Epic 9 would have reduced to its reconciliation
and `packages/shared` stories, and its whole snapshot pipeline need never have been built.

**Epic 10 is one epic, not two, and that is a decision rather than a default.** The obvious
split is types now, hooks after Epic 5, on the grounds that generated hooks point at NestJS
and NestJS returns 501 until Epic 5 implements the endpoints. FR-25's seam removes that
constraint by mapping spec paths onto the Next.js routes during coexistence, so both halves
land here. The split is the fallback if story 10.2 finds routes that cannot be mapped: those
routes' hooks would move to Epic 7, and the epic would say which ones and why.

**Why Epic 6 says 4 and not 1.** Epic 6 could technically be *built* right after Epic 1 -
it only edits frontend call sites, and its default values keep today's behavior exactly,
so nothing it produces needs the backend to exist. That reading is what `depends-on: 1`
would express, and it is wrong for story 6.2.

6.2 builds a seam that abstracts over "how does the frontend get the current session",
which Epic 7 then flips from NextAuth to NestJS. Building that abstraction before Epic 4
exists means designing it against one implementation while guessing at the other, which
is the standard way to end up with a seam that leaks and needs reworking at the moment of
cutover - precisely when Epic 7 is supposed to be a configuration change and nothing
else. After Epic 4, both sides of the abstraction are known.

The old story 6.1, the data base-URL seam, was the one part of Epic 6 with no such coupling,
and this section previously noted it could be pulled forward on its own. It no longer can be,
because it no longer exists - Epic 10 absorbed it into FR-25.

**Epic 12 is the one epic here that is held back rather than pulled forward, and it cannot
be brought early.** Both its dependencies are real and they are different in kind. `6` is a
code dependency in the plainest sense: the two files it relocates do not exist until story
6.2 has written one of them, so there is nothing to move before then. `7` is a collision
constraint - Epic 12 edits `frontend/src/middleware.ts` and both seam files, which are
exactly what story 7.1's flip is exercised through, and Epic 7 is built on nothing being
written there beyond configured values so that a post-flip regression has one possible cause.
Running 12 first, or between 7.1 and 7.2, would give it two. Listing `6` when `7` already
implies it is the same deliberate redundancy as listing `9` beside `10` above.

Read the pairing as the graph doing its job in the unusual direction: everything else here is
noted for being *earlier* than its number suggests, and this one is a small, self-contained
path change that would otherwise look eligible the moment Epic 6 lands.

**Epic 13 is the second epic held back, and its two dependencies are different in kind.**
`7` is the content dependency: the documentation describes the shipped topology, and the
topology is not shipped until the cutover flips. It also transitively carries the fact the
`OBSERVABILITY.md` correction rests on - story 5.9's backend metrics endpoint and its
`nestjs-backend` scrape job - which is why `5` is not listed separately; the chain 5 → 11 → 7
already delivers it and a third number on the line would suggest a constraint that is not
doing any work. `12` is a staleness constraint rather than a code one: Epic 13 writes a
repo-layout section naming paths under `frontend/src`, and Epic 12 moves two of them, so
documentation written first would ship a section that is wrong one epic later. Listing `7`
when `12` already implies it is the same deliberate redundancy as listing `6` beside `7` on
Epic 12's own line.

Nothing about this epic is technically hard enough to need the wait - every fact in it is
true from the end of Epic 7 except the two paths Epic 12 moves - so the honest statement is
that it is held back for accuracy, not capability. If Epic 12 were ever cancelled, Epic 13
becomes `depends-on: 7` and can run immediately.

**One thing this line deliberately does not carry.** Between Epic 12 completing and Epic 13
starting, a `bmad-architect` pass repoints the five `architecture.md` citations that story
12.2 makes stale; Epic 13's section states the constraint and `architecture.md`'s D64 states
the ruling behind it. It is an obligation between two epics rather than an epic of its own,
so it has no number to depend on and `depends-on: 7, 12` stays exactly as written. The
driver will treat Epic 13 as eligible the moment Epic 12 is signed off, which is correct -
the pass belongs in that sign-off-to-drafting gap, and it is Epic 13 that pays for it being
skipped, since story 13.1 would then copy its layout paths from pre-move citations.

**Epic 8 is fenced off.** `depends-on: OUT OF SCOPE` is a dependency nothing can satisfy,
so the driver will never start it. Approving that work means a new PRD, not an edit to
this line.

## Success Criteria

1. The repo is a pnpm workspace with `frontend/` and `backend/`; repo-wide concerns
   (`docker/`, `nginx/`, `monitoring/`, `docs/`, `.claude/`, compose files) remain at
   root per the story 1.1 inventory. Both packages run on Node 24 - pinned by
   `frontend/Dockerfile`, the root `.nvmrc`, and `engines` on both manifests - from
   story 1.2a onward, so no parity evidence in this initiative was gathered on a runtime
   that is not the shipped one.
2. `docker compose up` from cold brings up `next-app`, the NestJS backend, MySQL, Redis,
   nginx, and the full observability stack, reachable over the local HTTPS dev flow.
3. All 19 endpoints in FR-1 are served by NestJS, and the recorded parity sweep (5.10)
   shows responses identical to the Next.js originals - including the pre-formatted
   strings of FR-3 - for the same user and inputs. Exactly two categories of intentional
   difference exist, both in the divergence table of `inventory-endpoint-contracts.md`:
   FR-2's seven auth-posture tightenings, and FR-27's ownership scoping of
   `DELETE /transaction/:id`, whose divergence is confined to a caller asking to delete a
   row they do not own.
4. The generated Swagger UI documents every endpoint with request/response DTOs, a
   per-domain tag, realistic examples, and a visible auth posture; it was reviewed and
   signed off at Epic 2's GR-2 gate *before* implementation began.
5. Login, logout, and stay-logged-in work against the existing `User` table and bcrypt
   hashes with no password resets; `rememberMe` yields 8-hour vs 30-day lifetimes;
   `src/app/page.tsx` and `src/app/login/page.tsx` still gate server-side.
6. `dbService.ts`'s logic is spread across per-domain injectable Nest services; no god
   service exists; the EntityManager, current user, and clock are injected everywhere
   (NFR-1), such that unit tests could be written next with no restructuring.
7. MikroORM entities cover all seven models against the unchanged MySQL 5.7 schema; the
   Prisma migration history is untouched; no schema or data change occurred.
8. Metrics, Redis, and logging all work from the backend: Prometheus scrapes both
   services, the `METRICS_SECRET` guard returns `403 Forbidden` on a bad token, and
   Grafana dashboards show backend logs from Loki.
9. Every file under `src/app/api/` and `src/server/` that existed at the start still
   exists (relocated under `frontend/` only), and the frontend can be reverted to them
   by configuration alone.
10. The frontend's React components and MUI Joy/Tailwind styling are unchanged apart from
    the auth seam in Epic 6, the swap to the generated client in Epic 10, and the seam's
    refiling in Epic 12, which changes an import path in `page.tsx` and `login/page.tsx` and
    nothing else about either. React Query is
    still the data layer and its call sites are still `useQuery` with a `queryKey` and a
    `queryFn`; what changed is that Orval writes them. No component's control flow was
    restructured to accommodate a hook (GR-7), and no page renders differently.
11. The frontend's `next.config.js` type/lint suppression is unchanged, and story 1.6
    records the error count and the rationale for leaving it that way, with story 8.5
    carrying the type errors as scheduled follow-up. No lint step fails any image build:
    the backend and `packages/shared` are gated by type checking alone, which `nest build`
    and `tsc` enforce inherently.
12. No client-side frontend file hand-declares a backend response shape, and none writes an
    HTTP call to one either. Models and TanStack Query hooks are generated by Orval from the
    backend's live Swagger JSON into the committed `frontend/src/api/generated.ts`, so a
    clean checkout typechecks and both images build with no database, no network and no
    running backend. Keeping that file current is the developer's job at commit time
    (FR-26); no build or CI step checks it, by explicit owner ruling. No hand-written file
    sits between the DTO and the consumer except the Orval mutator at
    `frontend/src/api/http-client.ts`, which is the transport - `frontend/types/api.d.ts`,
    `frontend/types/contracts.ts` and `backend/openapi.json` are all gone, as are
    `scripts/generate-api-contract.mjs`, the `openapi-typescript` dependency and the
    deprecated `react-query` v3 package.
    `packages/shared` exports only `SessionClaims`, `SESSION_ALGORITHM`, and
    `SESSION_COOKIE_NAME` - the contracts with no HTTP representation. What survives in
    `frontend/types/global.d.ts` is exactly what GR-1-protected legacy code still imports,
    marked as such, and scheduled for deletion in story 8.7.
13. A developer with a clean checkout can bring the stack up from `README.md` alone: the
    pnpm workspace layout, the pinned Node 24 / pnpm 11 toolchain, and the
    `next-app` + `nest-api` topology behind nginx are written down, and every path it names
    is the post-Epic-12 path. `OBSERVABILITY.md`'s `METRICS_SECRET` rotation procedure
    covers all three consumers of that secret, so following it as written leaves no service
    running on the old value.
