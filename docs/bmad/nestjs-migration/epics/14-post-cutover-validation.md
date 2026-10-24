# Epic 14: Post-cutover validation and regression fixing

Status: Complete

Stories: 14.1, 14.2, 14.3, 14.3a
Depends on: 13
Base commit: 2a1801c

## Scope

Find and fix regressions in the live NestJS backend and the cut-over frontend that story
5.10's pre-cutover parity sweep either did not catch or that appeared after it ran (Epics 7,
11, 12, 13). Two sources feed it: an automated re-run of 5.10's recorded request/response
pairs against the live backend (14.1), and an open-ended container for bugs the owner reports
from using the live app (14.2). A sweep that finds nothing is a valid, completed outcome - this
epic's product is knowledge of what is actually broken, not a presupposed list of defects.

This is the prerequisite for whenever Epic 8 is proposed. Epic 8 deletes the `src/app/api/`
and `src/server/` code GR-1 has protected for the whole initiative, and doing that while the
NestJS backend that replaces it still carries unknown regressions would remove the last
fallback - reversibility (NFR-5) still points the frontend's configured seams at the legacy
routes, but once those routes' code is gone that reversibility is gone too. Epic 8 stays
`depends-on: OUT OF SCOPE` and out of scope for this initiative; this epic only establishes
that whoever later proposes Epic 8 should not schedule it ahead of this one's completion.

**Three known-open items considered for this epic's scope and excluded, deliberately:**

- **Epic 13's F2** (`OBSERVABILITY.md`'s "Local Development Notes" section overstating what
  `--enable-feature=expand-external-labels` substitutes) is a documentation accuracy defect,
  not a regression in the live backend or frontend. It is Epic 13's own follow-up (that epic's
  Owner Feedback records it as shipping open), not this epic's.
- **The Prometheus `403`/`down` scrape-target bug** predates the cutover entirely - story 5.9
  found it in Epic 5, before Epic 7 ran, and the owner has explicitly ruled it "pre-existing
  and outside this initiative" three times now (Epic 5's Owner Feedback, story 7.3's Dev Notes,
  and story 13.2's Out of Scope). It is not a post-cutover regression and not something 5.10's
  sweep was checking for is missing coverage on; folding it in here would silently reopen a
  decision the owner has already made three separate times without a new instruction to do so.
- **`monitoring/prometheus.yml:11`'s stale inline comment** contradicting `OBSERVABILITY.md`'s
  corrected rotation steps is leftover Epic 13 cleanup in a config file, not a backend or
  frontend behavior regression. It touches a file no Epic 14 story has reason to open.

If the owner wants any of these three folded in, that is a scope amendment to this epic (or a
new story), not something either 14.1 or 14.2 is written to absorb by default.

## Changed Files

~ `frontend/src/components/product/LineChart.tsx`  SSR-safe viewport helper; fixes the `/product` 500
~ `backend/src/main.ts`                            10mb JSON body limit; fixes the price-history 500 storm
~ `frontend/src/context/CoinbaseWsFeedContext.tsx`  readyState-driven socket lifecycle; fixes the blank-page crash

Story 14.1 changed no files (its sweep found no regression). Story 14.2 has no owner reports
yet. The first two files come from story 14.3, the third from story 14.3a.

## Review Notes

Entering review with story 14.2 still `Ready` rather than `Done`. 14.2 is the open-ended
container for owner-reported bugs and has no work product of its own; it stays open until the
owner reports a defect or decides it closes empty. Every story that produced code - 14.1
(none), 14.3, 14.3a - is `Done`, so the epic's diff is complete and reviewable now.

The per-story commits `06300c5` (story 14.3) and `5be002c` (story 14.3a) were soft-reset away
after round 2, so the epic is now one uncommitted diff on top of base `2a1801c` - the form the
owner reviews and the single epic commit is made from. Read it with `git diff HEAD`. Rounds 1
and 2 below were reviewed against those commits; the content is unchanged by the reset.

### Round 1

Depth: `frontend/src/context/CoinbaseWsFeedContext.tsx` deep (socket lifecycle, reconnect/concurrency, live consumers) · `backend/src/main.ts` deep (request-parsing boundary, global bootstrap with live consumers) · `frontend/src/components/product/LineChart.tsx` standard.

Reviewed `git diff 2a1801c..HEAD` (commits `06300c5`, `5be002c`; working tree clean apart from `frontend/next-env.d.ts` and untracked docs). Verified independently rather than on Dev Notes' word: `usePriceFeed` is byte-identical to `2a1801c` and no other export was lost in the rewrite (whole-file diff against the base, not just the hook); frontend typecheck reproduces exactly 15 errors with the only one in a changed file being the pre-existing `VerticalLiner` plugin-type error at `LineChart.tsx:128`; `LineChart.tsx` has no remaining unguarded browser globals; Nest 11's `useBodyParser` mechanism was checked against the installed adapter source rather than assumed.

`app.useBodyParser('json', { limit: '10mb' })` is the right mechanism here: `ExpressAdapter.useBodyParser` (`backend/node_modules/@nestjs/platform-express/adapters/express-adapter.js:201`) registers the parser immediately, and `NestApplication.init()`'s later `registerParserMiddleware` filters by `isMiddlewareApplied('jsonParser')`, so the 100KB default is never added. Even if that name check missed, ours is registered first and body-parser skips a request whose `_body` is already set. It does not interact with the global prefix, `cookieParser`, the validation pipe or the metrics interceptor - it only moves JSON parsing ahead of `cookieParser` in the stack, which nothing depends on.

Story 14.3's five dispositioned-away findings check out. F5 is confirmed: `frontend/src/app/providers.tsx:34` mounts `SessionProvider` unconditionally, so the legacy `GET /api/auth/session` is the coexistence design GR-1 and NFR-5 require, not a regression. F7 is confirmed and is documented in the code itself - `frontend/src/_hooks/useStorePriceHistory.ts:6-9` states the browser must call crypto.com directly because that API blocks server-side requests. F3's re-triage (downstream of F2, not the pre-existing miss 14.1 recorded) is consistent with the cache-fill path. F6 and F8 are within the story's stated thresholds.

- **F1** [blocking · correctness] `frontend/src/context/CoinbaseWsFeedContext.tsx:85-95` - the reconnect decision is nested inside the new-product check, so after a socket close no already-subscribed product can ever trigger a reconnect.

  ```ts
  if (!this.unitsSubscribedMap[product_id]) {
    console.log(`Sending new subscription for "${product_id}"`);
    this.unitsSubscribedMap[product_id] = { lastCalled: null };

    if (this.isOpen) {
      this.trySend(subscribeMessage(product_id, 'subscribe'));
    } else {
      // Reopens a socket that errored or closed; a no-op while one is still connecting.
      this.connect();
    }
  }
  ```

  "Is this a new product?" and "does the socket need reopening?" are independent questions, and this change couples them. The same commit deliberately stops `close()` from clearing `unitsSubscribedMap`, so after any close or error every currently-subscribed product is still in the map - which is exactly the set for which the `connect()` branch is now unreachable. Concrete failure: the Coinbase socket drops (idle disconnect or a network blip) while `/stats` is mounted; a component that then mounts and subscribes an already-mapped product - a second consumer of the same `product_id`, of which `/stats` has four per row (`CurrentPrice`, `DeltaColumn`, `HoldingsColumn`, `ProfitLossColumn`) and `/product` has two - falls through the `if` entirely, attaches its listener to a dead feed, and never reconnects. The ticker then stays frozen for the life of the page with no console error, because `trySend` and `connect` are both silent no-ops now; the pre-fix code at least logged `WebSocket not connected, cannot add subscription`. Story 14.3a's AC 5 required the post-close behavior to be "deliberate and stated", and its Dev Notes state `addSubscription` "calls `connect()` ... a genuine reconnect after a close" - that is true only for products absent from the map, i.e. not the ones that were live when it closed. The browser verification could not have caught this: under Strict Mode the child unsubscribes run before the provider's `close()`, so the map is empty at remount and the new-product path is the one exercised. Hoisting the `isOpen`/`connect()` decision out of the `if` fixes it and preserves the replay behavior, since the `open` handler already sends the whole map.
  - Status: Open

- **F2** [advisory · correctness] `backend/src/main.ts:19-21` - the 10mb limit's stated headroom does not exist end to end; nginx caps the same requests at 1MB.

  ```ts
  // App Router route handlers enforce no body-size limit, so the price-history payloads
  // (a coin's full daily series, ~250KB and growing) exceed Express's 100KB default.
  app.useBodyParser('json', { limit: '10mb' });
  ```

  `nginx/nginx.conf` sets no `client_max_body_size` in either the `/backend/` block (line 64) or the server block, so the directive's 1MB default applies to every browser request reaching `nest-api`. The 232KB payloads pass today and this is not a live defect or a regression - the legacy Next route sat behind the same proxy - but the reason recorded for choosing 10mb over a tighter bound ("these series grow by one entry per day") is answered by nginx, not by Nest: growth past ~1MB produces a 413 at the proxy while Nest's limit is still eight-ninths unused. Either raise `client_max_body_size` on the `/backend/` location to match, or record that 1MB is the real ceiling.
  - Status: Open

### Round 2

Depth: `frontend/src/context/CoinbaseWsFeedContext.tsx` deep (the only file changed since round 1) - nothing else in the diff moved, so `backend/src/main.ts` and `LineChart.tsx` are carried over from round 1 unchanged.

Reviewed `git diff 2a1801c` including the uncommitted working tree. The only change since round 1 is the five-line hoist in `addSubscription`. Frontend typecheck still reports exactly 15 errors, matching the round 1 baseline, and eslint on the file is clean - both re-run here rather than taken from Dev Notes.

**F1's fix is correct and closes the finding.** `addSubscription` now records the product and, only for a genuinely new one, sends the subscribe frame; the `if (!this.isOpen) this.connect();` that follows is reached for every subscriber regardless of map state, which is exactly the case that was unreachable before.

**No connect storm, and the CONNECTING guard is sufficient.** `new WebSocket(url)` sets `readyState` to CONNECTING synchronously in the constructor, and `connect()` assigns `this.ws` on the next statement, so by the time control returns to the caller the instance already reports `isConnecting`. Since all of this is single-threaded with no await between the check and the assignment, consumers 2..n mounting in the same tick - the `/stats` case, four consumers per row - hit `connect()`'s early return and share the one socket. The same holds when the socket is CLOSING or CLOSED: the first caller replaces `this.ws` with a CONNECTING socket and every later caller in that batch no-ops. `connect()` is only ever reached from a subscriber mounting, never from a retry, so the number of socket attempts is bounded by the number of mounts and cannot spin.

**The replay is correct and does not double-subscribe.** A product added to the map while the socket is down is not sent at subscribe time (`isOpen` is false, so the `trySend` branch is skipped) and is picked up by the `open` handler, which iterates the map once per socket. Each socket gets its own `open` listener via `addEventListener`, and a socket fires `open` at most once, so no product can be sent twice on the same connection. Products that were already mapped before the drop are in that same iteration, so they are restored by the identical path - one frame each, which matches the single replayed BTC-USD frame recorded in Dev Notes.

I also checked the one coupling this design could have gone wrong on: the `open` listener closes over `this` and sends via `this.ws`, not over the socket it was installed on, so it would send on the wrong socket if `this.ws` were ever replaced while an earlier socket could still open. It cannot be. `connect()` refuses to replace an OPEN or CONNECTING socket, so `this.ws` is only ever reassigned when the previous socket is CLOSING or CLOSED - and a socket closed during its handshake fails the connection rather than firing `open`. Not a finding, recorded so a later reader does not have to re-derive it.

**On isolating the already-mapped sub-case.** The limit Dev Notes states is fair - consumer 1 always takes the not-yet-mapped branch and masks consumers 2..n - and the fix is small enough to rest on reading. If it is worth closing later, the way to isolate it is to stop driving the class through React and call it directly: reach the feed instance through the React DevTools global hook (`__REACT_DEVTOOLS_GLOBAL_HOOK__`), walking the fiber tree to `CoinbaseWsProvider`'s ref, then from the console run `feed.close()` followed by `feed.addSubscription('BTC-USD', () => {})` while a mounted consumer still holds `BTC-USD` in the map. That is precisely the consumer-2 call with no unmount to clear the map, and it A/Bs cleanly: the pre-fix code opens no new socket and stays frozen, the fixed code opens one and replays. Worth doing only if this file is reworked again; not something to hold this epic for.

- **F1** [blocking · correctness] `frontend/src/context/CoinbaseWsFeedContext.tsx:85-99` - reconnect nested inside the new-product check.
  - Status: Resolved (round 2 - hoist verified; no redundant sockets, no double-subscribe)

- **F2** [advisory · correctness] `backend/src/main.ts:19-21` - nginx's 1MB `client_max_body_size` default is the real ceiling, not the 10mb Nest limit.
  - Status: Open (advisory, deliberately not folded in; carried to the owner as infrastructure headroom)

No blocking findings remain open. Epic goes to Owner Review with F2 outstanding as advisory.

## Owner Feedback

Approved 2026-08-28 with no changes requested, at the gate presenting the three-file diff, the
two review rounds and the three open items below.

Story 14.2 closes empty. It was presented at the gate as `Ready` with no owner reports, and the
approval covers the epic in that state - which this epic's own Scope names as a valid outcome:
"a sweep that finds nothing is a valid, completed outcome ... this epic's product is knowledge
of what is actually broken, not a presupposed list of defects." Marked `Done` on that basis
rather than left `Ready` inside a `Complete` epic.

Two items were surfaced at the gate and are **not** addressed by this epic. Neither was
approved as work; both are recorded so they are not silently lost:

- **Reviewer F2, advisory, still open.** `nginx/nginx.conf` sets no `client_max_body_size`, so
  nginx's 1MB default - not the 10mb Nest limit this epic added - is the real end-to-end
  ceiling. No live impact at today's ~232KB payloads. Either raise it on the `/backend/`
  location or record 1MB as the true ceiling.
- **`frontend/src/components/TopNav.tsx` is dead code.** Orphaned when the auth-seam
  consolidation moved the component to `top-nav/`; imported by nothing, still importing
  `useSession`/`signIn`/`signOut` from `next-auth/react`. Not a defect, and deliberately outside
  both stories' scope.

One verification limit, also surfaced at the gate: story 14.3a's already-mapped reconnect
sub-case rests on the code change and the reviewer's reading, not an isolated browser repro.
Story 14.3a's Dev Notes state why it resists isolation and the reviewer recorded a way to close
it if it is ever worth doing.
